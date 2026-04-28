import React, { useState, useEffect, useCallback } from 'react';
import {
 X, Plus, Trash2, Settings, LayoutGrid, Folder, Layers, Camera,
 ChevronRight, ChevronDown, BookOpen, AlertCircle, Save, Pencil, Check, Search, Minus
} from 'lucide-react';
import api from '../../../../../services/api';
import { Asset, Work, SubWork, Process, Config, Template } from './types';

interface AssetTreeNode extends Asset { children: AssetTreeNode[]; }

const SelectableAssetNode: React.FC<{
 node: AssetTreeNode;
 level: number;
 selectedAssets: Set<string>;
 toggleAssets: (ids: string[], forceState: boolean) => void;
}> = ({ node, level, selectedAssets, toggleAssets }) => {
 const [expanded, setExpanded] = useState(true);
 const hasChildren = node.children.length > 0;

 const getAllAssetIds = (n: AssetTreeNode): string[] => {
 let ids = [n.id];
 n.children.forEach(c => { ids = ids.concat(getAllAssetIds(c)); });
 return ids;
 };

 const isSelected = selectedAssets.has(node.id);
 const isLeaf = level > 0;

 const handleToggleChildren = (e: React.MouseEvent) => {
 e.stopPropagation();
 const childIds = getAllAssetIds(node).filter(id => id !== node.id);
 if (childIds.length === 0) return;

 const allChildrenSelected = childIds.every(id => selectedAssets.has(id));
 toggleAssets(childIds, !allChildrenSelected);
 };

 return (
 <div>
 <div className="flex items-center gap-2 py-1.5 pr-2 hover:bg-slate-50 transition-colors rounded-lg cursor-pointer"
 style={{ paddingLeft: `${level * 1.25 + 0.5}rem` }}>

 {hasChildren ? (
 <button onClick={(e) => { e.stopPropagation(); setExpanded(p => !p); }} className="w-5 h-5 text-slate-400 hover:text-indigo-600 flex items-center justify-center shrink-0">
 {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
 </button>
 ) : (
 <div className="w-5 h-5 flex items-center justify-center shrink-0">
 <LayoutGrid className="w-3 h-3 text-indigo-300" />
 </div>
 )}

 <input
 type="checkbox"
 className="accent-indigo-600 w-3.5 h-3.5 shrink-0 cursor-pointer"
 checked={isSelected}
 onChange={(e) => toggleAssets([node.id], e.target.checked)}
 />

 <span className={`flex-1 text-[13px] truncate select-none ${isLeaf ? 'text-indigo-700 font-medium' : 'text-slate-700 font-semibold'}`}
 onClick={() => toggleAssets([node.id], !isSelected)}>
 {node.name}
 </span>

 {hasChildren && (
 <div className="flex items-center gap-1.5 shrink-0">
 <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-full">
 {node.children.length}
 </span>
 <button
 title="Chọn / Bỏ chọn tất cả các thẻ con"
 onClick={handleToggleChildren}
 className="text-[10px] font-medium bg-emerald-50 text-emerald-600 hover:bg-emerald-100 hover:text-emerald-700 border border-emerald-100 px-1.5 py-0.5 rounded transition-colors"
 >
 Chọn chuỗi
 </button>
 </div>
 )}
 </div>
 {hasChildren && expanded && (
 <div className="flex flex-col">
 {node.children.map(child => (
 <SelectableAssetNode
 key={child.id}
 node={child}
 level={level + 1}
 selectedAssets={selectedAssets}
 toggleAssets={toggleAssets}
 />
 ))}
 </div>
 )}
 </div>
 );
};

const ConfigTab: React.FC<{
 projectId?: string;
 assets: Asset[];
 works: Work[];
 subWorks: SubWork[];
 processes: Process[];
 onRefresh: () => void;
}> = ({ projectId, assets, works, subWorks, processes, onRefresh }) => {
 const [configs, setConfigs] = useState<Config[]>([]);
 const [loading, setLoading] = useState(false);
 const [selectedAssets, setSelectedAssets] = useState<Set<string>>(new Set());
 const [selectedWork, setSelectedWork] = useState('');
 const [selectedSubWorks, setSelectedSubWorks] = useState<Set<string>>(new Set());
 const [selectedConfigIds, setSelectedConfigIds] = useState<Set<string>>(new Set());
 const [saving, setSaving] = useState(false);
 const [error, setError] = useState<string | null>(null);
 const [search, setSearch] = useState('');
 const [sortBy, setSortBy] = useState<'work' | 'subWork' | 'asset'>('work');

 const filteredSubWorks = subWorks.filter(sw => sw.id_work === selectedWork);

 const fetchConfigs = useCallback(async () => {
 setLoading(true);
 try {
 const res = await api.get('/configs', { params: projectId ? { project_id: projectId } : {} });
 setConfigs(res.data || []);
 } catch (e) {
 console.error('Failed to fetch configs', e);
 } finally {
 setLoading(false);
 }
 }, [projectId]);

 useEffect(() => { fetchConfigs(); }, [fetchConfigs]);

 const toggleAssets = (ids: string[], forceState: boolean) => {
 setSelectedAssets(prev => {
 const next = new Set(prev);
 if (forceState) {
 ids.forEach(id => next.add(id));
 } else {
 ids.forEach(id => next.delete(id));
 }
 return next;
 });
 };

 const assetTree = React.useMemo(() => {
 const map: Record<string, AssetTreeNode> = {};
 const roots: AssetTreeNode[] = [];
 assets.forEach(a => { map[a.id] = { ...a, children: [] }; });
 assets.forEach(a => {
 if (a.parent_id && map[a.parent_id]) {
 map[a.parent_id].children.push(map[a.id]);
 } else {
 roots.push(map[a.id]);
 }
 });
 return roots;
 }, [assets]);

 const handleCreate = async () => {
 if (selectedAssets.size === 0 || selectedSubWorks.size === 0) {
 setError('Vui lòng chọn ít nhất 1 tài sản và 1 công vi!c phụ.');
 return;
 }
 setSaving(true);
 setError(null);
 try {
 const payloads = Array.from(selectedAssets).flatMap(assetId =>
 Array.from(selectedSubWorks).map(subWorkId => ({
 id_asset: assetId,
 id_sub_work: subWorkId,
 ...(projectId ? { id_project: projectId } : {}),
 }))
 );
 await Promise.all(payloads.map(p => api.post('/configs', p)));
 setSelectedAssets(new Set());
 setSelectedSubWorks(new Set());
 fetchConfigs();
 onRefresh();
 } catch (e: any) {
 setError(e.response?.data?.error || 'Tạo cấu hình thất bại.');
 } finally {
 setSaving(false);
 }
 };

 const handleDelete = async (id: string) => {
 if (!window.confirm('Xóa cấu hình này?')) return;
 try {
 await api.delete(`/configs/${id}`);
 setSelectedConfigIds(prev => { const n = new Set(prev); n.delete(id); return n; });
 fetchConfigs();
 onRefresh();
 } catch (e) {
 setError('Xóa thất bại.');
 }
 };

 const handleDeleteMultiple = async () => {
 if (selectedConfigIds.size === 0) return;
 if (!window.confirm(`Xóa ${selectedConfigIds.size} cấu hình đã chọn?`)) return;
 setLoading(true);
 try {
 await Promise.all(Array.from(selectedConfigIds).map(id => api.delete(`/configs/${id}`)));
 setSelectedConfigIds(new Set());
 fetchConfigs();
 onRefresh();
 } catch (e) {
 setError('Xóa nhiều cấu hình thất bại.');
 setLoading(false);
 }
 };

 const handleDeleteSearchResults = async () => {
 if (!search) return;
 const searchCount = filteredConfigs.length;
 if (searchCount === 0) return;
 if (!window.confirm(`Bạn có thật sự muốn xóa TẤT CẢ ${searchCount} cấu hình đang hiển thị trong kết quả tìm kiếm "${search}" thay vì chỉ các mục đã chọn?`)) return;

 setLoading(true);
 try {
 const idsToDelete = filteredConfigs.map(c => c.id);
 await Promise.all(idsToDelete.map(id => api.delete(`/configs/${id}`)));

 setSelectedConfigIds(prev => {
 const next = new Set(prev);
 idsToDelete.forEach(id => next.delete(id));
 return next;
 });
 fetchConfigs();
 onRefresh();
 } catch (e) {
 setError('Xóa các cấu hình theo kết quả tìm kiếm thất bại.');
 setLoading(false);
 }
 };

 // Enrich configs with nested objects
 const enrichedConfigs = configs.map(c => ({
 ...c,
 asset: assets.find(a => a.id === c.id_asset),
 sub_work: (() => {
 const sw = subWorks.find(s => s.id === c.id_sub_work);
 if (!sw) return undefined;
 return { ...sw, work: works.find(w => w.id === sw.id_work) };
 })(),
 }));

 const filteredConfigs = search
 ? enrichedConfigs.filter(c =>
 c.asset?.name.toLowerCase().includes(search.toLowerCase()) ||
 c.sub_work?.name.toLowerCase().includes(search.toLowerCase()) ||
 c.sub_work?.work?.name.toLowerCase().includes(search.toLowerCase())
 )
 : enrichedConfigs;

 const sortedConfigs = [...filteredConfigs].sort((a, b) => {
 if (sortBy === 'work') {
 const wA = a.sub_work?.work?.name || '';
 const wB = b.sub_work?.work?.name || '';
 if (wA !== wB) return wA.localeCompare(wB);
 } else if (sortBy === 'subWork') {
 const swA = a.sub_work?.name || '';
 const swB = b.sub_work?.name || '';
 if (swA !== swB) return swA.localeCompare(swB);
 } else if (sortBy === 'asset') {
 const assetA = a.asset?.name || '';
 const assetB = b.asset?.name || '';
 if (assetA !== assetB) return assetA.localeCompare(assetB);
 }

 // Secondary sort to ensure consistent ordering when primary values are equal
 const fwA = a.sub_work?.work?.name || '';
 const fwB = b.sub_work?.work?.name || '';
 if (fwA !== fwB) return fwA.localeCompare(fwB);

 const fswA = a.sub_work?.name || '';
 const fswB = b.sub_work?.name || '';
 return fswA.localeCompare(fswB);
 });

 const assetSearchState = useState('');
 const [assetSearch] = assetSearchState;

 const filteredAssets = assets.filter(a =>
 assetSearch ? a.name.toLowerCase().includes(assetSearch.toLowerCase()) : true
 );

 return (
 <div className="flex h-full min-h-0">
 {/* Left: Create Form */}
 <div className="w-72 shrink-0 border-r border-gray-100 flex flex-col bg-slate-50/50">
 <div className="p-4 border-b border-gray-100 bg-white">
 <h3 className="font-semibold text-slate-700 flex items-center gap-2 text-sm">
 <Plus className="w-4 h-4 text-indigo-500" />
 Tạo cấu hình mới
 </h3>
 </div>
 <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar min-h-0">
 {/* Asset List */}
 <div>
 <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2 block">
 Tài sản (Asset)
 <button
 onClick={() => {
 if (selectedAssets.size === assets.length) setSelectedAssets(new Set());
 else setSelectedAssets(new Set(assets.map(a => a.id)));
 }}
 className="ml-2 text-indigo-600 normal-case font-normal"
 >
 Chọn tất cả
 </button>
 </label>
 <div className="space-y-0.5 max-h-[360px] overflow-y-auto custom-scrollbar pr-1">
 {assetTree.map(node => (
 <SelectableAssetNode
 key={node.id}
 node={node}
 level={0}
 selectedAssets={selectedAssets}
 toggleAssets={toggleAssets}
 />
 ))}
 {assets.length === 0 && (
 <p className="text-xs text-slate-400 text-center py-4">Chưa có tài sản nào trong dự án.</p>
 )}
 </div>
 </div>

 {/* Work Selector */}
 <div>
 <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5 block">
 Hạng mục chính (Work) bắt buộc
 </label>
 <select
 className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white text-sm text-slate-700 focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 outline-none"
 value={selectedWork}
 onChange={e => { setSelectedWork(e.target.value); setSelectedSubWorks(new Set()); }}
 >
 <option value="">-- Chọn hạng mục chính --</option>
 {works.map(w => (
 <option key={w.id} value={w.id}>{w.name}</option>
 ))}
 </select>
 </div>

 {/* SubWork Selector */}
 <div>
 <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1 block">
 Công việc phụ (Sub-work)
 <button
 onClick={() => {
 if (selectedSubWorks.size === filteredSubWorks.length && filteredSubWorks.length > 0) setSelectedSubWorks(new Set());
 else setSelectedSubWorks(new Set(filteredSubWorks.map(sw => sw.id)));
 }}
 className="ml-2 text-indigo-600 normal-case font-normal"
 >
 Chọn tất cả
 </button>
 </label>
 {!selectedWork ? (
 <div className="px-3 py-2 border border-slate-200 rounded-lg bg-slate-50 text-sm text-slate-400 italic">
 Vui lòng chọn Hạng mục chính.
 </div>
 ) : (
 <div className="space-y-1.5 max-h-48 overflow-y-auto custom-scrollbar pr-1 mt-2">
 {filteredSubWorks.map(sw => (
 <label
 key={sw.id}
 className={`flex items-start gap-2 p-2 rounded-lg border cursor-pointer transition-all text-sm ${selectedSubWorks.has(sw.id)
 ? 'bg-indigo-50 border-indigo-300 text-indigo-800'
 : 'bg-white border-slate-200 text-slate-700 hover:border-indigo-200'
 }`}
 >
 <input
 type="checkbox"
 className="mt-0.5 accent-indigo-600 w-3.5 h-3.5"
 checked={selectedSubWorks.has(sw.id)}
 onChange={() => {
 const next = new Set(selectedSubWorks);
 if (next.has(sw.id)) next.delete(sw.id); else next.add(sw.id);
 setSelectedSubWorks(next);
 }}
 />
 <span className="flex-1 min-w-0 break-words leading-tight">{sw.name}</span>
 </label>
 ))}
 {filteredSubWorks.length === 0 && (
 <p className="text-xs text-slate-400 text-center py-4">Chưa có công việc phụ nào.</p>
 )}
 </div>
 )}
 </div>

 {error && (
 <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-600">
 <AlertCircle className="w-4 h-4 shrink-0" />
 {error}
 </div>
 )}
 </div>

 {/* Create Button */}
 <div className="p-4 border-t border-gray-100 bg-white">
 <button
 onClick={handleCreate}
 disabled={saving || selectedAssets.size === 0 || selectedSubWorks.size === 0}
 className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
 >
 <Check className="w-4 h-4" />
 Tạo cấu hình ({selectedAssets.size * selectedSubWorks.size} mục)
 </button>
 </div>
 </div>

 {/* Right: Config List */}
 <div className="flex-1 flex flex-col min-w-0">
 <div className="p-4 border-b border-gray-100 bg-white flex flex-col md:flex-row md:items-center justify-between gap-3">
 <div className="flex items-center gap-3">
 <h3 className="font-semibold text-slate-700 text-sm whitespace-nowrap hidden lg:block">Danh sách cấu hình</h3>
 </div>
 <div className="flex items-center gap-2 w-full lg:w-auto">
 <div className="relative flex-1 lg:w-60">
 <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
 <input
 type="text"
 placeholder="Tìm kiếm..."
 className="w-full pl-8 pr-3 py-1.5 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400 outline-none"
 value={search}
 onChange={e => setSearch(e.target.value)}
 />
 </div>
 <select
 className="w-32 px-2 py-1.5 border border-slate-200 rounded-lg text-[11px] text-slate-700 outline-none focus:border-indigo-400"
 value={sortBy}
 onChange={e => setSortBy(e.target.value as any)}
 >
 <option value="work">Sắp xếp: Mục chính</option>
 <option value="subWork">Sắp xếp: Mục phụ</option>
 <option value="asset">Sắp xếp: Tài sản</option>
 </select>
 {search && filteredConfigs.length > 0 && (
 <button 
 onClick={handleDeleteSearchResults}
 className="px-3 py-1.5 text-xs font-bold text-red-600 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-colors shadow-sm"
 title={`Xóa tất cả ${filteredConfigs.length} cấu hình đang hiển thị này`}
 >
 Xóa ({filteredConfigs.length})
 </button>
 )}
 </div>
 </div>

 {selectedConfigIds.size > 0 && (
 <div className="bg-red-50 border-b border-red-100 px-4 py-2.5 flex items-center justify-between">
 <span className="text-sm font-semibold text-red-700">Đã chọn {selectedConfigIds.size} cấu hình</span>
 <div className="flex items-center gap-2">
 <button
 onClick={() => setSelectedConfigIds(new Set())}
 className="px-3 py-1.5 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
 >
 Bỏ chọn
 </button>
 <button
 onClick={handleDeleteMultiple}
 className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-red-500 rounded-lg hover:bg-red-600 shadow-sm transition-colors"
 >
 <Trash2 className="w-3.5 h-3.5" /> Xóa tất cả
 </button>
 </div>
 </div>
 )}

 <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar min-h-0">
 {loading && <p className="text-sm text-slate-400 text-center mt-8">Đang tải...</p>}
 {!loading && sortedConfigs.length === 0 && (
 <div className="flex flex-col items-center justify-center h-full text-slate-400 text-sm py-12">
 <LayoutGrid className="w-10 h-10 mb-2 opacity-30" />
 <p>Chưa có cấu hình nào.</p>
 </div>
 )}
 {sortedConfigs.map(cfg => {
 const procs = (cfg.sub_work?.id_process || []).map(pid => processes.find(p => p.id === pid)?.name).filter(Boolean);
 const isSelected = selectedConfigIds.has(cfg.id);
 return (
 <div
 key={cfg.id}
 onClick={() => {
 const next = new Set(selectedConfigIds);
 if (next.has(cfg.id)) next.delete(cfg.id); else next.add(cfg.id);
 setSelectedConfigIds(next);
 }}
 className={`bg-white border rounded-xl p-3.5 hover:shadow-sm transition-all group flex items-start gap-3 cursor-pointer ${isSelected ? 'border-indigo-400 ring-1 ring-indigo-400 bg-indigo-50/20' : 'border-slate-200 hover:border-indigo-300'}`}
 >
 <input
 type="checkbox"
 className="mt-0.5 accent-indigo-600 w-4 h-4 cursor-pointer shrink-0"
 checked={isSelected}
 readOnly
 />
 <div className="flex-1 min-w-0">
 {/* Breadcrumb */}
 <div className="flex items-center gap-1.5 flex-wrap mb-2">
 <span className="text-xs font-bold text-orange-600">{cfg.sub_work?.work?.name || ''}</span>
 <ChevronRight className="w-3 h-3 text-slate-300 shrink-0" />
 <span className="text-xs font-semibold text-slate-600">{cfg.sub_work?.name || ''}</span>
 <ChevronRight className="w-3 h-3 text-slate-300 shrink-0" />
 <span className="text-xs font-bold text-emerald-600">{cfg.asset?.name || ''}</span>
 <button
 onClick={(e) => { e.stopPropagation(); handleDelete(cfg.id); }}
 className="ml-auto p-1 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all rounded"
 >
 <Trash2 className="w-3.5 h-3.5" />
 </button>
 </div>
 {/* Process Tags */}
 {procs.length > 0 && (
 <div className="flex flex-wrap gap-1 mb-2">
 {procs.map((p, i) => (
 <span key={i} className="px-1.5 py-0.5 bg-amber-50 text-amber-700 text-[11px] rounded border border-amber-100">
 {p}
 </span>
 ))}
 </div>
 )}
 {/* Badges */}
 <div className="flex items-center gap-2 text-[11px]">
 <span className={`flex items-center gap-1 px-2 py-0.5 rounded-md border ${cfg.status_set_image_count ? 'bg-orange-50 text-orange-600 border-orange-200' : 'bg-slate-50 text-slate-500 border-slate-200'}`}>
 <Camera className="w-3 h-3" />
 {cfg.status_set_image_count ? `${cfg.image_count} ảnh` : 'Chụp vô hạn'}
 </span>
 {(cfg.guide_text || (cfg.guide_images && cfg.guide_images.length > 0)) && (
 <span className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-teal-50 text-teal-600 border border-teal-200">
 <BookOpen className="w-3 h-3" />
 Hướng dẫn
 </span>
 )}
 </div>
 </div>
 </div>
 );
 })}
 </div>
 </div>
 </div>
 );
};

export default ConfigTab;
