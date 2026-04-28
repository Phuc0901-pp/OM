import React, { useState, useEffect, useRef, useMemo } from 'react';
import ReactDOM from 'react-dom';
import { X, SwitchCamera, ZoomIn, ZoomOut, Square, Check, FastForward } from 'lucide-react';
import { drawWatermarkFrame, addWatermarkToImage, addWatermarkToBlob, getReverseGeocode, getStaticMapImage, resources, loadResourcesPromise } from '../../utils/watermarkUtils';
import { ImageEditor } from './ImageEditor';
import logoSrc from '../../assets/logo.png'; // Need logo for video frame drawing
import { useLocationStore, selectCoordString } from '../../stores/useLocationStore';

const PreviewVideo = ({ blob }: { blob: Blob }) => {
    const url = useMemo(() => URL.createObjectURL(blob), [blob]);

    useEffect(() => {
        return () => URL.revokeObjectURL(url);
    }, [url]);

    return <video src={url} controls autoPlay className="w-full h-full object-contain" playsInline />;
};

interface CameraModalProps {
    isOpen: boolean;
    onClose: () => void;
    onCapture: (data: (string | Blob)[]) => void; // Support Multi-Capture
    requiredImageCount?: number;
    existingImageCount?: number; // New Prop
    status_set_image_count?: boolean; // New Prop: if true, enforce requiredImageCount
    // Continuous capture: if provided, show "Next Asset" button
    nextTaskName?: string | null;
    onNextTask?: (data: (string | Blob)[]) => void;
    watermarkInfo?: string[];
}

interface CapturedItem {
    id: string;
    data: Blob; // Always Blob — memory-efficient, no Base64 / double-encode
    objectUrl: string; // Revocable display URL created from data Blob
    type: 'photo' | 'video';
    selected: boolean;
}

