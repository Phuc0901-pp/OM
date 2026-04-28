import { useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import api from '../../services/api';
import type { ManagerStatsResponse, DashboardStats, RecentActivity, PendingCheckout } from '../../types/models';
import { onWsMessage } from '../../services/websocketService';

const getManagerId = (): string | null => {
 try {
 const u = sessionStorage.getItem('user');
 return u ? JSON.parse(u).id : null;
 } catch { return null; }
};

export function useDashboardStats() {
 const managerId = getManagerId();
 const queryClient = useQueryClient();

 const { data: managerStats, isLoading: isStatsLoading } = useQuery<ManagerStatsResponse>({
 queryKey: ['managerStats', managerId],
 queryFn: () => api.get(`/manager/stats?manager_id=${managerId}`).then(res => res.data),
 enabled: !!managerId,
 });

 const { data: pendingCheckouts = [] } = useQuery<PendingCheckout[]>({
 queryKey: ['pendingCheckouts', managerId],
 queryFn: () => api.get(`/attendance/pending-checkouts`).then(res => res.data),
 enabled: !!managerId,
 refetchInterval: 60000,
 });

 useEffect(() => {
 const unsubWs = onWsMessage((raw) => {
 try {
 const data = raw as { metadata?: unknown; type?: string };
 const meta = typeof data?.metadata === 'string'
 ? JSON.parse(data.metadata)
 : (data?.metadata ?? {}) as { type?: string };
 const type: string = (meta as any)?.type ?? data?.type ?? '';
 if (type === 'checkout_request' || type === 'checkout') {
 queryClient.invalidateQueries({ queryKey: ['pendingCheckouts'] });
 }
 } catch { /* ignore */ }
 });
 return () => { unsubWs(); };
 }, [queryClient]);

 const isLoading = isStatsLoading || !managerStats;

 const stats: DashboardStats = useMemo(() => {
 if (!managerStats) {
 return { totalProjects: 0, activeAssignments: 0, completedTasks: 0, totalUsers: 0, totalTeams: 0 };
 }
 return {
 totalProjects: managerStats.total_projects || 0,
 activeAssignments: managerStats.active_assignments || 0,
 completedTasks: managerStats.completed_tasks || 0,
 totalUsers: managerStats.total_users || 0,
 totalTeams: managerStats.total_teams || 0,
 };
 }, [managerStats]);

 const recentActivities: RecentActivity[] = useMemo(() => [], []);

 const completionRate = useMemo(() => {
 if (!managerStats) return 0;
 const total = managerStats.active_assignments;
 const done = managerStats.completed_tasks;
 return total > 0 ? Math.round((done / total) * 100) : 0;
 }, [managerStats]);

 return {
 managerId,
 stats,
 recentActivities,
 completionRate,
 topPerformers: [],
 pendingCheckouts,
 isLoading,
 };
}
