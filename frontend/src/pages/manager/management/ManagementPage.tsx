import React, { useState } from 'react';
import { Users, Briefcase } from 'lucide-react';
import PersonnelTab from './PersonnelTab';
import ProjectsTab from './ProjectsTab';

const ManagerManagementPage = () => {
    const [activeTab, setActiveTab] = useState<'personnel' | 'projects'>('personnel');

    const tabs = [
        { id: 'personnel', label: 'Personnel', icon: Users },
        { id: 'projects', label: 'Projects', icon: Briefcase },
    ] as const;

    return (
        <div className="p-6 space-y-6 animate-fade-in">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-gray-800">Quản lý hệ thống</h1>
                <p className="text-gray-500">Cấu hình người dùng, dự án và danh mục công việc.</p>
            </div>

            {/* Tabs Navigation */}
            <div className="flex items-center gap-1 bg-gray-100/50 p-1 rounded-xl w-fit border border-gray-200/50">
                <button
                    onClick={() => setActiveTab('personnel')}
                    className={`
                        flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200
                        ${activeTab === 'personnel'
                            ? 'bg-white text-blue-600 shadow-sm border border-gray-200/50 ring-1 ring-black/5'
                            : 'text-gray-500 hover:text-gray-700 hover:bg-white/50'}
                    `}
                >
                    <Users className="w-4 h-4" />
                    Nhân sự
                </button>
                <button
                    onClick={() => setActiveTab('projects')}
                    className={`
                        flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200
                        ${activeTab === 'projects'
                            ? 'bg-white text-blue-600 shadow-sm border border-gray-200/50 ring-1 ring-black/5'
                            : 'text-gray-500 hover:text-gray-700 hover:bg-white/50'}
                    `}
                >
                    <Briefcase className="w-4 h-4" />
                    Dự án
                </button>
            </div>

            {/* Tab Content */}
            <div className="min-h-[500px]">
                {activeTab === 'personnel' && <PersonnelTab />}
                {activeTab === 'projects' && <ProjectsTab />}
            </div>
        </div>
    );
};

export default ManagerManagementPage;
