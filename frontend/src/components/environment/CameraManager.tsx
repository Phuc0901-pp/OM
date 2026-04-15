import React, { useRef, useCallback, useState } from 'react';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Capacitor } from '@capacitor/core';
import CameraModal from '../common/CameraModal';
import { Config } from '../../pages/user/environment/types';

const CameraManager = React.forwardRef<{
    openCamera: (assignId: string, taskId: string, stage: string) => Promise<void>;
    fileInputRef: React.RefObject<HTMLInputElement>;
    updateNextTask: (nextName: string | null, onNext: ((data: (string | Blob)[]) => void) | null) => void;
}, {
    onCapture: (data: (string | Blob)[]) => void;
    currentConfig?: Config | null;
    existingImageCount: number;
    nextTaskName?: string | null;
    onNextTask?: (data: (string | Blob)[]) => void;
    watermarkInfo?: string[];
}>((props, ref) => {
    const [isOpen, setIsOpen] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const captureContext = useRef<{ assignId: string, taskId: string, stage: string } | null>(null);

    // Next task info — updated imperatively via updateNextTask so we don't remount the modal
    const [nextTaskName, setNextTaskName] = useState<string | null>(props.nextTaskName || null);
    const [onNextTask, setOnNextTask] = useState<((data: (string | Blob)[]) => void) | null>(props.onNextTask || null);

    const openCamera = useCallback(async (assignId: string, taskId: string, stage: string) => {
        captureContext.current = { assignId, taskId, stage };
        
        // Luôn sử dụng WebRTC CameraModal (dùng React state isOpen) cho MỌI nền tảng 
        // để kích hoạt tính năng Chụp liên tiếp (Continuous Shooting) và Add Watermark trực tiếp.
        setIsOpen(true);
    }, []);

    // Expose openCamera + updateNextTask to parent via ref
    React.useImperativeHandle(ref, () => ({
        openCamera,
        fileInputRef,
        updateNextTask: (nextName: string | null, onNext: ((data: (string | Blob)[]) => void) | null) => {
            setNextTaskName(nextName);
            setOnNextTask(() => onNext);
        }
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
                    status_set_image_count={props.currentConfig?.status_set_image_count ?? true}
                    nextTaskName={nextTaskName}
                    onNextTask={onNextTask || undefined}
                    watermarkInfo={props.watermarkInfo}
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
