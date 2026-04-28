import React, { useState, useMemo } from 'react';
import { List, MapPin, ChevronDown, ChevronRight, Building2, FolderOpen, LayoutTemplate, Trash2, ArchiveRestore, X, RefreshCcw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import GlassCard from '../../../../components/common/GlassCard';
import { ProjectStat } from '../types';

interface ProjectListSidebarProps {
 projectStats: ProjectStat[];
 selectedAssignId: string | null;
 setSelectedAssignId: (id: string) => void;
 onCloseProject: (assignId: string) => void;
 viewMode?: 'active' | 'trash';
 onDelete?: (assignId: string) => void;
 onRestore?: (assignId: string) => void;
 onPermanentDelete?: (assignId: string) => void;
 onReopen?: (assignId: string) => void;
}

interface TreeNode {
 ownerName: string;
 projects: {
 projectName: string;
 assigns: ProjectStat[];
 }[];
}

const ProjectListSidebar: React.FC<ProjectListSidebarProps> = ({
 projectStats, selectedAssignId, setSelectedAssignId,
 onCloseProject, viewMode = 'active', onDelete, onRestore, onPermanentDelete, onReopen
}) => {
 // Expanded states
 const [expandedOwners, setExpandedOwners] = useState<Set<string>>(new Set());
 const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());

 const toggleOwner = (ownerName: string) => {
 setExpandedOwners(prev => {
 const next = new Set(prev);
 next.has(ownerName) ? next.delete(ownerName) : next.add(ownerName);
 return next;
 });
 };

 const toggleProject = (key: string) => {
 setExpandedProjects(prev => {
 const next = new Set(prev);
 next.has(key) ? next.delete(key) : next.add(key);
 return next;
 });
 };

 // Build tree: Owner -> Project -> [assigns]
 const treeData: TreeNode[] = useMemo(() => {
 const ownerMap: Record<string, Record<string, ProjectStat[]>> = {};

 projectStats.forEach(stat => {
 const owner = stat.ownerName || 'Chưa có chủ đầu tư';
 const project = stat.name || 'Dự án không tên';
 if (!ownerMap[owner]) ownerMap[owner] = {};
 if (!ownerMap[owner][project]) ownerMap[owner][project] = [];
 ownerMap[owner][project].push(stat);
 });

 return Object.entries(ownerMap)
 .sort(([a], [b]) => a.localeCompare(b))
 .map(([ownerName, projects]) => ({
 ownerName,
 projects: Object.entries(projects)
 .sort(([a], [b]) => a.localeCompare(b))
 .map(([projectName, assigns]) => ({
 projectName,
 assigns: assigns.sort((a, b) => (a.templateName || '').localeCompare(b.templateName || '')),
 })),
 }));
 }, [projectStats]);

 return (
 <div className="lg:col-span-3 space-y-3">
 <div className="flex items-center justify-between mb-1 pl-1">
 <h3 className="font-extrabold text-slate-700 flex items-center gap-2 uppercase tracking-wide text-xs">
 <List className="w-4 h-4 text-primary-500" /> Danh sách dự án
 </h3>
 <span className="text-xs font-medium text-slate-400 tabular-nums">{projectStats.length} đợt</span>
 </div>

 {/* Tree View */}
 <div className="space-y-1.5 max-h-[800px] overflow-y-auto pr-1 custom-scrollbar pb-4">
 {treeData.length === 0 && (
 <p className="text-xs text-slate-400 italic text-center py-6">Không có dự án nào</p>
 )}

 {treeData.map(ownerNode => {
 const isOwnerOpen = expandedOwners.has(ownerNode.ownerName);

 return (
 <div key={ownerNode.ownerName}>
 {/* Level 1: Owner */}
 <button
 onClick={() => toggleOwner(ownerNode.ownerName)}
 className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 border border-indigo-100 transition-all group"
 >
 <Building2 className="w-4 h-4 text-indigo-500 shrink-0" />
 <span className="flex-1 text-left text-sm font-bold text-indigo-800 truncate" title={ownerNode.ownerName}>
 {ownerNode.ownerName}
 </span>
 <span className="text-[10px] font-bold text-indigo-400 tabular-nums">
 {ownerNode.projects.length} dự án
 </span>
 {isOwnerOpen
 ? <ChevronDown className="w-4 h-4 text-indigo-400 shrink-0 transition-transform" />
 : <ChevronRight className="w-4 h-4 text-indigo-400 shrink-0 transition-transform" />
 }
 </button>

 <AnimatePresence initial={false}>
 {isOwnerOpen && (
 <motion.div
 key="owner-content"
 initial={{ height: 0, opacity: 0 }}
 animate={{ height: 'auto', opacity: 1 }}
 exit={{ height: 0, opacity: 0 }}
 transition={{ duration: 0.22, ease: 'easeInOut' }}
 className="overflow-hidden"
 >
 <div className="pl-3 mt-1.5 space-y-1.5 border-l-2 border-indigo-100 ml-3">
 {ownerNode.projects.map(projectNode => {
 const projectKey = `${ownerNode.ownerName}__${projectNode.projectName}`;
 const isProjectOpen = expandedProjects.has(projectKey);

 return (
 <div key={projectKey}>
 {/* Level 2: Project */}
 <button
 onClick={() => toggleProject(projectKey)}
 className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg bg-white hover:bg-slate-50 border border-slate-200 transition-all"
 >
 <FolderOpen className="w-3.5 h-3.5 text-amber-500 shrink-0" />
 <span className="flex-1 text-left text-xs font-bold text-slate-700 truncate" title={projectNode.projectName}>
 {projectNode.projectName}
 </span>
 <span className="text-[10px] font-medium text-slate-400 tabular-nums">
 {projectNode.assigns.length} mẫu
 </span>
 {isProjectOpen
 ? <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
 : <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
 }
 </button>

 <AnimatePresence initial={false}>
 {isProjectOpen && (
 <motion.div
 key="project-content"
 initial={{ height: 0, opacity: 0 }}
 animate={{ height: 'auto', opacity: 1 }}
 exit={{ height: 0, opacity: 0 }}
 transition={{ duration: 0.18, ease: 'easeInOut' }}
 className="overflow-hidden"
 >
 <div className="pl-3 mt-1 space-y-1.5 border-l-2 border-amber-100 ml-3">
 {projectNode.assigns.map(p => {
 const isSelected = selectedAssignId === p.assignId;
 const percentage = p.total > 0 ? Math.round((p.completed / p.total) * 100) : 0;
 const tplName = p.templateName || 'Không có mẫu';

 return (
 <GlassCard
 key={p.assignId}
 onClick={() => setSelectedAssignId(p.assignId)}
 className={`!p-3.5 cursor-pointer transition-all duration-200 group ${isSelected
 ? '!bg-gradient-to-br !from-primary-600 !to-indigo-600 !border-transparent ring-2 ring-primary-500/30 ring-offset-1'
 : 'hover:!bg-white/90 hover:!border-primary-200 hover:translate-x-0.5'
 }`}
 >
 {/* Template name row */}
 <div className="flex items-start justify-between gap-2 mb-2">
 <div className="flex items-center gap-1.5 min-w-0">
 <LayoutTemplate className={`w-3.5 h-3.5 shrink-0 ${isSelected ? 'text-indigo-200' : 'text-violet-500'}`} />
 <span className={`text-xs font-bold truncate ${isSelected ? 'text-white' : 'text-slate-700'}`} title={tplName}>
 {tplName}
 </span>
 </div>

 {/* Action buttons */}
 <div className="flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
 {p.pending > 0 && (
 <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full animate-pulse ${isSelected ? 'bg-amber-400 text-amber-900' : 'bg-amber-50 text-amber-600 border border-amber-100'}`}>
 {p.pending}
 </span>
 )}

 {viewMode === 'active' ? (
 <>
 {onReopen && p.statusAssign && (
 <button
 onClick={(e) => { e.stopPropagation(); onReopen(p.assignId); }}
 title="Mở lại dự án"
 className={`p-1 rounded transition-all mr-0.5 ${isSelected ? 'text-white/70 hover:text-white hover:bg-white/10' : 'text-slate-400 hover:text-indigo-600 hover:bg-indigo-50'
 }`}
 >
 <RefreshCcw className="w-3.5 h-3.5" />
 </button>
 )}
 <button
 onClick={(e) => { e.stopPropagation(); !p.statusAssign && onCloseProject(p.assignId); }}
 disabled={p.statusAssign}
 title={p.statusAssign ? 'Đã đóng' : 'Đóng dự án'}
 className={`p-1 rounded transition-all ${p.statusAssign
 ? 'text-slate-300 cursor-not-allowed'
 : isSelected
 ? 'text-white/70 hover:text-white hover:bg-white/10'
 : 'text-slate-400 hover:text-rose-500 hover:bg-rose-50'
 }`}
 >
 <X className="w-3.5 h-3.5" />
 </button>
 {onDelete && (
 <button
 onClick={() => onDelete(p.assignId)}
 title="Xoá đợt phân bổ"
 className={`p-1 rounded transition-all ${isSelected ? 'text-white/70 hover:text-white hover:bg-white/10' : 'text-slate-400 hover:text-red-500 hover:bg-red-50'}`}
 >
 <Trash2 className="w-3.5 h-3.5" />
 </button>
 )}
 </>
 ) : (
 <>
 {onRestore && (
 <button onClick={() => onRestore(p.assignId)} title="Phục hồi phân bổ"
 className="p-1 rounded text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition-all"
 >
 <ArchiveRestore className="w-3.5 h-3.5" />
 </button>
 )}
 {onPermanentDelete && (
 <button onClick={() => onPermanentDelete(p.assignId)} title="Xoá vĩnh viễn"
 className="p-1 rounded text-slate-400 hover:text-red-600 hover:bg-red-50 transition-all"
 >
 <X className="w-3.5 h-3.5" />
 </button>
 )}
 </>
 )}
 </div>
 </div>

 {/* Location */}
 {p.location && (
 <div className={`flex items-center gap-1 mb-2.5 text-[11px] font-medium ${isSelected ? 'text-indigo-200' : 'text-slate-400'}`}>
 <MapPin className="w-3 h-3 shrink-0" />
 <span className="truncate">{p.location}</span>
 </div>
 )}

 {/* Progress bar */}
 <div className={`w-full h-1 rounded-full overflow-hidden ${isSelected ? 'bg-black/20' : 'bg-slate-100'}`}>
 <motion.div
 initial={{ width: 0 }}
 animate={{ width: `${percentage}%` }}
 transition={{ duration: 1, ease: 'easeOut' }}
 className={`h-full ${isSelected ? 'bg-white' : 'bg-emerald-500'}`}
 />
 </div>
 <div className={`mt-1.5 flex justify-between text-[10px] font-bold uppercase tracking-wider ${isSelected ? 'text-indigo-200' : 'text-slate-400'}`}>
 <span>{p.completed}/{p.total} Hoàn thành</span>
 <span>{percentage}%</span>
 </div>
 </GlassCard>
 );
 })}
 </div>
 </motion.div>
 )}
 </AnimatePresence>
 </div>
 );
 })}
 </div>
 </motion.div>
 )}
 </AnimatePresence>
 </div>
 );
 })}
 </div>
 </div>
 );
};

export default ProjectListSidebar;
