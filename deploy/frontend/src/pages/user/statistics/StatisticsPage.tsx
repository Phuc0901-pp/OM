import { useState } from 'react';
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

    // 1. Metadata Queries (Parallel Fetching)
    const { data: projects = [] } = useQuery({ queryKey: ['projects'], queryFn: () => api.get('/projects').then(res => res.data || []) });
    const { data: stations = [] } = useQuery({ queryKey: ['stations'], queryFn: () => api.get('/stations').then(res => res.data || []) });
    const { data: processes = [] } = useQuery({ queryKey: ['processes'], queryFn: () => api.get('/admin/tables/process').then(res => res.data || []) });

    // 2. User Data Queries
    const { data: serverStats = { assigned: 0, completed: 0, pending_review: 0, rejected: 0 } } = useQuery({
        queryKey: ['userStats', userId, selectedProject],
        queryFn: async () => {
            const url = `/user/stats?user_id=${userId}${selectedProject ? `&project_id=${selectedProject}` : ''}`;
            const res = await api.get(url);
            return res.data || { assigned: 0, completed: 0, pending_review: 0, rejected: 0 };
        },
        enabled: !!userId,
        refetchInterval: 30000
    });

    const { data: allocations = [], isLoading: allocationsLoading } = useQuery({
        queryKey: ['userAllocations', userId],
        queryFn: async () => {
            const res = await api.get(`/allocations/user/${userId}`);
            return res.data || [];
        },
        enabled: !!userId,
        refetchInterval: 30000
    });

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="space-y-6 pb-24 min-h-screen bg-slate-50 dark:bg-slate-950 p-4 md:p-6 transition-colors duration-300"
        >
            <div className="flex items-center justify-between mb-2">
                <h1 className="text-2xl font-bold text-slate-800 dark:text-white">{t('sidebar.statistics')}</h1>
            </div>

            <StatsHeader
                projects={projects}
                selectedProject={selectedProject}
                onSelectProject={setSelectedProject}
            />

            {/* Pass server stats directly */}
            <OverviewCards
                assigned={serverStats.assigned}
                completed={serverStats.completed}
                pendingReview={serverStats.pending_review}
                rejected={serverStats.rejected}
            />

            <div className="grid grid-cols-1 gap-6">
                <ProjectSchedule
                    allocations={allocations}
                    selectedProject={selectedProject}
                    processes={processes}
                    stations={stations}
                    loading={allocationsLoading}
                />

                <TaskTable
                    allocations={allocations}
                    selectedProject={selectedProject}
                    stations={stations}
                    processes={processes}
                    loading={allocationsLoading}
                />
            </div>
        </motion.div>
    );
};

export default StatisticsPage;
