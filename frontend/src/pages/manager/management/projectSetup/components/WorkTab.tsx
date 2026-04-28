import React, { useState, useEffect, useCallback } from 'react';
import {
 X, Plus, Trash2, Settings, LayoutGrid, Folder, Layers, Camera,
 ChevronRight, ChevronDown, BookOpen, AlertCircle, Save, Pencil, Check, Search, Minus
} from 'lucide-react';
import api from '../../../../../services/api';
import { Asset, Work, SubWork, Process, Config, Template } from './types';

const WorkTab: React.FC<{ works: Work[]; subWorks: SubWork[]; processes: Process[]; onRefresh: () => void }> = ({ works, subWorks, processes, onRefresh }) => {
 const [selectedWorkId, setSelectedWorkId] = useState<string>('');
 const [newWorkName, setNewWorkName] = useState('');
 const [newSubWorkName, setNewSubWorkName] = useState('');
 const [newSubWorkProcesses, setNewSubWorkProcesses] = useState<string[]>([]);
 const [newProcessName, setNewProcessName] = useState('');
 const [loading, setLoading] = useState(false);
 const [error, setError] = useState<string | null>(null);
 // Process dropdown CRUD state
 const [isProcessDropdownOpen, setIsProcessDropdownOpen] = useState(false);
 const [processSearch, setProcessSearch] = useState('');
 const [editingProcessId, setEditingProcessId] = useState<string | null>(null);
 const [editProcessName, setEditProcessName] = useState('');

 // Auto-select first work if none selected
 useEffect(() => {
 if (!selectedWorkId && works.length > 0) {
 setSelectedWorkId(works[0].id);
 } else if (works.length === 0) {
 setSelectedWorkId('');
 }
 }, [works, selectedWorkId]);

 const handleAddWork = async () => {
 if (!newWorkName.trim()) return;
 setLoading(true);
 try {
 const res = await api.post('/works', { name: newWorkName });
 setNewWorkName('');
 onRefresh();
 if (res.data && res.data.id) setSelectedWorkId(res.data.id);
 } catch (e: any) { setError(e.response?.data?.error || 'Lỗi'); } finally { setLoading(false); }
 };

 const handleDeleteWork = async (id: string) => {
 if (!window.confirm('Xóa hạng mục này và tất cả công việc phụ liên quan?')) return;
 try {
 await api.delete(`/works/${id}`);
 if (selectedWorkId === id) setSelectedWorkId('');
 onRefresh();
 } catch { setError('Xóa thất bại.'); }
 };

 const handleAddSubWork = async () => {
 if (!newSubWorkName.trim() || !selectedWorkId) return;
 setLoading(true);
 try {
 await api.post('/sub-works', {
 name: newSubWorkName,
 id_work: selectedWorkId,
 id_process: newSubWorkProcesses
 });
 setNewSubWorkName('');
 setNewSubWorkProcesses([]);
 onRefresh();
 } catch (e: any) { setError(e.response?.data?.error || 'Lỗi'); } finally { setLoading(false); }
 };

 const handleDeleteSubWork = async (id: string) => {
 if (!window.confirm('Xóa công việc phụ này?')) return;
 try { await api.delete(`/sub-works/${id}`); onRefresh(); } catch { setError('Xóa thất bại.'); }
 };

 const handleAddProcess = async () => {
 if (!newProcessName.trim()) return;
 setLoading(true);
 try {
 const res = await api.post('/process', { name: newProcessName });
 setNewProcessName('');
 onRefresh();
 if (res.data && res.data.id) {
 setNewSubWorkProcesses(prev => [...prev, res.data.id]);
 }
 } catch (e: any) { setError(e.response?.data?.error || 'Lỗi thêm quy trình'); } finally { setLoading(false); }
 };

 const handleEditProcess = async (id: string) => {
 if (!editProcessName.trim()) return;
 try {
 await api.put(`/process/${id}`, { name: editProcessName.trim() });
 setEditingProcessId(null);
 setEditProcessName('');
 onRefresh();
 } catch (e: any) { setError(e.response?.data?.error || 'Lỗi cập nhật quy trình'); }
 };

 const handleDeleteProcess = async (id: string) => {
 if (!window.confirm('Xoá quy trình này? Nó sẽ bị gỡ khỏi các công việc phụ liên quan.')) return;
 try {
 await api.delete(`/process/${id}`);
 setNewSubWorkProcesses(prev => prev.filter(pid => pid !== id));
 onRefresh();
 } catch (e: any) { setError(e.response?.data?.error || 'Không thể xoá quy trình (có thể đang được sử dụng).'); }
 };

 const selectedWork = works.find(w => w.id === selectedWorkId);
 const filteredSubWorks = subWorks.filter(sw => sw.id_work === selectedWorkId);

 return (
 <div className="flex h-full min-h-0 bg-white">
 {/* Left Column: Works */}
 <div className="w-1/2 border-r border-gray-100 flex flex-col min-h-0">
 <div className="p-4 border-b border-gray-50 flex items-center justify-between bg-white shrink-0">
 <h3 className="text-sm font-bold text-slate-700">Hạng mục chính (work)</h3>
 </div>

 <div className="flex flex-col flex-1 min-h-0 p-4 overflow-y-auto custom-scrollbar">
 {/* Add Work Header */}
 <div className="flex gap-2 mb-4">
 <input
 type="text" placeholder="Thêm hạng mục chính..."
 className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-300 outline-none"
 value={newWorkName}
 onChange={e => setNewWorkName(e.target.value)}
 onKeyDown={e => e.key === 'Enter' && handleAddWork()}
 />
 <button onClick={handleAddWork} disabled={loading || !newWorkName.trim()} className="px-3 py-2 bg-indigo-50 text-indigo-600 rounded-lg text-sm font-semibold hover:bg-indigo-100 disabled:opacity-50 flex items-center gap-1">
 <Plus className="w-4 h-4" /> Thêm
 </button>
 </div>

 {/* Works List */}
 <div className="space-y-2">
 {works.map(w => {
 const isSelected = w.id === selectedWorkId;
 return (
 <div
 key={w.id}
 onClick={() => setSelectedWorkId(w.id)}
 className={`group flex items-center justify-between px-4 py-3 rounded-xl border cursor-pointer transition-all ${isSelected
 ? 'border-indigo-500 bg-indigo-50/50 shadow-sm'
 : 'border-slate-200 bg-white hover:border-indigo-300'
 }`}
 >
 <span className={`text-sm font-semibold ${isSelected ? 'text-indigo-800' : 'text-slate-700'}`}>
 {w.name}
 </span>
 <button
 onClick={(e) => { e.stopPropagation(); handleDeleteWork(w.id); }}
 className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-all rounded-lg"
 >
 <Trash2 className="w-4 h-4" />
 </button>
 </div>
 );
 })}
 {works.length === 0 && <p className="text-sm text-slate-400 text-center py-6">Chưa có hạng mục chính nào.</p>}
 </div>
 </div>
 </div>

 {/* Right Column: SubWorks */}
 <div className="w-1/2 flex flex-col min-h-0 bg-slate-50/30">
 <div className="p-4 border-b border-gray-50 flex items-center justify-between bg-white shrink-0">
 <h3 className="text-sm font-bold text-slate-700">
 Công việc (sub-work): <span className="text-indigo-600">{selectedWork?.name || '...'}</span>
 </h3>
 </div>

 <div className="flex flex-col flex-1 min-h-0 p-4 overflow-y-auto custom-scrollbar">
 {!selectedWorkId ? (
 <div className="flex items-center justify-center h-full text-slate-400 text-sm">
 Vui lòng chọn hoặc tạo hạng mục chính bên trái
 </div>
 ) : (
 <>
 {/* Add SubWork Header */}
 <div className="flex flex-col gap-2 mb-4">
 <div className="flex gap-2">
 <input
 type="text" placeholder="Thêm công việc phụ..."
 className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-300 outline-none"
 value={newSubWorkName}
 onChange={e => setNewSubWorkName(e.target.value)}
 onKeyDown={e => e.key === 'Enter' && handleAddSubWork()}
 />
 <button onClick={handleAddSubWork} disabled={loading || !newSubWorkName.trim()} className="px-3 py-2 bg-indigo-50 text-indigo-600 rounded-lg text-sm font-semibold hover:bg-indigo-100 disabled:opacity-50 flex items-center gap-1 shrink-0">
 <Plus className="w-4 h-4" /> Thêm
 </button>
 </div>
 {/* === PROCESS DROPDOWN === */}
 <div className="relative mt-1.5">
 {/* Selected badges */}
 {newSubWorkProcesses.length > 0 && (
 <div className="flex flex-wrap gap-1 mb-1.5">
 {newSubWorkProcesses.map(pid => {
 const p = processes.find(x => x.id === pid);
 if (!p) return null;
 return (
 <span key={pid} className="flex items-center gap-1 px-2 py-0.5 bg-indigo-500 text-white text-[11px] font-medium rounded-full">
 {p.name}
 <button
 type="button"
 onClick={() => setNewSubWorkProcesses(prev => prev.filter(id => id !== pid))}
 className="hover:text-red-200 transition-colors"
 ><X className="w-2.5 h-2.5" /></button>
 </span>
 );
 })}
 </div>
 )}
 {/* Trigger button */}
 <button
 type="button"
 onClick={() => { setIsProcessDropdownOpen(o => !o); setProcessSearch(''); }}
 className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 rounded-lg bg-white text-[12px] text-slate-600 hover:border-indigo-300 hover:bg-indigo-50 transition-colors w-full"
 >
 <Settings className="w-3.5 h-3.5 text-indigo-400" />
 <span className="flex-1 text-left">
 {newSubWorkProcesses.length > 0
 ? `${newSubWorkProcesses.length} quy trình đã chọn`
 : 'Chọn quy trình...'}
 </span>
 <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${isProcessDropdownOpen ? 'rotate-180' : ''}`} />
 </button>
 {/* Dropdown panel */}
 {isProcessDropdownOpen && (
 <div className="absolute z-50 top-full mt-1 left-0 right-0 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden">
 {/* Search */}
 <div className="flex items-center gap-2 p-2 border-b border-slate-100">
 <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
 <input
 autoFocus
 type="text"
 placeholder="Tìm quy trình..."
 value={processSearch}
 onChange={e => setProcessSearch(e.target.value)}
 className="flex-1 text-[12px] outline-none text-slate-700"
 />
 </div>
 {/* List */}
 <div className="max-h-48 overflow-y-auto custom-scrollbar">
 {processes
 .filter(p => p.name.toLowerCase().includes(processSearch.toLowerCase()))
 .map(p => {
 const isSel = newSubWorkProcesses.includes(p.id);
 const isEditing = editingProcessId === p.id;
 return (
 <div key={p.id} className="group flex items-center gap-2 px-3 py-2 hover:bg-slate-50 transition-colors">
 <input
 type="checkbox"
 className="accent-indigo-600 w-3.5 h-3.5 shrink-0 cursor-pointer"
 checked={isSel}
 onChange={() => setNewSubWorkProcesses(prev =>
 isSel ? prev.filter(id => id !== p.id) : [...prev, p.id]
 )}
 />
 {isEditing ? (
 <input
 autoFocus
 type="text"
 value={editProcessName}
 onChange={e => setEditProcessName(e.target.value)}
 onKeyDown={e => { if (e.key === 'Enter') handleEditProcess(p.id); if (e.key === 'Escape') setEditingProcessId(null); }}
 className="flex-1 px-1.5 py-0.5 text-[12px] border border-indigo-300 rounded outline-none focus:ring-1 focus:ring-indigo-400"
 />
 ) : (
 <span className="flex-1 text-[12px] text-slate-700 truncate select-none" onClick={() => setNewSubWorkProcesses(prev =>
 isSel ? prev.filter(id => id !== p.id) : [...prev, p.id]
 )}>{p.name}</span>
 )}
 {isEditing ? (
 <button onClick={() => handleEditProcess(p.id)} className="p-1 text-emerald-500 hover:text-emerald-700 rounded">
 <Check className="w-3.5 h-3.5" />
 </button>
 ) : (
 <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
 <button
 type="button"
 onClick={(e) => { e.stopPropagation(); setEditingProcessId(p.id); setEditProcessName(p.name); }}
 className="p-1 text-slate-400 hover:text-indigo-600 rounded hover:bg-indigo-50"
 ><Pencil className="w-3 h-3" /></button>
 <button
 type="button"
 onClick={(e) => { e.stopPropagation(); handleDeleteProcess(p.id); }}
 className="p-1 text-slate-400 hover:text-red-500 rounded hover:bg-red-50"
 ><Trash2 className="w-3 h-3" /></button>
 </div>
 )}
 </div>
 );
 })}
 {processes.filter(p => p.name.toLowerCase().includes(processSearch.toLowerCase())).length === 0 && (
 <p className="text-[11px] text-slate-400 text-center py-4">Không tìm thấy quy trình phù hợp.</p>
 )}
 </div>
 {/* Create new */}
 <div className="flex items-center gap-2 p-2 border-t border-slate-100 bg-slate-50">
 <input
 type="text"
 placeholder="+ Tạo quy trình mới..."
 value={newProcessName}
 onChange={e => setNewProcessName(e.target.value)}
 onKeyDown={e => e.key === 'Enter' && handleAddProcess()}
 className="flex-1 px-2 py-1 text-[12px] border border-slate-200 rounded-lg outline-none focus:border-indigo-400 bg-white"
 />
 <button
 onClick={handleAddProcess}
 disabled={loading || !newProcessName.trim()}
 className="px-2.5 py-1 text-[11px] bg-indigo-500 text-white rounded-lg font-bold hover:bg-indigo-600 disabled:opacity-50 transition-colors flex items-center gap-1"
 >
 <Plus className="w-3 h-3" /> Tạo
 </button>
 </div>
 </div>
 )}
 </div>
 </div>

 {/* SubWorks List */}
 <div className="space-y-2">
 {filteredSubWorks.map(sw => {
 const swProcesses = (sw.id_process || []).map(pid => processes.find(p => p.id === pid)).filter(Boolean) as Process[];
 return (
 <div key={sw.id} className="group flex flex-col px-4 py-3 bg-white border border-slate-200 rounded-xl hover:border-indigo-300 transition-all">
 <div className="flex items-start justify-between">
 <span className="text-sm font-semibold text-slate-700">{sw.name}</span>
 <button
 onClick={() => handleDeleteSubWork(sw.id)}
 className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-all rounded-lg shrink-0"
 >
 <Trash2 className="w-4 h-4" />
 </button>
 </div>
 {/* Process Tags */}
 {swProcesses.length > 0 && (
 <div className="flex flex-wrap gap-1.5 mt-2">
 {swProcesses.map(p => (
 <span key={p.id} className="px-2 py-0.5 bg-indigo-50 text-indigo-600 text-[11px] font-medium rounded border border-indigo-100">
 {p.name}
 </span>
 ))}
 </div>
 )}
 </div>
 );
 })}
 {filteredSubWorks.length === 0 && <p className="text-sm text-slate-400 text-center py-6">Chưa có công việc phụ nào.</p>}
 </div>
 </>
 )}
 </div>
 </div>
 </div>
 );
};

export default WorkTab;
