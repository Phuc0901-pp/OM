import React from 'react';
import { BarChart3, CalendarDays } from 'lucide-react';

interface StatsHeaderProps {
    projects: any[];
    selectedProject: string;
    onSelectProject: (id: string) => void;
}

const StatsHeader: React.FC<StatsHeaderProps> = ({
    projects,
    selectedProject,
    onSelectProject,
}) => {
    return (
        <div className="mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
                <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-3">
                    <BarChart3 className="w-7 h-7 text-indigo-600" />
                    Thống kê cá nhân
                </h1>
                <p className="text-slate-500 mt-1">Theo dõi hiệu suất và tiến độ dự án</p>
            </div>

            <div className="relative group">
                <select
                    className="appearance-none pl-4 pr-10 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 shadow-sm cursor-pointer hover:bg-slate-50 transition-all min-w-[180px]"
                    value={selectedProject}
                    onChange={(e) => onSelectProject(e.target.value)}
                >
                    <option value="">Tất cả dự án</option>
                    {projects.map(p => (
                        <option key={p.project_id} value={p.project_id}>
                            {p.project_name}
                        </option>
                    ))}
                </select>
                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                    <CalendarDays className="w-4 h-4 text-slate-400 group-hover:text-indigo-500 transition-colors" />
                </div>
            </div>
        </div>
    );
};

export default StatsHeader;
