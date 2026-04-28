import React, { useState } from 'react';
import { X, CheckCircle } from 'lucide-react';

interface ModelProjectModalProps {
 isOpen: boolean;
 onClose: () => void;
 onSubmit: (name: string) => Promise<void>;
}

const ModelProjectModal: React.FC<ModelProjectModalProps> = ({ isOpen, onClose, onSubmit }) => {
 const [name, setName] = useState('');
 const [loading, setLoading] = useState(false);
 const [error, setError] = useState('');

 if (!isOpen) return null;

 const handleSubmit = async (e: React.FormEvent) => {
 e.preventDefault();

 if (!name.trim()) {
 setError('Tên loại hình dự án không được để trống');
 return;
 }

 setLoading(true);
 setError('');

 try {
 await onSubmit(name.trim());
 setName('');
 onClose();
 } catch (err: any) {
 setError(err?.response?.data?.error || 'Không thể tạo mới. Vui lòng thử lại.');
 } finally {
 setLoading(false);
 }
 };

 return (
 <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
 <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
 <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-slate-50/50">
 <h3 className="text-lg font-bold text-slate-800">Thêm mới Loại hình dự án</h3>
 <button
 type="button"
 onClick={onClose}
 className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-slate-100 rounded-lg transition-colors"
 >
 <X className="w-5 h-5" />
 </button>
 </div>

 <form onSubmit={handleSubmit} className="p-6">
 {error && (
 <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm mb-4 border border-red-100">
 {error}
 </div>
 )}

 <div className="space-y-4">
 <div>
 <label className="block text-sm font-semibold text-slate-700 mb-1.5">
 Tên loại hình dự án <span className="text-red-500">*</span>
 </label>
 <input
 type="text"
 value={name}
 onChange={(e) => {
 setName(e.target.value);
 if (error) setError('');
 }}
 placeholder="VD: Bảo dương định kỳ, Quét nhiệt Inverter..."
 className="w-full bg-slate-50 border border-slate-200 text-slate-700 rounded-lg p-3 outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
 autoFocus
 />
 </div>
 </div>

 <div className="mt-8 flex items-center justify-end gap-3">
 <button
 type="button"
 onClick={onClose}
 disabled={loading}
 className="px-4 py-2 text-slate-600 font-medium hover:bg-slate-100 rounded-lg transition-colors"
 >
 Hủy bỏ
 </button>
 <button
 type="submit"
 disabled={loading || !name.trim()}
 className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg shadow-sm shadow-indigo-200 flex items-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
 >
 {loading ? (
 <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
 ) : (
 <CheckCircle className="w-4 h-4" />
 )}
 Xác nhận Tạo
 </button>
 </div>
 </form>
 </div>
 </div>
 );
};

export default ModelProjectModal;
