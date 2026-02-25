import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../../services/api';
import { Search, Plus, Trash2, MapPin, X, Copy, Calendar } from 'lucide-react';
import ConfirmModal from '../../../components/ConfirmModal';
import EditCharacteristicsModal from './EditCharacteristicsModal';
import GlassCard from '../../../components/common/GlassCard';
import PremiumButton from '../../../components/common/PremiumButton';
import ModernInput from '../../../components/common/ModernInput';

// Custom SVG icon provided by user
const ProjectHexIcon = ({ className }: { className?: string }) => (
    <svg viewBox="0 0 24 24" className={className} xmlns="http://www.w3.org/2000/svg">
        <polygon fillRule="evenodd" fill="#85A4E6" points="0.8,5.9 3.7,0.8 9.5,0.8 12.4,5.9 9.5,10.9 3.7,10.9" />
        <polygon fillRule="evenodd" fill="#5C85DE" points="11.4,7.7 8.5,2.6 9.5,0.7 12.4,5.9" />
        <polygon fillRule="evenodd" fill="#3367D6" points="2.7,9.3 8.5,9.3 10.5,5.9 11.4,7.7 9.5,10.9 3.7,11" />
        <polygon fillRule="evenodd" fill="#85A4E6" points="11.2,11.9 14.2,6.8 20,6.8 22.9,11.9 20,16.9 14.2,16.9" />
        <polygon fillRule="evenodd" fill="#5C85DE" points="21.9,13.7 19,8.6 20,6.7 22.9,11.9" />
        <polygon fillRule="evenodd" fill="#3367D6" points="13.2,15.3 19,15.3 21,11.9 21.9,13.7 20,16.9 14.2,17" />
        <polygon fillRule="evenodd" fill="#85A4E6" points="0.8,17.9 3.7,12.8 9.5,12.8 12.4,17.9 9.5,22.9 3.7,22.9" />
        <polygon fillRule="evenodd" fill="#5C85DE" points="11.4,19.7 8.5,14.6 9.5,12.7 12.4,17.9" />
        <polygon fillRule="evenodd" fill="#3367D6" points="2.7,21.3 8.5,21.3 10.5,17.9 11.4,19.7 9.5,22.9 3.7,23" />
    </svg>
);

interface Project {
    project_id: string;
    project_name: string;
    owner: string;
    area: number;
    location: string;
    created_at: string;
}

