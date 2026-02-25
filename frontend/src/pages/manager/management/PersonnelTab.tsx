import { useState, useEffect, useRef } from 'react';
import api from '../../../services/api';
import AddUserModal from '../../../components/AddUserModal';
import {
    CheckCircle2,
    Users,
    Mail,
    Phone,
    MapPin,
    LayoutGrid,
    List,
    Zap,
    Search,
    MoreHorizontal,
    ArrowUpRight,
    Trash2,
    X,
    Plus
} from 'lucide-react';

// Custom Google Cloud-style icon for Projects
const CloudApiIcon = ({ className }: { className?: string }) => (
    <svg viewBox="0 0 24 24" className={className} xmlns="http://www.w3.org/2000/svg">
        <path fill="#4285f4" d="M16.49,12,12,16.49,7.51,12,12,7.51ZM12,14.91,14.91,12,12,9.09,9.09,12Z" />
        <polygon fill="#669df6" points="16.33 15.02 18.98 15.02 22 12 19.35 12 16.33 15.02" />
        <polygon fill="#aecbfa" points="16.33 8.98 19.35 12 22 12 18.98 8.98 16.33 8.98" />
        <polygon fill="#aecbfa" points="7.67 8.98 5.02 8.98 2 12 4.65 12 7.67 8.98" />
        <polygon fill="#669df6" points="2 12 5.02 15.02 7.67 15.02 4.65 12 2 12" />
        <polygon fill="#aecbfa" points="8.98 5.02 8.98 7.67 12 4.65 12 2 8.98 5.02" />
        <polygon fill="#669df6" points="12 2 12 4.65 15.02 7.67 15.02 5.02 12 2" />
        <polygon fill="#aecbfa" points="8.98 16.33 8.98 18.98 12 22 12 19.35 8.98 16.33" />
        <polygon fill="#669df6" points="12 19.35 12 22 15.02 18.98 15.02 16.33 12 19.35" />
    </svg>
);

const TotalUsersIcon = ({ className }: { className?: string }) => (
    <svg className={className} version="1.1" id="_x32_" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" fill="currentColor">
        <g>
            <path d="M157.604,321.598c7.26-2.232,10.041-6.696,10.6-10.046c-0.559-4.469-3.143-6.279-3.986-14.404 c-0.986-9.457,6.91-32.082,9.258-36.119c-0.32-0.772-0.65-1.454-0.965-2.247c-11.002-6.98-22.209-19.602-27.359-42.416 c-2.754-12.197-0.476-24.661,6.121-35.287c0,0-7.463-52.071,3.047-86.079c-9.818-4.726-20.51-3.93-35.164-2.466 c-11.246,1.126-12.842,3.516-21.48,2.263c-9.899-1.439-17.932-4.444-20.348-5.654c-1.392-0.694-14.449,10.89-18.084,20.35 c-11.531,29.967-8.435,50.512-5.5,66.057c-0.098,1.592-0.224,3.178-0.224,4.787l2.68,11.386c0.01,0.12,0,0.232,0.004,0.346 c-5.842,5.24-9.363,12.815-7.504,21.049c3.828,16.934,12.07,23.802,20.186,26.777c5.383,15.186,10.606,24.775,16.701,31.222 c1.541,7.027,2.902,16.57,1.916,26.032C83.389,336.78,0,315.904,0,385.481c0,9.112,25.951,23.978,88.818,28.259 c-0.184-1.342-0.31-2.695-0.31-4.078C88.508,347.268,129.068,330.379,157.604,321.598z"></path>
            <path d="M424.5,297.148c-0.986-9.457,0.371-18.995,1.912-26.011c6.106-6.458,11.328-16.052,16.713-31.246 c8.113-2.977,16.35-9.848,20.174-26.774c1.77-7.796-1.293-15.006-6.59-20.2c3.838-12.864,18.93-72.468-26.398-84.556 c-15.074-18.839-28.258-18.087-50.871-15.827c-11.246,1.126-12.844,3.516-21.477,2.263c-1.89-0.275-3.682-0.618-5.41-0.984 c1.658,2.26,3.238,4.596,4.637,7.092c15.131,27.033,11.135,61.27,6.381,82.182c5.67,10.21,7.525,21.944,4.963,33.285 c-5.15,22.8-16.352,35.419-27.348,42.4c-0.551,1.383-2.172,4.214,0.06,7.006c2.039,3.305,2.404,2.99,4.627,5.338 c1.539,7.027,2.898,16.57,1.91,26.032c-0.812,7.85-14.352,14.404-10.533,17.576c3.756,1.581,8.113,3.234,13,5.028 c28.025,10.29,74.928,27.516,74.928,89.91c0,1.342-0.117,2.659-0.291,3.96C486.524,409.195,512,394.511,512,385.481 C512,315.904,428.613,336.78,424.5,297.148z"></path>
            <path d="M301.004,307.957c-1.135-10.885,0.432-21.867,2.201-29.956c7.027-7.423,13.047-18.476,19.244-35.968 c9.34-3.427,18.826-11.335,23.23-30.826c2.028-8.976-1.494-17.276-7.586-23.256c4.412-14.81,21.785-83.437-30.398-97.353 c-17.354-21.692-32.539-20.825-58.57-18.222c-12.951,1.294-14.791,4.048-24.731,2.603c-11.4-1.657-20.646-5.117-23.428-6.508 c-1.602-0.803-16.637,12.538-20.826,23.428c-13.27,34.5-9.705,58.159-6.33,76.056c-0.111,1.833-0.264,3.658-0.264,5.511 l3.092,13.11c0.01,0.135,0,0.264,0.004,0.399c-6.726,6.03-10.777,14.752-8.636,24.232c4.402,19.498,13.894,27.404,23.238,30.828 c6.199,17.485,12.207,28.533,19.231,35.956c1.773,8.084,3.34,19.076,2.205,29.966c-4.738,45.626-100.744,21.593-100.744,101.706 c0,12.355,41.4,33.902,144.906,33.902c103.506,0,144.906-21.547,144.906-33.902C401.748,329.549,305.742,353.583,301.004,307.957z M240.039,430.304l-26.276-106.728l32.324,13.453l-1.738,15.619l5.135-0.112L240.039,430.304z M276.209,430.304l-9.447-77.768 l5.135,0.112l-1.738-15.619l32.324-13.453L276.209,430.304z"></path>
        </g>
    </svg>
);

