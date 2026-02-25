import React, { useRef, useState } from 'react';
import { Upload, FileText, Scan, Sparkles, Image as ImageIcon } from 'lucide-react';
import { motion } from 'framer-motion';

interface Props {
    onUpload: (file: File) => void;
    isProcessing: boolean;
}

const TemplateUploader: React.FC<Props> = ({ onUpload, isProcessing }) => {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isDragging, setIsDragging] = useState(false);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            console.log("File selected:", e.target.files[0].name);
            onUpload(e.target.files[0]);
        }
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            console.log("File dropped:", e.dataTransfer.files[0].name);
            onUpload(e.dataTransfer.files[0]);
        }
    };

    return (
        <div className="w-full max-w-2xl">
            <div className="text-center mb-8">
                <h2 className="text-3xl font-black text-slate-800 mb-2">Bắt đầu với hình mẫu</h2>
                <p className="text-slate-500 text-lg">Upload ảnh chụp hoặc file PDF báo cáo mẫu. AI sẽ tự động học bố cục.</p>
            </div>

            <motion.div
                layout
                className={`relative group rounded-3xl border-3 border-dashed transition-all duration-300 overflow-hidden bg-white
                ${isDragging ? 'border-indigo-500 bg-indigo-50/50 scale-[1.02]' : 'border-slate-300 hover:border-indigo-400 hover:shadow-xl'}
                ${isProcessing ? 'pointer-events-none border-indigo-200' : 'cursor-pointer'}
                `}
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                onClick={() => {
                    console.log("Uploader clicked");
                    fileInputRef.current?.click();
                }}
            >
                <input ref={fileInputRef} type="file" accept="image/png, image/jpeg, image/jpg, application/pdf" className="hidden" onChange={handleFileChange} />

                <div className="p-16 flex flex-col items-center justify-center min-h-[400px]">
                    {isProcessing ? (
                        <div className="flex flex-col items-center">
                            <div className="relative w-32 h-32 mb-8">
                                {/* AI Scanning Effect */}
                                <div className="absolute inset-0 bg-indigo-100 rounded-2xl animate-pulse"></div>
                                <motion.div
                                    className="absolute inset-0 bg-gradient-to-b from-transparent via-indigo-500/20 to-transparent w-full h-1/2"
                                    animate={{ top: ['0%', '100%', '0%'] }}
                                    transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                                />
                                <div className="absolute inset-0 border-2 border-indigo-500 rounded-2xl opacity-50"></div>
                                <Scan className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-12 h-12 text-indigo-600" />
                            </div>
                            <h3 className="text-xl font-bold text-slate-800 mb-2 animate-pulse">Đang phân tích bố cục...</h3>
                            <p className="text-slate-500 font-medium">AI đang nhận diện các ô trống và tiêu đề</p>
                        </div>
                    ) : (
                        <>
                            <div className={`w-24 h-24 rounded-full bg-slate-50 flex items-center justify-center mb-6 transition-transform group-hover:scale-110 ${isDragging ? 'bg-indigo-100 text-indigo-600' : 'text-slate-400'}`}>
                                {isDragging ? <Upload className="w-10 h-10 animate-bounce" /> : <ImageIcon className="w-10 h-10" />}
                            </div>
                            <h3 className={`text-2xl font-bold mb-3 ${isDragging ? 'text-indigo-600' : 'text-slate-700'}`}>
                                {isDragging ? 'Thả file vào đây' : 'Kéo thả hoặc Click để Upload'}
                            </h3>
                            <p className="text-slate-400 text-sm font-medium mb-8">Hỗ trợ: JPG, PNG, PDF (Max 10MB)</p>

                            <div className="flex items-center gap-4">
                                <span className="px-4 py-2 bg-slate-100 rounded-lg text-xs font-bold text-slate-500 flex items-center gap-2">
                                    <FileText className="w-4 h-4" /> Báo cáo ngày
                                </span>
                                <span className="px-4 py-2 bg-slate-100 rounded-lg text-xs font-bold text-slate-500 flex items-center gap-2">
                                    <Scan className="w-4 h-4" /> Checklist thiết bị
                                </span>
                            </div>
                        </>
                    )}
                </div>
            </motion.div>

            {!isProcessing && (
                <div className="mt-8 flex justify-center">
                    <div className="flex items-center gap-2 text-indigo-600 bg-indigo-50 px-4 py-2 rounded-full text-sm font-bold opacity-80">
                        <Sparkles className="w-4 h-4" />
                        Powered by Antigravity AI Vision
                    </div>
                </div>
            )}
        </div>
    );
};

export default TemplateUploader;
