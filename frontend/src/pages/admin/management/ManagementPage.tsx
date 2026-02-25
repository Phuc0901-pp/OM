import React, { useState } from 'react';
import { Users, Briefcase } from 'lucide-react';
import { PersonnelTab } from './personnel';
import ProjectsTab from './ProjectsTab';
import PremiumButton from '../../../components/common/PremiumButton';

const AdminManagementPage = () => {
    const [activeTab, setActiveTab] = useState<'personnel' | 'projects'>('personnel');

    const tabs = [
        { id: 'personnel', label: 'Nhân sự', icon: <Users className="w-4 h-4" /> },
        { id: 'projects', label: 'Dự án', icon: <Briefcase className="w-4 h-4" /> },
    ] as const;

    return (
        <div className="space-y-8 animate-fade-in pb-10">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-display font-bold text-slate-800 mb-2">Quản lý hệ thống</h1>
                    <p className="text-slate-500 text-lg">Cấu hình người dùng, dự án và danh mục công việc.</p>
                </div>

                {/* Premium Tabs Navigation */}
                <div className="flex items-center gap-2 p-1.5 bg-white/40 backdrop-blur-md rounded-2xl border border-white/40 shadow-sm">
                    {tabs.map((tab) => (
                        <PremiumButton
                            key={tab.id}
                            variant={activeTab === tab.id ? 'primary' : 'ghost'}
                            size="sm"
                            onClick={() => setActiveTab(tab.id)}
                            icon={tab.icon}
                            className={`transition-all duration-300 ${activeTab === tab.id ? 'shadow-md' : 'hover:bg-white/50'}`}
                        >
                            {tab.label}
                        </PremiumButton>
                    ))}
                </div>
            </div>

            {/* Tab Content Area */}
            <div className="min-h-[500px] relative">
                {/* We don't use GlassCard here to allow Tabs to define their own containers, 
                    but we ensure the content renders smoothly */}
                <div className={activeTab === 'personnel' ? 'block animate-slide-up' : 'hidden'}>
                    <PersonnelTab />
                </div>
                <div className={activeTab === 'projects' ? 'block animate-slide-up' : 'hidden'}>
                    <ProjectsTab />
                </div>
            </div>
        </div>
    );
};

export default AdminManagementPage;
