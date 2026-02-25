import { useState, useEffect, useRef } from 'react';
import api from '../../../services/api';
import {
    CheckCircle2,
    Users,
    Mail,
    Phone,
    MapPin,
    LayoutGrid,
    List,
    Briefcase,
    Zap,
    Search,
    MoreHorizontal,
    ArrowUpRight,
    Trash2
} from 'lucide-react';

interface TaskDetailItem {
    id: string;
    status_submit?: number;
    status_approve?: number;
}

interface AssignedProject {
    id: string; // Added ID from backend
    project?: {
        project_name: string;
        location: string;
    };
    classification?: {
        name: string;
    };
    progress?: number;
    task_details?: TaskDetailItem[];
}

interface Personnel {
    id: string;
    email: string;
    full_name: string;
    role: string;
    assigned_projects: AssignedProject[];
    number_phone?: string;
}

const PersonnelTab = () => {
    const [personnel, setPersonnel] = useState<Personnel[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [sortBy, setSortBy] = useState<'name' | 'projects'>('name');
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
    const [selectedUser, setSelectedUser] = useState<Personnel | null>(null);
    const [showContactModal, setShowContactModal] = useState(false);
    const [showConfirm, setShowConfirm] = useState<{ show: boolean, assignId: string, userId: string, projectName: string }>({ show: false, assignId: '', userId: '', projectName: '' });
    const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
    const [contactUser, setContactUser] = useState<Personnel | null>(null);
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        fetchPersonnel();
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setActiveMenuId(null);
            }
        };
        window.addEventListener('mousedown', handleClickOutside);
        return () => window.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const fetchPersonnel = async () => {
        try {
            // Get current user ID to send as manager_id (if needed by backend, though backend requires it)
            const storedUser = localStorage.getItem('user');
            const currentUser = storedUser ? JSON.parse(storedUser) : null;

            const response = await api.get('/manager/personnel', {
                params: { manager_id: currentUser?.id }
            });
            setPersonnel(response.data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteAssignment = async (assignId: string, userId: string, projectName: string) => {
        setShowConfirm({ show: true, assignId, userId, projectName });
    };

    const confirmDelete = async () => {
        const { assignId, userId } = showConfirm;
        setShowConfirm({ show: false, assignId: '', userId: '', projectName: '' });

        try {
            await api.delete(`/allocations/${assignId}`);

            // Update State Locally
            setPersonnel(prev => prev.map(u => {
                if (u.id === userId) {
                    return {
                        ...u,
                        assigned_projects: u.assigned_projects.filter(p => p.id !== assignId)
                    };
                }
                return u;
            }));
        } catch (err) {
            console.error("Failed to delete assignment:", err);
            alert("Đã có lỗi xảy ra. Vui lòng thử lại sau.");
        }
    };

    // Helper: Calculate progress for an assignment
    const calculateProgress = (proj: AssignedProject): number => {
        const tasks = proj.task_details || [];
        const submittedCount = tasks.filter(t => t.status_submit === 1).length;
        const approvedCount = tasks.filter(t => t.status_approve === 1).length;

        if (submittedCount === 0) return 0;
        return Math.round((approvedCount / submittedCount) * 100);
    };

    const filteredPersonnel = personnel.filter(p => {
        const matchesSearch = p.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            p.email?.toLowerCase().includes(searchTerm.toLowerCase());

        return matchesSearch;
    });

    // Stats Calculation
    const totalUsers = filteredPersonnel.length;
    const totalProjects = filteredPersonnel.reduce((acc, curr) => acc + (curr.assigned_projects?.length || 0), 0);
    const activeUsers = filteredPersonnel.filter(p => p.assigned_projects?.length > 0).length;

    const StatsCard = ({ title, value, icon: Icon, colorClass }: any) => (
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] flex items-center justify-between">
            <div>
                <p className="text-sm font-medium text-gray-400 uppercase tracking-wide">{title}</p>
                <h3 className="text-2xl font-bold text-gray-800 mt-1">{value}</h3>
            </div>
            <div className={`p-3 rounded-xl ${colorClass}`}>
                <Icon className="w-6 h-6" />
            </div>
        </div>
    );

    if (loading) return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
            <div className="flex flex-col items-center gap-4">
                <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                <p className="text-gray-500 font-medium animate-pulse">Loading Personnel Data...</p>
            </div>
        </div>
    );

    return (
        <div className="min-h-screen bg-[#F8F9FC] p-8">
            <div className="max-w-7xl mx-auto space-y-8">

                {/* 1. Dashboard Header */}
                <div className="flex flex-col md:flex-row items-start md:items-end justify-between gap-6">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">Quản lý Nhân sự</h1>
                        <p className="text-gray-500 mt-1">Tổng quan về nhân sự và phân bổ dự án</p>
                    </div>
                    <div className="flex items-center gap-2 bg-white p-1 rounded-lg border border-gray-200">
                        <button
                            onClick={() => setViewMode('grid')}
                            className={`p-2 rounded-md transition-all ${viewMode === 'grid' ? 'bg-gray-100 text-gray-900 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                        >
                            <LayoutGrid className="w-5 h-5" />
                        </button>
                        <button
                            onClick={() => setViewMode('list')}
                            className={`p-2 rounded-md transition-all ${viewMode === 'list' ? 'bg-gray-100 text-gray-900 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                        >
                            <List className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* 2. Stats Row */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <StatsCard title="Tổng Nhân viên" value={totalUsers} icon={Users} colorClass="bg-blue-50 text-blue-600" />
                    <StatsCard title="Dự án Phân bổ" value={totalProjects} icon={Briefcase} colorClass="bg-indigo-50 text-indigo-600" />
                    <StatsCard title="Nhân sự Active" value={activeUsers} icon={Zap} colorClass="bg-amber-50 text-amber-600" />
                </div>

                {/* 3. Search Bar */}
                <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                    <input
                        type="text"
                        placeholder="Tìm kiếm theo tên, email hoặc vai trò..."
                        className="w-full pl-12 pr-4 py-3 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all shadow-sm"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>

                {/* 4. Content Grid */}
                <div className={`grid gap-6 ${viewMode === 'grid' ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3' : 'grid-cols-1'}`}>
                    {filteredPersonnel.map(user => (
                        <div key={user.id} className="group bg-white rounded-2xl border border-gray-200 shadow-sm hover:shadow-xl hover:border-blue-200 transition-all duration-300 flex flex-col relative overflow-hidden">
                            {/* Decorative Top Border */}
                            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-indigo-500 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-500"></div>

                            {/* Card Menu */}
                            <div className="absolute top-4 right-4 z-10">
                                <button
                                    onClick={(e) => { e.stopPropagation(); setActiveMenuId(activeMenuId === user.id ? null : user.id); }}
                                    className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                                >
                                    <MoreHorizontal className="w-5 h-5" />
                                </button>
                                {activeMenuId === user.id && (
                                    <div ref={menuRef} className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-xl border border-gray-100 animate-scale-in z-20 overflow-hidden">
                                        <button onClick={() => setContactUser(user)} className="w-full text-left px-4 py-2.5 text-sm text-gray-600 hover:bg-gray-50 hover:text-blue-600 flex items-center gap-2">
                                            <Phone className="w-4 h-4" /> Liên hệ
                                        </button>
                                        <button className="w-full text-left px-4 py-2.5 text-sm text-gray-600 hover:bg-gray-50 hover:text-blue-600 flex items-center gap-2">
                                            <ArrowUpRight className="w-4 h-4" /> Xem chi tiết
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* Card Body */}
                            <div className="p-6 pb-4">
                                {/* Header */}
                                <div className="flex items-start gap-4 mb-6">
                                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center text-xl font-bold text-gray-600 shadow-inner">
                                        {user.full_name?.charAt(0).toUpperCase()}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h3 className="font-bold text-gray-900 truncate pr-6 group-hover:text-blue-600 transition-colors">
                                            {user.full_name}
                                        </h3>
                                        <p className="text-sm text-gray-500 truncate mb-2">{user.email}</p>
                                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${user.role === 'engineer'
                                            ? 'bg-indigo-50 text-indigo-700 border-indigo-100'
                                            : 'bg-gray-50 text-gray-600 border-gray-200'
                                            }`}>
                                            {user.role}
                                        </span>
                                    </div>
                                </div>

                                {/* Projects Section */}
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between text-xs font-semibold text-gray-400 uppercase tracking-wider">
                                        <span className="flex items-center gap-1.5"><Briefcase className="w-3.5 h-3.5" /> Dự án</span>
                                        <span className="bg-gray-100 text-gray-600 px-1.5 rounded">{user.assigned_projects?.length || 0}</span>
                                    </div>

                                    {/* Projects List */}
                                    <div className="space-y-3 min-h-[120px]">
                                        {user.assigned_projects && user.assigned_projects.length > 0 ? (
                                            user.assigned_projects.slice(0, 3).map((proj, idx) => (
                                                <div key={idx} className="group/item">
                                                    <div className="flex justify-between items-center mb-1.5">
                                                        <span className="text-sm font-medium text-gray-700 truncate max-w-[70%] group-hover/item:text-blue-600 transition-colors" title={proj.project?.project_name}>
                                                            {proj.project?.project_name || 'Unknown Project'}
                                                        </span>
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-[10px] text-gray-400 font-medium">{calculateProgress(proj)}%</span>
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleDeleteAssignment(proj.id, user.id, proj.project?.project_name || '');
                                                                }}
                                                                className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-all"
                                                                title="Hủy phân công"
                                                            >
                                                                <Trash2 className="w-3 h-3" />
                                                            </button>
                                                        </div>
                                                    </div>
                                                    <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                                        <div
                                                            className={`h-full rounded-full transition-all duration-1000 ${calculateProgress(proj) === 100 ? 'bg-green-500' :
                                                                calculateProgress(proj) > 50 ? 'bg-blue-500' : 'bg-amber-400'
                                                                }`}
                                                            style={{ width: `${calculateProgress(proj)}%` }}
                                                        ></div>
                                                    </div>
                                                </div>
                                            ))
                                        ) : (
                                            <div className="h-24 flex flex-col items-center justify-center text-gray-400 bg-gray-50/50 rounded-xl border border-dashed border-gray-200">
                                                <Briefcase className="w-5 h-5 mb-1 opacity-50" />
                                                <span className="text-xs">Chưa có dự án</span>
                                            </div>
                                        )}
                                        {user.assigned_projects?.length > 3 && (
                                            <p className="text-xs text-center text-gray-400 font-medium mt-2">
                                                +{user.assigned_projects.length - 3} dự án khác
                                            </p>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Card Footer */}
                            <div className="mt-auto px-6 py-4 bg-gray-50/50 border-t border-gray-100 flex items-center justify-between group-hover:bg-blue-50/10 transition-colors">
                                <div className="flex items-center gap-1.5 text-xs text-gray-500">
                                    <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                                    <span>Đang hoạt động</span>
                                </div>
                                <button
                                    onClick={() => setContactUser(user)}
                                    className="text-xs font-semibold text-blue-600 hover:text-blue-700 hover:underline"
                                >
                                    Liên hệ ngay
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Premium Contact/Profile Modal */}
            {contactUser && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/40 backdrop-blur-sm animate-fade-in p-4"
                    onClick={() => setContactUser(null)}
                >
                    <div
                        className="bg-white w-full max-w-md rounded-3xl shadow-[0_20px_60px_-15px_rgba(0,0,0,0.3)] overflow-hidden animate-scale-in border border-white/20"
                        onClick={e => e.stopPropagation()}
                    >
                        {/* 1. Header with Cover & Avatar */}
                        <div className="relative">
                            <div className="h-32 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 relative overflow-hidden">
                                <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20"></div>
                                {/* Close Button */}
                                <button
                                    onClick={() => setContactUser(null)}
                                    className="absolute top-4 right-4 p-2 bg-black/10 hover:bg-black/20 text-white rounded-full transition-all backdrop-blur-sm"
                                >
                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>

                            <div className="px-8 flex justify-between items-end relative -mt-12">
                                <div className="p-1.5 bg-white rounded-2xl shadow-xl">
                                    <div className="w-24 h-24 rounded-xl bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center text-3xl font-bold text-gray-700">
                                        {contactUser.full_name?.charAt(0).toUpperCase()}
                                    </div>
                                </div>
                                <div className="mb-1 flex gap-2">
                                    <button
                                        onClick={() => window.open(`https://mail.google.com/mail/?view=cm&fs=1&to=${contactUser.email}`, '_blank')}
                                        className="p-2.5 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-100 transition-colors tooltip"
                                        title="Gửi Email (Gmail)"
                                    >
                                        <Mail className="w-5 h-5" />
                                    </button>
                                    <button
                                        onClick={() => window.open(`https://zalo.me/${contactUser.number_phone || '0909123456'}`, '_blank')}
                                        className="p-2.5 bg-green-50 text-green-600 rounded-xl hover:bg-green-100 transition-colors tooltip"
                                        title="Liên hệ Zalo"
                                    >
                                        <Phone className="w-5 h-5" />
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* 2. Profile Info */}
                        <div className="px-8 pt-4 pb-8 space-y-6">
                            <div>
                                <h2 className="text-2xl font-bold text-gray-900">{contactUser.full_name}</h2>
                                <div className="flex items-center gap-2 mt-1">
                                    <span className="px-2.5 py-0.5 rounded-full bg-gray-100 text-gray-600 text-xs font-bold uppercase tracking-wider border border-gray-200">
                                        {contactUser.role}
                                    </span>
                                    <span className="w-1 h-1 rounded-full bg-gray-300"></span>
                                    <span className="text-sm text-gray-500 font-medium flex items-center gap-1">
                                        <MapPin className="w-3.5 h-3.5" /> Tp. Hồ Chí Minh
                                    </span>
                                </div>
                            </div>

                            {/* Stats Row */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
                                    <div className="text-gray-400 text-xs font-bold uppercase tracking-wider mb-1">Dự án tham gia</div>
                                    <div className="text-2xl font-bold text-gray-900 flex items-baseline gap-1">
                                        {contactUser.assigned_projects?.length || 0}
                                        <span className="text-sm font-normal text-gray-500">active</span>
                                    </div>
                                </div>
                                <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
                                    <div className="text-gray-400 text-xs font-bold uppercase tracking-wider mb-1">Hiệu suất</div>
                                    <div className="text-2xl font-bold text-gray-900 flex items-baseline gap-1">
                                        98%
                                        <span className="text-sm font-normal text-green-500">+2.4%</span>
                                    </div>
                                </div>
                            </div>

                            {/* Contact Details List */}
                            <div className="space-y-4">
                                <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider">Thông tin liên lạc</h3>

                                <div
                                    onClick={() => window.open(`https://mail.google.com/mail/?view=cm&fs=1&to=${contactUser.email}`, '_blank')}
                                    className="group flex items-center gap-4 p-3 rounded-2xl hover:bg-gray-50 border border-transparent hover:border-gray-100 transition-all cursor-pointer"
                                >
                                    <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center">
                                        <Mail className="w-5 h-5" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs text-gray-400 font-medium uppercase">Email Work</p>
                                        <p className="text-sm font-semibold text-gray-900 truncate">{contactUser.email}</p>
                                    </div>
                                    <ArrowUpRight className="w-4 h-4 text-gray-300 group-hover:text-blue-500 opacity-0 group-hover:opacity-100 transition-all" />
                                </div>

                                <div
                                    onClick={() => window.open(`https://zalo.me/${contactUser.number_phone || '0909123456'}`, '_blank')}
                                    className="group flex items-center gap-4 p-3 rounded-2xl hover:bg-gray-50 border border-transparent hover:border-gray-100 transition-all cursor-pointer"
                                >
                                    <div className="w-10 h-10 rounded-full bg-green-100 text-green-600 flex items-center justify-center">
                                        <Phone className="w-5 h-5" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs text-gray-400 font-medium uppercase">Mobile Phone</p>
                                        <p className="text-sm font-semibold text-gray-900">{contactUser.number_phone || '0909 123 456'}</p>
                                    </div>
                                    <div className="px-2 py-1 rounded-md bg-green-50 text-green-700 text-[10px] font-bold">VERIFIED</div>
                                </div>
                            </div>
                        </div>


                    </div>
                </div>
            )}

            {/* Confirm Delete Modal */}
            {showConfirm.show && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
                        <h3 className="text-lg font-bold mb-2 text-red-600">Xác nhận xóa</h3>
                        <p className="text-gray-600 mb-4">
                            Bạn có chắc chắn muốn hủy phân công dự án <strong>"{showConfirm.projectName}"</strong>?
                            <span className="block mt-2 text-sm text-gray-500">Hành động này không thể hoàn tác.</span>
                        </p>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowConfirm({ show: false, assignId: '', userId: '', projectName: '' })}
                                className="flex-1 px-4 py-2 bg-gray-100 rounded-xl text-gray-600 font-medium hover:bg-gray-200"
                            >
                                Hủy
                            </button>
                            <button
                                onClick={confirmDelete}
                                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-xl font-medium hover:bg-red-700"
                            >
                                Xóa
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PersonnelTab;