const CameraModal: React.FC<CameraModalProps> = (props) => {
    const { isOpen, onClose, onCapture, requiredImageCount = 0, status_set_image_count = true, nextTaskName, onNextTask, watermarkInfo = [] } = props;
    // Refs
    const isMountedRef = useRef(true);
    useEffect(() => {
        return () => {
            isMountedRef.current = false;
        };
    }, []);

    const videoRef = useRef<HTMLVideoElement>(null);
    const videoContainerRef = useRef<HTMLDivElement>(null);
    const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
    const canvasRef = useRef<HTMLCanvasElement | null>(null); // For Photo Capture
    const processCanvasRef = useRef<HTMLCanvasElement | null>(null); // For Video Processing
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const animationFrameRef = useRef<number | null>(null);
    const recordedChunksRef = useRef<Blob[]>([]);

    // Track dynamic sizes
    useEffect(() => {
        if (!isOpen || !videoContainerRef.current) return;
        const observer = new ResizeObserver((entries) => {
            const entry = entries[0];
            if (entry) {
                setContainerSize({ width: entry.contentRect.width, height: entry.contentRect.height });
            }
        });
        observer.observe(videoContainerRef.current);
        return () => observer.disconnect();
    }, [isOpen]);

    // State
    const [mode, setMode] = useState<'photo' | 'video'>('photo');
    const [stream, setStream] = useState<MediaStream | null>(null);
    const mediaStreamRef = useRef<MediaStream | null>(null); // To fix unmount closure
    const [cameraCount, setCameraCount] = useState(0);
    const [isFrontCamera, setIsFrontCamera] = useState(false);
    const isFrontCameraRef = useRef(false);

    // V18: Core WebRTC Camera Refs
    const camerasRef = useRef<MediaDeviceInfo[]>([]);
    const currentDeviceIdRef = useRef<string | null>(null);
    const hasInitializedRef = useRef(false);
    const [flashMsg, setFlashMsg] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false); // Prevent double-submit

    // ── GPS from global store (pre-fetched, zero latency) ─────────────────────
    const gpsStore = useLocationStore();
    const gpsLocation = selectCoordString(gpsStore); // "lat, lng" string or null
    const storeMapImg = gpsStore.mapImage; // already loaded HTMLImageElement
    const storeAddress = gpsStore.address; // already reverse-geocoded string

    // Flash state
    const [isFlashOn, setIsFlashOn] = useState(false);
    const [hasFlash, setHasFlash] = useState(false);
    const [shutterFlash, setShutterFlash] = useState(false); // New shutter flash state

    // Live ticking time for the Watermark Preview
    const [currentTime, setCurrentTime] = useState(new Date());

    useEffect(() => {
        if (!isOpen) return;
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, [isOpen]);

    // ─────────────────────────────────────────────────────────────────────────
    // V18 CAMERA CORE — Clean Architecture
    // Designed for: Android Chrome, MTK/Xiaomi, Samsung Internet, iOS Safari
    // ─────────────────────────────────────────────────────────────────────────

    /**
    * stopStream (V18)
    * Full video-pipeline reset: pause → null srcObject → load()
    * The extra .load() call forces mobile WebView to discard its decode pipeline,
    * preventing the black-screen freeze that appears when srcObject is merely nulled.
    */
    const stopStream = () => {
        if (videoRef.current) {
            videoRef.current.pause();
            videoRef.current.srcObject = null;
            videoRef.current.load(); // Flush mobile decode pipeline
        }
        if (mediaStreamRef.current) {
            mediaStreamRef.current.getTracks().forEach(t => t.stop());
            mediaStreamRef.current = null;
        }
        if (stream) {
            stream.getTracks().forEach(t => t.stop());
            setStream(null);
        }
        if (timerRef.current) clearInterval(timerRef.current);
        if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };

    /**
    * getTargetDeviceId (V18)
    * Match a camera by label keywords — safe, no index guessing.
    * Camera ordering varies wildly across manufacturers:
    * iPhone → [wide, ultra, tele, FRONT] (front is last)
    * Xiaomi → [FRONT, back, macro, depth] (front is first)
    * Samsung → [back, FRONT, ultra, tele] (mixed)
    * Using label keywords is the only reliable cross-device strategy.
    * Falls back to undefined so the caller can use facingMode.
    */
    const getTargetDeviceId = (wantFront: boolean, devices: MediaDeviceInfo[]): string | undefined => {
        const frontKw = ['front', 'user', 'trước', 'selfie', 'face'];
        const rearKw = ['back', 'rear', 'environment', 'sau', 'main', 'wide'];
        const keywords = wantFront ? frontKw : rearKw;

        const match = devices.find(d => {
            const label = d.label.toLowerCase();
            if (!label) return false;
            return keywords.some(kw => label.includes(kw));
        });
        return match?.deviceId;
    };

    /**
    * startStream (V18)
    * Priority order:
    * 1. exact deviceId from label-matched list (most reliable)
    * 2. ideal facingMode (browser picks best match, no exceptions)
    * 3. bare video request (last resort)
    * Uses ideal (NOT exact) for facingMode because:
    * - `exact` throws OverconstrainedError on Safari
    * - `exact` is silently ignored on many Android Chrome builds
    */
    const startStream = async (wantFront: boolean, retryCount: number = 0): Promise<void> => {
        console.log(`[CAMERA_DEBUG] startStream(wantFront=${wantFront}, retry=${retryCount})`);
        stopStream();
        // Give hardware HAL time to release — MTK devices need ~600ms minimum
        await new Promise(r => setTimeout(r, 600));

        if (!isMountedRef.current) return;

        const tryGetStream = async (constraints: MediaStreamConstraints): Promise<MediaStream> => {
            return navigator.mediaDevices.getUserMedia(constraints);
        };

        const baseVideo: MediaTrackConstraints = {
            width: { ideal: 1920 },
            height: { ideal: 1080 },
            frameRate: { ideal: 30, max: 60 }
        };

        let newStream: MediaStream | null = null;

        // Attempt 1: exact deviceId (label-matched from our enumerated list)
        const cachedDevices = camerasRef.current;
        const targetId = cachedDevices.length > 0 ? getTargetDeviceId(wantFront, cachedDevices) : undefined;

        if (targetId) {
            try {
                console.log(`[CAMERA_DEBUG] Attempt 1: deviceId=${targetId}`);
                newStream = await tryGetStream({ video: { ...baseVideo, deviceId: { exact: targetId } }, audio: mode === 'video' });
            } catch (e: any) {
                console.warn('[CAMERA_DEBUG] Attempt 1 failed:', e.message);
            }
        }

        // Attempt 2: ideal facingMode (safe across all browsers)
        if (!newStream) {
            try {
                const fm = wantFront ? 'user' : 'environment';
                console.log(`[CAMERA_DEBUG] Attempt 2: facingMode ideal=${fm}`);
                newStream = await tryGetStream({ video: { ...baseVideo, facingMode: { ideal: fm } }, audio: mode === 'video' });
            } catch (e: any) {
                console.warn('[CAMERA_DEBUG] Attempt 2 failed:', e.message);
            }
        }

        // Attempt 3: bare video — absolute last resort
        if (!newStream) {
            try {
                console.log('[CAMERA_DEBUG] Attempt 3: bare video request');
                newStream = await tryGetStream({ video: baseVideo, audio: mode === 'video' });
            } catch (e: any) {
                console.error('[CAMERA_DEBUG] All attempts failed:', e.message);
                if (retryCount < 2) {
                    console.log(`[CAMERA_DEBUG] Scheduling retry ${retryCount + 1}...`);
                    setTimeout(() => startStream(wantFront, retryCount + 1), 1000);
                } else {
                    setFlashMsg(`Lỗi camera: ${e.message || e.name}`);
                }
                return;
            }
        }

        if (!isMountedRef.current) { newStream.getTracks().forEach(t => t.stop()); return; }

        // Stream acquired — wire it up
        mediaStreamRef.current = newStream;
        setStream(newStream);

        if (videoRef.current) {
            videoRef.current.srcObject = newStream;
            videoRef.current.onloadedmetadata = () => {
                videoRef.current?.play().catch(e => console.warn('[CAMERA_DEBUG] play():', e));
            };
        }

        // Read capabilities
        const track = newStream.getVideoTracks()[0];
        const caps = track.getCapabilities?.() ?? {};
        // @ts-ignore
        if (caps.zoom) { setMaxZoom((caps as any).zoom.max ?? 1); setZoom(1); }
        setHasFlash(!!(caps as any).torch);
        setFlashMsg(null);

        // Enumerate cameras once if not yet done (browsers hide labels before permission)
        if (!hasInitializedRef.current) {
            const allDevices = await navigator.mediaDevices.enumerateDevices();
            const videoDevices = allDevices.filter(d => d.kind === 'videoinput');
            camerasRef.current = videoDevices;
            setCameraCount(videoDevices.length);
            hasInitializedRef.current = true;
            console.log(`[CAMERA_DEBUG] Camera list built (${videoDevices.length} devices):`,
                videoDevices.map(d => d.label || d.deviceId.slice(0, 8)));
        }
    };

    /**
    * initCamera (V18)
    * Entry point when modal opens. Starts rear camera then builds the device list.
    */
    const initCamera = async () => {
        isFrontCameraRef.current = false;
        setIsFrontCamera(false);
        await startStream(false);
    };

    /**
    * switchCamera (V18)
    * Clean state flip → stopStream → startStream.
    * No arbitrary 1200ms delay needed because stopStream now does a full pipeline flush.
    */
    const switchCamera = async () => {
        if (cameraCount < 2) {
            setFlashMsg('Thiết bị chỉ có 1 camera');
            setTimeout(() => setFlashMsg(null), 1500);
            return;
        }
        const nextFront = !isFrontCameraRef.current;
        console.log('[CAMERA_DEBUG] switchCamera →', nextFront ? 'FRONT' : 'REAR');
        setIsFlashOn(false);
        setHasFlash(false);
        isFrontCameraRef.current = nextFront;
        setIsFrontCamera(nextFront);
        await startStream(nextFront);
    };

    const [zoom, setZoom] = useState(1);
    const [maxZoom, setMaxZoom] = useState(1);
    const [rotationAngle, setRotationAngle] = useState(0);

    // Recording State
    const [isRecording, setIsRecording] = useState(false);
    const [recordingTime, setRecordingTime] = useState(0);
    const timerRef = useRef<NodeJS.Timeout | null>(null);

    // Multi-Capture State
    const [captures, setCaptures] = useState<CapturedItem[]>([]);
    const [previewItem, setPreviewItem] = useState<CapturedItem | null>(null);
    const [editingItem, setEditingItem] = useState<CapturedItem | null>(null);

    // Track all object URLs created from Blobs so we can revoke them on cleanup
    const objectUrlsRef = useRef<string[]>([]);
    const revokeAllObjectUrls = () => {
        objectUrlsRef.current.forEach(url => URL.revokeObjectURL(url));
        objectUrlsRef.current = [];
    };

    // Load Logo for Video
    const logoRef = useRef<HTMLImageElement | null>(null);
    useEffect(() => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.src = logoSrc;
        img.onload = () => { logoRef.current = img; };
    }, []);

    // ─── Main lifecycle effect (single source of truth) ───────────────────────
    useEffect(() => {
        if (!isOpen) {
            stopStream();
            hasInitializedRef.current = false;
            revokeAllObjectUrls(); // Release all Blob memory when modal closes
            return;
        }

        setCaptures([]);
        setPreviewItem(null);
        setIsSaving(false);
        isSavingRef.current = false;
        setFlashMsg(null);

        if (!navigator.mediaDevices?.getUserMedia) {
            setFlashMsg('Camera yêu cầu HTTPS hoặc Localhost');
            return;
        }

        // GPS is now managed by the global useLocationStore.
        // No local watchPosition needed here.

        // Device orientation - Gravity vector projection (Quaternion/Vector equivalent)
        const handleOrientation = (e: DeviceOrientationEvent) => {
            const { beta, gamma } = e;
            if (beta === null || gamma === null) return;

            // Convert to radians
            const rad = Math.PI / 180;
            const b = beta * rad;
            const g = gamma * rad;

            // Project Earth's gravity vector onto the device's screen plane (XY plane)
            // This perfectly isolates "rotation in the device plane" from pitch/yaw
            const x = -Math.sin(g) * Math.cos(b);
            const y = Math.sin(b);

            // If the device is pointing perfectly flat down or up, gravity is purely Z.
            // Screen roll is mathematically undefined. Retain last known orientation.
            const magnitude = Math.sqrt(x * x + y * y);
            if (magnitude < 0.15) return;

            // Calculate the true roll angle of the device relative to gravity (-180 to 180)
            let angle = Math.atan2(x, y) * (180 / Math.PI);

            // Normalize to 0-360 to smoothly apply the requested quadrant thresholds
            let norm = angle < 0 ? angle + 360 : angle;
            let snapped = 0;

            if (norm > 50 && norm <= 140) {
                snapped = 90;
            } else if (norm > 140 && norm <= 230) {
                snapped = 180;
            } else if (norm > 230 && norm <= 320) {
                snapped = 270;
            } else {
                snapped = 0;
            }

            // Map back to negative quadrants as requested (-90, -180, -270)
            if (angle < 0 && snapped !== 0) {
                snapped = snapped === 180 ? -180 : snapped - 360;
            }

            setRotationAngle(prev => prev !== snapped ? snapped : prev);
        };
        window.addEventListener('deviceorientation', handleOrientation);

        // Start camera
        initCamera();

        return () => {
            stopStream();
            window.removeEventListener('deviceorientation', handleOrientation);
        };
    }, [isOpen]);

    // Resume video after preview overlay dismissed (mobile suspend fix)
    useEffect(() => {
        if (!previewItem && videoRef.current?.srcObject) {
            videoRef.current.play().catch(e => console.warn('Resume after preview:', e));
        }
    }, [previewItem]);


    const handleZoomChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = parseFloat(e.target.value);
        setZoom(value);
        if (stream) {
            const track = stream.getVideoTracks()[0];
            // @ts-ignore
            if (track && track.getCapabilities().zoom) {
                // @ts-ignore
                track.applyConstraints({ advanced: [{ zoom: value }] }).catch(console.error);
            }
        }
    };

    const toggleFlash = () => {
        if (!stream) return;
        const track = stream.getVideoTracks()[0];
        if (!track) return;
        const newState = !isFlashOn;
        // @ts-ignore
        track.applyConstraints({ advanced: [{ torch: newState }] })
            .then(() => setIsFlashOn(newState))
            .catch(() => setFlashMsg('Thiết bị không hỗ trợ đèn flash'));
    };

    const isSavingRef = useRef(false);
    const captureLockRef = useRef(false); // Prevent ghost-click double-firing on touch screens



    const handleConfirm = () => {
        console.log('[CAMERA_DEBUG] handleConfirm triggered. Selected captures count:', captures.filter(c => c.selected).length, 'Total captures:', captures.length);
        if (isSavingRef.current || isSaving) {
            console.warn('[CAMERA_DEBUG] handleConfirm blocked due to already saving.');
            return;
        }

        const selectedItems = captures.filter(c => c.selected);
        const selectedCount = selectedItems.length;
        const totalCount = (props.existingImageCount || 0) + selectedCount;

        // Only enforce required count if status_set_image_count is TRUE (toggled ON)
        if (status_set_image_count && requiredImageCount > 0 && totalCount !== requiredImageCount) {
            const existing = props.existingImageCount || 0;
            alert(`Yêu cầu tổng cộng ${requiredImageCount} ảnh.\n- Đã có sẵn: ${existing} ảnh\n- Bạn chọn thêm: ${selectedCount} ảnh\n- Tổng cộng: ${totalCount} ảnh\n\nVui lòng chọn đúng số lượng yêu cầu.`);
            return;
        }

        isSavingRef.current = true;
        setIsSaving(true);
        console.log('[CAMERA_DEBUG] Finalizing capture selection and passing data to parent. Processing', selectedItems.length, 'images/videos.');
        onCapture(selectedItems.map(c => c.data));
        // Modal will be unmounted by parent, so we don't need to reset isSaving usually
    };

    // 3. Capture Handler
    const handleCapture = async () => {
        console.log('[CAMERA_DEBUG] handleCapture clicked. Current mode:', mode);
        if (mode === 'photo') {
            await capturePhoto();
        } else {
            toggleRecording();
        }
    };

    const capturePhoto = async () => {
        // Guard against ghost-click double-firing (touch events emit both touchstart + click)
        if (captureLockRef.current) {
            console.log('[CAMERA_DEBUG] capturePhoto blocked by lock (ghost-click guard).');
            return;
        }
        captureLockRef.current = true;

        console.log('[CAMERA_DEBUG] capturePhoto started.');
        if (!videoRef.current || !canvasRef.current) {
            console.error('[CAMERA_DEBUG] capturePhoto failed: videoRef or canvasRef missing!');
            captureLockRef.current = false;
            return;
        }

        // Shutter flash effect
        setShutterFlash(true);
        setTimeout(() => setShutterFlash(false), 150);

        // Wait for shutter flash animation to complete before blocking main thread with canvas.toBlob
        setTimeout(async () => {
            console.log('[CAMERA_DEBUG] Executing single-canvas capture...');
            if (!videoRef.current || !canvasRef.current) {
                captureLockRef.current = false;
                return;
            }
            const video = videoRef.current;
            const canvas = canvasRef.current;

            try {
                // ── Source dimensions & crop (WYSIWYG) ────────────────────────────
                const vW = video.videoWidth;
                const vH = video.videoHeight;
                if (vW === 0 || vH === 0) throw new Error("Video source dimensions are zero.");

                const rect = video.getBoundingClientRect();
                const videoRatio = vW / vH;
                const clientRatio = rect.width / rect.height;

                let sx = 0, sy = 0, sw = vW, sh = vH;
                if (clientRatio > videoRatio) {
                    const visibleHeight = vW / clientRatio;
                    sy = (vH - visibleHeight) / 2;
                    sh = visibleHeight;
                } else {
                    const visibleWidth = vH * clientRatio;
                    sx = (vW - visibleWidth) / 2;
                    sw = visibleWidth;
                }

                // ── Cap to Full HD (bandwidth efficiency) ─────────────────────────
                const MAX_DIM = 1920;
                const downScale = Math.min(1, MAX_DIM / Math.max(sw, sh));
                const safeW = Math.round(sw * downScale);
                const safeH = Math.round(sh * downScale);

                const isLandscape = rotationAngle === 90 || rotationAngle === -90 || rotationAngle === 270 || rotationAngle === -270;
                canvas.width = isLandscape ? safeH : safeW;
                canvas.height = isLandscape ? safeW : safeH;

                const ctx = canvas.getContext('2d');
                if (!ctx) throw new Error("Canvas context is null.");

                // ── PASS 1: Draw video frame (auto-rotate to upright & mirror if front) ─────────────
                ctx.save();
                ctx.translate(canvas.width / 2, canvas.height / 2);
                if (isFrontCamera) {
                    ctx.scale(-1, 1);
                }
                if (rotationAngle !== 0) {
                    const angle = isFrontCamera ? rotationAngle : -rotationAngle;
                    ctx.rotate(angle * Math.PI / 180);
                }
                ctx.drawImage(video, sx, sy, sw, sh, -safeW / 2, -safeH / 2, safeW, safeH);
                ctx.restore();

                // ── PASS 2: Draw watermark DIRECTLY on the same canvas ───────────
                const now = new Date();
                const timestamp = now.toLocaleString('vi-VN', {
                    timeZone: 'Asia/Ho_Chi_Minh',
                    year: 'numeric', month: '2-digit', day: '2-digit',
                    hour: '2-digit', minute: '2-digit', second: '2-digit'
                });
                const address = storeAddress || gpsLocation || '';
                // Wait for icon resources (instant if already cached)
                await loadResourcesPromise;
                drawWatermarkFrame(ctx, canvas.width, canvas.height, timestamp, address, resources.logo, 0, null, watermarkInfo);

                // ── PASS 3: Single .toBlob() — only one JPEG encode, non-blocking ─
                canvas.toBlob((blob) => {
                    try {
                        if (!blob) throw new Error('canvas.toBlob returned null');
                        const objectUrl = URL.createObjectURL(blob);
                        objectUrlsRef.current.push(objectUrl);
                        const newItem: CapturedItem = {
                            id: Date.now().toString(),
                            data: blob,
                            objectUrl,
                            type: 'photo',
                            selected: true
                        };
                        setCaptures(prev => [...prev, newItem]);
                    } catch (blobErr) {
                        console.error('[capturePhoto] toBlob extraction error:', blobErr);
                        setFlashMsg('Lỗi khi xử lý ảnh');
                        setTimeout(() => setFlashMsg(null), 1500);
                    } finally {
                        setTimeout(() => { captureLockRef.current = false; }, 300);
                    }
                }, 'image/jpeg', 0.82);

            } catch (e: any) {
                console.error('[CAMERA_DEBUG] Capture exception:', e);
                setFlashMsg(`Lỗi xử lý: ${e.message || 'Không xác định'}`);
                setTimeout(() => setFlashMsg(null), 2000);
                setTimeout(() => { captureLockRef.current = false; }, 300);
            }
        }, 150);
    };

    // 4. Video Recording Logic (Real-time Watermark)
    const toggleRecording = () => {
        console.log('[CAMERA_DEBUG] toggleRecording clicked. isRecording:', isRecording);
        if (isRecording) {
            stopRecording();
        } else {
            startRecording();
        }
    };

    const startRecording = () => {
        console.log('[CAMERA_DEBUG] startRecording started.');
        if (!stream || !videoRef.current) {
            console.error('[CAMERA_DEBUG] Cannot start recording, stream or videoRef is missing.');
            return;
        }

        const video = videoRef.current;
        const rect = video.getBoundingClientRect();

        // Calculate Crop (Same as Photo)
        const videoRatio = video.videoWidth / video.videoHeight;
        const clientRatio = rect.width / rect.height;

        let sx = 0, sy = 0, sw = video.videoWidth, sh = video.videoHeight;
        if (clientRatio > videoRatio) {
            const visibleHeight = video.videoWidth / clientRatio;
            sy = (video.videoHeight - visibleHeight) / 2;
            sh = visibleHeight;
        } else {
            const visibleWidth = video.videoHeight * clientRatio;
            sx = (video.videoWidth - visibleWidth) / 2;
            sw = visibleWidth;
        }

        // Output Size: Use Source Crop Size (Max 720p for video performance to prevent mobile browser memory crash)
        const MAX_VIDEO_DIM = 720;
        const vScale = Math.min(1, MAX_VIDEO_DIM / Math.max(sw, sh));
        const safeW = Math.round(sw * vScale);
        const safeH = Math.round(sh * vScale);

        // Lock the initial frame rotation so MediaRecorder canvas dimensions do not change mid-recording!
        const initialRotation = rotationAngle;
        const isLandscape = initialRotation === 90 || initialRotation === -90 || initialRotation === 270 || initialRotation === -270;

        // Setup Process Canvas
        const canvas = document.createElement('canvas');
        canvas.width = isLandscape ? safeH : safeW;
        canvas.height = isLandscape ? safeW : safeH;
        processCanvasRef.current = canvas;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        recordedChunksRef.current = [];

        // Use pre-loaded data from global store — instant, no network wait
        // If the store hasn't loaded yet, fall back to fetching on-demand
        let currentMapImg: HTMLImageElement | null = storeMapImg;
        let currentAddress: string = storeAddress || gpsLocation || 'GPS...';
        if (!storeMapImg && gpsLocation) {
            Promise.all([
                getStaticMapImage(gpsLocation),
                getReverseGeocode(gpsLocation)
            ]).then(([img, address]) => {
                currentMapImg = img;
                currentAddress = address;
            }).catch(console.error);
        }

        // Start Canvas Loop
        const drawLoop = () => {
            if (!videoRef.current || !ctx) return;

            // Draw Cropped Video Frame WITH initial rotation and mirroring
            ctx.save();
            ctx.translate(canvas.width / 2, canvas.height / 2);
            if (isFrontCamera) {
                ctx.scale(-1, 1);
            }
            if (initialRotation !== 0) {
                const angle = isFrontCamera ? initialRotation : -initialRotation;
                ctx.rotate(angle * Math.PI / 180);
            }
            ctx.drawImage(videoRef.current, sx, sy, sw, sh, -safeW / 2, -safeH / 2, safeW, safeH);
            ctx.restore();

            // Draw Watermark upright over the now-upright canvas (rotation = 0)!
            const now = new Date();
            const ts = now.toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });

            drawWatermarkFrame(
                ctx, canvas.width, canvas.height,
                ts, currentAddress, logoRef.current, 0, currentMapImg, watermarkInfo
            );

            animationFrameRef.current = requestAnimationFrame(drawLoop);
        };

        drawLoop();

        // Capture Stream from Canvas (30 FPS for smoother motion)
        const canvasStream = canvas.captureStream(30);

        // Add Audio if available
        const audioTracks = stream.getAudioTracks();
        if (audioTracks.length > 0) canvasStream.addTrack(audioTracks[0]);

        // MediaRecorder
        const options = { mimeType: 'video/webm;codecs=vp9' };
        // Fallback mime types check could be added
        let recorder: MediaRecorder;
        try {
            recorder = new MediaRecorder(canvasStream, options);
        } catch (e) {
            recorder = new MediaRecorder(canvasStream); // Fallback default
        }

        recorder.ondataavailable = (e) => {
            if (e.data.size > 0) recordedChunksRef.current.push(e.data);
        };

        recorder.onstop = () => {
            const mimeType = recorder.mimeType || 'video/webm';
            const blob = new Blob(recordedChunksRef.current, { type: mimeType });
            const videoUrl = URL.createObjectURL(blob);
            objectUrlsRef.current.push(videoUrl);

            const newItem: CapturedItem = {
                id: Date.now().toString(),
                data: blob,
                objectUrl: videoUrl,
                type: 'video',
                selected: true
            };
            setCaptures(prev => [...prev, newItem]);

            if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
            setFlashMsg("Đã lưu Video!");
            setTimeout(() => setFlashMsg(null), 1500);
        };

        // Remove 1000ms chunking argument! Chunking causes dropped frames/shortened videos on mobile canvas streams!
        // Start without timeslice -> collects into a single unbroken buffer until stop() is called.
        recorder.start();
        mediaRecorderRef.current = recorder;

        setIsRecording(true);
        setRecordingTime(0);
        timerRef.current = setInterval(() => setRecordingTime(prev => prev + 1), 1000);
    };

    const stopRecording = () => {
        console.log('[CAMERA_DEBUG] stopRecording triggered. mediaRecorderRef exists:', !!mediaRecorderRef.current, 'isRecording:', isRecording);
        if (mediaRecorderRef.current && isRecording) {
            console.log('[CAMERA_DEBUG] Stopping mediaRecorder API...');
            mediaRecorderRef.current.stop();
            setIsRecording(false);
            if (timerRef.current) clearInterval(timerRef.current);
        }
    };

    const formatTime = (sec: number) => {
        const m = Math.floor(sec / 60).toString().padStart(2, '0');
        const s = (sec % 60).toString().padStart(2, '0');
        return `${m}:${s}`;
    };

    if (!isOpen) return null;

    // Use Portal to render outside the DOM hierarchy (directly to body)
    // This ensures the modal covers the entire viewport including sidebar
    const toggleSelection = (id: string) => {
        setCaptures(prev => prev.map(item =>
            item.id === id ? { ...item, selected: !item.selected } : item
        ));
    };

    // Portal for Modal (Optional, but kept local for now as per original code structure usually)
    // If you use createPortal, import { createPortal } from 'react-dom'; and return createPortal(..., document.body);
    // Assuming inline for now based on previous file content.

    // Portal for Modal: Renders outside local DOM to fix "bung modal" / overflow issues
    return ReactDOM.createPortal(
        <div className="fixed inset-0 z-[99999] bg-black font-sans touch-none">
            {/* Modal Container — full screen on mobile, centered box on desktop */}
            <div className="relative w-full h-full md:max-w-5xl md:mx-auto md:my-6 md:h-[calc(100dvh-3rem)] bg-black md:rounded-3xl overflow-hidden shadow-2xl ring-1 ring-white/10 flex flex-col">

                {/* Solid Header */}
                <div className="flex-none bg-black px-4 py-3 flex justify-between items-center z-20 border-b border-white/10 safe-area-top">
                    {/* Left: Close Button */}
                    <button
                        onClick={onClose}
                        className="flex items-center gap-2 px-3 py-2 bg-white/10 rounded-full text-white hover:bg-red-500/80 transition-colors group shadow-lg"
                    >
                        <X className="w-5 h-5 group-hover:scale-110 transition-transform" />
                        <span className="text-sm font-medium tracking-wide">Đóng</span>
                    </button>

                    {/* Right: Camera Tools and Rec Timer */}
                    <div className="flex items-center gap-3">
                        {isRecording && (
                            <div className="px-4 py-1 bg-red-600 rounded-full text-white font-mono font-bold animate-pulse shadow-lg">{formatTime(recordingTime)}</div>
                        )}
                        {!isRecording && hasFlash && (
                            <button
                                onClick={toggleFlash}
                                className={`w-10 h-10 rounded-full transition-colors border shadow-lg flex items-center justify-center ${isFlashOn
                                    ? 'bg-yellow-400 text-black border-transparent shadow-yellow-500/50'
                                    : 'bg-white/10 text-white border-white/10 hover:bg-white/20'
                                    }`}
                                title={isFlashOn ? 'Tắt đèn Flash' : 'Bật đèn Flash'}
                            >
                                <span className="text-xl leading-none">⚡</span>
                            </button>
                        )}
                        {!isRecording && cameraCount >= 2 && (
                            <button
                                onClick={switchCamera}
                                className="w-10 h-10 bg-white/10 rounded-full text-white hover:bg-white/20 transition-colors border border-white/10 shadow-lg flex items-center justify-center"
                                title="Đổi camera"
                            >
                                <SwitchCamera className="w-5 h-5" />
                            </button>
                        )}
                    </div>
                </div>

                {/* Video Viewport */}
                <div ref={videoContainerRef} className="flex-1 relative bg-black overflow-hidden group">
                    {/* Live Camera View - Always mounted to keep srcObject stream active! */}
                    <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        muted={!isRecording}
                        className="absolute inset-0 w-full h-full object-cover"
                        style={isFrontCamera ? { transform: 'scaleX(-1)' } : undefined}
                    />

                    {/* Live Watermark Overlay — mirrors actual canvas watermark layout 1:1.
 WHOLE-FRAME ROTATION: a single wrapper swaps width/height for landscape
 mode and rotates 90°, so all watermark elements stay in their correct
 corners (logo top-left, info bottom-left, map bottom-right) regardless
 of physical device orientation. */}
                    {!previewItem && containerSize.width > 0 && (() => {
                        const isLandscape = rotationAngle === 90 || rotationAngle === -90 || rotationAngle === 270 || rotationAngle === -270;
                        return (
                            <div className="absolute inset-0 z-10 pointer-events-none flex items-center justify-center overflow-hidden">
                                <div
                                    className="flex flex-col justify-between p-5 transition-transform duration-300 shrink-0"
                                    style={{
                                        width: isLandscape ? `${containerSize.height}px` : '100%',
                                        height: isLandscape ? `${containerSize.width}px` : '100%',
                                        transform: `rotate(${rotationAngle}deg)`,
                                        transformOrigin: 'center center',
                                    }}
                                >
                                    {/* Top Left: Logo */}
                                    <div className="flex justify-start">
                                        <img
                                            src={logoSrc}
                                            alt="Logo"
                                            className="w-16 sm:w-20 h-auto drop-shadow-lg"
                                            style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))' }}
                                        />
                                    </div>

                                    {/* Bottom row: Info block */}
                                    <div className="flex items-end gap-2 w-full">
                                        {/* Bottom Left: Info box */}
                                        <div className="bg-black/70 rounded-lg px-2.5 py-2 flex flex-col gap-1 shadow-[0_4px_12px_rgba(0,0,0,0.5)] border border-white/10 w-fit max-w-[40%] sm:max-w-[50%]">
                                            <div className="flex items-center gap-1.5 text-white">
                                                <svg className="w-2 h-2 flex-shrink-0 opacity-90" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                    <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
                                                </svg>
                                                <span className="font-bold text-xs xs:text-xs leading-tight whitespace-nowrap">
                                                    {currentTime.toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}
                                                </span>
                                            </div>
                                            <div className="flex items-start gap-1.5 text-white">
                                                <svg className="w-2 h-2 flex-shrink-0 mt-0.5 opacity-90" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" />
                                                </svg>
                                                <span className="font-medium text-[6px] xs:text-[8px] leading-tight break-words whitespace-normal">
                                                    {storeAddress || gpsLocation || 'Đang xác định vị trí...'}
                                                </span>
                                            </div>
                                            {watermarkInfo.map((info, idx) => {
                                                const isUser = info.startsWith('NV:');
                                                const isWork = info.startsWith('DA:') || info.startsWith('QT:');
                                                const isAsset = info.startsWith('TS:');

                                                let displayText = info;
                                                if (isUser) displayText = info.replace(/^NV:\s*/, '');
                                                else if (isWork) displayText = info.replace(/^(DA|QT):\s*/, '');
                                                else if (isAsset) displayText = info.replace(/^TS:\s*/, '');

                                                return (
                                                    <div key={idx} className="flex items-start gap-1.5 text-white">
                                                        {isUser && (
                                                            <svg className="w-2 h-2 flex-shrink-0 mt-0.5 opacity-90" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                                <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
                                                            </svg>
                                                        )}
                                                        {isWork && (
                                                            <svg className="w-2 h-2 flex-shrink-0 mt-0.5 opacity-90" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                                <rect width="8" height="4" x="8" y="2" rx="1" ry="1" /><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" /><path d="M12 11h4" /><path d="M12 16h4" /><path d="M8 11h.01" /><path d="M8 16h.01" />
                                                            </svg>
                                                        )}
                                                        {isAsset && (
                                                            <svg className="w-2 h-2 flex-shrink-0 mt-0.5 opacity-90" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                                <path d="m14 13-8.381 8.38a1 1 0 0 1-3.001-3L11 9.999" /><path d="M15.973 4.027A13 13 0 0 0 5.902 2.373c-1.398.342-1.092 2.158.277 2.601a19.9 19.9 0 0 1 5.822 3.024" /><path d="M16.001 11.999a19.9 19.9 0 0 1 3.024 5.824c.444 1.369 2.26 1.676 2.603.278A13 13 0 0 0 20 8.069" /><path d="M18.352 3.352a1.205 1.205 0 0 0-1.704 0l-5.296 5.296a1.205 1.205 0 0 0 0 1.704l2.296 2.296a1.205 1.205 0 0 0 1.704 0l5.296-5.296a1.205 1.205 0 0 0 0-1.704z" />
                                                            </svg>
                                                        )}
                                                        {!isUser && !isWork && !isAsset && <div className="w-2 flex-shrink-0" />}
                                                        <span className="font-medium text-[7px] xs:text-[9px] leading-tight break-words whitespace-normal">
                                                            {displayText}
                                                        </span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })()}

                    {/* Preview Mode Overlay */}
                    {previewItem && (
                        <div className="absolute inset-0 z-40 bg-black flex items-center justify-center">
                            {previewItem.type === 'photo' ? (
                                <img src={previewItem.objectUrl} className="w-full h-full object-contain" />
                            ) : (
                                <PreviewVideo blob={previewItem.data as Blob} />
                            )}

                            {/* Close Preview Button */}
                            <button
                                onClick={() => setPreviewItem(null)}
                                className="absolute top-4 left-4 px-4 py-2 bg-black/50 backdrop-blur-md rounded-full text-white hover:bg-white/20 transition-colors flex items-center gap-2"
                            >
                                <X className="w-4 h-4" />
                                <span className="text-xs font-bold">Quay lại Camera</span>
                            </button>

                            {/* Edit Button — always available for photos */}
                            {previewItem.type === 'photo' && (
                                <button
                                    onClick={() => setEditingItem(previewItem)}
                                    className="absolute top-4 right-4 px-5 py-2 bg-blue-600/90 backdrop-blur-md rounded-full text-white hover:bg-blue-500 transition-colors shadow-lg font-medium tracking-wide flex items-center gap-2"
                                >
                                    Chỉnh sửa ảnh
                                </button>
                            )}
                        </div>
                    )}

                    {/* Zoom Slider Overlay */}
                    {maxZoom > 1 && !previewItem && (
                        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 w-64 bg-black/30 backdrop-blur-md p-2 rounded-full flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity z-20">
                            <ZoomOut className="w-4 h-4 text-white" />
                            <input
                                type="range" min="1" max={maxZoom} step="0.1" value={zoom} onChange={handleZoomChange}
                                className="flex-1 h-1 bg-white/50 rounded-lg appearance-none cursor-pointer"
                            />
                            <ZoomIn className="w-4 h-4 text-white" />
                        </div>
                    )}
                </div>

                {/* Shutter Flash Animation */}
                {shutterFlash && (
                    <div className="absolute inset-0 bg-white z-40 pointer-events-none opacity-100 transition-opacity duration-150 animate-out fade-out-0" />
                )}

                {flashMsg && (
                    <div className="absolute inset-0 flex items-center justify-center z-30 pointer-events-none">
                        <div className="bg-black/70 backdrop-blur text-white px-6 py-3 rounded-2xl font-bold animate-fade-in">{flashMsg}</div>
                    </div>
                )}

                <canvas ref={canvasRef} className="hidden" />

                {/* Bottom Controls — inside Modal Container so flex-col stacks correctly */}
                <div className="flex-none shrink-0 w-full bg-black/95 py-4 px-6 flex flex-col items-center gap-4 z-20 border-t border-white/10 safe-area-bottom">

                    {/* Gallery / Selection Strip — Fully collapses when empty to save screen space */}
                    {captures.length > 0 && (
                        <div className="w-full flex gap-2 overflow-x-auto pb-2 custom-scrollbar">
                            {captures.map((item, idx) => (
                                <div
                                    key={item.id}
                                    className={`relative flex-none w-16 h-16 rounded-lg overflow-hidden border-2 cursor-pointer transition-all ${item.selected ? 'border-green-500 scale-105' : 'border-transparent opacity-60'} ${previewItem?.id === item.id ? 'ring-2 ring-white scale-110 opacity-100' : ''}`}
                                    onClick={() => setPreviewItem(item)}
                                >
                                    {item.type === 'photo' ? (
                                        <img src={item.objectUrl} className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="w-full h-full bg-slate-800 flex items-center justify-center text-white text-xs">Video</div>
                                    )}

                                    {/* Selection Checkbox Area - Stop Propagation to avoid opening preview */}
                                    <div
                                        className={`absolute top-0 right-0 p-1 bg-black/20 hover:bg-black/40 rounded-bl-lg transition-colors z-10`}
                                        onClick={(e) => { e.stopPropagation(); toggleSelection(item.id); }}
                                    >
                                        <div className={`w-4 h-4 rounded-full border border-white flex items-center justify-center ${item.selected ? 'bg-green-500' : 'bg-black/50'}`}>
                                            {item.selected && <Check className="w-3 h-3 text-white" />}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}



                    <div className="flex items-center gap-2 sm:gap-6 w-full justify-evenly px-2 sm:px-4 max-w-lg shrink-0">
                        {/* Mode Switcher */}
                        <div className="flex bg-white/10 p-1 rounded-full backdrop-blur-md shrink-0">
                            <button
                                onClick={() => setMode('photo')}
                                className={`px-3 sm:px-4 py-1.5 rounded-full text-[10px] sm:text-xs font-bold transition-all ${mode === 'photo' ? 'bg-white text-black shadow-lg' : 'text-white/60 hover:text-white'}`}
                            >
                                Ảnh
                            </button>
                            <button
                                onClick={() => setMode('video')}
                                className={`px-3 sm:px-4 py-1.5 rounded-full text-[10px] sm:text-xs font-bold transition-all ${mode === 'video' ? 'bg-red-500 text-white shadow-lg' : 'text-white/60 hover:text-white'}`}
                            >
                                Video
                            </button>
                        </div>

                        {/* Shutter Button */}
                        <button
                            onClick={handleCapture}
                            disabled={isSaving}
                            className={`shrink-0 w-14 h-14 sm:w-16 sm:h-16 rounded-full border-4 flex items-center justify-center transition-all transform active:scale-95 disabled:opacity-50 disabled:scale-100 ${mode === 'photo'
                                ? 'border-white bg-white hover:bg-gray-200'
                                : isRecording
                                    ? 'border-red-500 bg-red-500 scale-110'
                                    : 'border-red-500 bg-transparent hover:bg-red-500/20'
                                }`}
                        >
                            {mode === 'video' && isRecording ? (
                                <Square className="w-5 h-5 sm:w-6 sm:h-6 text-white fill-current" />
                            ) : (
                                <div className={`w-12 h-12 sm:w-14 sm:h-14 rounded-full ${mode === 'photo' ? 'bg-white' : 'bg-red-500'}`} />
                            )}
                        </button>

                        {/* Submit Button */}
                        <button
                            onClick={handleConfirm}
                            disabled={captures.filter(c => c.selected).length === 0 || isSaving}
                            className={`shrink-0 flex flex-col items-center justify-center gap-0.5 px-3 py-2 sm:px-6 rounded-2xl font-bold transition-all ${captures.filter(c => c.selected).length > 0
                                ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg lg:hover:scale-105'
                                : 'bg-white/10 text-white/30 cursor-not-allowed'
                                }`}
                        >
                            <span className="text-sm sm:text-lg">Lưu</span>
                            {captures.filter(c => c.selected).length > 0 && (
                                <span className="text-[9px] bg-white/20 px-1.5 py-0.5 rounded-full whitespace-nowrap">
                                    {captures.filter(c => c.selected).length} đã chọn
                                </span>
                            )}
                        </button>

                        {/* Next Asset Button */}
                        {nextTaskName && onNextTask && (
                            <button
                                onClick={() => {
                                    const selected = captures.filter(c => c.selected);
                                    if (selected.length === 0) {
                                        setFlashMsg('Chưa có ảnh nào được chọn!');
                                        setTimeout(() => setFlashMsg(null), 1500);
                                        return;
                                    }
                                    onNextTask(selected.map(c => c.data));
                                    setCaptures([]);
                                    setPreviewItem(null);
                                    isSavingRef.current = false;
                                    setIsSaving(false);
                                    // Flash message is purely informational — does NOT block the shutter button
                                    setFlashMsg(`Chuyển sang: ${nextTaskName}`);
                                    setTimeout(() => setFlashMsg(null), 500);
                                }}
                                disabled={captures.filter(c => c.selected).length === 0 || isSaving}
                                className={`shrink-1 flex-1 min-w-0 max-w-[90px] flex flex-col items-center justify-center gap-0.5 px-1 py-2 sm:px-2 rounded-xl font-bold transition-all text-center ${captures.filter(c => c.selected).length > 0
                                    ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-500/30'
                                    : 'bg-white/10 text-white/30 cursor-not-allowed'
                                    }`}
                                title={`Lưu và chuyển sang: ${nextTaskName}`}
                            >
                                <FastForward className="w-4 h-4" strokeWidth={2.5} />
                                <span className="text-[10px] sm:text-[11px] font-semibold leading-tight w-full line-clamp-2 break-words">{nextTaskName}</span>
                            </button>
                        )}
                    </div>

                    {/* Flash message */}
                </div>
            </div>

            {/* Image Editor Modal Layer */}
            {/* Loads directly from objectUrl (already-watermarked) — no re-watermarking on save */}
            {editingItem && (
                <ImageEditor
                    src={editingItem.objectUrl}
                    onCancel={() => setEditingItem(null)}
                    onSave={async (editedBase64) => {
                        try {
                            setFlashMsg("Đang lưu chỉnh sửa...");
                            // Convert edited canvas output (Base64) → Blob — single encode, no watermark re-apply
                            const resp = await fetch(editedBase64);
                            const editedBlob = await resp.blob();
                            const newUrl = URL.createObjectURL(editedBlob);
                            objectUrlsRef.current.push(newUrl);

                            // Revoke the old objectUrl before replacing
                            const oldItem = captures.find(c => c.id === editingItem.id);
                            if (oldItem?.objectUrl) URL.revokeObjectURL(oldItem.objectUrl);

                            setCaptures(prev => prev.map(item =>
                                item.id === editingItem.id
                                    ? { ...item, data: editedBlob, objectUrl: newUrl }
                                    : item
                            ));

                            if (previewItem?.id === editingItem.id) {
                                setPreviewItem(prev => prev
                                    ? { ...prev, data: editedBlob, objectUrl: newUrl }
                                    : null
                                );
                            }

                            setEditingItem(null);
                            setFlashMsg("Đã lưu chỉnh sửa!");
                            setTimeout(() => setFlashMsg(null), 1500);
                        } catch (e) {
                            console.error(e);
                            setFlashMsg("Lỗi khi lưu chỉnh sửa");
                            setTimeout(() => setFlashMsg(null), 1500);
                        }
                    }}
                />
            )}
        </div>,
        document.body
    );
};

export default CameraModal;
