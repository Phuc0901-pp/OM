// Refactored ProjectSetupPage - Clean, maintainable version
// Uses custom hook for Project Info and CategoryManagerModal for Config

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
 ChevronLeft, Settings, CheckCircle, User, Clock
} from 'lucide-react';
import PremiumButton from '../../../../components/common/PremiumButton';
import EditProjectModal from '../../../../components/modals/EditProjectModal';
import ProjectConfigManagerModal from './ProjectConfigManagerModal';
import ProjectHierarchyViewer from './ProjectHierarchyViewer';

import { useProjectSetup } from './useProjectSetup';

const ProjectSetupPage: React.FC = () => {
 const navigate = useNavigate();
 const [showEditModal, setShowEditModal] = useState(false);
 const [isManagerOpen, setIsManagerOpen] = useState(false);

 const {
 id,
 project,
 ownerName,
 assets,
 works,
 subWorks,
 configs,
 processes,
 templates,
 loading,
 error,
 isManagerRoute,
 handleBack,
 fetchData
 } = useProjectSetup();

 const formatDate = (dateStr?: string) => {
 if (!dateStr) return null;
 const d = new Date(dateStr);
 if (isNaN(d.getTime())) return null;
 return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
 + ' ' + d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
 };

 const projectLabel = loading ? 'Đang tải...' : (project?.name || (project as any)?.project_name || 'Không tìm thấy dự án');
 const updatedLabel = formatDate(project?.updated_at || project?.created_at);

 const handleEditProjectInfo = () => {
 if (isManagerRoute) {
 setShowEditModal(true);
 } else {
 navigate(`/admin/database?tab=projects&search=${id}`);
 }
 };

 return (
 <div className="space-y-6 animate-fade-in pb-20">
 {/* Header */}
 <div className="flex items-center gap-4 bg-white p-4 rounded-xl shadow-sm border border-slate-200">
 <button onClick={handleBack} className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 transition-colors shrink-0">
 <ChevronLeft className="w-5 h-5" />
 </button>
 <div className="flex-1 min-w-0">
 <h1 className="text-xl font-bold text-slate-800 truncate">
 {projectLabel}
 </h1>
 <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1">
 {ownerName && (
 <span className="flex items-center gap-1 text-xs text-slate-500">
 <User className="w-3.5 h-3.5 text-indigo-400" />
 {ownerName}
 </span>
 )}
 {updatedLabel && (
 <span className="flex items-center gap-1 text-xs text-slate-400">
 <Clock className="w-3.5 h-3.5" />
 Cập nhật: {updatedLabel}
 </span>
 )}
 </div>
 </div>
 <div className="ml-auto flex gap-3 shrink-0">
 <PremiumButton variant="ghost" onClick={handleEditProjectInfo} icon={<Settings className="w-4 h-4" />}>
 Sửa thông tin
 </PremiumButton>
 <PremiumButton variant="primary" onClick={handleBack} icon={<CheckCircle className="w-4 h-4" />}>
 Hoàn tất
 </PremiumButton>
 </div>
 </div>

 {error && (
 <div className="bg-red-50 text-red-600 p-4 rounded-xl border border-red-100 flex items-center gap-3">
 <span className="font-bold">Lỗi:</span> {error}
 </div>
 )}

 <div className="p-6">
 <ProjectHierarchyViewer
 assets={assets}
 works={works}
 subWorks={subWorks}
 configs={configs}
 processes={processes}
 templates={templates}
 onOpenManager={() => setIsManagerOpen(true)}
 />
 </div>


 <EditProjectModal
 isOpen={showEditModal}
 onClose={() => setShowEditModal(false)}
 onSuccess={() => fetchData()}
 project={project}
 />

 <ProjectConfigManagerModal
 isOpen={isManagerOpen}
 onClose={() => setIsManagerOpen(false)}
 onChange={() => fetchData()}
 projectId={id}
 />
 </div>
 );
};

export default ProjectSetupPage;