const AssignedProjectsIcon = ({ className }: { className?: string }) => (
    <svg viewBox="0 0 24 24" className={className} xmlns="http://www.w3.org/2000/svg" fill="currentColor">
        <path d="M10.873 16.4069C10.9219 16.2903 10.947 16.1653 10.9469 16.039V6.95853C10.9469 6.42953 10.5115 6.00003 9.9728 6.00003H6.97153C6.43534 6.00003 6 6.43003 6 6.95853V16.039C6.00027 16.2934 6.10263 16.5373 6.2847 16.7174C6.46677 16.8975 6.71372 16.9991 6.97153 17H9.9728C10.1008 17.0002 10.2275 16.9754 10.3457 16.9271C10.464 16.8789 10.5714 16.8081 10.6619 16.7189C10.7523 16.6296 10.8241 16.5236 10.873 16.4069Z"></path>
        <path d="M17.7155 12.7175C17.8975 12.5374 17.9999 12.2934 18 12.039V6.95853C18 6.42953 17.5642 6.00003 17.0285 6.00003H14.0272C13.4915 6.00003 13.0531 6.43003 13.0531 6.95853V12.039C13.0534 12.2938 13.1561 12.5381 13.3387 12.7183C13.5213 12.8984 13.7689 12.9998 14.0272 13H17.0285C17.2863 12.9992 17.5334 12.8977 17.7155 12.7175Z"></path>
        <path fillRule="evenodd" clipRule="evenodd" d="M17.2583 2.83306C13.7917 2.44562 10.2083 2.44562 6.74177 2.83306C4.72971 3.05794 3.10538 4.64295 2.86883 6.66548C2.45429 10.2098 2.45429 13.7903 2.86883 17.3346C3.10538 19.3571 4.72971 20.9422 6.74177 21.167C10.2083 21.5545 13.7917 21.5545 17.2583 21.167C19.2703 20.9422 20.8946 19.3571 21.1312 17.3346C21.5457 13.7903 21.5457 10.2098 21.1312 6.66548C20.8946 4.64295 19.2703 3.05794 17.2583 2.83306ZM6.90838 4.32378C10.2642 3.94871 13.7358 3.94871 17.0916 4.32378C18.4218 4.47244 19.4872 5.52205 19.6414 6.83973C20.0424 10.2683 20.0424 13.7318 19.6414 17.1604C19.4872 18.478 18.4218 19.5277 17.0916 19.6763C13.7358 20.0514 10.2642 20.0514 6.90838 19.6763C5.57827 19.5277 4.51278 18.478 4.35867 17.1604C3.95767 13.7318 3.95767 10.2683 4.35867 6.83973C4.51278 5.52205 5.57827 4.47244 6.90838 4.32378Z"></path>
    </svg>
);

