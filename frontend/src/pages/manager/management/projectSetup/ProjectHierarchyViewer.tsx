import React, { useMemo, useState } from 'react';
import { Settings, Folder, LayoutGrid, CheckCircle, Clock, Camera, BookOpen, ArrowDownAZ } from 'lucide-react';
import GlassCard from '../../../../components/common/GlassCard';
import PremiumButton from '../../../../components/common/PremiumButton';

const TemplateGroupCard: React.FC<{
    work: any;
    subWork: any;
    cfgTemplate: any;
    targetAssets: any[];
    assets: any[];
    processes: any[];
}> = ({ work, subWork, cfgTemplate, targetAssets, assets, processes }) => {
    const hasGuide = !!(cfgTemplate.guide_text || (cfgTemplate.guide_images && cfgTemplate.guide_images.length > 0));

    const renderAssets = useMemo(() => {
        return targetAssets.map(asset => {
            let name = asset.name;
            let curr = asset;
            const visited = new Set([curr.id]);
            while (curr.parent_id) {
                const p = assets.find((x: any) => x.id === curr.parent_id);
                if (!p || visited.has(p.id)) break;
                visited.add(p.id);
                name = `${p.name} ---> ${name}`;
                curr = p;
            }
            return { id: asset.id, path: name };
        }).sort((a, b) => a.path.localeCompare(b.path, undefined, { numeric: true }));
    }, [targetAssets, assets]);

    return (
        <div className="p-5 bg-white hover:shadow-lg transition-all rounded-2xl border border-slate-200 flex flex-col h-full group relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-400 to-teal-500 opacity-80"></div>

            <div className="mb-4">
                <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-[10px] uppercase tracking-widest font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded text-center">
                        {work.name}
                    </span>
                </div>
                <div className="text-base font-bold text-slate-800 leading-tight">
                    {subWork.name}
                </div>
            </div>

            <div className="mb-4 flex-1">
                <div className="text-xs font-semibold text-slate-500 mb-2 flex items-center justify-between">
                    <span>Áp dụng cho ({targetAssets.length} thiết bị):</span>
                </div>
                <div className="flex flex-col gap-1.5 max-h-[140px] overflow-y-auto pr-2 custom-scrollbar">
                    {renderAssets.map(ra => (
                        <div key={ra.id} className="bg-slate-50 hover:bg-emerald-50 text-slate-700 hover:text-emerald-700 transition-colors rounded-md border border-slate-100 hover:border-emerald-200 p-2 flex items-center gap-2 text-xs font-medium group/item cursor-default">
                            <LayoutGrid className="w-3.5 h-3.5 shrink-0 text-slate-400 group-hover/item:text-emerald-500" />
                            <span className="truncate">{ra.path}</span>
                        </div>
                    ))}
                </div>
            </div>

            <div className="mt-auto pt-3 border-t border-dashed border-slate-200 flex flex-col gap-3">
                {subWork.id_process && subWork.id_process.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                        {subWork.id_process.map((pid: string) => {
                            const p = processes.find(x => x.id === pid);
                            return p ? (
                                <span key={pid} className="px-2 py-1 bg-amber-50 text-amber-700 rounded-md text-[10px] font-semibold border border-amber-200/60 shadow-sm flex items-center gap-1">
                                    <CheckCircle className="w-3 h-3" />
                                    {p.name}
                                </span>
                            ) : null;
                        })}
                    </div>
                )}

                <div className="flex flex-wrap gap-2 text-xs font-semibold">
                    <span className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border shadow-sm ${cfgTemplate.status_set_image_count ? 'bg-orange-50 text-orange-600 border-orange-200' : 'bg-slate-50 text-slate-600 border-slate-200'}`}>
                        <Camera className="w-3.5 h-3.5" />
                        {cfgTemplate.status_set_image_count ? `${cfgTemplate.image_count} ảnh` : 'Chụp vô hạn'}
                    </span>
                    {hasGuide && (
                        <span className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-teal-50 text-teal-600 border border-teal-200 shadow-sm">
                            <BookOpen className="w-3.5 h-3.5" />
                            Hướng dẫn
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
};

const GeneralConfigCard: React.FC<{
    cfg: any;
    asset: any;
    assets: any[];
}> = ({ cfg, asset, assets }) => {
    const hasGuide = !!(cfg.guide_text || (cfg.guide_images && cfg.guide_images.length > 0));

    const assetPath = useMemo(() => {
        let name = asset.name;
        let curr = asset;
        const visited = new Set([curr.id]);
        while (curr.parent_id) {
            const p = assets.find((x: any) => x.id === curr.parent_id);
            if (!p || visited.has(p.id)) break;
            visited.add(p.id);
            name = `${p.name} ❯ ${name}`;
            curr = p;
        }
        return name;
    }, [asset, assets]);

    return (
        <div className="p-3 bg-white hover:bg-slate-50 transition-colors rounded-xl border border-slate-200 shadow-sm flex flex-col h-full">
            <div className="bg-emerald-50/50 rounded-lg border border-emerald-100/60 p-2 mb-3 flex items-center gap-2">
                <div className="w-5 h-5 rounded bg-white shadow-sm flex items-center justify-center shrink-0">
                    <LayoutGrid className="w-3 h-3 text-emerald-500" />
                </div>
                <div className="text-xs font-semibold text-emerald-800 break-words whitespace-normal leading-relaxed">
                    {assetPath}
                </div>
            </div>
            <div className="flex flex-wrap gap-2 text-[11px] font-semibold mt-auto">
                <span className={`flex items-center gap-1.5 px-2 py-1 rounded border shadow-sm ${cfg.status_set_image_count ? 'bg-orange-50 text-orange-600 border-orange-200' : 'bg-slate-50 text-slate-600 border-slate-200'}`}>
                    <Camera className="w-3.5 h-3.5" />
                    {cfg.status_set_image_count ? `${cfg.image_count} ảnh` : 'Chụp vô hạn'}
                </span>
                {hasGuide && (
                    <span className="flex items-center gap-1.5 px-2 py-1 rounded bg-teal-50 text-teal-600 border border-teal-200 shadow-sm">
                        <BookOpen className="w-3.5 h-3.5" />
                        Hướng dẫn
                    </span>
                )}
            </div>
        </div>
    );
};

interface HierarchyProps {
    assets: any[];
    works: any[];
    subWorks: any[];
    configs: any[];
    processes: any[];
    templates: any[];
    onOpenManager: () => void;
}

const ProjectHierarchyViewer: React.FC<HierarchyProps> = ({
    assets, works, subWorks, configs, processes, templates, onOpenManager
}) => {
    const [viewMode, setViewMode] = useState<'general' | 'template'>('general');
    const [isSmartSort, setIsSmartSort] = useState(false);

    // Determine if we have any configs to show
    const projectConfigs = useMemo(() => {
        const assetIds = new Set(assets.map(a => a.id));
        return configs.filter(c => assetIds.has(c.id_asset));
    }, [configs, assets]);

    // If no assets or no configs, return placeholder
    if (assets.length === 0 || projectConfigs.length === 0) {
        return (
            <GlassCard className="flex flex-col items-center justify-center p-12 text-center max-w-2xl mx-auto space-y-6">
                <div className="w-20 h-20 bg-indigo-50 text-indigo-500 rounded-full flex items-center justify-center">
                    <LayoutGrid className="w-10 h-10" />
                </div>
                <div>
                    <h2 className="text-2xl font-bold text-slate-800 mb-2">Cấu Hình Dự Án</h2>
                    <p className="text-slate-500 mb-6">Thiết lập hạng mục công việc, tài sản thiết bị và các quy trình cho dự án một cách tập trung.</p>
                    <PremiumButton size="lg" onClick={onOpenManager} icon={<Settings className="w-5 h-5" />}>
                        Mở Trình Quản Lý Cấu Hình
                    </PremiumButton>
                </div>
            </GlassCard>
        );
    }

    // Build the Tree Structure
    // works -> subWorks -> assets
    return (
        <GlassCard className="p-6">
            <div className="flex justify-between items-center border-b border-gray-100 pb-4 mb-6">
                <div>
                    <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                        <Folder className="w-6 h-6 text-indigo-500" />
                        Cấu hình hiện tại
                    </h2>
                    <p className="text-sm text-slate-500 mt-1">Sơ đồ tổng quan quy trình vận hành và tài sản áp dụng</p>
                </div>
                <div className="flex items-center gap-4">
                    <div className="flex bg-slate-100 p-1 rounded-lg">
                        <button
                            onClick={() => setViewMode('general')}
                            className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${viewMode === 'general' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            Tổng quát
                        </button>
                        <button
                            onClick={() => setViewMode('template')}
                            className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${viewMode === 'template' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            Theo Mẫu
                        </button>
                    </div>
                    <button
                        onClick={() => setIsSmartSort(!isSmartSort)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg transition-all ${isSmartSort ? 'bg-indigo-50 text-indigo-600 border border-indigo-200 shadow-sm' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 shadow-sm'}`}
                        title="Sắp xếp thông minh (tự động nhận diện số)"
                    >
                        <ArrowDownAZ className="w-4 h-4" />
                        Sắp xếp A-Z
                    </button>
                    <PremiumButton onClick={onOpenManager} icon={<Settings className="w-4 h-4" />}>
                        Mở Trình Quản Lý
                    </PremiumButton>
                </div>
            </div>

            <div className="space-y-6 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
                {viewMode === 'general' ? (
                    (() => {
                        const displayWorks = isSmartSort 
                            ? [...works].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))
                            : works;
                        
                        return displayWorks.map(work => {
                            const workSubWorks = subWorks.filter(sw => sw.id_work === work.id);
                            // Check if this work has any configs associated
                            const workHasConfigs = workSubWorks.some(sw => projectConfigs.some(cfg => cfg.id_sub_work === sw.id));

                        if (!workHasConfigs) return null;

                        return (
                            <div key={work.id} className="bg-slate-50/50 border border-slate-200 rounded-xl p-4">
                                <h3 className="font-bold text-lg text-slate-800 mb-4 flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                                    {work.name}
                                </h3>

                                <div className="space-y-4 pl-4 border-l-2 border-slate-100 ml-1">
                                    {(() => {
                                        const displaySubWorks = isSmartSort
                                            ? [...workSubWorks].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))
                                            : workSubWorks;
                                        
                                        return displaySubWorks.map(subWork => {
                                            const swConfigs = projectConfigs.filter(cfg => cfg.id_sub_work === subWork.id);
                                            if (swConfigs.length === 0) return null;

                                            return (
                                                <div key={subWork.id} className="bg-white border border-slate-100 rounded-lg p-4 shadow-sm">
                                                <div className="flex justify-between items-start mb-3">
                                                    <div>
                                                        <h4 className="font-semibold text-slate-700 text-base">{subWork.name}</h4>
                                                        {subWork.id_process && subWork.id_process.length > 0 && (
                                                            <div className="flex flex-wrap gap-1 mt-1.5">
                                                                {subWork.id_process.map((pid: string) => {
                                                                    const p = processes.find(x => x.id === pid);
                                                                    return p ? (
                                                                        <span key={pid} className="px-2 py-0.5 bg-amber-50 text-amber-700 rounded text-xs border border-amber-100">
                                                                            {p.name}
                                                                        </span>
                                                                    ) : null;
                                                                })}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>

                                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                                    {(() => {
                                                        const displayConfigs = isSmartSort
                                                            ? [...swConfigs].sort((a, b) => {
                                                                const getPath = (assetId: string) => {
                                                                    let curr = assets.find((x: any) => x.id === assetId);
                                                                    if (!curr) return '';
                                                                    let name = curr.name;
                                                                    const visited = new Set([curr.id]);
                                                                    while (curr.parent_id) {
                                                                        const p = assets.find((x: any) => x.id === curr.parent_id);
                                                                        if (!p || visited.has(p.id)) break;
                                                                        visited.add(p.id);
                                                                        name = `${p.name} ❯ ${name}`;
                                                                        curr = p;
                                                                    }
                                                                    return name;
                                                                };
                                                                return getPath(a.id_asset).localeCompare(getPath(b.id_asset), undefined, { numeric: true });
                                                            })
                                                            : swConfigs;
                                                        
                                                        return displayConfigs.map(cfg => {
                                                            const asset = assets.find(a => a.id === cfg.id_asset);
                                                            if (!asset) return null;

                                                            return (
                                                                <GeneralConfigCard
                                                                    key={cfg.id}
                                                                    cfg={cfg}
                                                                    asset={asset}
                                                                    assets={assets}
                                                                />
                                                            );
                                                        });
                                                    })()}
                                                </div>
                                            </div>
                                        );
                                    })
                                    })()}
                                </div>
                            </div>
                        );
                    })
                    })()
                ) : (
                    (() => {
                        const displayTemplates = isSmartSort
                            ? [...templates].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))
                            : templates;
                        
                        return displayTemplates.map(tpl => {
                            const rawIds = (tpl as any).id_config;
                        const tplConfigIds: string[] = Array.isArray(rawIds)
                            ? rawIds
                            : (() => { try { return JSON.parse(rawIds || '[]'); } catch { return []; } })();
                        const tplConfigs = tplConfigIds
                            .map((cid: string) => projectConfigs.find(c => c.id === cid))
                            .filter(Boolean);

                        if (tplConfigs.length === 0) return null;

                        return (
                            <div key={tpl.id} className="bg-slate-50/50 border border-slate-200 rounded-xl overflow-hidden mb-6">
                                <div className="bg-emerald-50 border-b border-emerald-100 px-4 py-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-y-2">
                                    <div>
                                        <h3 className="font-bold text-lg text-emerald-800 flex items-center gap-2">
                                            <BookOpen className="w-5 h-5 text-emerald-600" />
                                            {tpl.name}
                                        </h3>
                                        {tpl.created_at && !isNaN(new Date(tpl.created_at).getTime()) && (
                                            <p className="text-xs text-emerald-600/80 mt-1 flex items-center gap-1.5 ml-7">
                                                <Clock className="w-3.5 h-3.5" />
                                                {new Date(tpl.created_at).toLocaleString('vi-VN')}
                                            </p>
                                        )}
                                    </div>
                                    <span className="text-xs font-semibold px-2 py-1 rounded-full bg-emerald-100 text-emerald-700">
                                        {tplConfigs.length} cấu hình
                                    </span>
                                </div>
                                <div className="p-4 bg-white">
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                        {(() => {
                                            const map = new Map<string, any>();
                                            tplConfigs.forEach((cfg: any) => {
                                                const subWork = subWorks.find(sw => sw.id === cfg.id_sub_work);
                                                if (!subWork) return;

                                                if (!map.has(subWork.id)) {
                                                    const work = works.find(w => w.id === subWork.id_work);
                                                    if (!work) return;
                                                    map.set(subWork.id, {
                                                        id: subWork.id,
                                                        subWork,
                                                        work,
                                                        cfgTemplate: cfg,
                                                        targetAssets: []
                                                    });
                                                }

                                                const asset = assets.find(a => a.id === cfg.id_asset);
                                                if (asset) {
                                                    map.get(subWork.id).targetAssets.push(asset);
                                                }
                                            });

                                            return Array.from(map.values()).map(group => (
                                                <TemplateGroupCard
                                                    key={group.id}
                                                    work={group.work}
                                                    subWork={group.subWork}
                                                    cfgTemplate={group.cfgTemplate}
                                                    targetAssets={group.targetAssets}
                                                    assets={assets}
                                                    processes={processes}
                                                />
                                            ));
                                        })()}
                                    </div>
                                </div>
                            </div>
                        );
                    })
                    })()
                )}
            </div>
        </GlassCard>
    );
};

export default ProjectHierarchyViewer;
