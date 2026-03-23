import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import { X, SwitchCamera, ZoomIn, ZoomOut, Square, Check } from 'lucide-react';
import { drawWatermarkFrame, addWatermarkToImage, getReverseGeocode, getStaticMapImage } from '../../utils/watermarkUtils';
import { ImageEditor } from './ImageEditor';
import logoSrc from '../../assets/logo.png'; // Need logo for video frame drawing
import { useLocationStore, selectCoordString } from '../../stores/useLocationStore';

interface CameraModalProps {
    isOpen: boolean;
    onClose: () => void;
    onCapture: (data: (string | Blob)[]) => void; // Support Multi-Capture
    requiredImageCount?: number;
    existingImageCount?: number; // New Prop
    status_set_image_count?: boolean; // New Prop: if true, enforce requiredImageCount
}

interface CapturedItem {
    id: string;
    data: string | Blob;
    rawData?: string; // Tạm giữ ảnh thô chưa Watermark để Edit
    type: 'photo' | 'video';
    selected: boolean;
}

const CameraModal: React.FC<CameraModalProps> = (props) => {
    const { isOpen, onClose, onCapture, requiredImageCount = 0, status_set_image_count = true } = props;
    // Refs
    const isMountedRef = useRef(true);
    useEffect(() => {
        return () => {
            isMountedRef.current = false;
        };
    }, []);

    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement | null>(null); // For Photo Capture
    const processCanvasRef = useRef<HTMLCanvasElement | null>(null); // For Video Processing
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const animationFrameRef = useRef<number | null>(null);
    const recordedChunksRef = useRef<Blob[]>([]);

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
    const gpsLocation = selectCoordString(gpsStore);  // "lat, lng" string or null
    const storeMapImg = gpsStore.mapImage;             // already loaded HTMLImageElement
    const storeAddress = gpsStore.address;             // already reverse-geocoded string

    // Flash state
    const [isFlashOn, setIsFlashOn] = useState(false);
    const [hasFlash, setHasFlash] = useState(false);

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
     *   iPhone  → [wide, ultra, tele, FRONT]   (front is last)
     *   Xiaomi  → [FRONT, back, macro, depth]  (front is first)
     *   Samsung → [back, FRONT, ultra, tele]   (mixed)
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
     *   1. exact deviceId from label-matched list (most reliable)
     *   2. ideal facingMode (browser picks best match, no exceptions)
     *   3. bare video request (last resort)
     * Uses ideal (NOT exact) for facingMode because:
     *   - `exact` throws OverconstrainedError on Safari
     *   - `exact` is silently ignored on many Android Chrome builds
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

        const baseVideo: MediaTrackConstraints = { width: { ideal: 1920 }, height: { ideal: 1080 } };

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

        // Device orientation
        const handleOrientation = (e: DeviceOrientationEvent) => {
            const { beta, gamma } = e;
            if (beta === null || gamma === null) return;
            let deg = Math.round(Math.atan2(gamma, beta) * (180 / Math.PI));
            if (deg < 0) deg += 360;
            setRotationAngle(deg);
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
        setFlashMsg("Đang xử lý...");

        // Timeout to render UI update
        setTimeout(async () => {
            console.log('[CAMERA_DEBUG] Executing frame capture logic on offscreen canvas...');
            if (!videoRef.current || !canvasRef.current) {
                captureLockRef.current = false;
                return;
            }
            const video = videoRef.current;
            const canvas = canvasRef.current;

            // Source Dimensions
            const vW = video.videoWidth;
            const vH = video.videoHeight;
            const rect = video.getBoundingClientRect();

            // Aspect Ratios
            const videoRatio = vW / vH;
            const clientRatio = rect.width / rect.height;

            // 1. Calculate Crop (WYSIWYG)
            let sx = 0, sy = 0, sw = vW, sh = vH;

            if (clientRatio > videoRatio) {
                // Screen wider -> Crop Top/Bottom
                const visibleHeight = vW / clientRatio;
                sy = (vH - visibleHeight) / 2;
                sh = visibleHeight;
            } else {
                // Screen taller -> Crop Left/Right
                const visibleWidth = vH * clientRatio;
                sx = (vW - visibleWidth) / 2;
                sw = visibleWidth;
            }

            // 2. Pure Native Capture (No Rotation, purely what you see on screen)
            const ctx = canvas.getContext('2d');
            if (!ctx) { captureLockRef.current = false; return; }

            // Cap max dimension to Full HD (1920px) for enterprise bandwidth efficiency.
            // Reduces average image size from ~3-5MB to ~300-500KB (80% saving) without visible quality loss.
            const MAX_DIM = 1920;
            const downScale = Math.min(1, MAX_DIM / Math.max(sw, sh));
            const safeW = Math.round(sw * downScale);
            const safeH = Math.round(sh * downScale);

            canvas.width = safeW;
            canvas.height = safeH;

            // Draw original pristine pixels matching the viewport
            ctx.drawImage(video, sx, sy, sw, sh, 0, 0, safeW, safeH);

            try {
                // Save raw data WITHOUT watermark to allow editing later.
                // Quality 0.8 = enterprise standard: ~300-500KB per image, imperceptible loss vs 0.95 on web.
                const rawData = canvas.toDataURL('image/jpeg', 0.80);

                // For initial list preview, immediately generate a stamped version
                // Pass pre-loaded store data → instant watermark, no network wait
                const result = await addWatermarkToImage(rawData, gpsLocation || undefined, storeMapImg, storeAddress);

                const newItem: CapturedItem = {
                    id: Date.now().toString(),
                    data: result,
                    rawData: rawData,
                    type: 'photo',
                    selected: true // Auto-select by default
                };
                setCaptures(prev => [...prev, newItem]);

                setFlashMsg("Đã chụp!");
                setTimeout(() => setFlashMsg(null), 1000);
            } catch (e) {
                console.error(e);
                // Fallback
                const newItem: CapturedItem = {
                    id: Date.now().toString(),
                    data: canvas.toDataURL('image/jpeg', 0.92),
                    type: 'photo',
                    selected: true
                };
                setCaptures(prev => [...prev, newItem]);
            } finally {
                // Keep the lock for 1000ms to debounce mobile ghost clicks (which fire 300ms after touch) and user mash-clicking
                setTimeout(() => {
                    captureLockRef.current = false;
                }, 1000);
            }
        }, 50);
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

        // Output Size: Use Source Crop Size (Max 1920p for video performance)
        const MAX_VIDEO_DIM = 1920;
        const vScale = Math.min(1, MAX_VIDEO_DIM / Math.max(sw, sh));
        const destW = Math.round(sw * vScale);
        const destH = Math.round(sh * vScale);

        // Setup Process Canvas
        const canvas = document.createElement('canvas');
        canvas.width = destW;
        canvas.height = destH;
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

            // Draw Cropped Video Frame
            ctx.drawImage(videoRef.current, sx, sy, sw, sh, 0, 0, destW, destH);

            // Draw Watermark
            const now = new Date();
            const ts = now.toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });

            drawWatermarkFrame(
                ctx, destW, destH,
                ts, currentAddress, logoRef.current, mutationRotation(rotationAngle), currentMapImg
            );

            animationFrameRef.current = requestAnimationFrame(drawLoop);
        };

        // Helper to smooth rotation for video if needed (or just raw)
        const mutationRotation = (ang: number) => ang;

        drawLoop();

        // Capture Stream from Canvas (30 FPS)
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
            const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });

            const newItem: CapturedItem = {
                id: Date.now().toString(),
                data: blob,
                type: 'video',
                selected: true
            };
            setCaptures(prev => [...prev, newItem]);

            if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
            setFlashMsg("Đã lưu Video!");
            setTimeout(() => setFlashMsg(null), 1500);
        };

        recorder.start(1000); // chunk every 1s
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

                {/* Header Overlay */}
                <div className="absolute top-0 left-0 right-0 p-4 z-20 flex justify-between items-start pointer-events-none safe-area-top">
                    <div className="pointer-events-auto">
                        <button
                            onClick={onClose}
                            className="flex items-center gap-2 px-4 py-2 bg-black/50 backdrop-blur-md rounded-full text-white hover:bg-red-500/80 transition-colors group"
                        >
                            <X className="w-5 h-5 group-hover:scale-110 transition-transform" />
                            <span className="text-sm font-medium">Đóng</span>
                        </button>
                    </div>

                    <div className="flex flex-col gap-2 items-end pointer-events-auto">
                        {isRecording && <div className="px-4 py-1 bg-red-600 rounded-full text-white font-mono font-bold animate-pulse shadow-lg">{formatTime(recordingTime)}</div>}
                        {/* Flash Button - only show if camera supports torch */}
                        {hasFlash && (
                            <button
                                onClick={toggleFlash}
                                className={`p-3 backdrop-blur-md rounded-full transition-colors ${isFlashOn
                                    ? 'bg-yellow-400 text-black shadow-lg shadow-yellow-500/50'
                                    : 'bg-black/50 text-white hover:bg-white/20'
                                    }`}
                                title={isFlashOn ? 'Tắt đèn Flash' : 'Bật đèn Flash'}
                            >
                                ⚡
                            </button>
                        )}
                        {/* Switch Camera - only show if device has multiple cameras */}
                        {cameraCount >= 2 && (
                            <button onClick={switchCamera} className="p-3 bg-black/50 backdrop-blur-md rounded-full text-white hover:bg-white/20 transition-colors" title={isFrontCamera ? 'Chuyển sang camera sau' : 'Chuyển sang camera trước'}><SwitchCamera className="w-5 h-5" /></button>
                        )}
                    </div>
                </div>

                {/* Video Viewport */}
                <div className="flex-1 relative bg-black overflow-hidden group">
                    {/* Live Camera View - Always mounted to keep srcObject stream active! */}
                    <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        muted={!isRecording}
                        className="absolute inset-0 w-full h-full object-cover"
                        style={isFrontCamera ? { transform: 'scaleX(-1)' } : undefined}
                    />

                    {/* Live Watermark Overlay — mirrors actual canvas watermark layout 1:1 */}
                    {!previewItem && (
                        <div className="absolute inset-0 z-10 pointer-events-none flex flex-col justify-between p-3 sm:p-4">
                            {/* Top Left: Logo — same position as canvas drawWatermarkFrame */}
                            <div className="flex justify-start">
                                <img
                                    src={logoSrc}
                                    alt="Logo"
                                    className="w-16 sm:w-20 h-auto drop-shadow-lg"
                                    style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))' }}
                                />
                            </div>

                            {/* Bottom row: Info block + Minimap */}
                            <div className="flex justify-between items-end gap-2 w-full">
                                {/* Bottom Left: Single dark rounded box (matches canvas box) */}
                                <div className="bg-black/40 backdrop-blur-sm rounded-lg px-2.5 py-2 flex flex-col gap-1 shadow-md max-w-[55%] sm:max-w-[60%]">
                                    {/* Line 1: Clock icon + timestamp */}
                                    <div className="flex items-center gap-1.5 text-white">
                                        <svg className="w-3 h-3 flex-shrink-0 opacity-90" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                            <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                                        </svg>
                                        <span className="font-bold text-xs leading-tight">
                                            {currentTime.toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}
                                        </span>
                                    </div>
                                    {/* Line 2: MapPin icon + address */}
                                    <div className="flex items-start gap-1.5 text-white">
                                        <svg className="w-3 h-3 flex-shrink-0 mt-0.5 opacity-90" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
                                        </svg>
                                        <span className="font-medium text-[10px] sm:text-xs leading-tight line-clamp-2">
                                            {storeAddress || gpsLocation || 'Đang xác định vị trí...'}
                                        </span>
                                    </div>
                                </div>

                                {/* Bottom Right: Minimap with white Polaroid border */}
                                {storeMapImg && (
                                    <div className="flex-shrink-0 bg-white p-1 rounded-lg shadow-xl">
                                        <div className="w-20 h-[60px] sm:w-24 sm:h-[72px] rounded overflow-hidden">
                                            <img src={storeMapImg.src} className="w-full h-full object-cover" alt="Minimap" />
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Preview Mode Overlay */}
                    {previewItem && (
                        <div className="absolute inset-0 z-40 bg-black flex items-center justify-center">
                            {previewItem.type === 'photo' ? (
                                <img src={previewItem.data as string} className="w-full h-full object-contain" />
                            ) : (
                                <video src={URL.createObjectURL(previewItem.data as Blob)} controls className="w-full h-full object-contain" />
                            )}

                            {/* Close Preview Button */}
                            <button
                                onClick={() => setPreviewItem(null)}
                                className="absolute top-4 left-4 px-4 py-2 bg-black/50 backdrop-blur-md rounded-full text-white hover:bg-white/20 transition-colors flex items-center gap-2"
                            >
                                <X className="w-4 h-4" />
                                <span className="text-xs font-bold">Quay lại Camera</span>
                            </button>

                            {/* Edit Button */}
                            {previewItem.type === 'photo' && previewItem.rawData && (
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

                {flashMsg && (
                    <div className="absolute inset-0 flex items-center justify-center z-30 pointer-events-none">
                        <div className="bg-black/70 backdrop-blur text-white px-6 py-3 rounded-2xl font-bold animate-fade-in">{flashMsg}</div>
                    </div>
                )}

                <canvas ref={canvasRef} className="hidden" />

                {/* Bottom Controls — inside Modal Container so flex-col stacks correctly */}
                <div className="flex-none bg-black/95 backdrop-blur-md py-4 px-6 flex flex-col items-center gap-4 z-20 border-t border-white/10 safe-area-bottom">

                    {/* Gallery / Selection Strip — always reserve height so video viewport aspect ratio doesn't shift on first capture */}
                    <div className="w-full flex gap-2 overflow-x-auto pb-2 custom-scrollbar min-h-[72px]">
                        {captures.map((item, idx) => (
                            <div
                                key={item.id}
                                className={`relative flex-none w-16 h-16 rounded-lg overflow-hidden border-2 cursor-pointer transition-all ${item.selected ? 'border-green-500 scale-105' : 'border-transparent opacity-60'} ${previewItem?.id === item.id ? 'ring-2 ring-white scale-110 opacity-100' : ''}`}
                                onClick={() => setPreviewItem(item)}
                            >
                                {item.type === 'photo' ? (
                                    <img src={item.data as string} className="w-full h-full object-cover" />
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

                    <div className="flex items-center gap-8 w-full justify-center max-w-lg">
                        {/* Mode Switcher */}
                        <div className="flex bg-white/10 p-1 rounded-full backdrop-blur-md">
                            <button
                                onClick={() => setMode('photo')}
                                className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${mode === 'photo' ? 'bg-white text-black shadow-lg' : 'text-white/60 hover:text-white'}`}
                            >
                                Ảnh
                            </button>
                            <button
                                onClick={() => setMode('video')}
                                className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${mode === 'video' ? 'bg-red-500 text-white shadow-lg' : 'text-white/60 hover:text-white'}`}
                            >
                                Video
                            </button>
                        </div>

                        {/* Shutter Button */}
                        <button
                            onClick={handleCapture}
                            disabled={isSaving || !!flashMsg}
                            className={`w-16 h-16 rounded-full border-4 flex items-center justify-center transition-all transform active:scale-95 disabled:opacity-50 disabled:scale-100 ${mode === 'photo'
                                ? 'border-white bg-white hover:bg-gray-200'
                                : isRecording
                                    ? 'border-red-500 bg-red-500 scale-110'
                                    : 'border-red-500 bg-transparent hover:bg-red-500/20'
                                }`}
                        >
                            {mode === 'video' && isRecording ? (
                                <Square className="w-6 h-6 text-white fill-current" />
                            ) : (
                                <div className={`w-14 h-14 rounded-full ${mode === 'photo' ? 'bg-white' : 'bg-red-500'}`} />
                            )}
                        </button>

                        {/* Submit Button */}
                        <button
                            onClick={handleConfirm}
                            disabled={captures.filter(c => c.selected).length === 0 || isSaving}
                            className={`flex flex-col items-center justify-center gap-1 px-6 py-2 rounded-2xl font-bold transition-all ${captures.filter(c => c.selected).length > 0
                                ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg lg:hover:scale-105'
                                : 'bg-white/10 text-white/30 cursor-not-allowed'
                                }`}
                        >
                            <span className="text-lg">Lưu</span>
                            {captures.filter(c => c.selected).length > 0 && (
                                <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded-full">
                                    {captures.filter(c => c.selected).length} đã chọn
                                </span>
                            )}
                        </button>
                    </div>

                    {/* Flash message */}
                </div>
            </div>

            {/* Image Editor Modal Layer */}
            {editingItem && editingItem.rawData && (
                <ImageEditor
                    src={editingItem.rawData as string}
                    onCancel={() => setEditingItem(null)}
                    onSave={async (editedBase64) => {
                        try {
                            setFlashMsg("Đang đóng dấu ảnh...");
                            // Triggers the watermarking ON TOP of the newly flipped/rotated clean matrix layout (always upright visually)
                            const newWatermarked = await addWatermarkToImage(editedBase64, gpsLocation || undefined);

                            // Rehydrate the store with the newly updated dual state
                            setCaptures(prev => prev.map(item =>
                                item.id === editingItem.id ? { ...item, data: newWatermarked, rawData: editedBase64 } : item
                            ));

                            // Keep preview synchronized with newly saved graphic
                            if (previewItem?.id === editingItem.id) {
                                setPreviewItem(prev => prev ? { ...prev, data: newWatermarked, rawData: editedBase64 } : null);
                            }

                            setEditingItem(null);
                            setFlashMsg("Đã lưu chỉnh sửa!");
                            setTimeout(() => setFlashMsg(null), 1500);
                        } catch (e) {
                            console.error(e);
                            setFlashMsg("Lỗi khi đóng dấu ảnh");
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
