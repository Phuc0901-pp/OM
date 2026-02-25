import React, { useState } from 'react';
import ReactDOM from 'react-dom';
import { X, Camera, CheckCircle2, User, CreditCard, Shield, Wrench, FileText, ZoomIn, Trash2, Plus } from 'lucide-react';
import CameraModal from './common/CameraModal';
import PremiumButton from './common/PremiumButton';

interface CheckInModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (photos: CheckInPhotos) => void;
    loading: boolean;
    mode?: 'checkin' | 'checkout';
}

export interface CheckInPhotos {
    personnel_photo: string[];
    id_card_front: string | null;
    id_card_back: string | null;
    safety_card_front: string | null;
    safety_card_back: string | null;
    tools_photos: string[];
    documents_photos: string[];
}

const CheckInModal: React.FC<CheckInModalProps> = ({ isOpen, onClose, onSubmit, loading, mode = 'checkin' }) => {
    const [photos, setPhotos] = useState<CheckInPhotos>({
        personnel_photo: [], id_card_front: null, id_card_back: null, safety_card_front: null, safety_card_back: null, tools_photos: [], documents_photos: []
    });

    const [previewImage, setPreviewImage] = useState<string | null>(null);
    const [showCamera, setShowCamera] = useState(false);
    const [currentField, setCurrentField] = useState<{ field: keyof CheckInPhotos; isArray: boolean } | null>(null);

    const openCamera = (field: keyof CheckInPhotos, isArray: boolean = false) => {
        setCurrentField({ field, isArray });
        setShowCamera(true);
    };

    const handleCameraCapture = (data: string | Blob | (string | Blob)[]) => {
        if (!currentField) {
            console.error("CheckInModal: currentField is null, cannot save photos");
            setShowCamera(false);
            return;
        }

        const items = Array.isArray(data) ? data : [data];

        items.forEach(item => {
            // Handle Photo (Base64 String)
            if (typeof item === 'string') {
                if (currentField.isArray) {
                    setPhotos(prev => ({ ...prev, [currentField.field]: [...(prev[currentField.field] as string[]), item] }));
                } else {
                    setPhotos(prev => ({ ...prev, [currentField.field]: item }));
                }
            } else {
                // Handle Video (Blob) - Currently ignored as CheckInPhotos expects strings
                console.warn("Video capture not supported in CheckInModal");
            }
        });

        setShowCamera(false);
        setCurrentField(null);
    };

    const handleDeletePhoto = (field: keyof CheckInPhotos, index?: number) => {
        if (Array.isArray(photos[field])) {
            setPhotos(prev => ({ ...prev, [field]: (prev[field] as string[]).filter((_, i) => i !== index) }));
        } else {
            setPhotos(prev => ({ ...prev, [field]: null }));
        }
    };

    const handleSubmit = () => {
        if (photos.personnel_photo.length === 0) {
            alert('Vui lòng chụp ít nhất 1 ảnh nhân sự/xác thực!');
            return;
        }

        // Filter out null values before sending
        const photoData: any = {};
        if (photos.personnel_photo.length > 0) photoData.personnel_photo = photos.personnel_photo;
        if (photos.id_card_front) photoData.id_card_front = photos.id_card_front;
        if (photos.id_card_back) photoData.id_card_back = photos.id_card_back;
        if (photos.safety_card_front) photoData.safety_card_front = photos.safety_card_front;
        if (photos.safety_card_back) photoData.safety_card_back = photos.safety_card_back;
        if (photos.tools_photos.length > 0) photoData.tools_photos = photos.tools_photos;
        if (photos.documents_photos.length > 0) photoData.documents_photos = photos.documents_photos;

        onSubmit(photoData);
    };

    const isComplete = photos.personnel_photo.length > 0;

    if (!isOpen) return null;

    return (
        <>
            <CameraModal
                isOpen={showCamera}
                onClose={() => { setShowCamera(false); setCurrentField(null); }}
                onCapture={handleCameraCapture}
            />

            {isOpen && ReactDOM.createPortal(
                <div className="fixed inset-0 z-[9999] flex items-end md:items-center justify-center bg-black/60 backdrop-blur-md transition-all">
                    {/* Modal Container: Full screen on mobile, Centered card on desktop */}
                    <div className="relative w-full h-full md:h-auto md:max-w-3xl md:max-h-[90vh] bg-white md:rounded-3xl shadow-2xl flex flex-col overflow-hidden safe-top safe-bottom">

                        {/* Header */}
                        <div className={`flex-none bg-gradient-to-r ${mode === 'checkin' ? 'from-emerald-600 to-teal-600' : 'from-orange-600 to-red-600'} p-4 md:p-6 shadow-lg z-10`}>
                            <div className="flex items-center justify-between text-white">
                                <div className="flex items-center gap-3">
                                    <div className="p-2.5 bg-white/20 backdrop-blur-md rounded-xl"><Camera className="w-6 h-6" /></div>
                                    <div>
                                        <h2 className="text-xl md:text-2xl font-black tracking-tight">{mode === 'checkin' ? 'Check-in Checklist' : 'Check-out Verification'}</h2>
                                        <p className={`${mode === 'checkin' ? 'text-emerald-100' : 'text-orange-100'} font-medium text-xs md:text-sm`}>
                                            {mode === 'checkin' ? 'Chụp ảnh xác thực tại dự án' : 'Chụp ảnh xác nhận rời dự án'}
                                        </p>
                                    </div>
                                </div>
                                <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-xl transition-colors"><X className="w-6 h-6" /></button>
                            </div>
                        </div>

                        {/* Content (Scrollable) */}
                        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4 bg-slate-50/50">
                            <MultiPhotoItem
                                icon={User}
                                title="Ảnh nhân sự"
                                required
                                photos={photos.personnel_photo}
                                onCapture={() => openCamera('personnel_photo', true)}
                                onDelete={(index) => handleDeletePhoto('personnel_photo', index)}
                                onPreview={setPreviewImage}
                                color="blue"
                            />

                            {mode === 'checkin' && (
                                <>
                                    <SinglePhotoItem icon={CreditCard} title="CCCD - Mặt trước" required={false} photo={photos.id_card_front} onCapture={() => openCamera('id_card_front')} onDelete={() => handleDeletePhoto('id_card_front')} onPreview={setPreviewImage} color="indigo" />
                                    <SinglePhotoItem icon={CreditCard} title="CCCD - Mặt sau" required={false} photo={photos.id_card_back} onCapture={() => openCamera('id_card_back')} onDelete={() => handleDeletePhoto('id_card_back')} onPreview={setPreviewImage} color="purple" />
                                    <SinglePhotoItem icon={Shield} title="Thẻ an toàn - Mặt trước" required={false} photo={photos.safety_card_front} onCapture={() => openCamera('safety_card_front')} onDelete={() => handleDeletePhoto('safety_card_front')} onPreview={setPreviewImage} color="green" />
                                    <SinglePhotoItem icon={Shield} title="Thẻ an toàn - Mặt sau" required={false} photo={photos.safety_card_back} onCapture={() => openCamera('safety_card_back')} onDelete={() => handleDeletePhoto('safety_card_back')} onPreview={setPreviewImage} color="green" />
                                    <MultiPhotoItem icon={Wrench} title="Công cụ" required={false} photos={photos.tools_photos} onCapture={() => openCamera('tools_photos', true)} onDelete={(index) => handleDeletePhoto('tools_photos', index)} onPreview={setPreviewImage} color="orange" />
                                    <MultiPhotoItem icon={FileText} title="Biên bản" required={false} photos={photos.documents_photos} onCapture={() => openCamera('documents_photos', true)} onDelete={(index) => handleDeletePhoto('documents_photos', index)} onPreview={setPreviewImage} color="pink" />
                                </>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="flex-none bg-white p-4 md:p-6 border-t border-slate-100 shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.1)] z-10">
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-2">
                                    {isComplete ? (
                                        <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-100 text-emerald-700 rounded-lg font-bold text-sm">
                                            <CheckCircle2 className="w-4 h-4" /> <span className="hidden md:inline">Đã hoàn thành mục bắt buộc</span><span className="md:hidden">Đủ ảnh</span>
                                        </div>
                                    ) : (
                                        <span className="text-sm text-slate-500 font-medium italic">Vui lòng chụp đủ ảnh có dấu *</span>
                                    )}
                                </div>
                            </div>
                            <div className="flex gap-4">
                                <PremiumButton variant="ghost" onClick={onClose} className="flex-1">Hủy</PremiumButton>
                                <PremiumButton
                                    variant="success"
                                    onClick={handleSubmit}
                                    disabled={!isComplete || loading}
                                    loading={loading}
                                    className="flex-[2] shadow-lg shadow-emerald-200"
                                    icon={<CheckCircle2 className="w-5 h-5" />}
                                >
                                    Xác nhận
                                </PremiumButton>
                            </div>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {previewImage && ReactDOM.createPortal(
                <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/95 backdrop-blur-xl animate-in fade-in duration-200" onClick={() => setPreviewImage(null)}>
                    <button
                        onClick={() => setPreviewImage(null)}
                        className="absolute top-4 right-4 p-3 bg-white/10 hover:bg-red-600 rounded-full text-white/80 hover:text-white backdrop-blur-md transition-all shadow-2xl z-50 group border border-white/10"
                    >
                        <X className="w-8 h-8 group-hover:scale-110 transition-transform" />
                    </button>
                    <img
                        src={previewImage}
                        alt="Preview"
                        className="max-w-[85vw] max-h-[85vh] object-contain rounded-lg shadow-2xl animate-zoom-in duration-300 pointer-events-auto"
                        onClick={(e) => e.stopPropagation()}
                    />
                </div>,
                document.body
            )}
        </>
    );
};

interface SinglePhotoItemProps {
    icon: React.ElementType; title: string; required: boolean; photo: string | null; onCapture: () => void; onDelete: () => void; onPreview: (url: string) => void; color: string;
}

const SinglePhotoItem: React.FC<SinglePhotoItemProps> = ({ icon: Icon, title, required, photo, onCapture, onDelete, onPreview, color }) => {
    const gradients: Record<string, string> = {
        blue: 'from-blue-500 to-blue-600', indigo: 'from-indigo-500 to-indigo-600', purple: 'from-purple-500 to-purple-600', green: 'from-emerald-500 to-teal-600', orange: 'from-orange-500 to-red-500', pink: 'from-pink-500 to-rose-500'
    };

    return (
        <div className="p-4 bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all">
            <div className="flex items-start gap-4">
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${gradients[color]} flex items-center justify-center shadow-lg text-white`}><Icon className="w-6 h-6" /></div>
                <div className="flex-1">
                    <div className="flex items-center gap-2 mb-3">
                        <h3 className="font-bold text-slate-800">{title}</h3>
                        {required && <span className="text-red-500 font-bold">*</span>}
                    </div>
                    {photo ? (
                        <div className="relative group overflow-hidden rounded-xl border-2 border-emerald-500/50 cursor-pointer" onClick={() => onPreview(photo)}>
                            <img src={photo} alt={title} className="w-full h-48 object-cover transition-transform group-hover:scale-105" />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center gap-3 backdrop-blur-[2px]">
                                <button onClick={(e) => { e.stopPropagation(); onPreview(photo); }} className="p-2 bg-white/20 hover:bg-white/40 rounded-xl text-white backdrop-blur-md transition-all"><ZoomIn className="w-5 h-5" /></button>
                                <button onClick={(e) => { e.stopPropagation(); onDelete(); }} className="p-2 bg-red-500/80 hover:bg-red-600 rounded-xl text-white backdrop-blur-md transition-all shadow-lg shadow-red-500/30"><Trash2 className="w-5 h-5" /></button>
                            </div>
                            <div className="absolute top-2 right-2 bg-emerald-500 text-white text-[10px] font-bold px-2 py-1 rounded-lg shadow-sm flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Đã chụp</div>
                        </div>
                    ) : (
                        <PremiumButton onClick={onCapture} className="w-full" variant="secondary" icon={<Camera className="w-4 h-4" />}>Chụp ảnh</PremiumButton>
                    )}
                </div>
            </div>
        </div>
    );
};

interface MultiPhotoItemProps {
    icon: React.ElementType; title: string; required: boolean; photos: string[]; onCapture: () => void; onDelete: (index: number) => void; onPreview: (url: string) => void; color: string;
}

const MultiPhotoItem: React.FC<MultiPhotoItemProps> = ({ icon: Icon, title, required, photos, onCapture, onDelete, onPreview, color }) => {
    const gradients: Record<string, string> = { orange: 'from-orange-500 to-amber-500', pink: 'from-pink-500 to-rose-500' };

    return (
        <div className="p-4 bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all">
            <div className="flex items-start gap-4">
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${gradients[color]} flex items-center justify-center shadow-lg text-white`}><Icon className="w-6 h-6" /></div>
                <div className="flex-1">
                    <div className="flex items-center gap-2 mb-3">
                        <h3 className="font-bold text-slate-800">{title}</h3>
                        {!required && <span className="text-[10px] font-bold px-2 py-0.5 bg-slate-100 text-slate-500 rounded-full uppercase tracking-wide">Tùy chọn</span>}
                        {photos.length > 0 && <span className="text-[10px] font-bold px-2 py-0.5 bg-blue-100 text-blue-600 rounded-full ml-auto">{photos.length} ảnh</span>}
                    </div>
                    {photos.length > 0 && (
                        <div className="grid grid-cols-3 gap-3 mb-3">
                            {photos.map((photo, index) => (
                                <div key={index} className="relative group rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all border border-slate-200 cursor-pointer" onClick={() => onPreview(photo)}>
                                    <img src={photo} alt={`${title} ${index + 1}`} className="w-full h-24 object-cover" />
                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center gap-2">
                                        <button onClick={(e) => { e.stopPropagation(); onPreview(photo); }} className="p-1.5 bg-white/20 hover:bg-white/40 rounded-lg text-white"><ZoomIn className="w-4 h-4" /></button>
                                        <button onClick={(e) => { e.stopPropagation(); onDelete(index); }} className="p-1.5 bg-red-500/80 hover:bg-red-600 rounded-lg text-white"><Trash2 className="w-4 h-4" /></button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                    <PremiumButton onClick={onCapture} className="w-full" variant="secondary" icon={<Plus className="w-4 h-4" />}>Thêm ảnh</PremiumButton>
                </div>
            </div>
        </div>
    );
};

export default CheckInModal;
