import React from 'react';
import { List, MapPin } from 'lucide-react';
import { motion } from 'framer-motion';
import GlassCard from '../../../../components/common/GlassCard';
import { ProjectStat } from '../types';

interface ProjectListSidebarProps {
    projectStats: ProjectStat[];
    selectedProjectName: string | null;
    setSelectedProjectName: (name: string) => void;
}

const ProjectListSidebar: React.FC<ProjectListSidebarProps> = ({ projectStats, selectedProjectName, setSelectedProjectName }) => {
    return (
        <div className="lg:col-span-3 space-y-4">
            <div className="flex items-center justify-between mb-1 pl-1">
                <h3 className="font-extrabold text-slate-700 flex items-center gap-2 uppercase tracking-wide text-xs">
                    <List className="w-4 h-4 text-primary-500" /> Danh sách dự án
                </h3>
            </div>

            <div className="space-y-3 max-h-[800px] overflow-y-auto pr-1 custom-scrollbar pb-4">
                {projectStats.map(p => {
                    const isSelected = selectedProjectName === p.name;
                    const percentage = p.total > 0 ? Math.round((p.completed / p.total) * 100) : 0;

                    return (
                        <GlassCard
                            key={p.name}
                            onClick={() => setSelectedProjectName(p.name)}
                            className={`!p-5 cursor-pointer transition-all duration-300 group ${isSelected
                                ? '!bg-gradient-to-br !from-primary-600 !to-indigo-600 !border-transparent ring-2 ring-primary-500/30 ring-offset-2'
                                : 'hover:!bg-white/80 hover:!border-primary-200 hover:translate-x-1'
                                }`}
                        >
                            {isSelected && (
                                <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>
                            )}

                            <div className="flex justify-between items-start mb-3 relative z-10">
                                <h4 className={`font-bold text-sm tracking-tight ${isSelected ? 'text-white' : 'text-slate-800'}`}>
                                    {p.name}
                                </h4>
                                {p.pending > 0 && (
                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm animate-pulse ${isSelected ? 'bg-amber-400 text-amber-900 shadow-amber-900/10' : 'bg-amber-50 text-amber-600 border border-amber-100'
                                        }`}>
                                        {p.pending} chờ
                                    </span>
                                )}
                            </div>

                            <div className={`text-xs mb-4 flex items-center gap-1.5 font-medium ${isSelected ? 'text-indigo-100' : 'text-slate-400'}`}>
                                <MapPin className={`w-3.5 h-3.5 ${isSelected ? 'text-indigo-200' : 'text-slate-300'}`} />
                                {p.location}
                            </div>

                            {/* Progress Bar */}
                            <div className={`w-full h-1.5 rounded-full overflow-hidden ${isSelected ? 'bg-black/20' : 'bg-slate-100'}`}>
                                <motion.div
                                    initial={{ width: 0 }}
                                    animate={{ width: `${percentage}%` }}
                                    transition={{ duration: 1, ease: "easeOut" }}
                                    className={`h-full ${isSelected ? 'bg-white' : 'bg-emerald-500'}`}
                                />
                            </div>

                            <div className={`mt-2.5 flex justify-between text-[10px] font-bold uppercase tracking-wider ${isSelected ? 'text-indigo-100' : 'text-slate-400'}`}>
                                <span>{p.completed}/{p.total} Hoàn thành</span>
                                <span>{percentage}%</span>
                            </div>
                        </GlassCard>
                    );
                })}
            </div>
        </div>
    );
};

export default ProjectListSidebar;
