import React, { useState } from 'react';
import { Package, Plus, Trash2, ImagePlus, X, UploadCloud } from 'lucide-react';
import type { Asset } from '../../../../types/models';
import type { CustomTask } from '../../../../hooks/manager/useAllocationData';
import GlassCard from '../../../../components/common/GlassCard';
import api from '../../../../services/api';

interface Props {
 assets: Asset[];
 processes: any[];
 customTasks: CustomTask[];
 setCustomTasks: React.Dispatch<React.SetStateAction<CustomTask[]>>;
}

export default function CustomAssetTaskList({ assets, processes, customTasks, setCustomTasks }: Props) {
 const [selectedAssets, setSelectedAssets] = useState<Set<string>>(new Set());
 const [uploadingTaskId, setUploadingTaskId] = useState<string | null>(null);

 const toggleAsset = (assetId: string) => {
 const newSet = new Set(selectedAssets);
 if (newSet.has(assetId)) {
 newSet.delete(assetId);
 // Optional: remove tasks when unticked
 setCustomTasks(customTasks.filter(t => t.id_asset !== assetId));
 } else {
 newSet.add(assetId);
 }
 setSelectedAssets(newSet);
 };

 const handleAddTask = (assetId: string) => {
 setCustomTasks([...customTasks, {
 id: Date.now().toString(),
 id_asset: assetId,
 task_name: '',
 id_process: [],
 status_set_image_count: false,
 image_count: 0,
 guide_text: '',
 guide_images: [] // New field
 }]);
 };

 const handleUpdateTask = (taskId: string, field: keyof CustomTask, value: any) => {
 setCustomTasks(customTasks.map(t => t.id === taskId ? { ...t, [field]: value } : t));
 };

 const handleRemoveTask = (taskId: string) => {
 setCustomTasks(customTasks.filter(t => t.id !== taskId));
 };

 const handleUploadGuideImage = async (taskId: string, e: React.ChangeEvent<HTMLInputElement>) => {
 const file = e.target.files?.[0];
 if (!file) return;

 setUploadingTaskId(taskId);
 const formData = new FormData();
 formData.append('file', file);
 formData.append('target', 'guidelines');

 try {
 const res = await api.post('/upload/guideline', formData, {
 headers: { 'Content-Type': 'multipart/form-data' }
 });
 const task = customTasks.find(t => t.id === taskId);
 if (task && res.data?.url) {
 handleUpdateTask(taskId, 'guide_images', [...(task.guide_images || []), res.data.url]);
 }
 } catch (err) {
 console.error('Upload failed', err);
 alert("Tải ảnh thất bại!");
 } finally {
 setUploadingTaskId(null);
 e.target.value = ''; // Reset input
 }
 };

 const handleRemoveGuideImage = (taskId: string, imgUrl: string) => {
 const task = customTasks.find(t => t.id === taskId);
 if (task) {
 handleUpdateTask(taskId, 'guide_images', task.guide_images.filter(url => url !== imgUrl));
 }
 };

 if (assets.length === 0) {
 return (
 <GlassCard className="flex-1">
 <p className="text-sm text-slate-400 text-center py-8 bg-slate-50 rounded-xl border border-slate-100/50 block">
 Vui lòng chọn dự án để hiển thị danh sách thiết bị.
 </p>
 </GlassCard>
 );
 }

 return (
 <GlassCard className="flex-1 flex flex-col h-full overflow-hidden p-6">
 <div className="flex items-center gap-3 mb-6 border-b border-slate-100 pb-5 shrink-0">
 <div className="p-2.5 bg-indigo-50 rounded-xl border border-indigo-100/50">
 <Package className="w-5 h-5 text-indigo-600" />
 </div>
 <div>
 <h3 className="text-xl font-bold text-slate-800">Danh sách công việc</h3>
 <p className="text-[13px] text-slate-500 mt-1">Chọn vào các tài sản có phát sinh hạng mục đột xuất.</p>
 </div>
 </div>

 <div className="space-y-6 flex-1 overflow-y-auto pr-2 pb-4">
 {assets.map(asset => {
 const isSelected = selectedAssets.has(asset.id);
 const tasksForAsset = customTasks.filter(t => t.id_asset === asset.id);

 return (
 <div key={asset.id} className={`border rounded-xl p-0 relative transition-all duration-200 overflow-hidden ${isSelected ? 'border-indigo-300 shadow-sm shadow-indigo-100/50' : 'border-slate-200 bg-white hover:border-slate-300'}`}>
 <div className={`flex items-center justify-between gap-4 p-4 transition-colors ${isSelected ? 'bg-indigo-50/30' : 'bg-transparent'}`}>
 <label className="flex items-center gap-3 cursor-pointer group flex-1">
 <div className={`flex items-center justify-center w-5 h-5 rounded border ${isSelected ? 'bg-indigo-600 border-indigo-600' : 'bg-white border-slate-300 group-hover:border-indigo-400'}`}>
 {isSelected && <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
 </div>
 <input
 type="checkbox"
 className="hidden"
 checked={isSelected}
 onChange={() => toggleAsset(asset.id)}
 />
 <h4 className={`font-bold text-[15px] flex items-center gap-2 uppercase tracking-wide transition-colors ${isSelected ? 'text-indigo-900' : 'text-slate-500'}`}>
 <span className={`w-2 h-2 rounded-full shadow-sm ${isSelected ? 'bg-indigo-500 shadow-indigo-200' : 'bg-slate-300'}`}></span>
 {asset.name}
 </h4>
 </label>

 {isSelected && (
 <button
 onClick={() => handleAddTask(asset.id)}
 className="flex items-center gap-1.5 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border-2 border-indigo-200 px-3 py-1.5 rounded-lg transition-all ml-auto focus:ring-2 focus:ring-indigo-200"
 >
 <Plus className="w-4 h-4" /> Thêm công việc
 </button>
 )}
 </div>

 {isSelected && (
 <div className="p-5 pt-1 bg-white space-y-4 border-t border-indigo-100/50">
 {tasksForAsset.length > 0 ? (
 <div className="space-y-4">
 {tasksForAsset.map(task => (
 <div key={task.id} className="bg-white border text-sm border-slate-200 rounded-xl p-4 md:p-5 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] relative group">

 {/* Nút Xóa Task */}
 <button
 onClick={() => handleRemoveTask(task.id)}
 title="Xóa công việc này"
 className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center text-red-400 hover:text-red-600 bg-red-50 hover:bg-red-100/80 border border-red-100 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
 >
 <Trash2 className="w-4 h-4" />
 </button>

 <div className="flex flex-col gap-y-5 pr-10 w-full overflow-hidden">
 {/* Row 1: Tên & Quy trình */}
 <div className="flex flex-wrap gap-4 w-full">
 <div className="flex-1 min-w-[200px]">
 <label className="block text-[11px] uppercase font-bold text-slate-500 mb-1.5">Tên Công Việc <span className="text-red-500">*</span></label>
 <input
 type="text"
 className="w-full text-sm py-2 px-3 border border-slate-200 rounded-lg bg-white outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all font-medium text-slate-700 placeholder:font-normal placeholder:text-slate-400"
 placeholder="Nhập tên nhiệm vụ (VD: Trám mái, Thay Jack...)"
 value={task.task_name}
 onChange={e => handleUpdateTask(task.id, 'task_name', e.target.value)}
 />
 </div>
 <div className="flex-1 min-w-[200px]">
 <label className="block text-[11px] uppercase font-bold text-slate-500 mb-1.5">Quy trình bắt buộc (Chọn khung)</label>
 <select
 multiple
 className="w-full text-sm p-1.5 border border-slate-200 rounded-lg bg-white outline-none min-h-[100px] focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all custom-scrollbar text-slate-700"
 value={task.id_process}
 onChange={e => {
 const opts = Array.from(e.target.selectedOptions, option => option.value);
 handleUpdateTask(task.id, 'id_process', opts);
 }}
 >
 {processes.map(p => (
 <option key={p.id} value={p.id} className="py-1 px-2 mb-0.5 rounded-md hover:bg-indigo-50 cursor-pointer">{p.name}</option>
 ))}
 </select>
 </div>
 </div>

 {/* Row 2: Guide Text & Image Count */}
 <div className="flex flex-wrap gap-4 w-full">
 <div className="flex-[1.5] min-w-[200px]">
 <label className="block text-[11px] uppercase font-bold text-slate-500 mb-1.5">Văn bản hướng dẫn (Ghi chú)</label>
 <input
 type="text"
 className="w-full text-sm py-2 px-3 border border-slate-200 rounded-lg bg-white outline-none text-slate-600 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all placeholder:text-slate-400"
 placeholder="Mô tả các yêu cầu an toàn, công cụ cần thiết (nếu có)..."
 value={task.guide_text}
 onChange={e => handleUpdateTask(task.id, 'guide_text', e.target.value)}
 />
 </div>
 <div className="flex-1 min-w-[150px]">
 <label className="block text-[11px] uppercase font-bold text-slate-500 mb-1.5">Nghiệm thu Ảnh</label>
 <div className="flex items-center gap-3 bg-white border border-slate-200 rounded-lg px-3 h-[40px] focus-within:border-indigo-400 focus-within:ring-2 focus-within:ring-indigo-100 transition-all cursor-pointer" onClick={() => handleUpdateTask(task.id, 'status_set_image_count', !task.status_set_image_count)}>
 <div className={`flex items-center justify-center w-4 h-4 rounded border shrink-0 ${task.status_set_image_count ? 'bg-indigo-600 border-indigo-600' : 'bg-white border-slate-300'}`}>
 {task.status_set_image_count && <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
 </div>
 <span className="text-[13px] text-slate-600 font-semibold whitespace-nowrap select-none">Số lượng:</span>
 <input
 type="number"
 min="0"
 disabled={!task.status_set_image_count}
 onClick={(e) => e.stopPropagation()}
 className="w-full text-center text-[13px] py-1 bg-transparent outline-none disabled:opacity-50 font-medium text-slate-700"
 value={task.image_count}
 onChange={e => handleUpdateTask(task.id, 'image_count', parseInt(e.target.value) || 0)}
 />
 </div>
 </div>
 </div>

 {/* Row 3: Guide Images Upload */}
 <div className="w-full bg-white border border-dashed border-slate-300 rounded-xl p-4">
 <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-3">
 <h6 className="text-[11px] font-bold uppercase text-slate-500 flex items-center gap-2">
 <ImagePlus className="w-4 h-4 text-slate-400" />
 Ảnh đính kèm hướng dẫn <span className="text-slate-400">({task.guide_images?.length || 0})</span>
 </h6>
 <label className="cursor-pointer shrink-0">
 <input
 type="file"
 accept="image/*"
 className="hidden"
 onChange={(e) => handleUploadGuideImage(task.id, e)}
 disabled={uploadingTaskId === task.id}
 />
 <div className={`flex items-center gap-1.5 text-xs font-semibold px-4 py-1.5 rounded-full transition-all border ${uploadingTaskId === task.id ? 'bg-slate-100 text-slate-400 border-transparent cursor-not-allowed' : 'bg-white text-indigo-600 border-indigo-200 hover:bg-indigo-50 hover:border-indigo-300 hover:shadow-sm'}`}>
 {uploadingTaskId === task.id ? (
 <span className="flex items-center gap-2"><div className="w-3 h-3 border-2 border-slate-400 border-t-transparent rounded-full animate-spin"></div> Đang tải...</span>
 ) : (
 <><UploadCloud className="w-3.5 h-3.5" /> Tải ảnh lên</>
 )}
 </div>
 </label>
 </div>

 {task.guide_images && task.guide_images.length > 0 ? (
 <div className="flex flex-wrap gap-3">
 {task.guide_images.map((url, idx) => (
 <div key={idx} className="relative group w-20 h-20 rounded-lg border border-slate-200 overflow-hidden bg-white shadow-sm ring-1 ring-black/5">
 <img src={url} alt={`Guide ${idx}`} className="w-full h-full object-cover" />
 <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity"></div>
 <button
 onClick={() => handleRemoveGuideImage(task.id, url)}
 className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 p-2 bg-red-500 hover:bg-red-600 text-white rounded-full opacity-0 group-hover:opacity-100 transition-all scale-75 group-hover:scale-100 shadow-md"
 title="Xóa ảnh này"
 >
 <Trash2 className="w-3.5 h-3.5" />
 </button>
 </div>
 ))}
 </div>
 ) : (
 <div className="text-center py-6">
 <p className="text-xs text-slate-400">Chưa có ảnh mô tả quy trình/hướng dẫn trực quan.</p>
 </div>
 )}
 </div>
 </div>
 </div>
 ))}
 </div>
 ) : (
 <div className="text-[13.5px] text-slate-400 font-medium text-center py-6 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50/50">
 Chưa có hạng mục công việc. Bấm <b>Thêm công việc</b> để bắt đầu.
 </div>
 )}
 </div>
 )}
 </div>
 )
 })}
 </div>
 </GlassCard>
 );
}
