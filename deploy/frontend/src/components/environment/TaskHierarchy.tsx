import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ChevronRight, Network, Workflow, ClipboardList } from 'lucide-react';
import GlassCard from '../common/GlassCard';
import StationGroup from '../../pages/user/environment/components/StationGroup';
import { StationChildConfig, TaskDetail, GuidePopupData } from '../../pages/user/environment/types';

interface TaskHierarchyProps {
    groupedTasks: Record<string, Record<string, Record<string, TaskDetail[]>>>;
    mainCategoryMap: Record<string, string>;
    childCategoryMap: Record<string, any>;
    stationMap: Record<string, string>;
    processMap: Record<string, string>;
    stationConfigsMap: Record<string, StationChildConfig>;

    expandedMain: Record<string, boolean>;
    setExpandedMain: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
    expandedChild: Record<string, boolean>;
    setExpandedChild: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
    expandedStation: Record<string, boolean>;
    setExpandedStation: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;

    draftCaptures: Record<string, (string | Blob)[]>;
    draftNotes: Record<string, string>;
    editingTasks: Set<string>;

    onGuide: (title: string, text: string, images: string[]) => void;
    onTaskEdit: (taskId: string) => void;
    onTaskSubmit: (taskId: string) => void;
    onTaskCamera: (taskId: string) => void;
    onTaskReset: (taskId: string) => void;
    onTaskSaveNote: (taskId: string, note: string) => void;
    onTaskDeleteImage: (taskId: string, item: string | Blob, index: number) => void;
    onTaskViewImage: (taskId: string, images: (string | Blob)[], index: number) => void;

    selectedAssignId?: string;
}

const TaskHierarchy: React.FC<TaskHierarchyProps> = ({
    groupedTasks,
    mainCategoryMap,
    childCategoryMap,
    stationMap,
    processMap,
    stationConfigsMap,
    expandedMain,
    setExpandedMain,
    expandedChild,
    setExpandedChild,
    expandedStation,
    setExpandedStation,
    draftCaptures,
    draftNotes,
    editingTasks,
    onGuide,
    onTaskEdit,
    onTaskSubmit,
    onTaskCamera,
    onTaskReset,
    onTaskSaveNote,
    onTaskDeleteImage,
    onTaskViewImage,
    selectedAssignId
}) => {

    if (Object.keys(groupedTasks).length === 0 && selectedAssignId) {
        return (
            <GlassCard className="text-center py-12">
                <ClipboardList className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                <h3 className="text-lg font-bold text-slate-600 mb-2">Chưa có công việc</h3>
                <p className="text-slate-400">Liên hệ quản lý để được phân công công việc chi tiết</p>
            </GlassCard>
        );
    }

    return (
        <div className="space-y-4">
            {Object.entries(groupedTasks).map(([mainCatId, childGroups]) => {
                const mainCatName = mainCategoryMap[mainCatId] || 'Danh mục chính';
                const isMainExpanded = expandedMain[mainCatId] ?? true;

                return (
                    <GlassCard key={mainCatId} className="!p-0 overflow-hidden dark:bg-slate-900/50 dark:border-slate-700">
                        {/* Main Category Header */}
                        <div
                            onClick={() => setExpandedMain(prev => ({ ...prev, [mainCatId]: !prev[mainCatId] }))}
                            className="p-4 flex items-center justify-between cursor-pointer hover:bg-white/50 dark:hover:bg-slate-800/50 transition-colors bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-slate-800 dark:to-slate-800"
                        >
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-indigo-500 text-white rounded-lg shadow-lg shadow-indigo-500/30">
                                    <Network className="w-5 h-5" />
                                </div>
                                <h3 className="font-bold text-slate-800 dark:text-white text-lg">{mainCatName}</h3>
                            </div>
                            <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform ${isMainExpanded ? 'rotate-180' : ''}`} />
                        </div>

                        {/* Child Categories */}
                        <AnimatePresence>
                            {isMainExpanded && (
                                <motion.div
                                    key="child-categories-container"
                                    initial={{ height: 0 }}
                                    animate={{ height: 'auto' }}
                                    exit={{ height: 0 }}
                                    className="border-t border-slate-100"
                                >
                                    {Object.entries(childGroups).map(([childCatId, stationGroups]) => {
                                        const childCatName = childCategoryMap[childCatId]?.name || 'Danh mục con';
                                        const isChildExpanded = expandedChild[childCatId] ?? true;

                                        return (
                                            <div key={childCatId} className="border-b border-slate-100 dark:border-slate-700/50 last:border-b-0 bg-white dark:bg-slate-900/30">
                                                {/* Child Category Header */}
                                                <div
                                                    onClick={() => setExpandedChild(prev => ({ ...prev, [childCatId]: !prev[childCatId] }))}
                                                    className="p-3 pl-3 md:pl-8 flex items-center justify-between cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                                                >
                                                    <div className="flex items-center gap-2">
                                                        <Workflow className="w-4 h-4 text-purple-500" />
                                                        <span className="font-semibold text-slate-700 dark:text-slate-300">{childCatName}</span>
                                                    </div>
                                                    <ChevronRight className={`w-4 h-4 text-slate-400 transition-transform ${isChildExpanded ? 'rotate-90' : ''}`} />
                                                </div>

                                                {/* Stations */}
                                                {isChildExpanded && Object.entries(stationGroups).map(([stationId, tasks]) => {
                                                    const stationName = stationMap[stationId] || 'Station';
                                                    const configKey = `${stationId}_${childCatId}`;
                                                    const config = stationConfigsMap[configKey];

                                                    return (
                                                        <StationGroup
                                                            key={stationId}
                                                            stationId={stationId}
                                                            stationName={stationName}
                                                            childCatName={childCatName}
                                                            tasks={tasks}
                                                            isExpanded={expandedStation[stationId] ?? true}
                                                            config={config}
                                                            processMap={processMap}
                                                            draftCaptures={draftCaptures}
                                                            draftNotes={draftNotes}
                                                            editingTasks={editingTasks}
                                                            onToggle={() => setExpandedStation(prev => ({ ...prev, [stationId]: !prev[stationId] }))}
                                                            onGuide={() => {
                                                                if (config) onGuide(`${stationName} - ${childCatName}`, config.guide_text || '', config.guide_images || []);
                                                            }}
                                                            onTaskEdit={onTaskEdit}
                                                            onTaskSubmit={onTaskSubmit}
                                                            onTaskCamera={onTaskCamera}
                                                            onTaskReset={onTaskReset}
                                                            onTaskSaveNote={onTaskSaveNote}
                                                            onTaskDeleteImage={onTaskDeleteImage}
                                                            onTaskViewImage={onTaskViewImage}
                                                        />
                                                    );
                                                })}
                                            </div>
                                        );
                                    })}
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </GlassCard >
                );
            })}
        </div>
    );
};

export default TaskHierarchy;
