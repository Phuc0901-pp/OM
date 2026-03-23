import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../../services/api';
import { Search, Plus, Trash2, MapPin, X, Copy, Calendar, ArrowUpDown, User, ChevronDown, Check } from 'lucide-react';
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

type SortOption = 'name_asc' | 'name_desc' | 'newest' | 'oldest';

interface Project {
    project_id: string; // Will map from id
    project_name: string; // Will map from name
    id_owner?: string;
    owner?: {
        id: string;
        name: string;
    };
    area: number;
    location: string;
    created_at: string;
}

interface Owner {
    id: string;
    name: string;
}

const ProjectsTab = () => {
    const navigate = useNavigate();
    const [projects, setProjects] = useState<Project[]>([]);
    const [ownersList, setOwnersList] = useState<Owner[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [showAddModal, setShowAddModal] = useState(false);
    const [editingProject, setEditingProject] = useState<Project | null>(null);
    const [loading, setLoading] = useState(true);
    const [cloningId, setCloningId] = useState<string | null>(null);

    const [isAddingOwner, setIsAddingOwner] = useState(false);
    const [newOwnerName, setNewOwnerName] = useState('');

    // Filter & Sort State
    const [ownerFilter, setOwnerFilter] = useState('');
    const [sortOption, setSortOption] = useState<SortOption>('newest');
    const [showSortMenu, setShowSortMenu] = useState(false);

    // Form State (no area)
    const [form, setForm] = useState({
        project_name: '',
        id_owner: '',
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
        fetchOwners();
    }, []);

    const fetchOwners = async () => {
        try {
            const response = await api.get('/owners');
            setOwnersList(Array.isArray(response.data) ? response.data : []);
        } catch (error) {
            console.error("Failed to fetch owners", error);
        }
    };

    const fetchProjects = async () => {
        try {
            const response = await api.get('/projects');
            if (Array.isArray(response.data)) {
                // Map V2 schema (id, name) to also support V1 schema keys (project_id, project_name)
                const formattedProjects = response.data.map((p: any) => ({
                    ...p,
                    project_id: p.id || p.project_id,
                    project_name: p.name || p.project_name
                }));
                setProjects(formattedProjects);
            } else {
                setProjects([]);
            }
        } catch (error) {
            console.error("Failed to fetch projects", error);
        } finally {
            setLoading(false);
        }
    };

    const handleCreateOwner = async () => {
        if (!newOwnerName.trim()) return;
        try {
            const response = await api.post('/owners', { name: newOwnerName });
            await fetchOwners();
            setForm({ ...form, id_owner: response.data.id });
            setIsAddingOwner(false);
            setNewOwnerName('');
        } catch (error) {
            alert("Thêm chủ đầu tư thất bại. Vui lòng thử lại.");
        }
    };

    const handleCreate = async () => {
        if (!form.project_name.trim()) return;
        try {
            const response = await api.post('/projects', {
                name: form.project_name,
                id_owner: form.id_owner,
                location: form.location,
                area: 0
            });
            const newId = response.data.project_id || response.data.id;
            setShowAddModal(false);
            setForm({ project_name: '', id_owner: '', location: '' });
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

    // Derive unique owners for filter dropdown
    const ownerOptions = useMemo(() => {
        const ownerNames = projects
            .map(p => p.owner?.name)
            .filter(Boolean) as string[];
        return [...new Set(ownerNames)].sort();
    }, [projects]);

    const sortLabels: Record<SortOption, string> = {
        newest: 'Mới nhất',
        oldest: 'Cũ nhất',
        name_asc: 'Tên (A → Z)',
        name_desc: 'Tên (Z → A)',
    };

    const displayedProjects = useMemo(() => {
        let result = [...projects];

        // Filter by search
        if (searchTerm.trim()) {
            const s = searchTerm.toLowerCase();
            result = result.filter(p =>
                p.project_name.toLowerCase().includes(s) ||
                p.location.toLowerCase().includes(s)
            );
        }

        // Filter by owner
        if (ownerFilter) {
            result = result.filter(p => p.owner?.name === ownerFilter);
        }

        // Sort
        result.sort((a, b) => {
            switch (sortOption) {
                case 'name_asc': return a.project_name.localeCompare(b.project_name, 'vi');
                case 'name_desc': return b.project_name.localeCompare(a.project_name, 'vi');
                case 'oldest': return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
                case 'newest':
                default: return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
            }
        });

        return result;
    }, [projects, searchTerm, ownerFilter, sortOption]);

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Toolbar */}
            <GlassCard className="!p-4">
                <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
                    {/* Search */}
                    <div className="flex-1">
                        <ModernInput
                            placeholder="Tìm kiếm dự án, địa điểm..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            icon={<Search className="w-4 h-4" />}
                        />
                    </div>

                    {/* Owner Filter */}
                    <div className="relative">
                        <div className="flex items-center gap-2 px-3 py-2 bg-white/80 border border-slate-200 rounded-xl text-sm text-slate-600 focus-within:border-indigo-400 transition-colors">
                            <User className="w-4 h-4 text-indigo-400 shrink-0" />
                            <select
                                className="bg-transparent outline-none text-sm text-slate-700 cursor-pointer pr-1 min-w-[130px]"
                                value={ownerFilter}
                                onChange={e => setOwnerFilter(e.target.value)}
                            >
                                <option value="">Tất cả chủ sở hữu</option>
                                {ownerOptions.map(o => (
                                    <option key={o} value={o}>{o}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Sort Dropdown */}
                    <div className="relative">
                        <button
                            onClick={() => setShowSortMenu(v => !v)}
                            className="flex items-center gap-2 px-3 py-2 bg-white/80 border border-slate-200 rounded-xl text-sm text-slate-600 hover:border-indigo-300 transition-colors whitespace-nowrap"
                        >
                            <ArrowUpDown className="w-4 h-4 text-indigo-400" />
                            <span>{sortLabels[sortOption]}</span>
                            <ChevronDown className="w-4 h-4 text-slate-400" />
                        </button>
                        {showSortMenu && (
                            <div
                                className="absolute right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg z-20 w-44 py-1 animate-fade-in"
                                onMouseLeave={() => setShowSortMenu(false)}
                            >
                                {(Object.entries(sortLabels) as [SortOption, string][]).map(([key, label]) => (
                                    <button
                                        key={key}
                                        onClick={() => { setSortOption(key); setShowSortMenu(false); }}
                                        className={`w-full text-left px-4 py-2 text-sm transition-colors ${sortOption === key ? 'bg-indigo-50 text-indigo-600 font-semibold' : 'text-slate-700 hover:bg-slate-50'}`}
                                    >
                                        {label}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Add Button */}
                    <PremiumButton
                        variant="primary"
                        onClick={() => setShowAddModal(true)}
                        icon={<Plus className="w-4 h-4" />}
                    >
                        Thêm dự án
                    </PremiumButton>
                </div>

                {/* Active Filters Badge */}
                {(ownerFilter || sortOption !== 'newest') && (
                    <div className="flex gap-2 mt-3 flex-wrap">
                        {ownerFilter && (
                            <span className="inline-flex items-center gap-1 bg-indigo-50 text-indigo-600 text-xs font-medium px-2.5 py-1 rounded-full border border-indigo-100">
                                <User className="w-3 h-3" /> {ownerFilter}
                                <button onClick={() => setOwnerFilter('')} className="ml-1 hover:text-red-500 transition-colors">×</button>
                            </span>
                        )}
                        {sortOption !== 'newest' && (
                            <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-600 text-xs font-medium px-2.5 py-1 rounded-full border border-slate-200">
                                <ArrowUpDown className="w-3 h-3" /> {sortLabels[sortOption]}
                                <button onClick={() => setSortOption('newest')} className="ml-1 hover:text-red-500 transition-colors">×</button>
                            </span>
                        )}
                    </div>
                )}
            </GlassCard>

            {/* Empty state */}
            {!loading && displayedProjects.length === 0 && (
                <div className="text-center py-16 text-slate-400">
                    <div className="w-16 h-16 mx-auto mb-3 opacity-30">
                        <ProjectHexIcon className="w-full h-full" />
                    </div>
                    <p className="font-medium">Không tìm thấy dự án nào</p>
                    <p className="text-sm mt-1">Thử thay đổi bộ lọc hoặc từ khóa tìm kiếm</p>
                </div>
            )}

            {/* Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {displayedProjects.map(project => {
                    const createdDate = project.created_at ? new Date(project.created_at) : null;
                    const formattedDate = createdDate
                        ? `${String(createdDate.getDate()).padStart(2, '0')}/${String(createdDate.getMonth() + 1).padStart(2, '0')}/${createdDate.getFullYear()}`
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
                                    <span className="truncate" title={project.location}>{project.location || '—'}</span>
                                </div>
                                <div className="flex items-center gap-2 text-[12px] text-slate-400">
                                    <Calendar className="w-3.5 h-3.5 shrink-0" />
                                    <span>{formattedDate}</span>
                                </div>

                                {/* Footer */}
                                <div className="mt-auto pt-3 border-t border-slate-100">
                                    <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block mb-0.5">Chủ sở hữu</span>
                                    <span className="text-sm font-semibold text-slate-700 block truncate" title={typeof project.owner === 'string' ? project.owner : project.owner?.name}>
                                        {typeof project.owner === 'string' ? project.owner : (project.owner?.name || '—')}
                                    </span>
                                </div>
                            </div>
                        </GlassCard>
                    );
                })}
            </div>

            {/* Add Project Modal */}
            {showAddModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in">
                    <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden border border-slate-100">
                        {/* Modal Header */}
                        <div className="bg-gradient-to-r from-indigo-600 to-blue-600 px-6 py-5">
                            <div className="flex justify-between items-center">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center p-2">
                                        <ProjectHexIcon className="w-full h-full" />
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-bold text-white">Thêm dự án mới</h3>
                                        <p className="text-indigo-100 text-xs">Điền thông tin cơ bản để khởi tạo dự án</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setShowAddModal(false)}
                                    className="text-white/70 hover:text-white hover:bg-white/20 rounded-lg p-1.5 transition-all"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                        </div>

                        {/* Modal Body */}
                        <div className="p-6 space-y-5">
                            <ModernInput
                                label="Tên dự án *"
                                value={form.project_name}
                                onChange={e => setForm({ ...form, project_name: e.target.value })}
                                placeholder="Nhập tên dự án..."
                            />
                            <div>
                                <div className="flex justify-between items-center mb-1.5">
                                    <label className="block text-sm font-medium text-slate-600">Chủ sở hữu</label>
                                    {!isAddingOwner && (
                                        <button
                                            onClick={() => setIsAddingOwner(true)}
                                            className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
                                        >
                                            <Plus className="w-3 h-3" /> Thêm mới
                                        </button>
                                    )}
                                </div>
                                {isAddingOwner ? (
                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            className="w-full px-4 py-2.5 border border-slate-200 rounded-xl bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-300 transition-shadow text-sm"
                                            placeholder="Tên chủ đầu tư mới..."
                                            value={newOwnerName}
                                            onChange={(e) => setNewOwnerName(e.target.value)}
                                            autoFocus
                                        />
                                        <button
                                            onClick={handleCreateOwner}
                                            disabled={!newOwnerName.trim()}
                                            className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white p-2.5 rounded-xl transition-colors shrink-0"
                                        >
                                            <Check className="w-5 h-5" />
                                        </button>
                                        <button
                                            onClick={() => { setIsAddingOwner(false); setNewOwnerName(''); }}
                                            className="bg-slate-100 hover:bg-slate-200 text-slate-500 p-2.5 rounded-xl transition-colors shrink-0"
                                        >
                                            <X className="w-5 h-5" />
                                        </button>
                                    </div>
                                ) : (
                                    <div className="relative">
                                        <select
                                            value={form.id_owner}
                                            onChange={e => setForm({ ...form, id_owner: e.target.value })}
                                            className="w-full px-4 py-2.5 border border-slate-200 rounded-xl bg-white text-slate-800 appearance-none focus:outline-none focus:ring-2 focus:ring-indigo-300 transition-shadow"
                                        >
                                            <option value="">-- Chọn chủ sở hữu --</option>
                                            {ownersList.map(o => (
                                                <option key={o.id} value={o.id}>{o.name}</option>
                                            ))}
                                        </select>
                                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                                    </div>
                                )}
                            </div>
                            <ModernInput
                                label="Vị trí"
                                value={form.location}
                                onChange={e => setForm({ ...form, location: e.target.value })}
                                placeholder="Địa điểm lắp đặt..."
                            />
                        </div>

                        {/* Modal Footer */}
                        <div className="px-6 pb-6 flex gap-3">
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
                                disabled={!form.project_name.trim()}
                            >
                                Tạo dự án
                            </PremiumButton>
                        </div>
                    </div>
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
