import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import api from '../../../services/api';
import { ChevronLeft, Save, CheckCircle, ChevronDown, ChevronRight, Settings, FileText, Activity, CheckSquare, Square, MinusSquare } from 'lucide-react';
import PremiumButton from '../../../components/common/PremiumButton';
import GlassCard from '../../../components/common/GlassCard';
import ModernInput from '../../../components/common/ModernInput';

import CategoryManagerModal from '../../../components/CategoryManagerModal';
import EditProjectModal from '../../../components/modals/EditProjectModal';

interface MainCategory {
    id: string;
    name: string;
    children?: ChildCategory[];
}

interface ChildCategory {
    id: string;
    name: string;
    main_category_id: string;
    requires_inverter?: boolean;
    column_key?: string;
}

const ProjectSetupPage = () => {

    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const location = useLocation();

    const [showEditModal, setShowEditModal] = useState(false);

    const handleBack = () => {
        if (location.pathname.includes('/manager')) {
            navigate('/manager/management');
        } else {
            navigate('/admin/management');
        }
    };

    const handleEditProjectInfo = () => {
        if (location.pathname.includes('/manager')) {
            setShowEditModal(true);
        } else {
            navigate(`/admin/database?tab=projects&search=${id}`);
        }
    };

    const [project, setProject] = useState<any>(null);
    const [categories, setCategories] = useState<MainCategory[]>([]);
    const [loading, setLoading] = useState(true);

    // checklist state
    const [selectedCategoryIds, setSelectedCategoryIds] = useState<Set<string>>(new Set());

    // UI State
    const [expandedMain, setExpandedMain] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    // Modal State
    const [isManagerOpen, setIsManagerOpen] = useState(false);

    // Configuration State
    const [selectedChild, setSelectedChild] = useState<ChildCategory | null>(null);
    const [availableProcesses, setAvailableProcesses] = useState<any[]>([]);

    // Project Characteristics (for validation)
    const [projectCharacteristics, setProjectCharacteristics] = useState<Record<string, any>>({});

    // Form State for the selected child
    const [configForm, setConfigForm] = useState<{
        process_ids: string[]; // Changed to array for multi-select
        characteristics: Record<string, any>;
    }>({ process_ids: [], characteristics: {} });

    // NEW: Quantities are now stored per Child Category using column_key
    // Each child category has a `column_key` (e.g., "cleaning_pv_modules") which is used to store its count
    // All data is saved to `project_characteristics.child_category_data` as JSON

    // Helper to normalize category name to key (used for legacy support)
    const getMatchingKey = (name: string) => {
        return name.toLowerCase()
            .replace(/\s*&\s*/g, '_and_')
            .replace(/\s+/g, '_');
    };

    useEffect(() => {
        if (id) {
            fetchData();
            fetchProcesses();
            fetchSelectedCategories();
        }
    }, [id]);

    const fetchProcesses = async () => {
        try {
            // Fetch data from the dynamic 'process' table
            const res = await api.get('/admin/tables/process');
            // Check if res.data is array or wrapped
            setAvailableProcesses(Array.isArray(res.data) ? res.data : []);
        } catch (error) {
            console.error("Failed to fetch processes", error);
        }
    };

    const fetchSelectedCategories = async () => {
        if (!id) return;
        try {
            // Assuming endpoint exists to get all checklists for a project
            // If not specific endpoint, we might need to rely on what logic exists.
            // For now, I will try to call an endpoint I assume exists or should exist.
            // If I implemented the backend I would know, but I am just an agent.
            // Based on REST patterns: GET /projects/:id/checklists
            const res = await api.get(`/projects/${id}/checklists`);
            if (Array.isArray(res.data)) {
                const ids = res.data.map((item: any) => item.child_category_id);
                setSelectedCategoryIds(new Set(ids));
            }
        } catch (error) {
            console.warn("Could not fetch bulk checklists, maybe endpoint doesn't exist?", error);
        }
    };

    const handleSelectChild = async (child: ChildCategory) => {
        setSelectedChild(child);
        if (!child.column_key) return;

        // Load config for this child from the loaded characteristics (which contains the parsed JSON)
        // We use projectCharacteristics as source of truth for "last saved" state, 
        // OR we use configForm.characteristics as "current working" state if we want to preserve edits?
        // Let's use configForm.characteristics because fetchData populates it.

        const rawData = configForm.characteristics[child.column_key];

        let loadedConfig = {
            process_ids: [] as string[],
            area_name: "",
            note: "", // New Note field
            inverter: 0,
            inverter_sub_area_count: 0,
            inverter_details: null as any,
            quantity: 0
        };

        if (rawData) {
            if (typeof rawData === 'object') {
                // New nested structure (process_ids, area_name are local)
                loadedConfig = {
                    process_ids: Array.isArray(rawData.process_ids) ? rawData.process_ids : [],
                    area_name: rawData.area_name || "",
                    note: rawData.note || "", // Load note
                    inverter: 0, // Ignored from local (using global)
                    inverter_sub_area_count: 0, // Ignored from local
                    inverter_details: null, // Ignored from local
                    quantity: rawData.quantity || 0
                };
            } else {
                // Legacy
                loadedConfig.quantity = Number(rawData) || 0;
            }
        }

        // Update form state
        setConfigForm(prev => ({
            ...prev,
            process_ids: loadedConfig.process_ids,
            characteristics: {
                ...prev.characteristics,
                // LOCAL specific fields
                area_name: loadedConfig.area_name,
                note: loadedConfig.note, // Set note in form

                // GLOBAL Inverter fields (read directly from top-level characteristics state)
                inverter: prev.characteristics['inverter'],
                inverter_sub_area_count: prev.characteristics['inverter_sub_area_count'],
                inverter_details: prev.characteristics['inverter_details'],

                // Child quantity
                [child.column_key!]: loadedConfig.quantity
            }
        }));

        // Add to selected set if not already
        setSelectedCategoryIds(prev => new Set(prev).add(child.id));
    };

    const handleToggleCategory = async (childId: string, e: React.MouseEvent) => {
        e.stopPropagation(); // Prevent selecting the child for editing when just toggling checkbox
        if (!id) return;

        const isSelected = selectedCategoryIds.has(childId);

        try {
            if (isSelected) {
                // Remove checklist
                // Need to know checklist ID or use endpoint that deletes by project+child
                // Assuming DELETE /projects/:id/checklist/:childId works or similar
                await api.delete(`/projects/${id}/checklist/${childId}`);
                setSelectedCategoryIds(prev => {
                    const next = new Set(prev);
                    next.delete(childId);
                    return next;
                });
                if (selectedChild?.id === childId) {
                    // Maybe clear form or styling, but keeping it is fine
                }
            } else {
                // Add checklist (create default)
                const payload = {
                    project_id: id,
                    child_category_id: childId,
                    process_id: "",
                    characteristics: { process_ids: [] }
                };
                await api.post('/checklists', payload);
                setSelectedCategoryIds(prev => new Set(prev).add(childId));
            }
        } catch (err) {
            console.error("Failed to toggle category", err);
            alert("Không thể cập nhật trạng thái hạng mục.");
        }
    };

    const handleToggleMainCategory = async (main: MainCategory, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!id || !main.children || main.children.length === 0) return;

        const childrenIds = main.children.map(c => c.id);
        const selectedCount = childrenIds.filter(cid => selectedCategoryIds.has(cid)).length;
        const isAllSelected = selectedCount === childrenIds.length;

        try {
            if (isAllSelected) {
                // Deselect All
                // We need to remove each one. Ideally bulk API, but loop for now.
                // To avoid UI flicker, we optimistic update? or wait?
                // Sequential await might be slow. Parallel is better.
                await Promise.all(childrenIds.map(cid => {
                    if (selectedCategoryIds.has(cid)) {
                        return api.delete(`/projects/${id}/checklist/${cid}`).catch(e => console.warn(e));
                    }
                    return Promise.resolve();
                }));

                setSelectedCategoryIds(prev => {
                    const next = new Set(prev);
                    childrenIds.forEach(cid => next.delete(cid));
                    return next;
                });
            } else {
                // Select All (or remaining)
                const toAdd = childrenIds.filter(cid => !selectedCategoryIds.has(cid));
                await Promise.all(toAdd.map(cid => {
                    const payload = {
                        project_id: id,
                        child_category_id: cid,
                        process_id: "",
                        characteristics: { process_ids: [] }
                    };
                    return api.post('/checklists', payload).catch(e => console.warn(e));
                }));

                setSelectedCategoryIds(prev => {
                    const next = new Set(prev);
                    childrenIds.forEach(cid => next.add(cid));
                    return next;
                });
            }
        } catch (error) {
            console.error("Bulk toggle failed", error);
            alert("Thao tác hàng loạt thất bại một phần/toàn bộ.");
        }
    };

    const handleSaveConfig = async () => {
        if (!selectedChild || !id) return;

        try {
            // Build characteristics payload
            const charPayload: Record<string, any> = {};

            if (selectedChild.column_key) {
                // Construct the complex configuration object for this child category
                const childConfig: any = {
                    quantity: Number(configForm.characteristics[selectedChild.column_key]
                        ?? configForm.characteristics['child_quantity']
                        ?? 0),
                    process_ids: configForm.process_ids || [],
                    area_name: configForm.characteristics['area_name'] || '',
                    note: configForm.characteristics['note'] || '', // Save note
                };

                // Assign the config object to the child's column key
                charPayload[selectedChild.column_key] = childConfig;

                // GLOBAL INVERTER CONFIG (Restored)
                if (selectedChild.requires_inverter) {
                    if (configForm.characteristics['inverter'] !== undefined) {
                        charPayload['inverter'] = Number(configForm.characteristics['inverter']) || 0;
                    }
                    if (configForm.characteristics['inverter_details']) {
                        charPayload['inverter_details'] = configForm.characteristics['inverter_details'];
                    }
                    if (configForm.characteristics['inverter_sub_area_count']) {
                        charPayload['inverter_sub_area_count'] = configForm.characteristics['inverter_sub_area_count'];
                    }
                }
            }

            // Only update if there are values to save
            if (Object.keys(charPayload).length > 0) {
                await api.put(`/projects/${id}/characteristics`, charPayload);
            }

            setSelectedCategoryIds(prev => new Set(prev).add(selectedChild.id));
            alert("Đã lưu cấu hình thành công!");
        } catch (error) {
            console.error(error);
            alert("Lưu thất bại! Vui lòng thử lại.");
        }
    };

    const fetchData = async () => {
        if (!id) return;
        setLoading(true);
        setError(null);
        try {
            const [projRes, mainCatsRes] = await Promise.all([
                api.get(`/projects/${id}`),
                api.get('/main-categories')
            ]);

            if (!projRes.data) throw new Error("Project not found");
            setProject(projRes.data);

            // Fetch project characteristics for validation (e.g., total inverter count)
            try {
                const charRes = await api.get(`/projects/${id}/characteristics`);
                if (charRes.data) {
                    setProjectCharacteristics(charRes.data);

                    // ========== SYNC: Populate form from saved data ==========
                    const savedChar = charRes.data;
                    const loadedCharacteristics: Record<string, any> = {};

                    // Load child_category_data JSON
                    if (savedChar.child_category_data) {
                        const childData = typeof savedChar.child_category_data === 'string'
                            ? JSON.parse(savedChar.child_category_data)
                            : savedChar.child_category_data;
                        Object.assign(loadedCharacteristics, childData);
                    }

                    // Load inverter specific fields
                    // Load inverter specific fields (Global)
                    if (savedChar.inverter !== undefined) {
                        loadedCharacteristics['inverter'] = savedChar.inverter;
                    }
                    if (savedChar.inverter_sub_area_count) {
                        loadedCharacteristics['inverter_sub_area_count'] = savedChar.inverter_sub_area_count;
                    }
                    if (savedChar.inverter_details) {
                        const details = typeof savedChar.inverter_details === 'string'
                            ? JSON.parse(savedChar.inverter_details)
                            : savedChar.inverter_details;
                        loadedCharacteristics['inverter_details'] = details;
                    }
                    if (savedChar.area_name) {
                        loadedCharacteristics['area_name'] = savedChar.area_name;
                    }

                    // Load process_ids (array) from database
                    let processIds: string[] = [];
                    if (savedChar.process_ids) {
                        processIds = typeof savedChar.process_ids === 'string'
                            ? JSON.parse(savedChar.process_ids)
                            : savedChar.process_ids;
                    }

                    // Update configForm with loaded data (including process_ids)
                    setConfigForm(prev => ({
                        ...prev,
                        process_ids: Array.isArray(processIds) ? processIds : [],
                        characteristics: {
                            ...prev.characteristics,
                            ...loadedCharacteristics
                        }
                    }));
                    // ========== END SYNC ==========
                }
            } catch (charErr) {
                console.warn("Could not fetch project characteristics", charErr);
            }

            // Fetch children for each main category (or optimize with a single call if backend supports)
            const mainCats = mainCatsRes.data;
            if (Array.isArray(mainCats)) {
                const catsWithChildren = await Promise.all(mainCats.map(async (cat: MainCategory) => {
                    try {
                        const childRes = await api.get(`/main-categories/${cat.id}/children`);
                        return { ...cat, children: childRes.data };
                    } catch (e) {
                        return { ...cat, children: [] };
                    }
                }));
                setCategories(catsWithChildren);
                if (catsWithChildren.length > 0) {
                    setExpandedMain(catsWithChildren[0].id);
                }
            }
        } catch (error: any) {
            console.error("Failed to fetch setup data", error);
            setError(error.response?.data?.error || "Không thể tải dữ liệu dự án. Vui lòng thử lại.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-6 animate-fade-in pb-20">
            {/* Header */}
            <div className="flex items-center gap-4 bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                <button onClick={handleBack} className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 transition-colors">
                    <ChevronLeft className="w-5 h-5" />
                </button>
                <div>
                    <h1 className="text-xl font-bold text-slate-800">
                        {loading ? 'Đang tải...' : (project?.project_name || 'Không tìm thấy dự án')}
                    </h1>
                    <p className="text-sm text-slate-500">Cấu hình danh mục, quy trình và thông số.</p>
                </div>
                <div className="ml-auto flex gap-3">
                    <PremiumButton
                        variant="ghost"
                        onClick={handleEditProjectInfo}
                        icon={<Settings className="w-4 h-4" />}
                    >
                        Chỉnh sửa thông tin dự án
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

            {/* Content - Category Tree */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* Left: Main Categories List */}
                <div className="lg:col-span-1 space-y-4">
                    <div className="flex justify-between items-center px-2">
                        <h3 className="font-bold text-slate-700">Danh mục chính</h3>
                        <button
                            onClick={() => setIsManagerOpen(true)}
                            className="text-xs font-bold text-indigo-600 hover:bg-indigo-50 px-2 py-1 rounded transition-colors"
                        >
                            + Quản lý
                        </button>
                    </div>
                    {categories.map(cat => {
                        // Calculate Main Category selection state
                        const childrenIds = cat.children?.map(c => c.id) || [];
                        const selectedCount = childrenIds.filter(cid => selectedCategoryIds.has(cid)).length;
                        const isAllSelected = childrenIds.length > 0 && selectedCount === childrenIds.length;
                        const isSomeSelected = selectedCount > 0 && selectedCount < childrenIds.length;

                        return (
                            <div key={cat.id} className="space-y-2">
                                <div
                                    onClick={() => setExpandedMain(expandedMain === cat.id ? null : cat.id)}
                                    className={`p-4 rounded-xl border cursor-pointer transition-all flex justify-between items-center
                                    ${expandedMain === cat.id ? 'bg-indigo-50 border-indigo-200 shadow-sm' : 'bg-white border-slate-200 hover:border-indigo-200'}
                                `}
                                >
                                    <div className="flex items-center gap-3">
                                        <div
                                            onClick={(e) => handleToggleMainCategory(cat, e)}
                                            className="shrink-0 text-indigo-600 hover:scale-110 transition-transform"
                                        >
                                            {isAllSelected ? <CheckSquare className="w-5 h-5" /> :
                                                isSomeSelected ? <MinusSquare className="w-5 h-5" /> :
                                                    <Square className="w-5 h-5" />}
                                        </div>
                                        <span className="font-bold text-slate-800">{cat.name}</span>
                                    </div>
                                    {expandedMain === cat.id ? <ChevronDown className="w-4 h-4 text-indigo-500" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                                </div>

                                {/* Children List (Accordion) */}
                                {expandedMain === cat.id && (
                                    <div className="pl-4 space-y-2 animate-slide-in">
                                        {cat.children?.map(child => {
                                            const isChecked = selectedCategoryIds.has(child.id);
                                            return (
                                                <div
                                                    key={child.id}
                                                    onClick={() => handleSelectChild(child)}
                                                    className={`p-3 rounded-lg border shadow-sm cursor-pointer flex items-center justify-between group transition-all
                                                ${selectedChild?.id === child.id
                                                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-md ring-2 ring-indigo-200'
                                                            : 'bg-white border-slate-100 hover:border-indigo-100 text-slate-600'}
                                            `}
                                                >
                                                    <div className="flex items-center gap-3 overflow-hidden">
                                                        <div
                                                            onClick={(e) => handleToggleCategory(child.id, e)}
                                                            className={`shrink-0 transition-colors hover:scale-110
                                                        ${selectedChild?.id === child.id ? 'text-white' : 'text-indigo-600'}
                                                    `}
                                                        >
                                                            {isChecked ? <CheckSquare className="w-5 h-5" /> : <Square className="w-5 h-5" />}
                                                        </div>
                                                        <span className={`text-sm font-medium truncate ${selectedChild?.id === child.id ? 'text-white' : 'group-hover:text-indigo-600'}`}>
                                                            {child.name}
                                                        </span>
                                                    </div>

                                                    <ChevronRight className={`w-3 h-3 shrink-0 ${selectedChild?.id === child.id ? 'text-white' : 'text-slate-300 group-hover:text-indigo-400'}`} />
                                                </div>
                                            )
                                        })}
                                        {(!cat.children || cat.children.length === 0) && (
                                            <p className="text-xs text-slate-400 italic pl-2">Chưa có danh mục phụ</p>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>

                {/* Right: Configuration Panel */}
                <div className="lg:col-span-2">
                    {selectedChild ? (
                        <GlassCard className="h-full flex flex-col relative !p-0 overflow-hidden">
                            <div className="p-6 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
                                <div>
                                    <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                                        <Settings className="w-5 h-5 text-indigo-500" />
                                        Cấu hình: {selectedChild.name}
                                    </h2>
                                    <p className="text-xs text-slate-500">Thiết lập quy trình và thông số kỹ thuật cho hạng mục này.</p>
                                </div>
                                <PremiumButton size="sm" onClick={handleSaveConfig} icon={<Save className="w-4 h-4" />}>Lưu cấu hình</PremiumButton>
                            </div>

                            <div className="p-6 space-y-8 overflow-y-auto max-h-[600px] custom-scrollbar">
                                {/* 1. Process Selection */}
                                <div className="space-y-3">
                                    <div className="flex items-center gap-2 text-indigo-700 font-semibold border-b border-indigo-100 pb-2">
                                        <Activity className="w-4 h-4" />
                                        1. Quy trình làm việc (Process)
                                    </div>

                                    {availableProcesses.length > 0 ? (
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                            {availableProcesses.map((proc: any) => {
                                                const isSelected = configForm.process_ids.includes(proc.id);
                                                return (
                                                    <div
                                                        key={proc.id}
                                                        onClick={() => {
                                                            const currentIds = configForm.process_ids;
                                                            const newIds = isSelected
                                                                ? currentIds.filter(id => id !== proc.id)
                                                                : [...currentIds, proc.id];
                                                            setConfigForm({ ...configForm, process_ids: newIds });
                                                        }}
                                                        className={`p-4 rounded-xl border cursor-pointer transition-all flex items-start gap-3
                                                            ${isSelected
                                                                ? 'bg-indigo-50 border-indigo-500 ring-1 ring-indigo-500'
                                                                : 'bg-white border-slate-200 hover:border-indigo-300'}
                                                        `}
                                                    >
                                                        <div className={`mt-0.5 w-4 h-4 rounded appearance-none border flex items-center justify-center transition-all
                                                            ${isSelected ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-slate-300 bg-white'}
                                                        `}>
                                                            {isSelected && <CheckCircle className="w-3 h-3" />}
                                                        </div>
                                                        <div>
                                                            <div className="font-bold text-sm text-slate-800 mb-1">{proc.name || 'Unnamed Process'}</div>
                                                            <div className="text-xs text-slate-500 line-clamp-2">{proc.description || 'No description'}</div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    ) : (
                                        <div className="p-4 bg-orange-50 text-orange-600 rounded-lg text-sm border border-orange-100">
                                            Chưa có quy trình (Process) nào được tạo trong hệ thống.
                                            <br />Vui lòng vào <b>Database Inspector</b> để tạo dữ liệu cho bảng 'process'.
                                        </div>
                                    )}
                                </div>

                                {/* 2. Characteristics */}
                                <div className="space-y-3">
                                    <div className="flex items-center gap-2 text-indigo-700 font-semibold border-b border-indigo-100 pb-2">
                                        <FileText className="w-4 h-4" />
                                        2. Đặc điểm & Số lượng (Characteristics)
                                    </div>
                                    <p className="text-xs text-slate-500 mb-2">Nhập số lượng/thông số cho các hạng mục liên quan.</p>

                                    <div className="mb-4">
                                        <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Tên khu vực (Area Name)</label>
                                        <input
                                            type="text"
                                            placeholder="Ví dụ: Khu vực A, Mái Nhà Xưởng..."
                                            className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none transition-all"
                                            value={configForm.characteristics['area_name'] || ''}
                                            onChange={(e) => setConfigForm({
                                                ...configForm,
                                                characteristics: {
                                                    ...configForm.characteristics,
                                                    'area_name': e.target.value
                                                }
                                            })}
                                        />
                                    </div>

                                    <div className="mb-4">
                                        <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Chú thích (Note)</label>
                                        <textarea
                                            placeholder="Ghi chú tùy chọn cho hạng mục này..."
                                            className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none transition-all resize-none h-20"
                                            value={configForm.characteristics['note'] || ''}
                                            onChange={(e) => setConfigForm({
                                                ...configForm,
                                                characteristics: {
                                                    ...configForm.characteristics,
                                                    'note': e.target.value
                                                }
                                            })}
                                        />
                                    </div>

                                    {/* NEW: Simple quantity input for non-inverter categories */}
                                    {selectedChild && selectedChild.requires_inverter === false && selectedChild.column_key && (
                                        <div className="bg-emerald-50/50 p-4 rounded-xl border border-emerald-100 animate-fade-in">
                                            <label className="text-xs font-bold text-emerald-700 uppercase mb-2 block">
                                                Số lượng {selectedChild.name}
                                            </label>
                                            <input
                                                type="number"
                                                min="0"
                                                placeholder="0"
                                                className="w-full md:w-1/2 p-3 bg-white border border-emerald-200 rounded-lg text-lg font-semibold text-slate-700 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100 outline-none transition-all"
                                                value={configForm.characteristics[selectedChild.column_key] || ''}
                                                onChange={(e) => setConfigForm({
                                                    ...configForm,
                                                    characteristics: {
                                                        ...configForm.characteristics,
                                                        [selectedChild.column_key!]: parseInt(e.target.value) || 0
                                                    }
                                                })}
                                            />
                                            <p className="text-xs text-emerald-600 mt-2 italic">
                                                Giá trị này sẽ được lưu vào cột "{selectedChild.column_key}" trong bảng project_characteristics.
                                            </p>
                                        </div>
                                    )}

                                    {/* NEW: Automatic zone splitting for requires_inverter = true */}
                                    {selectedChild && selectedChild.requires_inverter === true && (() => {
                                        const inverterKey = 'inverter';
                                        const detailsKey = 'inverter_details';
                                        const areaName = configForm.characteristics['area_name'] || 'Khu vực';
                                        const subAreaCount = Number(configForm.characteristics['inverter_sub_area_count']) || 0;
                                        const totalInverterFromChild = Number(configForm.characteristics[inverterKey]) || 0;
                                        const totalInverterFromProject = Number(projectCharacteristics?.inverter) || 0;
                                        const isMismatch = totalInverterFromProject > 0 && totalInverterFromChild !== totalInverterFromProject;

                                        return (
                                            <div className="bg-indigo-50/50 p-6 rounded-xl border border-indigo-100 shadow-sm animate-fade-in space-y-6">
                                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                                    <div>
                                                        <label className="text-base font-bold text-indigo-800 flex items-center gap-2 mb-1">
                                                            <Activity className="w-5 h-5" />
                                                            Cấu hình chia khu vực Inverter
                                                        </label>
                                                        <p className="text-xs text-slate-500">
                                                            Nhập số lượng khu vực (nhà trạm) và số inverter cho mỗi khu vực.
                                                        </p>
                                                    </div>
                                                    {totalInverterFromProject > 0 && (
                                                        <div className="bg-white px-4 py-2 rounded-lg border border-indigo-200 text-sm">
                                                            <span className="text-slate-600">Tổng Inverter dự án: </span>
                                                            <span className="font-bold text-indigo-700">{totalInverterFromProject}</span>
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Zone Count Input */}
                                                <div className="bg-white p-4 rounded-lg border border-slate-200">
                                                    <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">
                                                        Số lượng khu vực (Nhà trạm) cho "{selectedChild.name}"
                                                    </label>
                                                    <div className="flex items-center gap-4">
                                                        <input
                                                            type="number"
                                                            min="1"
                                                            max="100"
                                                            placeholder="Ví dụ: 4"
                                                            className="w-full md:w-1/3 p-2 bg-slate-50 border border-indigo-200 rounded-lg text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none"
                                                            value={subAreaCount || ''}
                                                            onChange={(e) => {
                                                                const count = parseInt(e.target.value) || 0;
                                                                const currentDetails = (configForm.characteristics[detailsKey] as number[]) || [];
                                                                let newDetails = [...currentDetails];
                                                                if (count > currentDetails.length) {
                                                                    newDetails = [...newDetails, ...Array(count - currentDetails.length).fill(0)];
                                                                } else {
                                                                    newDetails = newDetails.slice(0, count);
                                                                }
                                                                const sum = newDetails.reduce((a, b) => a + b, 0);

                                                                // Update both inverter_sub_area_count AND the child's column_key
                                                                setConfigForm({
                                                                    ...configForm,
                                                                    characteristics: {
                                                                        ...configForm.characteristics,
                                                                        ['inverter_sub_area_count']: count,
                                                                        [detailsKey]: newDetails,
                                                                        [inverterKey]: sum,
                                                                        // ALSO save the zone count to child's column_key
                                                                        ...(selectedChild.column_key ? { [selectedChild.column_key]: count } : {})
                                                                    }
                                                                });
                                                            }}
                                                        />
                                                        <span className="text-sm text-slate-400 italic">Nhập số để tạo các ô bên dưới.</span>
                                                    </div>
                                                    <p className="text-xs text-indigo-600 mt-2">
                                                        Giá trị này sẽ lưu vào <b>{selectedChild.column_key}</b>: {subAreaCount} khu vực
                                                    </p>
                                                </div>

                                                {/* Zone Details Grid */}
                                                {subAreaCount > 0 && (
                                                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                                                        {Array.from({ length: subAreaCount }).map((_, idx) => (
                                                            <div key={idx} className="relative group">
                                                                <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block truncate pl-1" title={`${areaName} ${idx + 1}`}>
                                                                    {areaName} {idx + 1}
                                                                </label>
                                                                <input
                                                                    type="number"
                                                                    min="0"
                                                                    placeholder="0"
                                                                    className="w-full p-2 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-700 focus:border-indigo-500 focus:shadow-sm outline-none transition-all"
                                                                    value={((configForm.characteristics[detailsKey] as number[]) || [])[idx] || ''}
                                                                    onChange={(e) => {
                                                                        const val = parseInt(e.target.value) || 0;
                                                                        const details = [...((configForm.characteristics[detailsKey] as number[]) || [])];
                                                                        if (!details[idx]) details[idx] = 0;
                                                                        details[idx] = val;
                                                                        const sum = details.reduce((a, b) => a + b, 0);

                                                                        setConfigForm({
                                                                            ...configForm,
                                                                            characteristics: {
                                                                                ...configForm.characteristics,
                                                                                [detailsKey]: details,
                                                                                [inverterKey]: sum
                                                                            }
                                                                        });
                                                                    }}
                                                                />
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}

                                                {/* Total & Validation */}
                                                <div className={`flex justify-between items-center p-3 rounded-lg ${isMismatch ? 'bg-red-50 border border-red-200' : 'bg-indigo-100'}`}>
                                                    <span className={`text-sm font-bold ${isMismatch ? 'text-red-700' : 'text-indigo-800'}`}>
                                                        Tổng Inverter: {totalInverterFromChild}
                                                    </span>
                                                    {isMismatch && (
                                                        <span className="text-xs text-red-600 flex items-center gap-1">
                                                            ⚠️ Không khớp với tổng Inverter dự án ({totalInverterFromProject})
                                                        </span>
                                                    )}
                                                    {!isMismatch && totalInverterFromProject > 0 && (
                                                        <span className="text-xs text-green-600 flex items-center gap-1">
                                                            ✓ Khớp với tổng Inverter dự án
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })()}

                                    {/* Simple message when no special config needed */}
                                    {selectedChild && !selectedChild.requires_inverter && !selectedChild.column_key && (
                                        <div className="p-4 bg-slate-50 text-slate-500 rounded-lg text-sm italic border border-slate-100">
                                            Hạng mục này chưa có cấu hình số lượng. Vui lòng cập nhật <b>column_key</b> trong quản lý danh mục.
                                        </div>
                                    )}


                                </div>
                            </div>
                        </GlassCard>
                    ) : (
                        <GlassCard className="h-full min-h-[500px] flex items-center justify-center text-slate-400 flex-col gap-4">
                            <Settings className="w-12 h-12 opacity-50" />
                            <p>Chọn một danh mục phụ ở bên trái để bắt đầu cấu hình.</p>
                        </GlassCard>
                    )}
                </div>

            </div>

            <CategoryManagerModal
                isOpen={isManagerOpen}
                onClose={() => setIsManagerOpen(false)}
                onChange={() => fetchData()} // Refresh category list after changes
            />

            {/* Edit Project Modal */}
            <EditProjectModal
                isOpen={showEditModal}
                onClose={() => setShowEditModal(false)}
                onSuccess={() => fetchData()}
                project={project}
            />
        </div>
    );
};

export default ProjectSetupPage;
