import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { getUserId } from '../../../utils/userUtils';
import api from '../../../services/api';
import type { Assign, DetailAssign } from '../../../types/models';
import { useLanguageStore } from '../../../stores/useLanguageStore';
import { determineDetailStatus } from '../../../utils/statusUtils';

// Components
import StatsHeader from './components/StatsHeader';
import OverviewCards from './components/OverviewCards';
import TaskTable from './components/TaskTable';

const StatisticsPage = () => {
  const { t } = useLanguageStore();
  const userId = getUserId();

  const [selectedProject, setSelectedProject] = useState<string>('');
  // Lifted up: shared between OverviewCards (click to filter) and TaskTable
  const [selectedStatus, setSelectedStatus] = useState<string>('all');

  // Fetch user assigns
  const { data: assigns = [], isLoading } = useQuery<Assign[]>({
    queryKey: ['userAssigns', userId],
    queryFn: () => api.get(`/assigns`, { params: { user_id: userId } }).then(res => res.data || []),
    enabled: !!userId,
    refetchInterval: 30000,
  });

  // Fetch all users once to resolve approver/rejector names
  const { data: allUsers = [] } = useQuery<{ id: string; name: string }[]>({
    queryKey: ['allUsersForStats'],
    queryFn: () => api.get('/users').then(res => res.data || []),
    staleTime: 5 * 60 * 1000,
  });
  const usersMap = useMemo(() => {
    const m: Record<string, string> = {};
    allUsers.forEach(u => { if (u.id && u.name) m[u.id] = u.name; });
    return m;
  }, [allUsers]);

  // Derive unique projects from assigns
  const uniqueProjects = useMemo(() => {
    const map = new Map<string, { id: string; name: string }>();
    assigns.forEach((assign: Assign) => {
      if (assign.project) {
        const pid = assign.id_project;
        if (pid && !map.has(pid)) {
          map.set(pid, { id: pid, name: assign.project.name || 'Unknown' });
        }
      }
    });
    return Array.from(map.values());
  }, [assigns]);

  // Filter assigns by project
  const filteredAssigns = useMemo(() => {
    if (!selectedProject) return assigns;
    return assigns.filter((a: Assign) => a.id_project === selectedProject);
  }, [assigns, selectedProject]);

  // Compute stats from assigns/detail_assigns
  const computedStats = useMemo(() => {
    let assigned = 0, completed = 0, pendingReview = 0, rejected = 0;
    filteredAssigns.forEach((assign: Assign) => {
      const details = assign.details || [];
      details.forEach((d: DetailAssign) => {
        assigned++;
        const status = determineDetailStatus(d);
        if (status === 'approved') completed++;
        else if (status === 'rejected') rejected++;
        else if (status === 'submitted') pendingReview++;
      });
    });
    return { assigned, completed, pendingReview, rejected };
  }, [filteredAssigns]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-6 pb-24 min-h-screen bg-slate-50 p-4 md:p-6 transition-colors duration-300"
    >
      {/* Premium Header */}
      <div className="relative overflow-hidden bg-white/80 backdrop-blur-xl rounded-3xl p-6 md:p-8 shadow-xl border border-white/20 transition-colors">
        <div className="absolute top-0 right-0 w-80 h-80 bg-gradient-to-br from-blue-400/20 to-indigo-600/20 rounded-full blur-3xl -z-10"></div>
        <div className="relative z-10 flex flex-col gap-1">
          <h1 className="text-3xl md:text-4xl font-black bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent">
            {t('sidebar.statistics')}
          </h1>
          <p className="text-gray-600 font-medium">Theo dõi hiệu suất và tiến độ dự án</p>
        </div>
      </div>

      <StatsHeader
        projects={uniqueProjects}
        selectedProject={selectedProject}
        onSelectProject={setSelectedProject}
      />

      {/* Cards — bấm để lọc bảng bên dưới */}
      <OverviewCards
        assigned={computedStats.assigned}
        completed={computedStats.completed}
        pendingReview={computedStats.pendingReview}
        rejected={computedStats.rejected}
        selectedStatus={selectedStatus}
        onSelectStatus={setSelectedStatus}
      />

      <div className="grid grid-cols-1 gap-6">
        <TaskTable
          assigns={filteredAssigns}
          selectedProject={selectedProject}
          loading={isLoading}
          usersMap={usersMap}
          statusFilter={selectedStatus}
          onStatusFilterChange={setSelectedStatus}
        />
      </div>
    </motion.div>
  );
};

export default StatisticsPage;
