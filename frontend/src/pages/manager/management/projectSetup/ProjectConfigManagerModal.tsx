import React, { useState, useEffect, useCallback } from 'react';
import ReactDOM from 'react-dom';
import {
    X, Plus, Trash2, Settings, LayoutGrid, Folder, Layers, Camera,
    ChevronRight, ChevronDown, BookOpen, AlertCircle, Save, Pencil, Check, Search, Minus
} from 'lucide-react';
import api from '../../../../services/api';

// --- Types ---
interface Asset { id: string; name: string; }
interface Work { id: string; name: string; }
interface SubWork { id: string; name: string; id_work: string; id_process?: string[]; }
interface Process { id: string; name: string; }
interface Config {
    id: string;
    id_asset: string;
    id_sub_work: string;
    image_count?: number;
    status_set_image_count?: boolean;
    guide_text?: string;
    guide_images?: string[];
    asset?: Asset;
    sub_work?: SubWork & { work?: Work; id_process?: string[] };
}

interface Template {
    id: string;
    name: string;
    id_project?: string;
    id_model_project?: string;
    id_config?: string[] | string; // array of config UUIDs stored as JSONB
}

type Tab = 'work' | 'asset' | 'config' | 'template';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    onChange: () => void;
    projectId?: string;
}

// ======================= CONFIG TAB =======================
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

    const handleToggleAsset = (id: string) => {
        const next = new Set(selectedAssets);
        if (next.has(id)) next.delete(id); else next.add(id);
        setSelectedAssets(next);
    };

    const handleCreate = async () => {
        if (selectedAssets.size === 0 || selectedSubWorks.size === 0) {
            setError('Vui lòng chọn ít nhất 1 tài sản và 1 công vi�!c phụ.');
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
            fetchConfigs();
            onRefresh();
        } catch (e) {
            setError('Xóa thất bại.');
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
                        <div className="space-y-1.5 max-h-48 overflow-y-auto custom-scrollbar pr-1">
                            {assets.map(asset => (
                                <label
                                    key={asset.id}
                                    className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-all text-sm ${selectedAssets.has(asset.id)
                                        ? 'bg-indigo-50 border-indigo-300 text-indigo-800'
                                        : 'bg-white border-slate-200 text-slate-700 hover:border-indigo-200'
                                        }`}
                                >
                                    <input
                                        type="checkbox"
                                        className="accent-indigo-600 w-3.5 h-3.5"
                                        checked={selectedAssets.has(asset.id)}
                                        onChange={() => handleToggleAsset(asset.id)}
                                    />
                                    <span className="truncate">{asset.name}</span>
                                </label>
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
                    <h3 className="font-semibold text-slate-700 text-sm whitespace-nowrap hidden lg:block">Danh sách cấu hình</h3>
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
                    </div>
                </div>
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
                        return (
                            <div key={cfg.id} className="bg-white border border-slate-200 rounded-xl p-3.5 hover:border-indigo-200 hover:shadow-sm transition-all group">
                                {/* Breadcrumb */}
                                <div className="flex items-center gap-1.5 flex-wrap mb-2">
                                    <span className="text-xs font-bold text-orange-600">{cfg.sub_work?.work?.name || ''}</span>
                                    <ChevronRight className="w-3 h-3 text-slate-300 shrink-0" />
                                    <span className="text-xs font-semibold text-slate-600">{cfg.sub_work?.name || ''}</span>
                                    <ChevronRight className="w-3 h-3 text-slate-300 shrink-0" />
                                    <span className="text-xs font-bold text-emerald-600">{cfg.asset?.name || ''}</span>
                                    <button
                                        onClick={() => handleDelete(cfg.id)}
                                        className="ml-auto p-1 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all rounded"
                                    >
                                        <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                                {/* Process Tags */}
                                {procs.length > 0 && (
                                    <div className="flex flex-wrap gap-1 mb-2">
                                        {procs.map((p, i) => (
                                            <span key={i} className="px-1.5 py-0.5 bg-amber-50 text-amber-700 text-xs rounded border border-amber-100">
                                                {p}
                                            </span>
                                        ))}
                                    </div>
                                )}
                                {/* Badges */}
                                <div className="flex items-center gap-2 text-xs">
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
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

// ======================= WORK TAB =======================
const WorkTab: React.FC<{ works: Work[]; subWorks: SubWork[]; processes: Process[]; onRefresh: () => void }> = ({ works, subWorks, processes, onRefresh }) => {
    const [selectedWorkId, setSelectedWorkId] = useState<string>('');
    const [newWorkName, setNewWorkName] = useState('');
    const [newSubWorkName, setNewSubWorkName] = useState('');
    const [newSubWorkProcesses, setNewSubWorkProcesses] = useState<string[]>([]);
    const [newProcessName, setNewProcessName] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

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
                                <div className="flex flex-wrap gap-1.5 mt-1">
                                    {processes.map(p => {
                                        const isSelected = newSubWorkProcesses.includes(p.id);
                                        return (
                                            <button
                                                key={p.id}
                                                onClick={() => {
                                                    setNewSubWorkProcesses(prev =>
                                                        isSelected ? prev.filter(id => id !== p.id) : [...prev, p.id]
                                                    );
                                                }}
                                                className={`px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors ${isSelected
                                                    ? 'bg-indigo-500 text-white border-indigo-500 shadow-sm'
                                                    : 'bg-white text-slate-500 border-slate-200 hover:border-indigo-300'
                                                    }`}
                                            >
                                                {p.name}
                                            </button>
                                        );
                                    })}
                                    <div className="flex items-center gap-1 ml-1 bg-white border border-slate-200 rounded-full px-1 py-0.5 focus-within:border-indigo-400 focus-within:ring-1 focus-within:ring-indigo-400">
                                        <input
                                            type="text" placeholder="+ Tạo quy trình..."
                                            className="px-2 py-0.5 text-[11px] outline-none w-28 bg-transparent text-slate-600"
                                            value={newProcessName}
                                            onChange={e => setNewProcessName(e.target.value)}
                                            onKeyDown={e => e.key === 'Enter' && handleAddProcess()}
                                        />
                                        <button onClick={handleAddProcess} disabled={loading || !newProcessName.trim()} className="px-1.5 py-0.5 text-[10px] bg-indigo-50 text-indigo-600 rounded-full font-bold hover:bg-indigo-100 disabled:opacity-50 transition-colors">Tạo</button>
                                    </div>
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

// ======================= ASSET TAB =======================
const AssetTab: React.FC<{ projectId?: string; assets: Asset[]; onRefresh: () => void }> = ({ projectId, assets, onRefresh }) => {
    const [newName, setNewName] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleAdd = async () => {
        if (!newName.trim()) return;
        setLoading(true);
        try {
            await api.post('/assets', { name: newName, ...(projectId ? { id_project: projectId } : {}) });
            setNewName('');
            onRefresh();
        } catch (e: any) { setError(e.response?.data?.error || 'Lỗi'); } finally { setLoading(false); }
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm('Xóa tài sản này?')) return;
        try { await api.delete(`/assets/${id}`); onRefresh(); } catch { setError('Xóa thất bại.'); }
    };

    return (
        <div className="p-5 space-y-4 overflow-y-auto h-full custom-scrollbar">
            {error && <p className="text-red-500 text-sm px-3 py-2 bg-red-50 rounded-lg border border-red-200">{error}</p>}
            <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2"><LayoutGrid className="w-4 h-4 text-emerald-400" /> Tài sản dự án</h3>
            <div className="flex gap-2">
                <input
                    type="text" placeholder="Tên tài sản/thiết bị..."
                    className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-300 outline-none"
                    value={newName}
                    onChange={e => setNewName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleAdd()}
                />
                <button onClick={handleAdd} disabled={loading || !newName.trim()} className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-1.5">
                    <Plus className="w-4 h-4" /> Thêm
                </button>
            </div>
            <div className="space-y-2">
                {assets.map(a => (
                    <div key={a.id} className="flex items-center justify-between px-3 py-2.5 bg-white border border-slate-200 rounded-lg group hover:border-emerald-200">
                        <div className="flex items-center gap-2 text-sm text-slate-700">
                            <LayoutGrid className="w-4 h-4 text-emerald-400 shrink-0" />
                            {a.name}
                        </div>
                        <button onClick={() => handleDelete(a.id)} className="p-1 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all rounded">
                            <Trash2 className="w-3.5 h-3.5" />
                        </button>
                    </div>
                ))}
                {assets.length === 0 && <p className="text-xs text-slate-400 text-center py-5">Chưa có tài sản nào.</p>}
            </div>
        </div>
    );
};

// ======================= TEMPLATE TAB =======================

/** Checkbox that supports indeterminate state */
const TriCheckbox: React.FC<{
    checked: boolean;
    indeterminate?: boolean;
    onChange: () => void;
    className?: string;
}> = ({ checked, indeterminate, onChange, className }) => {
    const ref = React.useRef<HTMLInputElement>(null);
    useEffect(() => {
        if (ref.current) ref.current.indeterminate = !!indeterminate;
    }, [indeterminate]);
    return (
        <input
            ref={ref}
            type="checkbox"
            checked={checked}
            onChange={onChange}
            className={`accent-emerald-500 w-3.5 h-3.5 cursor-pointer ${className ?? ''}`}
        />
    );
};

const TemplateTab: React.FC<{
    projectId?: string;
    assets: Asset[];
    works: Work[];
    subWorks: SubWork[];
    processes: Process[];
}> = ({ projectId, assets, works, subWorks, processes }) => {
    const [templates, setTemplates] = useState<Template[]>([]);
    const [configs, setConfigs] = useState<Config[]>([]);
    const [loading, setLoading] = useState(false);
    const [newTemplateName, setNewTemplateName] = useState('');
    const [selectedConfigIds, setSelectedConfigIds] = useState<Set<string>>(new Set());
    const [expandedWorks, setExpandedWorks] = useState<Set<string>>(new Set());
    const [expandedSubWorks, setExpandedSubWorks] = useState<Set<string>>(new Set());
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const [tplRes, cfgRes] = await Promise.all([
                api.get('/templates').catch(() => ({ data: [] })),
                api.get('/configs', { params: projectId ? { project_id: projectId } : {} }).catch(() => ({ data: [] }))
            ]);
            let rawTemplates = tplRes.data || [];
            if (projectId) {
                rawTemplates = rawTemplates.filter((t: any) => t.id_project === projectId || !t.id_project);
            }
            setTemplates(rawTemplates);
            setConfigs(cfgRes.data || []);
        } catch (e) {
            console.error('Failed to fetch template data', e);
        } finally {
            setLoading(false);
        }
    }, [projectId]);

    useEffect(() => { fetchData(); }, [fetchData]);

    // Build enriched + grouped tree: Work -> SubWork -> Asset(Config)
    const enrichedConfigs = configs.map(c => ({
        ...c,
        asset: assets.find(a => a.id === c.id_asset),
        sub_work: (() => {
            const sw = subWorks.find(s => s.id === c.id_sub_work);
            if (!sw) return undefined;
            return { ...sw, work: works.find(w => w.id === sw.id_work) };
        })(),
    })).filter(c => c.asset && c.sub_work?.work);

    type EnrichedConfig = typeof enrichedConfigs[number];

    /** tree[workId][subWorkId] = Config[] */
    const tree = enrichedConfigs.reduce<Record<string, { work: Work; subWorks: Record<string, { subWork: SubWork; configs: EnrichedConfig[] }> }>>((acc, cfg) => {
        const workId = cfg.sub_work!.work!.id;
        const swId = cfg.sub_work!.id;
        if (!acc[workId]) acc[workId] = { work: cfg.sub_work!.work!, subWorks: {} };
        if (!acc[workId].subWorks[swId]) acc[workId].subWorks[swId] = { subWork: cfg.sub_work! as SubWork, configs: [] };
        acc[workId].subWorks[swId].configs.push(cfg);
        return acc;
    }, {});

    const sortedWorkIds = Object.keys(tree).sort((a, b) => tree[a].work.name.localeCompare(tree[b].work.name));

    // Toggle helpers
    const getWorkConfigIds = (workId: string) =>
        Object.values(tree[workId]?.subWorks ?? {}).flatMap(sw => sw.configs.map(c => c.id));

    const getSwConfigIds = (workId: string, swId: string) =>
        (tree[workId]?.subWorks[swId]?.configs ?? []).map(c => c.id);

    const toggleWork = (workId: string) => {
        const ids = getWorkConfigIds(workId);
        const allSelected = ids.every(id => selectedConfigIds.has(id));
        const next = new Set(selectedConfigIds);
        if (allSelected) ids.forEach(id => next.delete(id));
        else ids.forEach(id => next.add(id));
        setSelectedConfigIds(next);
    };

    const toggleSubWork = (workId: string, swId: string) => {
        const ids = getSwConfigIds(workId, swId);
        const allSelected = ids.every(id => selectedConfigIds.has(id));
        const next = new Set(selectedConfigIds);
        if (allSelected) ids.forEach(id => next.delete(id));
        else ids.forEach(id => next.add(id));
        setSelectedConfigIds(next);
    };

    const toggleConfig = (id: string) => {
        const next = new Set(selectedConfigIds);
        if (next.has(id)) next.delete(id); else next.add(id);
        setSelectedConfigIds(next);
    };

    const workCheckState = (workId: string): 'all' | 'none' | 'partial' => {
        const ids = getWorkConfigIds(workId);
        if (ids.length === 0) return 'none';
        const cnt = ids.filter(id => selectedConfigIds.has(id)).length;
        if (cnt === 0) return 'none';
        if (cnt === ids.length) return 'all';
        return 'partial';
    };

    const swCheckState = (workId: string, swId: string): 'all' | 'none' | 'partial' => {
        const ids = getSwConfigIds(workId, swId);
        if (ids.length === 0) return 'none';
        const cnt = ids.filter(id => selectedConfigIds.has(id)).length;
        if (cnt === 0) return 'none';
        if (cnt === ids.length) return 'all';
        return 'partial';
    };

    const handleSaveTemplate = async () => {
        if (!newTemplateName.trim() || selectedConfigIds.size === 0) {
            setError('Vui lòng nhập tên và chọn ít nhất 1 cấu hình.');
            return;
        }
        setSaving(true);
        setError(null);
        try {
            await api.post('/templates', {
                name: newTemplateName,
                id_project: projectId || null,
                // send as array of UUID strings stored as JSONB in backend
                id_config: Array.from(selectedConfigIds),
            });
            setNewTemplateName('');
            setSelectedConfigIds(new Set());
            fetchData();
        } catch (e: any) {
            setError(e.response?.data?.error || 'Tạo mẫu thất bại');
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteTemplate = async (id: string) => {
        if (!window.confirm('Xóa mẫu này?')) return;
        try {
            await api.delete(`/templates/${id}`);
            fetchData();
        } catch (e) {
            console.error(e);
        }
    };

    const tplConfigsFor = (tpl: Template) => {
        const ids: string[] = (() => {
            try {
                // id_config can come as a JS array or as a raw JSON string
                const raw = (tpl as any).id_config;
                return Array.isArray(raw) ? raw : JSON.parse(raw || '[]');
            } catch { return []; }
        })();
        return ids.map(cid => enrichedConfigs.find(c => c.id === cid)).filter(Boolean) as typeof enrichedConfigs;
    };

    return (
        <div className="flex h-full min-h-0 bg-white">
            {/* Left: Create Form */}
            <div className="w-80 border-r border-gray-100 flex flex-col min-h-0 bg-slate-50/50">
                <div className="p-4 border-b border-gray-50 bg-white shrink-0 flex items-center gap-2 text-sm font-bold text-emerald-700">
                    <BookOpen className="w-4 h-4" />
                    Tạo Mẫu Mới
                </div>
                <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                    {error && <p className="text-red-500 text-[11px] mb-3 px-2 py-1.5 bg-red-50 rounded-lg">{error}</p>}

                    <div className="mb-4">
                        <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Tên Mẫu (Template)</label>
                        <input
                            type="text" placeholder="VD: Bảo Trì Tháng 3"
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400"
                            value={newTemplateName}
                            onChange={e => setNewTemplateName(e.target.value)}
                        />
                    </div>

                    {/* Hierarchical tree */}
                    <div className="mb-3 flex items-center justify-between">
                        <label className="text-xs font-semibold text-slate-600">Chọn Cấu hình theo cây</label>
                        <span className="text-[10px] font-medium bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">{selectedConfigIds.size} Đã chọn</span>
                    </div>

                    {enrichedConfigs.length === 0 && (
                        <p className="text-xs text-slate-400 text-center py-4">Chưa có cấu hình nào trong dự án. Vui lòng tạo ở tab Cấu hình.</p>
                    )}

                    <div className="space-y-1.5">
                        {sortedWorkIds.map(workId => {
                            const { work, subWorks: sws } = tree[workId];
                            const wState = workCheckState(workId);
                            const isWorkOpen = expandedWorks.has(workId);
                            const sortedSwIds = Object.keys(sws).sort((a, b) => sws[a].subWork.name.localeCompare(sws[b].subWork.name));

                            return (
                                <div key={workId} className="border border-slate-200 rounded-xl overflow-hidden">
                                    {/* Work row */}
                                    <div
                                        className={`flex items-center gap-2 px-3 py-2 cursor-pointer select-none transition-colors ${wState !== 'none' ? 'bg-emerald-50' : 'bg-white hover:bg-slate-50'}`}
                                    >
                                        <TriCheckbox
                                            checked={wState === 'all'}
                                            indeterminate={wState === 'partial'}
                                            onChange={() => toggleWork(workId)}
                                        />
                                        <span
                                            className="flex-1 text-xs font-bold text-orange-700 truncate"
                                            onClick={() => setExpandedWorks(prev => {
                                                const next = new Set(prev);
                                                if (next.has(workId)) next.delete(workId); else next.add(workId);
                                                return next;
                                            })}
                                        >
                                            {work.name}
                                        </span>
                                        <button
                                            onClick={() => setExpandedWorks(prev => {
                                                const next = new Set(prev);
                                                if (next.has(workId)) next.delete(workId); else next.add(workId);
                                                return next;
                                            })}
                                            className="p-0.5 text-slate-400 hover:text-slate-600"
                                        >
                                            {isWorkOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                                        </button>
                                    </div>

                                    {/* Sub-work rows */}
                                    {isWorkOpen && (
                                        <div className="border-t border-slate-100 bg-white">
                                            {sortedSwIds.map(swId => {
                                                const { subWork, configs: swCfgs } = sws[swId];
                                                const swState = swCheckState(workId, swId);
                                                const isSwOpen = expandedSubWorks.has(swId);
                                                const sortedCfgs = [...swCfgs].sort((a, b) => (a.asset?.name ?? '').localeCompare(b.asset?.name ?? ''));

                                                return (
                                                    <div key={swId} className="border-b border-slate-50 last:border-0">
                                                        {/* Sub-work row */}
                                                        <div
                                                            className={`flex items-center gap-2 pl-5 pr-3 py-1.5 cursor-pointer select-none transition-colors ${swState !== 'none' ? 'bg-indigo-50/60' : 'hover:bg-slate-50'}`}
                                                        >
                                                            <TriCheckbox
                                                                checked={swState === 'all'}
                                                                indeterminate={swState === 'partial'}
                                                                onChange={() => toggleSubWork(workId, swId)}
                                                            />
                                                            <span
                                                                className="flex-1 text-[11px] font-semibold text-indigo-700 truncate"
                                                                onClick={() => setExpandedSubWorks(prev => {
                                                                    const next = new Set(prev);
                                                                    if (next.has(swId)) next.delete(swId); else next.add(swId);
                                                                    return next;
                                                                })}
                                                            >
                                                                {subWork.name}
                                                            </span>
                                                            <span className="text-[10px] text-slate-400 mr-1">{swCfgs.length}</span>
                                                            <button
                                                                onClick={() => setExpandedSubWorks(prev => {
                                                                    const next = new Set(prev);
                                                                    if (next.has(swId)) next.delete(swId); else next.add(swId);
                                                                    return next;
                                                                })}
                                                                className="p-0.5 text-slate-400 hover:text-slate-600"
                                                            >
                                                                {isSwOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                                                            </button>
                                                        </div>

                                                        {/* Asset (Config) rows */}
                                                        {isSwOpen && (
                                                            <div className="border-t border-slate-50">
                                                                {sortedCfgs.map(cfg => (
                                                                    <label
                                                                        key={cfg.id}
                                                                        className={`flex items-center gap-2 pl-10 pr-3 py-1.5 cursor-pointer transition-colors ${selectedConfigIds.has(cfg.id) ? 'bg-emerald-50/70 text-emerald-800' : 'hover:bg-slate-50 text-slate-600'}`}
                                                                    >
                                                                        <input
                                                                            type="checkbox"
                                                                            className="accent-emerald-500 w-3 h-3"
                                                                            checked={selectedConfigIds.has(cfg.id)}
                                                                            onChange={() => toggleConfig(cfg.id)}
                                                                        />
                                                                        <LayoutGrid className="w-3 h-3 text-emerald-500 shrink-0" />
                                                                        <span className="text-[11px] font-medium truncate">{cfg.asset?.name}</span>
                                                                    </label>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>

                <div className="p-4 bg-white border-t border-gray-50 flex-shrink-0">
                    <button
                        onClick={handleSaveTemplate}
                        disabled={saving || !newTemplateName.trim() || selectedConfigIds.size === 0}
                        className="w-full py-2.5 bg-emerald-400 hover:bg-emerald-500 text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-50 transition-colors"
                    >
                        <Plus className="w-4 h-4" /> Lưu Mẫu
                    </button>
                </div>
            </div>

            {/* Right: Template List */}
            <div className="flex-1 flex flex-col min-h-0 bg-white">
                <div className="p-4 border-b border-gray-50 flex items-center justify-between bg-white shrink-0">
                    <h3 className="text-sm font-bold text-slate-700">Danh sách Mẫu của dự án</h3>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
                    {loading ? <p className="text-sm text-slate-400 text-center">Đang tải...</p> : null}
                    {templates.map(t => {
                        const tplConfigs = tplConfigsFor(t);
                        return (
                            <div key={t.id} className="border border-emerald-100 rounded-xl overflow-hidden shadow-sm">
                                <div className="bg-emerald-50 border-b border-emerald-100 px-4 py-3 flex items-center justify-between">
                                    <div className="flex items-center gap-2 text-emerald-800 font-bold">
                                        <BookOpen className="w-4 h-4 text-emerald-600" />
                                        {t.name}
                                    </div>
                                    <button onClick={() => handleDeleteTemplate(t.id)} className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-white rounded transition-colors">
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                                <div className="p-4 bg-white">
                                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-1">
                                        <Check className="w-3 h-3 text-emerald-400" /> CHI TIẾT HẠNG MỤC ({tplConfigs.length})
                                    </div>
                                    <div className="border-l-[1.5px] border-emerald-100/70 ml-1.5 pl-3 space-y-3">
                                        {tplConfigs.map((c, i) => (
                                            <div key={i} className="text-sm border-b border-slate-50 border-dashed pb-2 last:border-0 last:pb-0">
                                                <div className="flex items-center gap-1.5 font-semibold text-slate-700 mb-1.5 relative">
                                                    <span className="absolute -left-[17px] top-1.5 w-1.5 h-1.5 rounded-full bg-emerald-300"></span>
                                                    <span className="text-indigo-600">{c.asset?.name || ''}</span>
                                                    <ChevronRight className="w-3 h-3 text-slate-300" />
                                                    <span className="text-purple-600">{c.sub_work?.work?.name || ''}</span>
                                                    <ChevronRight className="w-3 h-3 text-slate-300" />
                                                    <span className="text-slate-600">{c.sub_work?.name || ''}</span>
                                                </div>
                                                <div className="ml-1 flex flex-wrap gap-1.5">
                                                    {(c.sub_work?.id_process || []).map((pid: string, j: number) => {
                                                        const p = processes.find(pr => pr.id === pid);
                                                        return p ? (
                                                            <span key={j} className="px-2 py-0.5 bg-orange-50 text-orange-600 text-[10px] font-medium rounded border border-orange-100">
                                                                {p.name}
                                                            </span>
                                                        ) : null;
                                                    })}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                    {templates.length === 0 && !loading && (
                        <div className="flex flex-col items-center justify-center text-slate-400 h-full opacity-50">
                            <BookOpen className="w-12 h-12 mb-2" />
                            <p className="text-sm">Chưa có mẫu nào.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};


// ======================= MAIN MODAL =======================
const ProjectConfigManagerModal: React.FC<Props> = ({ isOpen, onClose, onChange, projectId }) => {
    const [activeTab, setActiveTab] = useState<Tab>('config');
    const [assets, setAssets] = useState<Asset[]>([]);
    const [works, setWorks] = useState<Work[]>([]);
    const [subWorks, setSubWorks] = useState<SubWork[]>([]);
    const [processes, setProcesses] = useState<Process[]>([]);

    const fetchBase = useCallback(async () => {
        try {
            const [assetsRes, worksRes, subWorksRes, procsRes] = await Promise.all([
                api.get('/assets', { params: projectId ? { project_id: projectId } : {} }).catch(() => ({ data: [] })),
                api.get('/works').catch(() => ({ data: [] })),
                api.get('/sub-works').catch(() => ({ data: [] })),
                api.get('/process').catch(() => ({ data: [] })),
            ]);
            setAssets(assetsRes.data || []);
            setWorks(worksRes.data || []);
            setSubWorks(subWorksRes.data || []);
            setProcesses(procsRes.data || []);
        } catch (e) {
            console.error('Failed to fetch base data', e);
        }
    }, [projectId]);

    useEffect(() => {
        if (isOpen) {
            fetchBase();
        }
    }, [isOpen, fetchBase]);

    const handleRefresh = () => {
        fetchBase();
        onChange();
    };

    if (!isOpen) return null;

    const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
        { id: 'work', label: 'Hạng mục chính (Work)', icon: <Folder className="w-3.5 h-3.5" /> },
        { id: 'asset', label: 'Tài sản (Asset)', icon: <LayoutGrid className="w-3.5 h-3.5" /> },
        { id: 'config', label: 'Cấu hình (Config)', icon: <Settings className="w-3.5 h-3.5" /> },
        { id: 'template', label: 'Các Mẫu (Template)', icon: <BookOpen className="w-3.5 h-3.5" /> },
    ];

    return ReactDOM.createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
            <div className="bg-white rounded-2xl w-full max-w-5xl h-[85vh] shadow-2xl flex flex-col overflow-hidden">
                {/* Header */}
                <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50 shrink-0">
                    <div className="flex items-center gap-2">
                        <Folder className="w-5 h-5 text-indigo-500" />
                        <h2 className="text-lg font-bold text-gray-800">Quản lý hạng mục</h2>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                        <X className="w-5 h-5 text-gray-500" />
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-gray-100 shrink-0 bg-white px-4 gap-1 pt-2">
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold rounded-t-lg border-b-2 transition-all ${activeTab === tab.id
                                ? 'text-indigo-600 border-indigo-600 bg-indigo-50'
                                : 'text-slate-500 border-transparent hover:text-indigo-500 hover:bg-slate-50'
                                }`}
                        >
                            {tab.icon}
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* Tab Content */}
                <div className="flex-1 min-h-0 overflow-hidden">
                    {activeTab === 'config' && (
                        <ConfigTab
                            projectId={projectId}
                            assets={assets}
                            works={works}
                            subWorks={subWorks}
                            processes={processes}
                            onRefresh={handleRefresh}
                        />
                    )}
                    {activeTab === 'work' && (
                        <WorkTab works={works} subWorks={subWorks} processes={processes} onRefresh={handleRefresh} />
                    )}
                    {activeTab === 'asset' && (
                        <AssetTab projectId={projectId} assets={assets} onRefresh={handleRefresh} />
                    )}
                    {activeTab === 'template' && (
                        <TemplateTab
                            projectId={projectId}
                            assets={assets}
                            works={works}
                            subWorks={subWorks}
                            processes={processes}
                        />
                    )}
                </div>
            </div>
        </div>,
        document.body
    );
};

export default ProjectConfigManagerModal;