const ActiveUsersIcon = ({ className }: { className?: string }) => (
    <svg version="1.1" xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 245 256" fill="currentColor">
        <path d="M94.338,47.137c0,0,0,1.603,0,2.452c0,15.611,12.654,28.265,28.265,28.265s28.265-12.654,28.265-28.265 c0-0.849,0-2.452,0-2.452S94.338,47.137,94.338,47.137z M161.906,33.326v7.881H83.094v-7.881h5.517 c1.058-13.06,9.469-24.039,21.088-28.794v16.972h4.926V2.942C117.184,2.328,119.855,2,122.603,2c2.678,0,5.282,0.315,7.782,0.898 v18.606h4.926V4.448c11.722,4.711,20.221,15.743,21.285,28.878H161.906z M236.606,134.036c-3.92-3.75-9.073-5.689-14.507-5.445 c-10.552,0.466-18.817,9.328-18.817,20.177v11.643h-9.852v-39.406c0-19.443-16.309-35.016-35.676-35.016h-7.659l-20.7,34.031 l-2.955-25.936l2.955-8.171h-13.792l2.955,8.171l-2.955,25.936L94.915,85.988h-7.67c-19.443,0-35.676,15.649-35.676,35.016v39.406 h-9.852V148.76c0-10.849-8.265-19.712-18.816-20.177c-5.43-0.236-10.586,1.694-14.507,5.446c-3.923,3.753-6.083,8.81-6.083,14.238 v85.469h0.008c-0.15,5.308,1.776,10.327,5.445,14.169c3.755,3.931,8.815,6.096,14.25,6.096h200.971 c5.435,0,10.496-2.165,14.25-6.097c3.668-3.841,5.594-8.858,5.446-14.164l0.007-85.466 C242.688,142.845,240.528,137.79,236.606,134.036z M164.861,127.9c1.632,0,2.955,1.323,2.955,2.955v29.555h-5.911v-29.555 C161.906,129.224,163.229,127.9,164.861,127.9z M77.183,130.856c0-1.632,1.323-2.955,2.955-2.955c1.632,0,2.955,1.323,2.955,2.955 v29.555h-5.911V130.856z M10.192,148.266c0-3.257,1.296-6.291,3.651-8.543c2.221-2.126,5.052-3.449,8.711-3.267 c6.22,0.309,11.282,5.794,11.282,12.304v69.77c-3.648-2.751-8.099-4.129-12.748-3.916c-4.058,0.187-7.821,1.641-10.896,3.969 V148.266z M231.536,242.46c-2.253,2.359-5.289,3.659-8.551,3.659H22.014c-3.261,0-6.298-1.299-8.551-3.659 c-2.251-2.357-3.409-5.457-3.259-8.727c0.278-6.028,5.217-10.968,11.246-11.246c3.276-0.146,6.37,1.006,8.727,3.259 c2.359,2.253,3.659,5.289,3.659,8.551h7.881v-66.005h9.852v26.599c0,6.81,5.997,11.822,12.807,11.822s12.807-5.012,12.807-11.822 v-26.599h90.634v26.599c0,6.81,5.997,12.807,12.807,12.807c6.81,0,12.807-5.997,12.807-12.807v-26.599h9.852v66.005h7.881 c0-3.261,1.3-6.298,3.659-8.551c2.357-2.252,5.442-3.412,8.727-3.259c6.028,0.277,10.968,5.217,11.246,11.246 C234.946,237.003,233.788,240.103,231.536,242.46z M234.807,218.584c-3.075-2.328-6.445-3.991-11.834-3.991 c-4.31,0-8.407,1.372-11.809,3.937v-69.762c0-6.51,5.061-12.03,11.282-12.304c3.261-0.143,6.358,1.015,8.711,3.266 c2.354,2.252,3.65,5.287,3.65,8.543V218.584z"></path>
    </svg>
);

