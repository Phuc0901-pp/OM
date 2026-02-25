import { useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { getUserId } from '../../../utils/userUtils';
import api from '../../../services/api';
import type { Allocation } from '../../../types/allocation';
import { useLanguage } from '../../../context/LanguageContext';

// Components
import StatsHeader from './components/StatsHeader';
import OverviewCards from './components/OverviewCards';
import ProjectSchedule from './components/ProjectSchedule';
import TaskTable from './components/TaskTable';

// NEW: Interface for Server Stats
interface UserTaskStats {
    assigned: number;
    completed: number;
    pending_review: number;
    rejected: number;
}

const StatisticsPage = () => {
    const { t } = useLanguage();
    const userId = getUserId();

    // Filter State
    const [selectedProject, setSelectedProject] = useState<string>('');

    // ==================== QUERIES ====================

    // 1. Metadata Queries
    // Derived projects from allocations instead of separate API call
    const { data: stations = [] } = useQuery({ queryKey: ['stations'], queryFn: () => api.get('/stations').then(res => res.data || []) });
    const { data: processes = [] } = useQuery({ queryKey: ['processes'], queryFn: () => api.get('/admin/tables/process').then(res => res.data || []) });

    // 2. User Data Queries (Fetch ALL allocations)
    const { data: allocations = [], isLoading: allocationsLoading } = useQuery({
        queryKey: ['userAllocations', userId], // Key depends only on userId
        queryFn: async () => {
            // Fetch everything
            const res = await api.get(`/allocations/user/${userId}`);
            return res.data || [];
        },
        enabled: !!userId,
        refetchInterval: 30000
    });

    // 3. (REMOVED) Server Stats Query - Caluclated Client Side for Perfect Sync

    // ==================== DERIVED STATE ====================

    // Derive Unique Projects from Allocations
    const uniqueProjects = useMemo(() => {
        const map = new Map();
        allocations.forEach((alloc: any) => {
            if (alloc.project) {
                // Use project_id or id (handle both just in case)
                const pId = alloc.project.project_id || alloc.project.id || alloc.id_project;
                if (pId && !map.has(pId)) {
                    map.set(pId, {
                        project_id: pId,
                        project_name: alloc.project.project_name || 'Unknown Project'
                    });
                }
            }
        });
        return Array.from(map.values());
    }, [allocations]);

    // Client-Side Filtered Allocations
    const filteredAllocations = useMemo(() => {
        if (!selectedProject) return allocations;
        return allocations.filter((alloc: any) => {
            const pId = alloc.project?.project_id || alloc.project?.id || alloc.id_project;
            return pId === selectedProject;
        });
    }, [allocations, selectedProject]);

    // Compute Stats from Filtered Allocations
    const computedStats = useMemo(() => {
        let assigned = 0;
        let completed = 0;
        let pendingReview = 0;
        let rejected = 0;

        filteredAllocations.forEach((alloc: any) => {
            const tasks = alloc.task_details || [];
            tasks.forEach((t: any) => {
                assigned++;

                // Status Logic matching backend
                // Completed: status_approve == 1
                if (t.status_approve === 1) {
                    completed++;
                }
                // Rejected: status_reject == 1
                else if (t.status_reject === 1) {
                    rejected++;
                }
                // Pending Review: submitted (status_submit == 1 or status_work == 2) AND not approved/rejected
                else if ((t.status_submit === 1 || t.status_work === 2) && t.status_approve === 0 && t.status_reject === 0) {
                    pendingReview++;
                }
            });
        });

        return { assigned, completed, pendingReview, rejected };
    }, [filteredAllocations]);

    // URL Params for Filtering
    const [searchParams] = useSearchParams();
    const taskIdParam = searchParams.get('taskId');

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="space-y-6 pb-24 min-h-screen bg-slate-50 dark:bg-slate-950 p-4 md:p-6 transition-colors duration-300"
        >
            <div className="flex items-center justify-between mb-2">
                <h1 className="text-2xl font-bold text-slate-800 dark:text-white">{t('sidebar.statistics')}</h1>
                {taskIdParam && (
                    <div className="bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full text-xs font-bold animate-pulse">
                        Đang lọc theo Task ID: {taskIdParam}
                    </div>
                )}
            </div>

            <StatsHeader
                projects={uniqueProjects}
                selectedProject={selectedProject}
                onSelectProject={setSelectedProject}
            />

            {/* Pass computed client-side stats */}
            <OverviewCards
                assigned={computedStats.assigned}
                completed={computedStats.completed}
                pendingReview={computedStats.pendingReview}
                rejected={computedStats.rejected}
            />

            <div className="grid grid-cols-1 gap-6">
                <ProjectSchedule
                    allocations={filteredAllocations}
                    selectedProject={selectedProject}
                    processes={processes}
                    stations={stations}
                    loading={allocationsLoading}
                />

                <TaskTable
                    allocations={filteredAllocations}
                    selectedProject={selectedProject}
                    stations={stations}
                    processes={processes}
                    loading={allocationsLoading}
                    filterTaskId={taskIdParam}
                />
            </div>
        </motion.div>
    );
};

export default StatisticsPage;
