import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import api from '../../../services/api';
import StatCard from '../../../components/charts/StatCard';
import { SimpleBarChart, SimplePieChart } from '../../../components/charts/ChartComponents';
import { LayoutGrid, Users, Briefcase, Activity } from 'lucide-react';
import GlassCard from '../../../components/common/GlassCard';

interface AdminStats {
    total_projects: number;
    total_users: number;
    total_teams: number;
    active_assigns: number;
    projects_by_class?: Record<string, number>;
}

const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: {
            staggerChildren: 0.1
        }
    }
};

const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 }
};

const ReportsPage = () => {
    const [stats, setStats] = useState<AdminStats | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchStats();
    }, []);

    const fetchStats = async () => {
        try {
            const response = await api.get('/stats/admin');
            setStats(response.data);
        } catch (error) {
            console.error("Failed to fetch admin stats", error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center py-20">
                <div className="w-10 h-10 border-4 border-slate-200 border-t-primary-600 rounded-full animate-spin"></div>
            </div>
        );
    }

    // Mock Data for Charts
    const projectStatusData = [
        { name: 'Hoàn thành', value: 12 },
        { name: 'Đang thực hiện', value: stats?.active_assigns || 0 },
        { name: 'Chưa bắt đầu', value: (stats?.total_projects || 0) - (stats?.active_assigns || 0) },
    ];

    const teamPerformanceData = [
        { name: 'Team A', value: 85 },
        { name: 'Team B', value: 72 },
        { name: 'Team C', value: 90 },
        { name: 'Team D', value: 65 },
    ];

    return (
        <motion.div
            className="space-y-8 pb-10"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
        >
            {/* Header */}
            <motion.div variants={itemVariants}>
                <h2 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-slate-800 to-slate-600">
                    Tổng quan hệ thống
                </h2>
                <p className="text-slate-500 mt-1">Thống kê hoạt động và hiệu suất toàn dự án.</p>
            </motion.div>

            {/* Stat Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {[
                    { title: "Tổng dự án", value: stats?.total_projects || 0, icon: LayoutGrid, color: "bg-gradient-to-br from-blue-500 to-blue-600", trend: "12%", trendUp: true, delay: 0 },
                    { title: "Tổng nhân sự", value: stats?.total_users || 0, icon: Users, color: "bg-gradient-to-br from-emerald-500 to-emerald-600", trend: "5%", trendUp: true, delay: 1 },
                    { title: "Dự án đang chạy", value: stats?.active_assigns || 0, icon: Activity, color: "bg-gradient-to-br from-amber-500 to-amber-600", delay: 2 },
                    { title: "Nhóm kỹ thuật", value: stats?.total_teams || 3, icon: Briefcase, color: "bg-gradient-to-br from-purple-500 to-purple-600", delay: 3 }
                ].map((item, idx) => (
                    <motion.div key={idx} variants={itemVariants} custom={idx}>
                        <StatCard
                            title={item.title}
                            value={item.value}
                            icon={item.icon}
                            color={item.color}
                            trend={item.trend}
                            trendUp={item.trendUp}
                        />
                    </motion.div>
                ))}
            </div>

            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Project Status */}
                <motion.div variants={itemVariants} className="h-full">
                    <GlassCard className="h-full flex flex-col">
                        <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
                            <span className="w-1.5 h-6 bg-primary-500 rounded-full"></span>
                            Trạng thái dự án
                        </h3>
                        <div className="flex-1 flex flex-col justify-center">
                            <SimplePieChart
                                data={projectStatusData}
                                nameKey="name"
                                valueKey="value"
                                height={300}
                            />
                            <div className="flex justify-center flex-wrap gap-4 mt-6 text-sm text-slate-600">
                                {projectStatusData.map((entry, index) => (
                                    <div key={index} className="flex items-center gap-2 px-3 py-1 bg-slate-50/50 rounded-full border border-slate-100/50">
                                        <div className={`w-3 h-3 rounded-full shadow-sm`} style={{ backgroundColor: ['#3b82f6', '#10b981', '#f59e0b'][index % 3] }}></div>
                                        <span className="font-medium">{entry.name}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </GlassCard>
                </motion.div>

                {/* Team Performance */}
                <motion.div variants={itemVariants} className="h-full">
                    <GlassCard className="h-full flex flex-col">
                        <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
                            <span className="w-1.5 h-6 bg-purple-500 rounded-full"></span>
                            Hiệu suất đội nhóm (Giả lập)
                        </h3>
                        <div className="flex-1 flex flex-col justify-center">
                            <SimpleBarChart
                                data={teamPerformanceData}
                                xKey="name"
                                yKey="value"
                                color="#8b5cf6"
                                height={300}
                            />
                        </div>
                    </GlassCard>
                </motion.div>
            </div>
        </motion.div>
    );
};

export default ReportsPage;
