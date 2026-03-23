import React from 'react';
import { Briefcase, Rocket, Package, Users, Clock, Wrench, Plus, Layers } from 'lucide-react';
import GlassCard from '../../../components/common/GlassCard';
import PremiumButton from '../../../components/common/PremiumButton';

import { useAllocationData } from '../../../hooks/manager/useAllocationData';
import ProjectSelection from './components/ProjectSelection';
import TeamSelection from './components/TeamSelection';
import ModelProjectModal from './components/ModelProjectModal';
import CustomAssetTaskList from './components/CustomAssetTaskList';

const ManagerAllocationPage = () => {
    const data = useAllocationData();
    const [isModelModalOpen, setIsModelModalOpen] = React.useState(false);
    const [newTemplateName, setNewTemplateName] = React.useState('');

    // Determine if the current project actually has valid config entries
    const projectConfigs = React.useMemo(() => {
        const assetIds = new Set(data.assets.map(a => a.id));
        return data.configs.filter(c => assetIds.has(c.id_asset));
    }, [data.configs, data.assets]);

    return (
        <div className="p-4 md:p-8 space-y-8 pb-24">
            {/* Header */}
            <div className="relative overflow-hidden bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl rounded-3xl p-6 md:p-8 shadow-xl dark:shadow-2xl border border-white/20 dark:border-white/5 transition-colors flex flex-col lg:flex-row lg:items-start justify-between gap-6">
                <div className="absolute top-0 right-0 w-80 h-80 bg-gradient-to-br from-indigo-400/20 to-pink-600/20 rounded-full blur-3xl -z-10"></div>
                <div className="flex-1 relative z-10 flex flex-col gap-1">
                    <h1 className="text-3xl md:text-4xl font-black bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent mb-2">
                        Phân Bổ Công Việc
                    </h1>
                    <p className="text-gray-600 dark:text-slate-400 font-medium mb-2 lg:mb-0">Giao công việc từ dự án cho các nhân sự.</p>
                </div>

                {/* Right Side: Actions & Summary box */}
                <div className="flex flex-col lg:items-end gap-4">
                    {/* Action Button */}
                    <div className="flex justify-start lg:justify-end w-full">
                        <PremiumButton
                            onClick={data.handleSubmit}
                            loading={data.loading}
                            variant="primary"
                            icon={<Rocket className="w-5 h-5 mr-1" />}
                            size="md"
                            className="shadow-xl shadow-indigo-200"
                        >
                            Triển Khai
                        </PremiumButton>
                    </div>

                    {/* Summary box */}
                    {data.selectedProject && (
                        <div className="flex flex-wrap items-center gap-3 bg-slate-50/50 p-3 rounded-2xl border border-slate-100">
                            <div className="flex items-center gap-3 bg-white px-4 py-3 rounded-xl shadow-[0_2px_8px_-4px_rgba(0,0,0,0.1)] border border-slate-100 min-w-[150px]">
                                <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600">
                                    <Package className="w-5 h-5" />
                                </div>
                                <div>
                                    <div className="text-[11px] text-slate-400 font-bold uppercase tracking-wider mb-0.5">Số lượng công việc</div>
                                    <div className="text-xl font-black text-indigo-700 leading-none">{data.selectedConfigs.length}</div>
                                </div>
                            </div>
                            <div className="flex items-center gap-3 bg-white px-4 py-3 rounded-xl shadow-[0_2px_8px_-4px_rgba(0,0,0,0.1)] border border-slate-100 min-w-[150px]">
                                <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600">
                                    <Users className="w-5 h-5" />
                                </div>
                                <div>
                                    <div className="text-[11px] text-slate-400 font-bold uppercase tracking-wider mb-0.5">Nhân sự</div>
                                    <div className="text-xl font-black text-emerald-700 leading-none">{data.selectedUsers.length}</div>
                                </div>
                            </div>
                            <div className="flex flex-col justify-center bg-white px-4 py-3 rounded-xl shadow-[0_2px_8px_-4px_rgba(0,0,0,0.1)] border border-slate-100 min-w-[180px] space-y-2">
                                <div className="flex items-center justify-between gap-4">
                                    <span className="text-slate-400 text-[11px] font-bold uppercase tracking-wider">Bắt đầu:</span>
                                    <span className="font-bold text-slate-700 text-sm">{data.startTime ? new Date(data.startTime).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' }) : '--:--'}</span>
                                </div>
                                <div className="flex items-center justify-between gap-4">
                                    <span className="text-slate-400 text-[11px] font-bold uppercase tracking-wider">Kết thúc:</span>
                                    <span className="font-bold text-rose-600 text-sm">{data.endTime ? new Date(data.endTime).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' }) : '--:--'}</span>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                {/* LEFT: Project + Team Selection */}
                <div className="lg:col-span-4 space-y-6 sticky top-6">
                    <ProjectSelection
                        projects={data.projects}
                        selectedProject={data.selectedProject}
                        setSelectedProject={data.setSelectedProject}
                        searchTerm={data.searchTerm}
                        setSearchTerm={data.setSearchTerm}
                        selectedOwnerFilter={data.selectedOwnerFilter}
                        setSelectedOwnerFilter={data.setSelectedOwnerFilter}
                        selectedLocationFilter={data.selectedLocationFilter}
                        setSelectedLocationFilter={data.setSelectedLocationFilter}
                        uniqueLocations={data.uniqueLocations}
                        owners={data.owners}
                        filteredProjects={data.filteredProjects}
                    />

                    {data.selectedProject && (
                        <div className="bg-white border text-sm border-slate-200 rounded-xl p-4 shadow-sm">
                            <label className="block text-slate-700 font-bold mb-3 flex items-center gap-2">
                                <Layers className="w-4 h-4 text-indigo-600" /> Loại hình dự án (Tùy chọn)
                            </label>
                            <div className="flex items-center gap-2">
                                <select
                                    className="flex-1 bg-white border-2 border-indigo-500/80 text-slate-700 rounded-lg p-2.5 outline-none focus:ring-4 focus:ring-indigo-500/20 cursor-pointer transition-all shadow-sm font-medium"
                                    value={data.selectedModelProject}
                                    onChange={(e) => data.setSelectedModelProject(e.target.value)}
                                >
                                    <option value="">-- Chọn loại dự án (Mặc định không có) --</option>
                                    {data.modelProjects.map(m => (
                                        <option key={m.id} value={m.id}>{m.name}</option>
                                    ))}
                                </select>
                                <button
                                    onClick={() => setIsModelModalOpen(true)}
                                    className="shrink-0 p-2.5 bg-indigo-50 text-indigo-700 rounded-lg border-2 border-indigo-200 hover:bg-indigo-100 hover:border-indigo-300 transition-colors flex items-center justify-center shadow-sm"
                                    title="Thêm Loại hình dự án mới"
                                >
                                    <Plus className="w-5 h-5" />
                                </button>
                            </div>

                            {/* Template (Mẫu) Selection — shown whenever there are templates for this project */}
                            {data.templates && data.templates.length > 0 && (
                                <div className="mt-4 pt-4 border-t border-slate-100 flex flex-col">
                                    <label className="text-slate-700 font-bold mb-3 flex items-center gap-2">
                                        <Layers className="w-4 h-4 text-emerald-600" /> Chọn mẫu đã cấu hình sẵn
                                    </label>
                                    <select
                                        className="w-full bg-emerald-50/50 border-2 border-emerald-500/50 text-slate-700 rounded-lg p-2.5 outline-none focus:ring-4 focus:ring-emerald-500/20 cursor-pointer transition-all shadow-sm font-medium"
                                        value={data.selectedTemplate}
                                        onChange={(e) => data.handleTemplateChange(e.target.value)}
                                    >
                                        <option value="">-- Tự chọn thủ công --</option>
                                        {data.templates.map(t => (
                                            <option key={t.id} value={t.id}>{t.name}</option>
                                        ))}
                                    </select>
                                    {data.selectedTemplate && (
                                        <p className="text-[11px] text-emerald-600 font-medium mt-1.5 ml-1">
                                            ✓ Đã chọn xong danh sách công việc.
                                        </p>
                                    )}
                                </div>
                            )}

                            {/* Inline: Save current manual selection as a New Template */}
                            {data.selectedTemplate === '' && data.selectedConfigs.length > 0 && (
                                <div className="mt-4 pt-4 border-t border-slate-100">
                                    <p className="text-xs font-semibold text-slate-500 mb-2 flex items-center gap-1.5">
                                        <Layers className="w-3.5 h-3.5 text-indigo-400" />
                                        Lưu lựa chọn này thành mẫu mới (Tùy chọn)
                                    </p>
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="text"
                                            value={newTemplateName}
                                            onChange={e => setNewTemplateName(e.target.value)}
                                            placeholder="Tên mẫu... (VD: Mẫu vệ sinh T3)"
                                            className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 bg-white"
                                            onKeyDown={e => {
                                                if (e.key === 'Enter' && newTemplateName.trim()) {
                                                    data.handleSaveAsTemplate(newTemplateName.trim()).then(ok => {
                                                        if (ok) setNewTemplateName('');
                                                        else alert('Lưu mẫu thất bại, thử lại!');
                                                    });
                                                }
                                            }}
                                        />
                                        <button
                                            disabled={!newTemplateName.trim() || data.loading}
                                            onClick={() => {
                                                if (!newTemplateName.trim()) return;
                                                data.handleSaveAsTemplate(newTemplateName.trim()).then(ok => {
                                                    if (ok) setNewTemplateName('');
                                                    else alert('Lưu mẫu thất bại, thử lại!');
                                                });
                                            }}
                                            className="shrink-0 p-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-40 transition-colors shadow-sm"
                                            title="Lưu Mẫu"
                                        >
                                            <Plus className="w-4 h-4" />
                                        </button>
                                    </div>
                                    <p className="text-[10px] text-slate-400 mt-1.5">{data.selectedConfigs.length} công việc đang được chọn sẽ được lưu vào mẫu.</p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Time & Note Box */}
                    {data.selectedProject && (
                        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
                            <div className="flex items-center gap-2 mb-5 border-b border-slate-100 pb-3">
                                <Clock className="w-5 h-5 text-blue-500" />
                                <div>
                                    <h3 className="text-[16px] font-bold text-slate-800">Thời Gian & Ghi Chú</h3>
                                    <p className="text-[12px] text-slate-500 mt-0.5">Giới hạn thời hạn và chỉ dẫn ghi chú nội bộ.</p>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div className="grid grid-cols-1 gap-4">
                                    <div>
                                        <label className="block text-[11px] font-semibold text-slate-500 mb-1.5 uppercase tracking-wider">Bắt Đầu <span className="text-red-500">*</span></label>
                                        <input
                                            type="datetime-local"
                                            value={data.startTime}
                                            onChange={(e) => data.setStartTime(e.target.value)}
                                            className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm text-slate-700 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[11px] font-semibold text-slate-500 mb-1.5 uppercase tracking-wider">Kết Thúc <span className="text-red-500">*</span></label>
                                        <input
                                            type="datetime-local"
                                            value={data.endTime}
                                            onChange={(e) => data.setEndTime(e.target.value)}
                                            className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm text-slate-700 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-[11px] font-semibold text-slate-500 mb-1.5 uppercase tracking-wider">Chỉ Dẫn Nghiệp Vụ</label>
                                    <textarea
                                        rows={4}
                                        value={data.note}
                                        onChange={(e) => data.setNote(e.target.value)}
                                        placeholder="Nhập ghi chú hoặc yêu cầu đi kèm mã phân bổ này..."
                                        className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm text-slate-700 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 resize-none"
                                    />
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* MIDDLE: Config Tree Selection OR Custom Task List */}
                {data.selectedProject && data.isCustomModel && !data.selectedTemplate ? (
                    <div className="lg:col-span-5 flex flex-col h-[800px]">
                        <CustomAssetTaskList
                            assets={data.assets}
                            processes={data.processes}
                            customTasks={data.customTasks}
                            setCustomTasks={data.setCustomTasks}
                        />
                    </div>
                ) : data.selectedProject ? (
                    <div className="lg:col-span-5 flex flex-col h-[800px]">
                        <GlassCard className="flex-1 flex flex-col overflow-hidden p-6">
                            <div className="flex items-center justify-between mb-6 border-b border-slate-100 pb-5 shrink-0">
                                <div className="flex items-center gap-3">
                                    <div className="p-2.5 bg-emerald-50 rounded-xl border border-emerald-100/50">
                                        <Package className="w-5 h-5 text-emerald-600" />
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-bold text-slate-800">Danh sách công việc</h3>
                                        <p className="text-[13px] text-slate-500 mt-1">Chọn vào các công việc bên dưới để phân bổ cho nhân viên.</p>
                                    </div>
                                </div>

                                <label className="flex items-center gap-2 cursor-pointer px-3 py-1.5 hover:bg-slate-50 rounded-lg transition-colors border border-transparent hover:border-slate-200 ml-auto">
                                    <span className="text-sm font-bold text-slate-600">Chọn tất cả</span>
                                    <input
                                        type="checkbox"
                                        className="w-4 h-4 accent-emerald-600 rounded cursor-pointer"
                                        checked={data.selectedConfigs.length === projectConfigs.length && projectConfigs.length > 0}
                                        onChange={() => {
                                            if (data.selectedConfigs.length === projectConfigs.length) {
                                                data.setSelectedConfigs([]);
                                            } else {
                                                const allIds = projectConfigs.map(c => c.id);
                                                data.setSelectedConfigs(allIds);
                                            }
                                        }}
                                    />
                                </label>
                            </div>

                            {data.assets.length === 0 || projectConfigs.length === 0 ? (
                                <p className="text-sm text-slate-400 text-center py-8 bg-slate-50 rounded-xl border border-slate-100/50 block">
                                    Dự án này chưa được cấu hình bất kỳ hạng mục nào.
                                </p>
                            ) : (
                                <div className="space-y-6 flex-1 overflow-y-auto pr-2 pb-4">
                                    {data.works.map(work => {
                                        const workSubWorks = data.subWorks.filter(sw => sw.id_work === work.id);
                                        // Get all config IDs that belong to this work (through subWorks)
                                        const workConfigIds = projectConfigs
                                            .filter(cfg => workSubWorks.some(sw => sw.id === cfg.id_sub_work))
                                            .map(cfg => cfg.id);

                                        if (workConfigIds.length === 0) return null;

                                        // Check if all configs in this work are selected
                                        const allWorkSelected = workConfigIds.every(id => data.selectedConfigs.includes(id));

                                        return (
                                            <div key={work.id} className="border-t border-slate-100 pt-6 mt-6 first:border-0 first:pt-0 first:mt-0">
                                                <div className="flex items-center justify-between xl:justify-start gap-4 mb-4">
                                                    <h4 className="font-black text-lg text-slate-700 flex items-center gap-2 uppercase tracking-wide">
                                                        <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 shadow-sm shadow-indigo-200"></span>
                                                        {work.name}
                                                    </h4>
                                                    <label className="flex items-center gap-2 cursor-pointer px-3 py-1.5 hover:bg-slate-50 rounded-lg transition-colors border border-transparent hover:border-slate-200 ml-auto xl:ml-auto">
                                                        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Chọn khối</span>
                                                        <input
                                                            type="checkbox"
                                                            className="w-4.5 h-4.5 accent-indigo-600 rounded cursor-pointer"
                                                            checked={allWorkSelected}
                                                            onChange={() => {
                                                                if (allWorkSelected) {
                                                                    const remaining = data.selectedConfigs.filter(id => !workConfigIds.includes(id));
                                                                    data.setSelectedConfigs(remaining);
                                                                } else {
                                                                    const newSelected = new Set([...data.selectedConfigs, ...workConfigIds]);
                                                                    data.setSelectedConfigs(Array.from(newSelected));
                                                                }
                                                            }}
                                                        />
                                                    </label>
                                                </div>

                                                <div className="space-y-5 pl-4 ml-1.5 border-l-2 border-slate-100 transition-colors hover:border-indigo-100/70">
                                                    {workSubWorks.map(subWork => {
                                                        const swConfigs = projectConfigs.filter(cfg => cfg.id_sub_work === subWork.id);
                                                        if (swConfigs.length === 0) return null;

                                                        return (
                                                            <div key={subWork.id} className="bg-white border text-sm border-slate-200 rounded-xl p-4 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)]">
                                                                <div className="flex items-center gap-2 mb-3 mt-1 px-1">
                                                                    <Wrench className="w-4 h-4 text-slate-400" />
                                                                    <h5 className="font-bold text-slate-700">{subWork.name}</h5>
                                                                </div>
                                                                {/* Processes badges */}
                                                                {subWork.id_process && subWork.id_process.length > 0 && (
                                                                    <div className="flex flex-wrap gap-1.5 px-1 mb-3">
                                                                        {subWork.id_process.map((procId: string) => {
                                                                            const proc = data.processes.find((p: any) => p.id === procId);
                                                                            if (!proc) return null;
                                                                            return (
                                                                                <span key={procId} className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600 border border-indigo-100">
                                                                                    <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></svg>
                                                                                    {proc.name}
                                                                                </span>
                                                                            );
                                                                        })}
                                                                    </div>
                                                                )}
                                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 mt-2">
                                                                    {swConfigs.map(cfg => {
                                                                        const asset = data.assets.find(a => a.id === cfg.id_asset);
                                                                        if (!asset) return null;

                                                                        const isChecked = data.selectedConfigs.includes(cfg.id);

                                                                        return (
                                                                            <label
                                                                                key={cfg.id}
                                                                                className={`relative flex items-start gap-3 p-3.5 rounded-xl border-2 cursor-pointer transition-all ${isChecked ? 'bg-indigo-50/50 border-indigo-300 ring-1 ring-indigo-200 shadow-sm shadow-indigo-100/50' : 'bg-white border-slate-100 hover:border-indigo-300 hover:bg-slate-50/50'}`}
                                                                            >
                                                                                <div className="pt-0.5 shrink-0">
                                                                                    <input
                                                                                        type="checkbox"
                                                                                        checked={isChecked}
                                                                                        onChange={() => data.toggleConfig(cfg.id)}
                                                                                        className="w-4 h-4 accent-indigo-600 rounded cursor-pointer mt-0.5"
                                                                                    />
                                                                                </div>
                                                                                <div className="flex-1 min-w-0">
                                                                                    <div className={`font-bold text-[14.5px] leading-tight mb-2 ${isChecked ? 'text-indigo-900' : 'text-slate-700'}`}>
                                                                                        {asset.name}
                                                                                    </div>
                                                                                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-0.5">
                                                                                        <span className={`text-[12.5px] flex items-center gap-1.5 font-semibold ${cfg.status_set_image_count ? 'text-orange-600' : 'text-slate-500'}`}>
                                                                                            <span className="text-slate-500 mr-1"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="20" x="2" y="2" rx="5" ry="5" /><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" /><line x1="17.5" x2="17.51" y1="6.5" y2="6.5" /></svg></span>
                                                                                            {cfg.status_set_image_count ? `${cfg.image_count} ảnh` : 'Không giới hạn'}
                                                                                        </span>
                                                                                        {cfg.guide_text && <span className="text-slate-300 text-sm hidden xl:inline-block">|</span>}
                                                                                        {cfg.guide_text && <span className="text-[12px] font-bold text-teal-600">Có hướng dẫn</span>}
                                                                                    </div>
                                                                                </div>
                                                                            </label>
                                                                        );
                                                                    })}
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </GlassCard>
                    </div>
                ) : null
                }

                {/* RIGHT: Team Selection Area */}
                {
                    data.selectedProject && (
                        <div className="lg:col-span-3 space-y-6 sticky top-6">
                            <TeamSelection
                                users={data.users}
                                roles={data.roles}
                                selectedUsers={data.selectedUsers}
                                toggleUser={data.toggleUser}
                            />
                        </div>
                    )
                }
            </div >

            {/* Modal Components */}
            < ModelProjectModal
                isOpen={isModelModalOpen}
                onClose={() => setIsModelModalOpen(false)}
                onSubmit={data.handleCreateModelProject}
            />
        </div >
    );
};

export default ManagerAllocationPage;
