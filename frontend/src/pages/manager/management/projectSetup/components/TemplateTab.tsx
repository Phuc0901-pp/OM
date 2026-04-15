import React, { useState, useEffect, useCallback } from 'react';
import {
    X, Plus, Trash2, Settings, LayoutGrid, Folder, Layers, Camera,
    ChevronRight, ChevronDown, BookOpen, AlertCircle, Save, Pencil, Check, Search, Minus
} from 'lucide-react';
import api from '../../../../../services/api';
import { Asset, Work, SubWork, Process, Config, Template } from './types';


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
                                                const getPath = (asset: Asset | undefined) => {
                                                    if (!asset) return '';
                                                    let name = asset.name;
                                                    let curr = asset;
                                                    while (curr.parent_id) {
                                                        const p = assets.find(x => x.id === curr.parent_id);
                                                        if (!p) break;
                                                        name = `${p.name} ❯ ${name}`;
                                                        curr = p;
                                                    }
                                                    return name;
                                                };
                                                const sortedCfgs = [...swCfgs].sort((a, b) => getPath(a.asset).localeCompare(getPath(b.asset)));

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
                                                                        <span className="text-[11px] font-medium truncate" title={getPath(cfg.asset)}>{getPath(cfg.asset)}</span>
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
export default TemplateTab;
