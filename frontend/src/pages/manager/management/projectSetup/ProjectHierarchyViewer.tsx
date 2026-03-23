import React, { useMemo, useState } from 'react';
import { Settings, Folder, LayoutGrid, CheckCircle, Clock, Camera, BookOpen } from 'lucide-react';
import GlassCard from '../../../../components/common/GlassCard';
import PremiumButton from '../../../../components/common/PremiumButton';

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
                    <PremiumButton onClick={onOpenManager} icon={<Settings className="w-4 h-4" />}>
                        Mở Trình Quản Lý
                    </PremiumButton>
                </div>
            </div>

            <div className="space-y-6 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
                {viewMode === 'general' ? (
                    works.map(work => {
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
                                    {workSubWorks.map(subWork => {
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
                                                    {swConfigs.map(cfg => {
                                                        const asset = assets.find(a => a.id === cfg.id_asset);
                                                        if (!asset) return null;

                                                        const hasGuide = !!(cfg.guide_text || (cfg.guide_images && cfg.guide_images.length > 0));

                                                        return (
                                                            <div key={cfg.id} className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                                                                <div className="font-medium text-slate-800 flex items-center gap-2 mb-2">
                                                                    <LayoutGrid className="w-4 h-4 text-emerald-500" />
                                                                    {asset.name}
                                                                </div>
                                                                <div className="flex flex-wrap gap-2 text-xs font-medium mt-1">
                                                                    <span className={`flex items-center gap-1.5 px-2 py-1 rounded-md border ${cfg.status_set_image_count ? 'bg-orange-50 text-orange-600 border-orange-200' : 'bg-white text-slate-600 border-slate-200'}`}>
                                                                        <Camera className="w-3.5 h-3.5" />
                                                                        {cfg.status_set_image_count ? `${cfg.image_count} ảnh` : 'Chụp vô hạn'}
                                                                    </span>
                                                                    {hasGuide && (
                                                                        <span className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-teal-50 text-teal-600 border border-teal-200">
                                                                            <BookOpen className="w-3.5 h-3.5" />
                                                                            Hướng dẫn
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })
                ) : (
                    templates.map(tpl => {
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
                                <div className="bg-emerald-50 border-b border-emerald-100 px-4 py-3 flex items-center justify-between">
                                    <h3 className="font-bold text-lg text-emerald-800 flex items-center gap-2">
                                        <BookOpen className="w-5 h-5 text-emerald-600" />
                                        {tpl.name}
                                    </h3>
                                    <span className="text-xs font-semibold px-2 py-1 rounded-full bg-emerald-100 text-emerald-700">
                                        {tplConfigs.length} cấu hình
                                    </span>
                                </div>
                                <div className="p-4 bg-white">
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                        {tplConfigs.map((cfg: any) => {
                                            const subWork = subWorks.find(sw => sw.id === cfg.id_sub_work);
                                            const work = subWork ? works.find(w => w.id === subWork.id_work) : null;
                                            const asset = assets.find(a => a.id === cfg.id_asset);
                                            
                                            if (!asset || !subWork || !work) return null;
                                            const hasGuide = !!(cfg.guide_text || (cfg.guide_images && cfg.guide_images.length > 0));

                                            return (
                                                <div key={cfg.id} className="p-3 bg-slate-50 rounded-lg border border-slate-200 flex flex-col h-full">
                                                    <div className="text-xs font-bold text-slate-500 mb-1 flex items-center gap-1.5 truncate">
                                                        <span className="text-indigo-600 truncate">{work.name}</span>
                                                        <span className="text-slate-300">/</span>
                                                        <span className="text-purple-600 truncate">{subWork.name}</span>
                                                    </div>
                                                    <div className="font-medium text-slate-800 flex items-center gap-2 mb-2">
                                                        <LayoutGrid className="w-4 h-4 text-emerald-500 shrink-0" />
                                                        <span className="truncate">{asset.name}</span>
                                                    </div>
                                                    
                                                    {subWork.id_process && subWork.id_process.length > 0 && (
                                                        <div className="flex flex-wrap gap-1 mb-2">
                                                            {subWork.id_process.map((pid: string) => {
                                                                const p = processes.find(x => x.id === pid);
                                                                return p ? (
                                                                    <span key={pid} className="px-1.5 py-0.5 bg-amber-50 text-amber-700 rounded text-[10px] border border-amber-100">
                                                                        {p.name}
                                                                    </span>
                                                                ) : null;
                                                            })}
                                                        </div>
                                                    )}

                                                    <div className="flex flex-wrap gap-2 text-xs font-medium mt-auto">
                                                        <span className={`flex items-center gap-1.5 px-2 py-1 rounded-md border ${cfg.status_set_image_count ? 'bg-orange-50 text-orange-600 border-orange-200' : 'bg-white text-slate-600 border-slate-200'}`}>
                                                            <Camera className="w-3.5 h-3.5" />
                                                            {cfg.status_set_image_count ? `${cfg.image_count} ảnh` : 'Chụp vô hạn'}
                                                        </span>
                                                        {hasGuide && (
                                                            <span className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-teal-50 text-teal-600 border border-teal-200">
                                                                <BookOpen className="w-3.5 h-3.5" />
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
                    })
                )}
            </div>
        </GlassCard>
    );
};

export default ProjectHierarchyViewer;
