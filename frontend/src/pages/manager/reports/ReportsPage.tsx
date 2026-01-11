import React, { useEffect, useState, useRef, useMemo, lazy, Suspense } from 'react';
import api from '../../../services/api';
import {
    FileText,
    Printer,
    File
} from 'lucide-react';
import TaskCard from './components/TaskCard';
import { CompletedTask, GroupedTasks } from '../../../types/reports';

// Lazy load libraries to reduce bundle size
// Note: Dynamic imports usually work better inside the handler, but lazy is good for components.
// For plain functions like html2canvas, we import them dynamically inside the function.

const ReportsPage = () => {
    const [completedTasks, setCompletedTasks] = useState<CompletedTask[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState({
        project: '',
        user: '',
        category: ''
    });

    // Pagination State
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);
    const LIMIT = 50;

    // Dropdown Data
    const [projects, setProjects] = useState<any[]>([]); // simplified type
    const [users, setUsers] = useState<any[]>([]);
    const [exporting, setExporting] = useState(false);
    const reportRef = useRef<HTMLDivElement>(null);

    // Initial Load - Metadata
    useEffect(() => {
        const fetchMeta = async () => {
            try {
                const [pRes, uRes] = await Promise.all([
                    api.get('/projects'),
                    api.get('/users')
                ]);
                setProjects(pRes.data || []);
                setUsers(uRes.data || []);
            } catch (err) { console.error("Failed to fetch meta", err); }
        };
        fetchMeta();
    }, []);

    // Filter Change -> Reset Page and Fetch
    useEffect(() => {
        setPage(1);
        fetchCompletedTasks(1, true);
    }, [filter.project, filter.user]);

    // Page Change -> Fetch Append
    useEffect(() => {
        if (page > 1) fetchCompletedTasks(page, false);
    }, [page]);

    const fetchCompletedTasks = async (pageNum: number, reset: boolean) => {
        setLoading(true);
        try {
            const params: any = {
                page: pageNum,
                limit: LIMIT
            };

            if (filter.project) params.project_id = filter.project;
            if (filter.user) params.user_id = filter.user;

            const response = await api.get('/manager/completed-tasks', { params });
            const newData = response.data || [];

            if (newData.length < LIMIT) setHasMore(false);
            else setHasMore(true);

            setCompletedTasks(prev => reset ? newData : [...prev, ...newData]);
        } catch (error) {
            console.error("Failed to fetch completed tasks", error);
        } finally {
            setLoading(false);
        }
    };

    const handleExportPDF = async () => {
        if (!reportRef.current) return;
        setExporting(true);

        // Hide elements that shouldn't appear in PDF
        const exportBtn = document.getElementById('export-btn');
        const reportFilters = document.getElementById('report-filters');

        if (exportBtn) exportBtn.style.display = 'none';
        if (reportFilters) reportFilters.style.display = 'none';

        try {
            // Dynamic Imports for Lazy Loading
            const html2canvas = (await import('html2canvas')).default;
            const jsPDF = (await import('jspdf')).default;

            const canvas = await html2canvas(reportRef.current, {
                useCORS: true,
                allowTaint: true
            });

            const imgData = canvas.toDataURL('image/png');

            const pdfWidth = 210; // A4 width
            const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

            const pdf = new jsPDF('p', 'mm', [pdfWidth, pdfHeight]);
            pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);

            const dateStr = new Date().toISOString().split('T')[0];
            const projectSuffix = filter.project ? `-${filter.project}` : '';
            pdf.save(`bao-cao-cong-viec${projectSuffix}-${dateStr}.pdf`);
        } catch (err) {
            console.error("PDF Export failed", err);
            alert("Xuất PDF thất bại. Vui lòng kiểm tra lại console.");
        } finally {
            // Restore hidden elements
            if (exportBtn) exportBtn.style.display = '';
            if (reportFilters) reportFilters.style.display = '';
            setExporting(false);
        }
    };

    // Memoized Filtering
    const filteredTasks = useMemo(() => {
        return completedTasks.filter(task => {
            if (filter.category && task.main_category !== filter.category) return false;
            return true;
        });
    }, [completedTasks, filter.category]);

    // Memoized Grouping
    const groupedTasks = useMemo(() => {
        const groups: GroupedTasks = {};
        filteredTasks.forEach(task => {
            const mainCat = task.main_category || 'Khác';
            const childCat = task.child_category || 'Chung';

            if (!groups[mainCat]) {
                groups[mainCat] = {};
            }
            if (!groups[mainCat][childCat]) {
                groups[mainCat][childCat] = [];
            }
            groups[mainCat][childCat].push(task);
        });
        return groups;
    }, [filteredTasks]);

    // Memoized Unique Categories
    const uniqueCategories = useMemo(() => {
        return [...new Set(completedTasks.map(t => t.main_category))];
    }, [completedTasks]);

    return (
        <div className="space-y-6 animate-fade-in pb-10">
            {/* Header & Export Actions */}
            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                        <FileText className="w-6 h-6 text-blue-600" />
                        Báo cáo công việc hoàn thành
                    </h2>
                    <p className="text-sm text-gray-500 mt-1">
                        {filter.project ? `Dự án: ${filter.project}` : 'Tất cả dự án'}
                    </p>
                </div>

                <button
                    id="export-btn"
                    onClick={handleExportPDF}
                    disabled={exporting}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 shadow-sm whitespace-nowrap font-medium"
                >
                    {exporting ? 'Đang xuất...' : 'Xuất PDF Report'}
                    <Printer className="w-4 h-4" />
                </button>
            </div>

            {/* Filters */}
            <div id="report-filters" className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase mb-2">Dự án</label>
                    <select
                        value={filter.project}
                        onChange={(e) => setFilter({ ...filter, project: e.target.value })}
                        className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                    >
                        <option value="">Tất cả dự án</option>
                        {projects.map(p => <option key={p.id} value={p.id}>{p.project_name}</option>)}
                    </select>
                </div>
                <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase mb-2">Nhân sự</label>
                    <select
                        value={filter.user}
                        onChange={(e) => setFilter({ ...filter, user: e.target.value })}
                        className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                    >
                        <option value="">Tất cả nhân sự</option>
                        {users.map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}
                    </select>
                </div>
                <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase mb-2">Hạng mục (filter trang hiện tại)</label>
                    <select
                        value={filter.category}
                        onChange={(e) => setFilter({ ...filter, category: e.target.value })}
                        className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                    >
                        <option value="">Tất cả hạng mục</option>
                        {uniqueCategories.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                </div>
            </div>

            {/* MAIN REPORT CONTENT WRAPPER */}
            <div ref={reportRef} className="bg-white min-h-[500px] p-8 rounded-none md:rounded-2xl shadow-sm border border-gray-100">

                {/* PDF Header Info */}
                <div className="border-b border-gray-200 pb-6 mb-8">
                    <div className="flex justify-between items-end">
                        <div>
                            <h1 className="text-3xl font-bold text-gray-900 uppercase tracking-tight">BÁO CÁO NGHIỆM THU CÔNG VIỆC</h1>
                            <div className="mt-4 space-y-1 text-sm text-gray-600">
                                <p><span className="font-semibold w-24 inline-block">Dự án:</span> {filter.project || 'Tất cả'}</p>
                                <p><span className="font-semibold w-24 inline-block">Nhân sự:</span> {filter.user || 'Tất cả'}</p>
                                <p><span className="font-semibold w-24 inline-block">Ngày xuất:</span> {new Date().toLocaleDateString('vi-VN')}</p>
                            </div>
                        </div>
                        <div className="text-right">
                            <div className="bg-green-50 text-green-700 px-4 py-2 rounded-lg border border-green-100">
                                <span className="block text-xs font-semibold uppercase opacity-75">Tổng hoàn thành</span>
                                <span className="text-2xl font-bold">{filteredTasks.length}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {Object.keys(groupedTasks).length === 0 ? (
                    <div className="text-center py-20 text-gray-400">
                        <File className="w-16 h-16 mx-auto mb-4 opacity-20" />
                        <p>Không có dữ liệu báo cáo phù hợp</p>
                    </div>
                ) : (
                    <div className="space-y-10">
                        {Object.entries(groupedTasks).map(([mainCat, childrenMap]) => (
                            <div key={mainCat} className="category-section">
                                {/* MAIN CATEGORY HEADER */}
                                <div className="flex items-center gap-3 mb-6 border-l-4 border-blue-600 pl-4 py-1">
                                    <h2 className="text-xl font-bold text-gray-800 uppercase tracking-wide">{mainCat}</h2>
                                    <span className="bg-blue-100 text-blue-800 text-xs px-2 py-0.5 rounded-full font-medium">
                                        {Object.values(childrenMap).reduce((acc, curr) => acc + curr.length, 0)} Items
                                    </span>
                                </div>

                                <div className="space-y-8 pl-5">
                                    {Object.entries(childrenMap).map(([childCat, tasks]) => (
                                        <div key={childCat} className="child-section relative">
                                            {/* Vertical Line Connector */}
                                            <div className="absolute left-[-20px] top-[24px] bottom-0 w-[2px] bg-gray-100"></div>

                                            {/* CHILD CATEGORY HEADER */}
                                            <div className="flex items-center gap-2 mb-4">
                                                <div className="w-3 h-3 bg-gray-300 rounded-full absolute left-[-25px] border-2 border-white ring-1 ring-gray-100"></div>
                                                <h3 className="text-lg font-bold text-gray-700">{childCat}</h3>
                                            </div>

                                            {/* TASKS LIST GRID */}
                                            <div className="grid grid-cols-1 gap-6">
                                                {tasks.map((task, idx) => (
                                                    <TaskCard key={task.id} task={task} index={idx} />
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
            {/* Pagination Controls */}
            {hasMore && !loading && (
                <div className="flex justify-center pt-6">
                    <button
                        onClick={() => setPage(p => p + 1)}
                        className="px-6 py-2 bg-white border border-gray-300 rounded-full text-gray-600 font-medium hover:bg-gray-50 shadow-sm transition-all"
                    >
                        Tải thêm nhiệm vụ cũ hơn...
                    </button>
                </div>
            )}
            {loading && <div className="text-center py-4 text-gray-500">Đang tải...</div>}
        </div>
    );
};

export default ReportsPage;
