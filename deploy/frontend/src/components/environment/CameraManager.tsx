import React, { useRef, useCallback, useState } from 'react';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Capacitor } from '@capacitor/core';
import CameraModal from '../common/CameraModal';
import { StationChildConfig } from '../../pages/user/environment/types';

interface CameraManagerProps {
    onCapture: (data: (string | Blob)[]) => void;
    // We expose a ref or similar so parent can call openCamera, 
    // or we use an imperative handle. For simplicity in this refactor, 
    // we might just return the UI and function if we used a hook, 
    // but as a component, it renders the Modal and Input.
    // Let's use `forwardRef` or just pass the control state down if we want.
    // Actually, extracting the *logic* to a hook `useCameraManager` might be cleaner,
    // but the request was "Component". Let's make a component that renders the hidden input and modal.
    isCameraOpen: boolean;
    setIsCameraOpen: (val: boolean) => void;
    currentConfig?: StationChildConfig;
    existingImageCount: number;
}

// We need a way to invoke the "Open Camera" action from the parent.
// The parent has the `openCamera` function. 
// Let's create a Helper Component that just holds the Modal and Input.

const CameraManager = React.forwardRef<{
    openCamera: (assignId: string, taskId: string, stage: string) => Promise<void>;
    fileInputRef: React.RefObject<HTMLInputElement>;
}, {
    onCapture: (data: (string | Blob)[]) => void;
    currentConfig?: StationChildConfig | null;
    existingImageCount: number;
}>((props, ref) => {
    const [isOpen, setIsOpen] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    // Context to track what we are capturing for
    const captureContext = useRef<{ assignId: string, taskId: string, stage: string } | null>(null);

    const openCamera = useCallback(async (assignId: string, taskId: string, stage: string) => {
        captureContext.current = { assignId, taskId, stage };
        if (Capacitor.isNativePlatform()) {
            try {
                const image = await Camera.getPhoto({
                    quality: 60,
                    width: 1024,
                    allowEditing: false,
                    resultType: CameraResultType.DataUrl,
                    source: CameraSource.Camera,
                    saveToGallery: false
                });
                if (image.dataUrl) {
                    props.onCapture([image.dataUrl]);
                }
            } catch (e) {
                console.error('Native Camera failed:', e);
            }
        } else {
            setIsOpen(true);
        }
    }, [props]);

    // Expose openCamera to parent
    React.useImperativeHandle(ref, () => ({
        openCamera,
        fileInputRef
    }));

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file && captureContext.current) {
            const reader = new FileReader();
            reader.onloadend = () => {
                if (reader.result) {
                    props.onCapture([reader.result as string]);
                }
                captureContext.current = null;
                if (fileInputRef.current) fileInputRef.current.value = '';
            };
            reader.readAsDataURL(file);
        }
    };

    return (
        <>
            {isOpen && (
                <CameraModal
                    isOpen={isOpen}
                    onClose={() => setIsOpen(false)}
                    onCapture={(data) => {
                        props.onCapture(data);
                        setIsOpen(false);
                    }}
                    requiredImageCount={props.currentConfig?.image_count || 0}
                    existingImageCount={props.existingImageCount}
                />
            )}
            <input
                type="file"
                accept="image/*"
                capture="environment"
                ref={fileInputRef}
                style={{ display: 'none' }}
                onChange={handleFileChange}
            />
        </>
    );
});

export default CameraManager;
