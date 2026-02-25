import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import { X, SwitchCamera, Video, Camera, ZoomIn, ZoomOut, Circle, Square, Check } from 'lucide-react';
import { addWatermarkToCanvas, drawWatermarkFrame } from '../../utils/watermarkUtils';
import logoSrc from '../../assets/logo.png'; // Need logo for video frame drawing

interface CameraModalProps {
    isOpen: boolean;
    onClose: () => void;
    onCapture: (data: (string | Blob)[]) => void; // Support Multi-Capture
    requiredImageCount?: number;
    existingImageCount?: number; // New Prop
}

interface CapturedItem {
    id: string;
    data: string | Blob;
    type: 'photo' | 'video';
    selected: boolean;
}

const CameraModal: React.FC<CameraModalProps> = (props) => {
    const { isOpen, onClose, onCapture, requiredImageCount = 0 } = props;
    // Refs
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement | null>(null); // For Photo Capture
    const processCanvasRef = useRef<HTMLCanvasElement | null>(null); // For Video Processing
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const animationFrameRef = useRef<number | null>(null);
    const recordedChunksRef = useRef<Blob[]>([]);

    // State
    const [mode, setMode] = useState<'photo' | 'video'>('photo');
    const [stream, setStream] = useState<MediaStream | null>(null);
    const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
    const [selectedCameraId, setSelectedCameraId] = useState<string>('');
    const [flashMsg, setFlashMsg] = useState<string | null>(null);
    const [gpsLocation, setGpsLocation] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false); // Prevent double-submit

    // Simplified Camera Switching using facingMode (More reliable on mobile)
    const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');

    const switchCamera = () => {
        const newMode = facingMode === 'environment' ? 'user' : 'environment';
        setFacingMode(newMode);
        setSelectedCameraId(''); // Clear specific device ID to let browser choose best camera for new mode
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

    // Load Logo for Video
    const logoRef = useRef<HTMLImageElement | null>(null);
    useEffect(() => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.src = logoSrc;
        img.onload = () => { logoRef.current = img; };
    }, []);

    // 1. Cleanup & Init
    useEffect(() => {
        if (!isOpen) {
            stopStream(); // Ensure cleanup when closed
            return;
        }

        // ─── Reset state on each open so the shutter is never stuck disabled ───
        setCaptures([]);
        setPreviewItem(null);
        setIsSaving(false);
        isSavingRef.current = false;
        setFlashMsg(null);
        // ─────────────────────────────────────────────────────────────────────────

        if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
            setFlashMsg("Camera yêu cầu HTTPS hoặc Localhost");
            return;
        }

        // GPS Watch
        let watchId: number | null = null;
        if ('geolocation' in navigator) {
            watchId = navigator.geolocation.watchPosition(
                (pos) => setGpsLocation(`${pos.coords.latitude.toFixed(6)}, ${pos.coords.longitude.toFixed(6)}`),
                (err) => console.warn("GPS Error", err),
                { enableHighAccuracy: true, maximumAge: 0, timeout: 5000 }
            );
        }

        // Orientation Watch (Gravity Alignment)
        const handleOrientation = (event: DeviceOrientationEvent) => {
            const { beta, gamma } = event;
            if (beta === null || gamma === null) return;

            let angle = 0;
            if (Math.abs(gamma) > 45) {
                angle = gamma > 0 ? -90 : 90;
            } else if (beta < -45) {
                angle = 180; // Upside down
            }
            setRotationAngle(angle);
        };
        window.addEventListener('deviceorientation', handleOrientation);

        // Cameras
        navigator.mediaDevices.enumerateDevices().then(devices => {
            const vDevs = devices.filter(d => d.kind === 'videoinput');
            setCameras(vDevs);
            if (vDevs.length > 0) setSelectedCameraId(vDevs[0].deviceId);
        });

        // Trigger stream start
        handleStreamStart();

        return () => {
            stopStream();
            if (watchId !== null) navigator.geolocation.clearWatch(watchId);
            window.removeEventListener('deviceorientation', handleOrientation);
        };
    }, [isOpen]);

    // 2. Stream Management
    const streamLockRef = useRef(false);

    // Re-trigger stream when camera config changes, but ONLY if open
    useEffect(() => {
        if (isOpen) handleStreamStart();
    }, [selectedCameraId, facingMode]);

    const handleStreamStart = async () => {
        if (streamLockRef.current) return;
        streamLockRef.current = true;
        await startStream(selectedCameraId);
        streamLockRef.current = false;
    };

    const stopStream = () => {
        if (videoRef.current && videoRef.current.srcObject) {
            const stream = videoRef.current.srcObject as MediaStream;
            stream.getTracks().forEach(t => {
                t.stop();
                stream.removeTrack(t);
            });
            videoRef.current.srcObject = null;
        }
        if (stream) {
            stream.getTracks().forEach(t => t.stop());
            setStream(null);
        }
        if (timerRef.current) clearInterval(timerRef.current);
        if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };

    const startStream = async (deviceId?: string, retryCount = 0) => {
        stopStream();
        // Give hardware a moment to release
        await new Promise(r => setTimeout(r, 200));

        try {
            const constraints: MediaStreamConstraints = {
                video: deviceId
                    ? { deviceId: { exact: deviceId } }
                    : { facingMode: facingMode }, // Use state
                audio: mode === 'video'
            };

            console.log("Requesting camera with constraints:", JSON.stringify(constraints));
            const newStream = await navigator.mediaDevices.getUserMedia(constraints);

            if (videoRef.current) {
                videoRef.current.srcObject = newStream;
                // Wait for video to be ready
                videoRef.current.onloadedmetadata = async () => {
                    try {
                        await videoRef.current?.play();
                    } catch (e) {
                        console.warn("Play interrupted", e);
                    }
                };
            }

            setStream(newStream);
            setFlashMsg(null);

            // Zoom Capabilities
            const track = newStream.getVideoTracks()[0];
            const caps = track.getCapabilities ? track.getCapabilities() : {};
            // @ts-ignore
            if (caps.zoom) {
                // @ts-ignore
                setMaxZoom(caps.zoom.max || 1);
                setZoom(1);
            }

        } catch (err: any) {
            console.error("Camera Error", err);

            // Retry logic for NotReadableError (hardware lock) or general failure
            if (retryCount < 2 && (err.name === 'NotReadableError' || err.name === 'NotAllowedError' || err.name === 'AbortError')) {
                console.log("Retrying camera access...");
                setTimeout(() => startStream(deviceId, retryCount + 1), 500);
                return;
            }

            // Fallback: If specific device failed, try generic environment
            if (deviceId && retryCount === 2) {
                console.log("Falling back to generic environment camera");
                startStream(undefined, 3); // force fallback
                return;
            }

            setFlashMsg("Lỗi truy cập camera: " + (err.message || err.name));
        }
    };

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

    const isSavingRef = useRef(false);

    const handleConfirm = () => {
        if (isSavingRef.current || isSaving) return; // Prevent double trigger synchronously

        const selectedItems = captures.filter(c => c.selected);
        const selectedCount = selectedItems.length;
        const totalCount = (props.existingImageCount || 0) + selectedCount;

        if (requiredImageCount > 0 && totalCount !== requiredImageCount) {
            const existing = props.existingImageCount || 0;
            alert(`Yêu cầu tổng cộng ${requiredImageCount} ảnh.\n- Đã có sẵn: ${existing} ảnh\n- Bạn chọn thêm: ${selectedCount} ảnh\n- Tổng cộng: ${totalCount} ảnh\n\nVui lòng chọn đúng số lượng yêu cầu.`);
            return;
        }

        isSavingRef.current = true;
        setIsSaving(true);
        onCapture(selectedItems.map(c => c.data));
        // Modal will be unmounted by parent, so we don't need to reset isSaving usually
    };

    // 3. Capture Handler
    const handleCapture = async () => {
        if (mode === 'photo') {
            await capturePhoto();
        } else {
            toggleRecording();
        }
    };

    const capturePhoto = async () => {
        if (!videoRef.current || !canvasRef.current) return;
        setFlashMsg("Đang xử lý...");

        // Timeout to render UI update
        setTimeout(async () => {
            if (!videoRef.current || !canvasRef.current) return;
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

            // 2. Check Orientation for Force Portrait
            // Priority: Device Sensor (rotationAngle) -> Video Dimensions (sw > sh)
            // If phone is held Landscape (90 or -90), we want to rotate to Portrait.
            // If rotationAngle is 0, we check if video is wider than tall (Landscape feed).

            // We want the Final Canvas to be Portrait (Height > Width)
            // If currently Landscape, we swap dimensions.
            const MAX_DIM = 2400; // Higher quality
            // Scale logic
            const scale = Math.min(1, MAX_DIM / Math.max(sw, sh));

            // Base Destination Size
            let destW = sw * scale;
            let destH = sh * scale;

            // 3. Setup Canvas
            const ctx = canvas.getContext('2d');
            if (!ctx) return;

            // FIX: Only rotate if sensor explicitly says 90/-90. 
            const needsRotation = Math.abs(rotationAngle) === 90;

            if (needsRotation) {
                // Swap W/H for the container
                canvas.width = destH;
                canvas.height = destW;

                // Rotation Logic
                ctx.translate(canvas.width / 2, canvas.height / 2);

                // Determine rotation degrees
                // If sensor says 90/-90, use that reversed to upright.
                // If sensor is 0 but video is landscape, default to -90 (standard CW landscape).
                let rotDeg = 0;
                if (rotationAngle !== 0) {
                    rotDeg = -rotationAngle;
                } else {
                    rotDeg = -90;
                }

                ctx.rotate(rotDeg * Math.PI / 180);

                // Draw Image centered
                ctx.drawImage(video, sx, sy, sw, sh, -destW / 2, -destH / 2, destW, destH);

                // IMPORTANT: Reset Transform so subsequent draws (watermark) are standard
                ctx.setTransform(1, 0, 0, 1, 0, 0);
            } else {
                // Standard Portrait
                canvas.width = destW;
                canvas.height = destH;
                ctx.drawImage(video, sx, sy, sw, sh, 0, 0, destW, destH);
            }

            try {
                // Pass current GPS and Rotation (No User Name)
                const result = await addWatermarkToCanvas(canvas, gpsLocation || undefined, 0); // Rotation handled above

                const newItem: CapturedItem = {
                    id: Date.now().toString(),
                    data: result,
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
            }
        }, 50);
    };

    // 4. Video Recording Logic (Real-time Watermark)
    const toggleRecording = () => {
        if (isRecording) {
            stopRecording();
        } else {
            startRecording();
        }
    };

    const startRecording = () => {
        if (!stream || !videoRef.current) return;

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

        // Start Canvas Loop
        const drawLoop = () => {
            if (!videoRef.current || !ctx) return;

            // Draw Cropped Video Frame
            ctx.drawImage(videoRef.current, sx, sy, sw, sh, 0, 0, destW, destH);

            // Draw Watermark
            const now = new Date();
            const ts = now.toLocaleString('vi-VN');

            drawWatermarkFrame(
                ctx, destW, destH,
                ts, gpsLocation || 'GPS...', logoRef.current, mutationRotation(rotationAngle)
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
        if (mediaRecorderRef.current && isRecording) {
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
        <div className="fixed inset-0 z-[99999] bg-black/90 backdrop-blur-sm flex items-center justify-center p-0 md:p-6 font-sans h-[100dvh] w-[100vw] touch-none">
            {/* Modal Container */}
            <div className="relative w-full h-full md:w-full md:max-w-5xl md:h-auto md:aspect-video bg-black rounded-none md:rounded-3xl overflow-hidden shadow-2xl ring-1 ring-white/10 flex flex-col">

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
                        <button onClick={switchCamera} className="p-3 bg-black/50 backdrop-blur-md rounded-full text-white hover:bg-white/20 transition-colors"><SwitchCamera className="w-5 h-5" /></button>
                    </div>
                </div>

                {/* Video Viewport */}
                <div className="flex-1 relative bg-black overflow-hidden group">
                    {/* Preview Mode Overlay */}
                    {previewItem ? (
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
                        </div>
                    ) : (
                        /* Live Camera View */
                        <>
                            <video
                                ref={videoRef}
                                autoPlay
                                playsInline
                                muted={!isRecording}
                                className="absolute inset-0 w-full h-full object-cover"
                                style={{ transform: facingMode === 'user' ? 'scaleX(-1)' : 'none' }}
                            />

                            {/* Zoom Slider Overlay */}
                            {maxZoom > 1 && (
                                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 w-64 bg-black/30 backdrop-blur-md p-2 rounded-full flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity z-20">
                                    <ZoomOut className="w-4 h-4 text-white" />
                                    <input
                                        type="range" min="1" max={maxZoom} step="0.1" value={zoom} onChange={handleZoomChange}
                                        className="flex-1 h-1 bg-white/50 rounded-lg appearance-none cursor-pointer"
                                    />
                                    <ZoomIn className="w-4 h-4 text-white" />
                                </div>
                            )}
                        </>
                    )}

                    {flashMsg && (
                        <div className="absolute inset-0 flex items-center justify-center z-30 pointer-events-none">
                            <div className="bg-black/70 backdrop-blur text-white px-6 py-3 rounded-2xl font-bold animate-fade-in">{flashMsg}</div>
                        </div>
                    )}
                </div>

                <canvas ref={canvasRef} className="hidden" />

                {/* Bottom Controls */}
                <div className="flex-none bg-black/80 backdrop-blur-md py-4 px-6 flex flex-col items-center gap-4 z-20 border-t border-white/10 safe-area-bottom">

                    {/* Gallery / Selection Strip */}
                    {captures.length > 0 && (
                        <div className="w-full flex gap-2 overflow-x-auto pb-2 custom-scrollbar">
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
                    )}

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
                            disabled={isSaving}
                            className={`w-16 h-16 rounded-full border-4 flex items-center justify-center transition-all transform active:scale-95 ${mode === 'photo'
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
                </div>
            </div>
        </div>,
        document.body
    );
};

export default CameraModal;