interface TaskDetailItem {
    id: string;
    status_submit?: number;
    status_approve?: number;
}

interface AssignedProject {
    id: string;
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

// Generate a consistent color gradient based on name initial
const getAvatarGradient = (name: string) => {
    const gradients = [
        'from-indigo-400 to-blue-500',
        'from-violet-400 to-indigo-500',
        'from-blue-400 to-cyan-500',
        'from-sky-400 to-indigo-400',
        'from-purple-400 to-violet-500',
    ];
    const idx = (name?.charCodeAt(0) || 0) % gradients.length;
    return gradients[idx];
};

const PersonnelTab = () => {
    const [personnel, setPersonnel] = useState<Personnel[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
    const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
    const [contactUser, setContactUser] = useState<Personnel | null>(null);
    const [showConfirm, setShowConfirm] = useState<{ show: boolean, assignId: string, userId: string, projectName: string }>({ show: false, assignId: '', userId: '', projectName: '' });
    const [showAddModal, setShowAddModal] = useState(false);
    const [currentManagerId, setCurrentManagerId] = useState<string>('');
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
            const storedUser = localStorage.getItem('user');
            const currentUser = storedUser ? JSON.parse(storedUser) : null;
            if (currentUser?.id) setCurrentManagerId(currentUser.id);
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
            setPersonnel(prev => prev.map(u => {
                if (u.id === userId) {
                    return { ...u, assigned_projects: u.assigned_projects.filter(p => p.id !== assignId) };
                }
                return u;
            }));
        } catch (err) {
            console.error('Failed to delete assignment:', err);
            alert('Đã có lỗi xảy ra. Vui lòng thử lại sau.');
        }
    };

    const calculateProgress = (proj: AssignedProject): number => {
        const tasks = proj.task_details || [];
        const submittedCount = tasks.filter(t => t.status_submit === 1).length;
        const approvedCount = tasks.filter(t => t.status_approve === 1).length;
        if (submittedCount === 0) return 0;
        return Math.round((approvedCount / submittedCount) * 100);
    };

