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

    // ... (rest of the file) ...



    // ... (rendering) ...


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
            stopStream();
            return;
        }

        if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
            setFlashMsg("Camera không được hỗ trợ");
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

            // Simple Logic: 
            // Portrait: beta ~90 (Upright) -> 0 deg
            // Landscape Left: gamma ~ -90 -> 90 deg?
            // Need to experiment. Visual alignment:
            // If phone rotates 90 deg clockwise, we should rotate watermark -90 deg to stay "up".

            // Approximate calculation
            // Reset to 0 default, refine if needed.
            // For MVP, if Gamma > 45 -> Landscape (-90 deg visible), etc.

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

        startStream();

        return () => {
            stopStream();
            if (watchId !== null) navigator.geolocation.clearWatch(watchId);
            window.removeEventListener('deviceorientation', handleOrientation);
        };
    }, [isOpen]);

    // 2. Stream Management
    useEffect(() => {
        if (isOpen && selectedCameraId) startStream(selectedCameraId);
    }, [selectedCameraId]);

    const stopStream = () => {
        if (videoRef.current && videoRef.current.srcObject) {
            (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop());
            videoRef.current.srcObject = null;
        }
        if (stream) {
            stream.getTracks().forEach(t => t.stop());
            setStream(null);
        }
        if (timerRef.current) clearInterval(timerRef.current);
        if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };

    const startStream = async (deviceId?: string) => {
        stopStream();
        try {
            const constraints: MediaStreamConstraints = {
                video: {
                    deviceId: deviceId ? { exact: deviceId } : undefined,
                    facingMode: 'environment',
                    width: { ideal: 1920 },
                    height: { ideal: 1080 }
                },
                audio: mode === 'video' // Request audio for video mode
            };
            const newStream = await navigator.mediaDevices.getUserMedia(constraints);
            setStream(newStream);
            if (videoRef.current) videoRef.current.srcObject = newStream;

            // Zoom Capabilities
            const track = newStream.getVideoTracks()[0];
            const caps = track.getCapabilities ? track.getCapabilities() : {};
            // @ts-ignore
            if (caps.zoom) {
                // @ts-ignore
                setMaxZoom(caps.zoom.max || 1);
                setZoom(1);
            }

        } catch (err) {
            console.error("Camera Error", err);
            setFlashMsg("Lỗi truy cập camera");
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

    const switchCamera = () => {
        if (cameras.length <= 1) return;
        const idx = cameras.findIndex(c => c.deviceId === selectedCameraId);
        setSelectedCameraId(cameras[(idx + 1) % cameras.length].deviceId);
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

            // WYSIWYG Calculation
            // 1. Get Aspect Ratios
            const videoRatio = video.videoWidth / video.videoHeight;
            // Use client dimensions of the container or video element itself (which is styled object-cover)
            // video.getBoundingClientRect() gives the displayed size
            const rect = video.getBoundingClientRect();
            const clientRatio = rect.width / rect.height;

            // 2. Calculate Visible Source Rect (sx, sy, sw, sh)
            let sx = 0, sy = 0, sw = video.videoWidth, sh = video.videoHeight;

            if (clientRatio > videoRatio) {
                // Screen is wider than video -> Video is cropped top/bottom (zoomed to fit width)
                // Wait, object-cover logic:
                // Scale = rect.width / video.videoWidth? No. 
                // If client > video (Wider): We must crop Top/Bottom? 
                // Example: Video 4:3 (1.33), Screen 16:9 (1.77). 
                // To fill 16:9, we match Width. Height of video is "too tall" relative to width? No.
                // If 4:3 video fits in 16:9 box with object-cover:
                // We zoom until Width matches. 
                // Then (Width / 1.33) is the rendered height. 
                // Screen height is (Width / 1.77). 
                // Rendered Height > Screen Height. We crop Top/Bottom.
                // CORRECT.

                // Effective Source Height = video.videoWidth / clientRatio
                const visibleHeight = video.videoWidth / clientRatio;
                sy = (video.videoHeight - visibleHeight) / 2;
                sh = visibleHeight;
            } else {
                // Screen is taller/narrower -> Video is cropped left/right
                const visibleWidth = video.videoHeight * clientRatio;
                sx = (video.videoWidth - visibleWidth) / 2;
                sw = visibleWidth;
            }

            // 3. Destination Size (Max 1080p, maintain Screen Ratio)
            const MAX_DIM = 1920; // 1080p resolution
            // Scale based on destination/screen max edge
            // Wait, we want high res. rect.width is small (CSS px).
            // We should base it on Source resolution, but cropped.
            // Let's use Source Crop dimensions as baseline, then cap at 1080p.
            const outputScale = Math.min(1, MAX_DIM / Math.max(sw, sh));

            canvas.width = sw * outputScale;
            canvas.height = sh * outputScale;

            const ctx = canvas.getContext('2d');
            if (ctx) {
                // Draw Cropped
                ctx.drawImage(video, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);

                try {
                    // Pass current GPS and Rotation (No User Name)
                    // Note: rotationAngle is device physical tilt. 
                    // Does cropped capture need extra rotation? NO. 
                    // object-cover naturally handles orientation visually. 
                    // If user holds landscape, clientRatio > 1. Capture will be landscape.
                    const result = await addWatermarkToCanvas(canvas, gpsLocation || undefined, rotationAngle);

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
        // Note: Rect might change if resizing? Assume fixed during recording.
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
        // Video encoding is heavy. Limit to 1080p or 720p if needed.
        // Let's match source crop but cap at 1080p equivalent area
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
            // Re-calc crop? If phone rotates during recording? 
            // Better to lock crop config at start or dynamic?
            // Dynamic is expensive (re-get rect). Lock at start is safer for stream stability.
            // But user said "xoay ngang xoay doc". 
            // If user rotates phone, 'rect' changes? 
            // Yes, full screen layout changes. 
            // But 'captureStream' dimension change might break recorder?
            // Most browsers FAIL if stream size changes mid-recording.
            // DECISION: Lock dimensions at start of recording.

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



    const modalContent = (
        <div className="fixed inset-0 z-[9999] bg-black/90 backdrop-blur-sm flex items-center justify-center p-0 md:p-6 font-sans">
            {/* Modal Container (Desktop: Centered Box, Mobile: Full Screen) */}
            <div className="relative w-full h-full md:w-full md:max-w-5xl md:h-auto md:aspect-video bg-black rounded-none md:rounded-3xl overflow-hidden shadow-2xl ring-1 ring-white/10 flex flex-col">

                {/* Header Overlay */}
                <div className="absolute top-0 left-0 right-0 p-4 z-20 flex justify-between items-start pointer-events-none">
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
                            <video ref={videoRef} autoPlay playsInline muted={!isRecording} className="absolute inset-0 w-full h-full object-cover" />

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
                <div className="flex-none bg-black/80 backdrop-blur-md py-4 px-6 flex flex-col items-center gap-4 z-20 border-t border-white/10">

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

                    <div className="w-full flex items-center justify-between">
                        {/* Mode Switcher */}
                        {!isRecording && (
                            <div className="flex bg-white/10 p-1 rounded-full">
                                <button
                                    onClick={() => setMode('photo')}
                                    className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${mode === 'photo' ? 'bg-white text-black shadow-lg' : 'text-white/60 hover:text-white'}`}
                                >
                                    Ảnh
                                </button>
                                <button
                                    onClick={() => setMode('video')}
                                    className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${mode === 'video' ? 'bg-white text-black shadow-lg' : 'text-white/60 hover:text-white'}`}
                                >
                                    Video
                                </button>
                            </div>
                        )}

                        {/* Shutter Button */}
                        <div className="relative">
                            {/* Border Ring Decoration */}
                            <div className={`absolute inset-0 rounded-full border-2 ${mode === 'video' && isRecording ? 'border-red-500/30 scale-150 animate-ping' : 'border-transparent'}`}></div>

                            <button
                                onClick={handleCapture}
                                className={`rounded-full transition-all shadow-xl active:scale-95 flex items-center justify-center relative z-10 ${mode === 'video'
                                    ? isRecording
                                        ? 'w-14 h-14 bg-transparent border-[6px] border-red-500' // Stop Icon style
                                        : 'w-14 h-14 bg-red-600 border-[4px] border-white'
                                    : 'w-14 h-14 bg-white border-[4px] border-slate-300'
                                    }`}
                            >
                                {mode === 'video' && isRecording ? <Square className="w-5 h-5 fill-red-500 text-red-500" /> : null}
                            </button>
                        </div>

                        {/* Confirm / Done Button */}
                        <button
                            onClick={handleConfirm}
                            disabled={captures.length === 0 || isSaving}
                            className={`px-6 py-2 rounded-full font-bold transition-all flex items-center gap-2 ${captures.length > 0 && !isSaving ? 'bg-indigo-600 text-white shadow-lg hover:bg-indigo-500' : 'bg-white/10 text-white/30 cursor-not-allowed'}`}
                        >
                            {isSaving ? (
                                <span>Đang lưu...</span>
                            ) : (
                                <>
                                    <span>Lưu</span>
                                    {captures.filter(c => c.selected).length > 0 && (
                                        <span className="bg-white/20 px-2 py-0.5 rounded-full text-xs">
                                            {captures.filter(c => c.selected).length}
                                        </span>
                                    )}
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );

    // Render to body via portal
    if (typeof document === 'undefined' || !document.body) return null;
    return ReactDOM.createPortal(modalContent, document.body as Element);
};

export default CameraModal;
