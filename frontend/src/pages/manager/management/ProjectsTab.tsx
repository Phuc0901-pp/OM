import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../../services/api';
import { Search, Plus, Trash2, Factory, MapPin, X } from 'lucide-react';
import ConfirmModal from '../../../components/ConfirmModal';
import EditCharacteristicsModal from './EditCharacteristicsModal';
import GlassCard from '../../../components/common/GlassCard';
import PremiumButton from '../../../components/common/PremiumButton';
import ModernInput from '../../../components/common/ModernInput';

interface Project {
    project_id: string;
    project_name: string;
    owner: string;
    area: number;
    location: string;
    create_at: string;
}

const ProjectsTab = () => {
    const navigate = useNavigate();
    const [projects, setProjects] = useState<Project[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [showAddModal, setShowAddModal] = useState(false);
    const [editingProject, setEditingProject] = useState<Project | null>(null);
    const [loading, setLoading] = useState(true);

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
                {filtered.map(project => (
                    <GlassCard
                        key={project.project_id}
                        hoverEffect={true}
                        onClick={() => navigate(`/manager/projects/${project.project_id}/setup`)}
                        className="cursor-pointer group relative !p-6 flex flex-col h-full bg-white/60"
                    >
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                handleDelete(project.project_id);
                            }}
                            className="absolute top-4 right-4 p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100 z-20"
                        >
                            <Trash2 className="w-4 h-4" />
                        </button>

                        <div className="mb-6 flex justify-between items-start">
                            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-orange-400 to-red-500 flex items-center justify-center text-white shadow-lg shadow-orange-500/30 transform group-hover:scale-110 transition-transform duration-300">
                                <Factory className="w-7 h-7" />
                            </div>
                        </div>

                        <div className="flex-1">
                            <h3 className="text-xl font-bold text-slate-800 mb-2 group-hover:text-primary-600 transition-colors">
                                {project.project_name}
                            </h3>
                            <div className="flex items-center gap-2 text-sm text-slate-500 mb-6 bg-slate-100/50 w-fit px-3 py-1 rounded-full">
                                <MapPin className="w-3.5 h-3.5 text-primary-500" />
                                {project.location}
                            </div>
                        </div>

                        <div className="flex justify-between items-center text-sm pt-4 border-t border-slate-200/60 mt-auto">
                            <div>
                                <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider mb-0.5">Chủ sở hữu</span>
                                <span className="font-semibold text-slate-700">{project.owner}</span>
                            </div>
                            <div className="text-right">
                                <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider mb-0.5">Diện tích</span>
                                <span className="font-semibold text-slate-700">{project.area.toLocaleString()} m²</span>
                            </div>
                        </div>
                    </GlassCard>
                ))}
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
                onClose={() => setConfirmState({ ...confirmState, isOpen: false })}
                onConfirm={confirmState.onConfirm}
                title={confirmState.title}
                message={confirmState.message}
            />
        </div>
    );
};

export default ProjectsTab;