const ProjectsTab = () => {
    const navigate = useNavigate();
    const [projects, setProjects] = useState<Project[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [showAddModal, setShowAddModal] = useState(false);
    const [editingProject, setEditingProject] = useState<Project | null>(null);
    const [loading, setLoading] = useState(true);
    const [cloningId, setCloningId] = useState<string | null>(null);

    // Form State
    const [form, setForm] = useState({
        project_name: '',
        owner: '',
        area: 0,
        location: ''
    });

    // Confirm Modal State
    const [confirmState, setConfirmState] = useState<{
        isOpen: boolean;
        title: string;
        message: string;
        onConfirm: () => void;
    }>({ isOpen: false, title: '', message: '', onConfirm: () => { } });

    useEffect(() => {
        fetchProjects();
    }, []);

    const fetchProjects = async () => {
        try {
            const response = await api.get('/projects');
            setProjects(Array.isArray(response.data) ? response.data : []);
        } catch (error) {
            console.error("Failed to fetch projects", error);
        } finally {
            setLoading(false);
        }
    };

    const handleCreate = async () => {
        try {
            const response = await api.post('/projects', form);
            // Assuming response.data returns the created project with ID, or we need to fetch it?
            // Usually POST returns the created object.
            // Let's check api.post return type or backend.
            // If response.data.id exists:
            const newId = response.data.project_id || response.data.id;

            setShowAddModal(false);
            setForm({ project_name: '', owner: '', area: 0, location: '' });
            fetchProjects();

            if (newId) {
                navigate(`/manager/projects/${newId}/setup`);
            }
        } catch (error) {
            alert("Failed to create project");
        }
    };

    const handleDelete = (id: string) => {
        setConfirmState({
            isOpen: true,
            title: "Xóa dự án",
            message: "Bạn có chắc chắn muốn xóa dự án này? Tất cả dữ liệu liên quan sẽ bị mất.",
            onConfirm: async () => {
                try {
                    await api.delete(`/projects/${id}`);
                    fetchProjects();
                } catch (error) {
                    alert("Failed to delete project");
                }
            }
        });
    };

    const handleClone = (id: string) => {
        setConfirmState({
            isOpen: true,
            title: "Nhân bản dự án",
            message: "Sao chép dự án này kèm toàn bộ cấu hình Trạm và Quy trình? Bạn có thể chỉnh sửa sau khi nhân bản.",
            onConfirm: async () => {
                setCloningId(id);
                try {
                    const response = await api.post(`/projects/${id}/clone`);
                    const newId = response.data.project_id;
                    await fetchProjects();
                    if (newId) {
                        navigate(`/manager/projects/${newId}/setup`);
                    }
                } catch (error) {
                    alert("Nhân bản thất bại. Vui lòng thử lại.");
                } finally {
                    setCloningId(null);
                }
            }
        });
    };

    const filtered = projects.filter(p =>
        p.project_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.location.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Actions */}
            <GlassCard className="!p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                {/* Search & Add Project */}
                <div className="flex flex-col sm:flex-row gap-3 mb-6 w-full">
                    <ModernInput
                        placeholder="Tìm kiếm dự án..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        icon={<Search className="w-4 h-4" />}
                        className="flex-1"
                    />
                    <PremiumButton
                        variant="primary"
                        onClick={() => setShowAddModal(true)}
                        icon={<Plus className="w-4 h-4" />}
                    >
                        Thêm dự án
                    </PremiumButton>
                </div>
            </GlassCard>

            {/* Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filtered.map(project => {
                    const createdDate = project.created_at ? new Date(project.created_at) : null;
                    const formattedDate = createdDate
                        ? `${String(createdDate.getHours()).padStart(2, '0')}:${String(createdDate.getMinutes()).padStart(2, '0')} ${String(createdDate.getDate()).padStart(2, '0')}/${String(createdDate.getMonth() + 1).padStart(2, '0')}/${createdDate.getFullYear()}`
                        : '—';

                    return (
                        <GlassCard
                            key={project.project_id}
                            hoverEffect={true}
                            onClick={() => navigate(`/manager/projects/${project.project_id}/setup`)}
                            className="cursor-pointer group relative flex flex-col h-full !p-0 overflow-hidden border border-slate-100/80"
                        >
                            {/* Header strip */}
                            <div className="relative flex items-center gap-4 px-5 pt-5 pb-4">
                                {/* Icon container */}
                                <div className="w-14 h-14 shrink-0 rounded-2xl bg-gradient-to-br from-indigo-50 to-blue-100 border border-indigo-100 flex items-center justify-center shadow-sm transform group-hover:scale-105 transition-transform duration-300 p-2">
                                    <ProjectHexIcon className="w-full h-full" />
                                </div>

                                {/* Title */}
                                <h3 className="flex-1 min-w-0 text-[15px] font-bold text-slate-800 group-hover:text-indigo-600 transition-colors line-clamp-2 leading-snug" title={project.project_name}>
                                    {project.project_name}
                                </h3>

                                {/* Action buttons – visible on hover */}
                                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all duration-200 shrink-0">
                                    <button
                                        onClick={(e) => { e.stopPropagation(); handleClone(project.project_id); }}
                                        disabled={cloningId === project.project_id}
                                        title="Nhân bản dự án"
                                        className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all disabled:opacity-50"
                                    >
                                        <Copy className="w-4 h-4" />
                                    </button>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); handleDelete(project.project_id); }}
                                        className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>

                            {/* Thin accent divider */}
                            <div className="mx-5 h-px bg-gradient-to-r from-indigo-100 via-blue-200 to-transparent" />

                            {/* Metadata */}
                            <div className="flex-1 flex flex-col px-5 pt-3.5 pb-5 gap-2">
                                <div className="flex items-center gap-2 text-[12px] text-slate-500">
                                    <MapPin className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                                    <span className="truncate" title={project.location}>{project.location}</span>
                                </div>
                                <div className="flex items-center gap-2 text-[12px] text-slate-400">
                                    <Calendar className="w-3.5 h-3.5 shrink-0" />
                                    <span>{formattedDate}</span>
                                </div>

                                {/* Footer */}
                                <div className="flex justify-between items-end mt-auto pt-3 border-t border-slate-100">
                                    <div className="min-w-0 flex-1 mr-3">
                                        <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block mb-0.5">Chủ sở hữu</span>
                                        <span className="text-sm font-semibold text-slate-700 block truncate" title={project.owner}>{project.owner}</span>
                                    </div>
                                    <div className="shrink-0 bg-indigo-50 px-3 py-1.5 rounded-xl text-right">
                                        <span className="text-[10px] uppercase font-bold tracking-wider text-indigo-400 block mb-0.5">Diện tích</span>
                                        <span className="text-sm font-bold text-indigo-600">{project.area.toLocaleString()} m²</span>
                                    </div>
                                </div>
                            </div>
                        </GlassCard>
                    );
                })}


            </div>

            {/* Modal */}
            {showAddModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in">
                    <GlassCard className="w-full max-w-md !p-0 overflow-hidden">
                        <div className="p-6 bg-white/80">
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="text-xl font-bold text-slate-800">Thêm dự án mới</h3>
                                <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            <div className="space-y-4">
                                <ModernInput
                                    label="Tên dự án"
                                    value={form.project_name}
                                    onChange={e => setForm({ ...form, project_name: e.target.value })}
                                    placeholder="Nhập tên dự án..."
                                />
                                <ModernInput
                                    label="Chủ sở hữu"
                                    value={form.owner}
                                    onChange={e => setForm({ ...form, owner: e.target.value })}
                                    placeholder="Tên chủ sở hữu..."
                                />
                                <div className="grid grid-cols-2 gap-4">
                                    <ModernInput
                                        label="Vị trí"
                                        value={form.location}
                                        onChange={e => setForm({ ...form, location: e.target.value })}
                                        placeholder="Địa điểm..."
                                    />
                                    <ModernInput
                                        label="Diện tích (m²)"
                                        type="number"
                                        value={form.area}
                                        onChange={e => setForm({ ...form, area: Number(e.target.value) })}
                                        placeholder="0"
                                    />
                                </div>

                                <div className="flex gap-3 pt-4">
                                    <PremiumButton
                                        variant="secondary"
                                        onClick={() => setShowAddModal(false)}
                                        className="flex-1"
                                    >
                                        Hủy
                                    </PremiumButton>
                                    <PremiumButton
                                        onClick={handleCreate}
                                        className="flex-1"
                                    >
                                        Tạo dự án
                                    </PremiumButton>
                                </div>
                            </div>
                        </div>
                    </GlassCard>
                </div>
            )}

            {/* Edit Characteristics Modal */}
            <EditCharacteristicsModal
                isOpen={!!editingProject}
                onClose={() => setEditingProject(null)}
                projectId={editingProject?.project_id || null}
                projectName={editingProject?.project_name || ''}
            />
            {/* Confirmation Modal */}
            <ConfirmModal
                isOpen={confirmState.isOpen}
                onClose={() => setConfirmState(prev => ({ ...prev, isOpen: false }))}
                onConfirm={confirmState.onConfirm}
                title={confirmState.title}
                message={confirmState.message}
            />
        </div>
    );
};

export default ProjectsTab;
