import React from 'react';
import { Layers, Search, LayoutGrid, Briefcase } from 'lucide-react';
import GlassCard from '../../../../components/common/GlassCard';
import ModernInput from '../../../../components/common/ModernInput';
import type { Project } from '../../../../types/models';

interface ProjectSelectionProps {
    projects: Project[];
    selectedProject: string;
    setSelectedProject: (id: string) => void;
    searchTerm: string;
    setSearchTerm: (term: string) => void;
    selectedOwnerFilter: string;
    setSelectedOwnerFilter: (id: string) => void;
    selectedLocationFilter: string;
    setSelectedLocationFilter: (loc: string) => void;
    owners: any[];
    uniqueLocations: string[];
    filteredProjects: Project[];
}

const ProjectSelection: React.FC<ProjectSelectionProps> = ({
    projects,
    selectedProject,
    setSelectedProject,
    searchTerm,
    setSearchTerm,
    selectedOwnerFilter,
    setSelectedOwnerFilter,
    selectedLocationFilter,
    setSelectedLocationFilter,
    owners,
    uniqueLocations,
    filteredProjects
}) => {
    return (
        <GlassCard className="!p-0 overflow-hidden flex flex-col max-h-[600px]">
            <div className="p-6 bg-white/40 border-b border-indigo-50/50">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                        <Layers className="w-5 h-5 text-indigo-600" /> Dự Án
                    </h3>
                    {selectedProject && (
                        <button
                            onClick={() => setSelectedProject('')}
                            className="text-[12px] font-bold text-red-600 bg-red-50 border border-red-100 px-3 py-1.5 rounded-lg hover:bg-red-100 hover:border-red-200 transition-colors flex items-center gap-1.5"
                        >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            Bỏ chọn
                        </button>
                    )}
                </div>
                {!selectedProject && (
                    <div className="space-y-3">
                        <ModernInput
                            placeholder="Tìm dự án, địa điểm, CĐT..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            icon={<Search className="w-4 h-4" />}
                            className="bg-white/60"
                        />
                        <div className="grid grid-cols-2 gap-3">
                            <div className="relative">
                                <select
                                    value={selectedOwnerFilter}
                                    onChange={(e) => setSelectedOwnerFilter(e.target.value)}
                                    className="w-full appearance-none bg-white text-slate-700 text-sm pl-3 pr-8 py-2.5 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all cursor-pointer shadow-sm"
                                >
                                    <option value="">Tất cả dự án (theo chủ đầu tư)</option>
                                    {owners.map(owner => (
                                        <option key={owner.id} value={owner.id}>
                                            {owner.name}
                                        </option>
                                    ))}
                                </select>
                                <div className="absolute inset-y-0 right-2.5 flex items-center pointer-events-none text-slate-400">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                                </div>
                            </div>
                            <div className="relative">
                                <select
                                    value={selectedLocationFilter}
                                    onChange={(e) => setSelectedLocationFilter(e.target.value)}
                                    className="w-full appearance-none bg-white text-slate-700 text-sm pl-3 pr-8 py-2.5 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all cursor-pointer shadow-sm"
                                >
                                    <option value="">Tất cả địa điểm</option>
                                    {uniqueLocations.map(loc => (
                                        <option key={loc} value={loc}>
                                            {loc}
                                        </option>
                                    ))}
                                </select>
                                <div className="absolute inset-y-0 right-2.5 flex items-center pointer-events-none text-slate-400">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {!selectedProject ? (
                <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar bg-slate-50/30">
                    {filteredProjects.map(p => (
                        <div
                            key={p.id}
                            onClick={() => setSelectedProject(p.id)}
                            className="p-4 rounded-xl cursor-pointer transition-all border bg-white text-slate-600 border-white/50 hover:bg-indigo-50 hover:border-indigo-200"
                        >
                            <div className="font-bold text-sm text-slate-800">{p.name}</div>
                            {p.location && <div className="text-xs mt-1 flex items-center gap-1 text-slate-400"><LayoutGrid className="w-3 h-3" /> {p.location}</div>}
                        </div>
                    ))}
                    {filteredProjects.length === 0 && (
                        <div className="text-center py-8 text-sm text-slate-400">
                            Không tìm thấy dự án nào phù hợp!
                        </div>
                    )}
                </div>
            ) : (
                <div className="p-6 bg-gradient-to-br from-indigo-700 to-indigo-900 text-white relative overflow-hidden flex-1 flex flex-col justify-center items-center text-center">
                    <Briefcase className="w-32 h-32 absolute -right-6 -bottom-6 text-white/5 rotate-12" />
                    <div className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center mb-4 border-4 border-white/20 backdrop-blur-md relative z-10">
                        <Layers className="w-7 h-7 text-indigo-100" />
                    </div>
                    <h2 className="text-xl font-bold mb-3 relative z-10">{projects.find(p => p.id === selectedProject)?.name}</h2>
                    <span className="px-4 py-1.5 bg-white/10 rounded-full text-xs font-semibold border border-white/10 backdrop-blur-md relative z-10 shadow-sm">
                        {projects.find(p => p.id === selectedProject)?.location || 'Tất cả vị trí'}
                    </span>
                    <p className="text-indigo-200 text-sm mt-5 relative z-10 max-w-[250px] mx-auto">
                        Dự án đã được chọn thành công.
                    </p>
                </div>
            )}
        </GlassCard>
    );
};

export default ProjectSelection;