    const filteredPersonnel = personnel.filter(p =>
        p.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.email?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const totalUsers = filteredPersonnel.length;
    const totalProjects = filteredPersonnel.reduce((acc, curr) => acc + (curr.assigned_projects?.length || 0), 0);
    const activeUsers = filteredPersonnel.filter(p => p.assigned_projects?.length > 0).length;

    if (loading) return (
        <div className="min-h-[400px] flex items-center justify-center">
            <div className="flex flex-col items-center gap-4">
                <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                <p className="text-slate-500 text-sm font-medium">Đang tải dữ liệu nhân sự...</p>
            </div>
        </div>
    );

    return (
        <div className="space-y-6">

            {/* 1. Stats Row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                    { title: 'Tổng Nhân viên', value: totalUsers, icon: TotalUsersIcon, from: 'from-indigo-500', to: 'to-blue-500' },
                    { title: 'Dự án Phân bổ', value: totalProjects, icon: AssignedProjectsIcon, from: 'from-blue-500', to: 'to-cyan-500' },
                    { title: 'Nhân sự Active', value: activeUsers, icon: ActiveUsersIcon, from: 'from-violet-500', to: 'to-indigo-500' },
                ].map(s => (
                    <div key={s.title} className="bg-white rounded-2xl border border-slate-100 shadow-sm px-5 py-4 flex items-center justify-between">
                        <div>
                            <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-1">{s.title}</p>
                            <p className="text-3xl font-extrabold text-slate-800">{s.value}</p>
                        </div>
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center bg-gradient-to-br ${s.from} ${s.to} text-white shadow-md`}>
                            <s.icon className="w-5 h-5" />
                        </div>
                    </div>
                ))}
            </div>

            {/* 2. Toolbar */}
            <div className="flex items-center gap-3">
                <div className="relative flex-1">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                    <input
                        type="text"
                        placeholder="Tìm kiếm theo tên, email..."
                        className="w-full pl-10 pr-4 py-2.5 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-400/30 focus:border-indigo-400 transition-all shadow-sm"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="flex items-center bg-white border border-slate-200 rounded-xl p-1 gap-1 shadow-sm">
                    <button
                        onClick={() => setViewMode('grid')}
                        className={`p-2 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-indigo-100 text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
                    >
                        <LayoutGrid className="w-4 h-4" />
                    </button>
                    <button
                        onClick={() => setViewMode('list')}
                        className={`p-2 rounded-lg transition-all ${viewMode === 'list' ? 'bg-indigo-100 text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
                    >
                        <List className="w-4 h-4" />
                    </button>
                </div>
                <button
                    onClick={() => setShowAddModal(true)}
                    className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl transition-all shadow-md shadow-indigo-500/20 shrink-0"
                >
                    <Plus className="w-4 h-4" />
                    Thêm nhân sự
                </button>
            </div>

            {/* 3. Personnel Grid */}
            <div className={`grid gap-5 ${viewMode === 'grid' ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3' : 'grid-cols-1'}`}>
                {filteredPersonnel.map(user => (
                    <div
                        key={user.id}
                        className="group bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-lg hover:border-indigo-200 transition-all duration-300 flex flex-col overflow-hidden relative"
                    >
                        {/* Hover accent line */}
                        <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-indigo-500 to-blue-400 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-500 origin-left" />

                        {/* Card Header */}
                        <div className="p-5 pb-4 flex items-start gap-4">
                            <div className={`w-12 h-12 shrink-0 rounded-xl bg-gradient-to-br ${getAvatarGradient(user.full_name)} flex items-center justify-center text-lg font-bold text-white shadow-md`}>
                                {user.full_name?.charAt(0).toUpperCase()}
                            </div>
                            <div className="flex-1 min-w-0">
                                <h3 className="font-bold text-slate-800 truncate group-hover:text-indigo-600 transition-colors text-[15px]">
                                    {user.full_name}
                                </h3>
                                <p className="text-[12px] text-slate-400 truncate mb-1.5">{user.email}</p>
                                <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${user.role === 'engineer'
                                    ? 'bg-indigo-50 text-indigo-600 border border-indigo-100'
                                    : 'bg-slate-50 text-slate-500 border border-slate-200'
                                    }`}>
                                    {user.role}
                                </span>
                            </div>
                            {/* Menu */}
                            <div className="shrink-0 relative" ref={activeMenuId === user.id ? menuRef : undefined}>
                                <button
                                    onClick={(e) => { e.stopPropagation(); setActiveMenuId(activeMenuId === user.id ? null : user.id); }}
                                    className="p-1.5 text-slate-300 hover:text-slate-500 hover:bg-slate-50 rounded-lg transition-colors"
                                >
                                    <MoreHorizontal className="w-4 h-4" />
                                </button>
                                {activeMenuId === user.id && (
                                    <div className="absolute right-0 mt-1 w-44 bg-white rounded-xl shadow-xl border border-slate-100 z-20 overflow-hidden">
                                        <button onClick={() => { setContactUser(user); setActiveMenuId(null); }} className="w-full text-left px-4 py-2.5 text-sm text-slate-600 hover:bg-indigo-50 hover:text-indigo-600 flex items-center gap-2">
                                            <Phone className="w-3.5 h-3.5" /> Liên hệ
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Divider */}
                        <div className="mx-5 h-px bg-gradient-to-r from-indigo-100 via-blue-100 to-transparent" />

                        {/* Projects Section */}
                        <div className="px-5 pt-3.5 pb-4 flex-1">
                            <div className="flex items-center justify-between mb-3">
                                <span className="text-[11px] font-bold uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
                                    <CloudApiIcon className="w-3 h-3" /> Dự án
                                </span>
                                <span className="bg-indigo-50 text-indigo-600 text-[10px] font-bold px-1.5 py-0.5 rounded-md border border-indigo-100">
                                    {user.assigned_projects?.length || 0}
                                </span>
                            </div>

                            <div className="space-y-3 min-h-[96px]">
                                {user.assigned_projects && user.assigned_projects.length > 0 ? (
                                    user.assigned_projects.slice(0, 3).map((proj, idx) => {
                                        const pct = calculateProgress(proj);
                                        const barColor = pct === 100 ? 'bg-emerald-500' : pct > 50 ? 'bg-indigo-500' : 'bg-amber-400';
                                        return (
                                            <div key={idx} className="group/item">
                                                <div className="flex justify-between items-center mb-1">
                                                    <span className="text-[13px] font-medium text-slate-700 truncate max-w-[75%]" title={proj.project?.project_name}>
                                                        {proj.project?.project_name || 'Unknown'}
                                                    </span>
                                                    <div className="flex items-center gap-1.5">
                                                        <span className="text-[11px] text-slate-400 font-semibold">{pct}%</span>
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); handleDeleteAssignment(proj.id, user.id, proj.project?.project_name || ''); }}
                                                            className="p-0.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded transition-all opacity-0 group-hover/item:opacity-100"
                                                            title="Hủy phân công"
                                                        >
                                                            <Trash2 className="w-3 h-3" />
                                                        </button>
                                                    </div>
                                                </div>
                                                <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                                    <div
                                                        className={`h-full rounded-full transition-all duration-700 ${barColor}`}
                                                        style={{ width: `${pct}%` }}
                                                    />
                                                </div>
                                            </div>
                                        );
                                    })
                                ) : (
                                    <div className="h-24 flex flex-col items-center justify-center text-slate-300 bg-slate-50/70 rounded-xl border border-dashed border-slate-200">
                                        <CloudApiIcon className="w-5 h-5 mb-1 opacity-40" />
                                        <span className="text-xs text-slate-400">Chưa có dự án</span>
                                    </div>
                                )}
                                {user.assigned_projects?.length > 3 && (
                                    <p className="text-[11px] text-center text-indigo-400 font-semibold mt-1">
                                        +{user.assigned_projects.length - 3} dự án khác
                                    </p>
                                )}
                            </div>
                        </div>

                        {/* Card Footer */}
                        <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/40 flex items-center justify-between">
                            <div className="flex items-center gap-1.5 text-[12px] text-slate-500">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                                <span>Đang hoạt động</span>
                            </div>
                            <button
                                onClick={() => setContactUser(user)}
                                className="text-[12px] font-semibold text-indigo-500 hover:text-indigo-700 transition-colors"
                            >
                                Liên hệ ngay →
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            {/* ── Contact Modal ── */}
            {contactUser && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-md p-4"
                    onClick={() => setContactUser(null)}
                >
                    <div
                        className="bg-white w-full max-w-sm rounded-3xl shadow-2xl overflow-hidden"
                        onClick={e => e.stopPropagation()}
                    >
                        {/* ── Profile Header ── */}
                        <div className="bg-gradient-to-br from-slate-800 to-slate-900 px-6 pt-6 pb-8">
                            {/* Top row: close button */}
                            <div className="flex justify-end mb-4">
                                <button
                                    onClick={() => setContactUser(null)}
                                    className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white transition-all"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>

                            {/* Avatar + Name row */}
                            <div className="flex items-center gap-4">
                                <div className={`w-14 h-14 shrink-0 rounded-2xl bg-gradient-to-br ${getAvatarGradient(contactUser.full_name)} flex items-center justify-center text-2xl font-bold text-white shadow-lg`}>
                                    {contactUser.full_name?.charAt(0).toUpperCase()}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h2 className="text-[17px] font-bold text-white truncate">{contactUser.full_name}</h2>
                                    <div className="flex items-center gap-2 mt-1">
                                        <span className="px-2 py-0.5 rounded-md bg-indigo-500/30 text-indigo-200 text-[10px] font-bold uppercase tracking-wider">
                                            {contactUser.role}
                                        </span>
                                        <span className="flex items-center gap-1 text-emerald-400 text-[11px] font-semibold">
                                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                            Active
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* ── Widget Grid ── */}
                        <div className="grid grid-cols-2 gap-3 px-6 -mt-4">
                            {/* Projects widget */}
                            <div className="bg-white rounded-2xl border border-slate-100 shadow-md p-4 flex items-center gap-3">
                                <div className="w-9 h-9 rounded-xl bg-blue-50/80 flex items-center justify-center shrink-0 p-1.5">
                                    <CloudApiIcon className="w-full h-full" />
                                </div>
                                <div>
                                    <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Dự án</p>
                                    <p className="text-lg font-extrabold text-slate-800 leading-tight">{contactUser.assigned_projects?.length || 0}</p>
                                </div>
                            </div>
                            {/* Location widget */}
                            <div className="bg-white rounded-2xl border border-slate-100 shadow-md p-4 flex items-center gap-3">
                                <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
                                    <MapPin className="w-4 h-4 text-blue-500" />
                                </div>
                                <div>
                                    <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Vị trí</p>
                                    <p className="text-sm font-bold text-slate-700 leading-tight">Tp. HCM</p>
                                </div>
                            </div>
                        </div>

                        {/* ── Contact Info ── */}
                        <div className="px-6 py-5 space-y-2">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-3">Thông tin liên lạc</p>

                            {/* Email */}
                            <button
                                onClick={() => window.open(`https://mail.google.com/mail/?view=cm&fs=1&to=${contactUser.email}`, '_blank')}
                                className="w-full flex items-center gap-3 p-3 rounded-xl bg-slate-50 hover:bg-blue-50 border border-transparent hover:border-blue-100 transition-all text-left group"
                            >
                                <div className="w-9 h-9 shrink-0 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center">
                                    <Mail className="w-4 h-4" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Email</p>
                                    <p className="text-sm font-semibold text-slate-700 truncate">{contactUser.email}</p>
                                </div>
                                <ArrowUpRight className="w-4 h-4 text-slate-300 group-hover:text-blue-500 transition-colors shrink-0" />
                            </button>

                            {/* Phone */}
                            <button
                                onClick={() => window.open(`https://zalo.me/${contactUser.number_phone || '0909123456'}`, '_blank')}
                                className="w-full flex items-center gap-3 p-3 rounded-xl bg-slate-50 hover:bg-emerald-50 border border-transparent hover:border-emerald-100 transition-all text-left group"
                            >
                                <div className="w-9 h-9 shrink-0 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center">
                                    <Phone className="w-4 h-4" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Điện thoại</p>
                                    <p className="text-sm font-semibold text-slate-700">{contactUser.number_phone || 'Chưa cập nhật'}</p>
                                </div>
                                <span className="shrink-0 px-2 py-1 rounded-md bg-emerald-100 text-emerald-700 text-[10px] font-bold">ZL</span>
                            </button>
                        </div>

                        {/* ── Footer quick actions ── */}
                        <div className="flex gap-3 px-6 pb-6">
                            <button
                                onClick={() => window.open(`https://mail.google.com/mail/?view=cm&fs=1&to=${contactUser.email}`, '_blank')}
                                className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl transition-all shadow-md shadow-indigo-500/20"
                            >
                                <Mail className="w-4 h-4" /> Gửi Email
                            </button>
                            <button
                                onClick={() => window.open(`https://zalo.me/${contactUser.number_phone || '0909123456'}`, '_blank')}
                                className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-xl transition-all shadow-md shadow-emerald-500/20"
                            >
                                <Phone className="w-4 h-4" /> Zalo
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Add Personnel Modal ── */}
            <AddUserModal
                isOpen={showAddModal}
                onClose={() => setShowAddModal(false)}
                onSuccess={() => { fetchPersonnel(); }}
                forceLeaderId={currentManagerId}
            />

            {/* Confirm Delete Modal */}
            {
                showConfirm.show && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
                        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 border border-slate-100">
                            <h3 className="text-base font-bold mb-2 text-slate-800">Xác nhận hủy phân công</h3>
                            <p className="text-sm text-slate-500 mb-5">
                                Bạn có chắc muốn hủy phân công dự án <strong className="text-slate-700">"{showConfirm.projectName}"</strong>?
                            </p>
                            <div className="flex gap-3">
                                <button
                                    onClick={() => setShowConfirm({ show: false, assignId: '', userId: '', projectName: '' })}
                                    className="flex-1 px-4 py-2 bg-slate-100 rounded-xl text-slate-600 text-sm font-semibold hover:bg-slate-200 transition-colors"
                                >
                                    Hủy bỏ
                                </button>
                                <button
                                    onClick={confirmDelete}
                                    className="flex-1 px-4 py-2 bg-red-500 text-white rounded-xl text-sm font-semibold hover:bg-red-600 transition-colors"
                                >
                                    Xác nhận xóa
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }
        </div >
    );
};

export default PersonnelTab;
