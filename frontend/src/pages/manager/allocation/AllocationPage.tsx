import { useState, useEffect, useCallback } from 'react';
import useAutoRefresh from '../../../hooks/useAutoRefresh';
import {
    Save, Check, Plus, X, ChevronRight, CheckCircle2,
    LayoutGrid, Calendar, Users, Zap, Layers, Search,
    AlertCircle, Briefcase, ChevronDown, Rocket,
    MoreHorizontal, Filter, ArrowRight, HelpCircle
} from 'lucide-react';
import api from '../../../services/api';
import { motion, AnimatePresence } from 'framer-motion';
import GlassCard from '../../../components/common/GlassCard';
import PremiumButton from '../../../components/common/PremiumButton';
import ModernInput from '../../../components/common/ModernInput';
import VirtualCategoryList from './VirtualCategoryList';

const FIXED_QUANTITY_ITEMS = ["Utility Meter Reading", "Inspect for shattered solar panels"];

interface Option {
    id: string;
    name: string;
    label?: string;
}

interface User {
    id: string;
    full_name: string;
    role: string;
}

interface Project {
    project_id: string;
    project_name: string;
    location?: string;
}

interface Station {
    id: string;
    name: string;
    id_main_category: string;
    id_project: string;
    child_category_ids?: string[];
    child_configs?: StationChildConfig[];
}

interface StationChildConfig {
    id: string; // Required for Option B task details creation
    child_category_id: string;
    guide_text?: string;
    image_count?: number;
    process_ids?: string[];
    guide_images?: string[];
    project_classification_id?: string;
}

const ManagerAllocationPage = () => {
    // Get API base URL for proper image resolution (especially for tunnel access)
    const apiUrl = import.meta.env.VITE_API_URL || '';

    // Helper to resolve image URLs
    const getImageUrl = (img: string): string => {
        if (!img) return '';
        if (img.startsWith('http://') || img.startsWith('https://')) return img;

        const baseUrl = apiUrl.replace(/\/api$/, '');

        if (img.startsWith('/api')) {
            return baseUrl ? `${baseUrl}${img}` : img;
        }

        // Handle legacy URLs missing /api prefix
        if (img.startsWith('/media/')) {
            return baseUrl ? `${baseUrl}/api${img}` : `/api${img}`;
        }

        if (img.startsWith('/')) {
            return baseUrl ? `${baseUrl}${img}` : img;
        }
        return img;
    };
    // (End of helper)

    // Data States
    const [projects, setProjects] = useState<Project[]>([]);
    const [classifications, setClassifications] = useState<Option[]>([]);
    const [mainCategories, setMainCategories] = useState<Option[]>([]);
    const [users, setUsers] = useState<User[]>([]);

    // Selection States
    const [selectedProject, setSelectedProject] = useState('');
    const [selectedClassification, setSelectedClassification] = useState('');
    const [selectedUsers, setSelectedUsers] = useState<string[]>([]);

    // Timeline States
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [note, setNote] = useState('');

    // Characteristics & Scope
    const [charValues, setCharValues] = useState<Record<string, string>>({});
    const [quantities, setQuantities] = useState<Record<string, number>>({});
    const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});
    const [selectedMainCats, setSelectedMainCats] = useState<Record<string, boolean>>({});
    const [selectedChildCats, setSelectedChildCats] = useState<Record<string, boolean>>({});
    const [childCategoriesMap, setChildCategoriesMap] = useState<Record<string, any[]>>({});
    const [childAreaNames, setChildAreaNames] = useState<Record<string, string>>({}); // New State to store "Mái", "Nhà máy" etc.

    // Tracks which main categories are configured (qty > 0) for the selected project
    const [configuredMainCatIds, setConfiguredMainCatIds] = useState<Set<string>>(new Set());

    // Station State
    const [stationsMap, setStationsMap] = useState<Record<string, Station[]>>({});

    // Process Names Map (id -> name)
    const [processMap, setProcessMap] = useState<Record<string, string>>({});

    // Guide Popup State
    const [guidePopup, setGuidePopup] = useState<{ title: string, text: string, images: string[] } | null>(null);

    // UI States
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [isProjectListExpanded, setIsProjectListExpanded] = useState(true);

    // --- Effects ---

    const fetchData = useCallback(async () => {
        try {
            const storedUser = localStorage.getItem('user');
            const currentUser = storedUser ? JSON.parse(storedUser) : null;
            const currentUserId = currentUser?.id;

            const [projRes, classRes, mainRes, processRes] = await Promise.all([
                api.get('/projects'),
                api.get('/project-classification'),
                api.get('/main-categories'),
                api.get('/admin/tables/process').catch(() => ({ data: [] }))
            ]);

            setProjects(projRes.data);
            setClassifications(classRes.data);
            setMainCategories(mainRes.data);

            // Build process map (id -> name)
            const pMap: Record<string, string> = {};
            (processRes.data || []).forEach((p: { id: string, name?: string }) => {
                if (p.id) pMap[p.id] = p.name || 'Unknown';
            });
            setProcessMap(pMap);

            if (currentUserId) {
                try {
                    const userRes = await api.get(`/users/my-team?manager_id=${currentUserId}`);
                    setUsers((userRes.data || []).filter((u: User) => u.role === 'user'));
                } catch (err) {
                    setUsers([]);
                }
            }
        } catch (error) {
            console.error('Error fetching initial data', error);
        }
    }, []);

    // Mount: initial load  
    useEffect(() => { fetchData(); }, [fetchData]);

    // Auto-refresh: 5-min polling + instant refresh on any WebSocket event
    useAutoRefresh(fetchData, 5 * 60 * 1000, true, true);


    useEffect(() => {
        if (mainCategories.length === 0) return;
        const fetchAllChildren = async () => {
            const newMap: Record<string, any[]> = {};
            await Promise.all(mainCategories.map(async (cat) => {
                try {
                    const res = await api.get(`/main-categories/${cat.id}/children`);
                    newMap[cat.id] = res.data;
                } catch (err) {
                    newMap[cat.id] = [];
                }
            }));
            setChildCategoriesMap(newMap);
        };
        fetchAllChildren();
    }, [mainCategories]);

    useEffect(() => {
        if (!selectedProject) return;



        setIsProjectListExpanded(false);
        setConfiguredMainCatIds(new Set()); // Reset on project change

        if (mainCategories.length === 0 || Object.keys(childCategoriesMap).length === 0) return;

        const fetchCharacteristics = async () => {
            try {
                const res = await api.get(`/projects/${selectedProject}/characteristics`);
                const data = res.data;
                const newValues: Record<string, string> = {};
                const newExpanded: Record<string, boolean> = {};
                const newSelectedMain: Record<string, boolean> = {};
                const newSelectedChild: Record<string, boolean> = {};
                const newAreaNames: Record<string, string> = {}; // Extract Area Names
                const newConfiguredMain = new Set<string>(); // Track configured main cats

                // Parse child category data if available
                const childData = data.child_category_data || {};

                mainCategories.forEach(mainCat => {
                    const mainKey = toSnakeCase(mainCat.name);
                    const mainVal = data[mainKey];
                    const children = childCategoriesMap[mainCat.id] || [];
                    let hasActiveChild = false;

                    children.forEach(child => {
                        let finalQty = 0;

                        // 1. Check specific child data first (Primary Source)
                        if (child.column_key && childData[child.column_key]) {
                            const cData = childData[child.column_key];
                            if (cData.quantity) finalQty = cData.quantity;
                            if (cData.area_name) newAreaNames[child.id] = cData.area_name;
                        }
                        // 2. Fallback to Main Category value if specific is missing
                        else if (typeof mainVal === 'number' && mainVal > 0) {
                            finalQty = mainVal;
                        }

                        // 3. Fixed Items override
                        if (FIXED_QUANTITY_ITEMS.includes(child.name)) {
                            finalQty = 1;
                        }

                        if (finalQty > 0) {
                            newValues[child.id] = String(finalQty);
                            newSelectedChild[child.id] = true;
                            hasActiveChild = true;
                        }
                    });

                    // Expand if Main Value exists OR any child has data
                    if ((typeof mainVal === 'number' && mainVal > 0) || hasActiveChild) {
                        newExpanded[mainCat.id] = true;
                        newSelectedMain[mainCat.id] = true;
                        newConfiguredMain.add(mainCat.id); // Track it is configured
                    }
                });

                setCharValues(newValues);
                setChildAreaNames(newAreaNames);
                setExpandedCategories(prev => ({ ...prev, ...newExpanded }));
                setSelectedMainCats(prev => ({ ...prev, ...newSelectedMain }));
                setSelectedChildCats(prev => ({ ...prev, ...newSelectedChild }));
                setQuantities(data);
                setConfiguredMainCatIds(newConfiguredMain);
            } catch (error) {
                setCharValues({});
                setQuantities({});
            }
        };
        fetchCharacteristics();
    }, [selectedProject, mainCategories, childCategoriesMap]);

    // --- Helpers ---

    const toSnakeCase = (str: string) => str.toLowerCase().trim().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');

    const fetchStationsForMain = async (mainCategoryId: string) => {
        if (!selectedProject) return;
        try {
            const res = await api.get('/stations', {
                params: { main_category_id: mainCategoryId, project_id: selectedProject }
            });
            const stations: Station[] = Array.isArray(res.data) ? res.data : [];
            setStationsMap(prev => ({ ...prev, [mainCategoryId]: stations }));
        } catch (error) {
            console.error("Failed to fetch stations", error);
        }
    };

    useEffect(() => {
        if (!selectedProject || mainCategories.length === 0) return;
        mainCategories.forEach(cat => fetchStationsForMain(cat.id));
    }, [selectedProject, mainCategories]);

    const handleCategoryExpand = (catId: string, expanded: boolean) => {
        setExpandedCategories(prev => ({ ...prev, [catId]: expanded }));
    };

    const toggleMainCat = (catId: string, checked: boolean) => {
        setSelectedMainCats(prev => ({ ...prev, [catId]: checked }));

        // Auto-select/deselect all children
        const children = childCategoriesMap[catId] || [];
        setSelectedChildCats(prev => {
            const next = { ...prev };
            children.forEach(child => {
                next[child.id] = checked;
            });
            return next;
        });

        if (checked) {
            setExpandedCategories(prev => ({ ...prev, [catId]: true }));
        }
    };

    const toggleChildCat = (childId: string, mainId: string, checked: boolean) => {
        setSelectedChildCats(prev => ({ ...prev, [childId]: checked }));
        if (checked) {
            setSelectedMainCats(prev => ({ ...prev, [mainId]: true }));
            setExpandedCategories(prev => ({ ...prev, [mainId]: true }));
        }
    };

    const toggleStation = (station: Station, checked: boolean) => {
        const childIds = station.child_category_ids || [];
        setSelectedChildCats(prev => {
            const next = { ...prev };
            childIds.forEach(id => next[id] = checked);
            return next;
        });
        if (checked) {
            setSelectedMainCats(prev => ({ ...prev, [station.id_main_category]: true }));
            setExpandedCategories(prev => ({ ...prev, [station.id_main_category]: true }));
        }
    };

    const handleCharChange = (id: string, value: string) => {
        setCharValues(prev => ({ ...prev, [id]: value }));
    };

    const handleMainQuantityChange = (mainCat: Option, value: string) => {
        const numVal = parseInt(value) || 0;
        const mainKey = toSnakeCase(mainCat.name);
        setQuantities(prev => ({ ...prev, [mainKey]: numVal }));

        const children = childCategoriesMap[mainCat.id] || [];
        setCharValues(prev => {
            const next = { ...prev };
            children.forEach(child => {
                if (FIXED_QUANTITY_ITEMS.includes(child.name)) {
                    next[child.id] = "1";
                } else {
                    next[child.id] = String(numVal);
                }
            });
            return next;
        });
    };



    const handleSubmit = async () => {
        setLoading(true);
        if (!selectedProject || selectedUsers.length === 0 || !selectedClassification) {
            alert('Lỗi: Vui lòng chọn Dự án, Loại hình và Nhân sự.');
            setLoading(false);
            return;
        }

        const project = projects.find(p => p.project_id === selectedProject);
        const classification = classifications.find(c => c.id === selectedClassification);

        const mainCategoriesPayload = mainCategories
            .filter(mainCat => selectedMainCats[mainCat.id])
            .map(mainCat => {
                const children = childCategoriesMap[mainCat.id] || [];
                const childCatsPayload = children
                    .filter(child => selectedChildCats[child.id])
                    .map(child => ({
                        name: child.name,
                        id: child.id,
                        quantity: charValues[child.id] || "0"
                    }));
                const mainKey = toSnakeCase(mainCat.name);
                const num = quantities[mainKey] || 0;

                return {
                    name: mainCat.name,
                    id: mainCat.id,
                    num: String(num),
                    child_categories: childCatsPayload
                };
            });

        // Collect all station_child_config_ids for Option B task details creation
        const stationChildConfigIds: string[] = [];
        mainCategories
            .filter(mainCat => selectedMainCats[mainCat.id])
            .forEach(mainCat => {
                const stations = stationsMap[mainCat.id] || [];
                stations.forEach(station => {
                    (station.child_configs || []).forEach(config => {
                        // Only include configs that match selected classification and selected child categories
                        const matchesClassification = !selectedClassification ||
                            !config.project_classification_id ||
                            config.project_classification_id === selectedClassification;
                        const matchesChild = selectedChildCats[config.child_category_id];

                        if (matchesClassification && matchesChild && config.id) {
                            stationChildConfigIds.push(config.id);
                        }
                    });
                });
            });

        const payload = {
            user_ids: selectedUsers,
            id_project: selectedProject,
            id_project_classification: selectedClassification,
            station_child_config_ids: stationChildConfigIds, // Option B: Pre-create task_details
            data_work: {
                timestamp: new Date().toISOString(),
                project: project?.project_name,
                project_id: selectedProject,
                project_classification: classification?.name,
                project_classification_id: selectedClassification,
                main_categories: mainCategoriesPayload
            },
            start_time: startDate ? new Date(startDate).toISOString() : null,
            end_time: endDate ? new Date(endDate).toISOString() : null,
            note: note
        };

        try {
            await api.post('/allocations', payload);
            alert('Triển khai thành công!');
            setCharValues({});
            setStartDate('');
            setEndDate('');
            setNote('');
        } catch (error: any) {
            alert(error.response?.data?.error || 'Triển khai thất bại');
        } finally {
            setLoading(false);
        }
    };

    const filteredProjects = projects.filter(p =>
        p.project_name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="p-4 md:p-8 space-y-8 pb-24">
            {/* Header */}
            <GlassCard className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                    <h1 className="text-3xl font-black text-slate-800 tracking-tight flex items-center gap-3">
                        <Briefcase className="w-8 h-8 text-indigo-600" />
                        Phân Bổ Công Việc
                    </h1>
                    <p className="text-slate-500 font-medium mt-1">Phân phối các công việc của dự án cho các nhân sự.</p>
                </div>
                <PremiumButton
                    onClick={handleSubmit}
                    loading={loading}
                    variant="primary"
                    icon={<Rocket className="w-5 h-5 mr-1" />}
                    size="lg"
                    className="shadow-xl shadow-indigo-200"
                >
                    Triển Khai Dự Án
                </PremiumButton>
            </GlassCard>

            <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">

                {/* LEFT COLUMN */}
                <div className="xl:col-span-4 space-y-6 sticky top-6">
                    {/* Project Selection */}
                    <GlassCard className="!p-0 overflow-hidden flex flex-col max-h-[600px]">
                        <div className="p-6 bg-white/40 border-b border-indigo-50/50">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                                    <Layers className="w-5 h-5 text-indigo-600" /> Thông Tin Dự Án
                                </h3>
                                {!isProjectListExpanded && selectedProject && (
                                    <button onClick={() => setIsProjectListExpanded(true)} className="text-xs font-bold text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-lg hover:bg-indigo-100 transition-colors">
                                        Chọn Lại
                                    </button>
                                )}
                            </div>
                            {isProjectListExpanded && (
                                <ModernInput
                                    placeholder="Tìm kiếm dự án..."
                                    value={searchTerm}
                                    onChange={e => setSearchTerm(e.target.value)}
                                    icon={<Search className="w-4 h-4" />}
                                    className="bg-white/60"
                                />
                            )}
                        </div>

                        {isProjectListExpanded ? (
                            <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar bg-slate-50/30">
                                {filteredProjects.map(p => (
                                    <div
                                        key={p.project_id}
                                        onClick={() => setSelectedProject(p.project_id)}
                                        className={`p-4 rounded-xl cursor-pointer transition-all border ${selectedProject === p.project_id ? 'bg-indigo-600 text-white border-indigo-600 shadow-lg shadow-indigo-200' : 'bg-white text-slate-600 border-white/50 hover:bg-indigo-50 hover:border-indigo-200'}`}
                                    >
                                        <div className="font-bold text-sm">{p.project_name}</div>
                                        {p.location && <div className={`text-xs mt-1 flex items-center gap-1 ${selectedProject === p.project_id ? 'text-indigo-200' : 'text-slate-400'}`}><LayoutGrid className="w-3 h-3" /> {p.location}</div>}
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="p-6 bg-gradient-to-br from-slate-900 to-slate-800 text-white relative overflow-hidden flex-1 flex flex-col justify-center items-center text-center">
                                <Briefcase className="w-24 h-24 absolute -right-6 -bottom-6 text-white/5 rotate-12" />
                                <h2 className="text-2xl font-bold mb-2 relative z-10">{projects.find(p => p.project_id === selectedProject)?.project_name}</h2>
                                <span className="px-3 py-1 bg-white/10 rounded-full text-xs font-bold border border-white/10 backdrop-blur-md relative z-10">
                                    {projects.find(p => p.project_id === selectedProject)?.location || 'Site'}
                                </span>
                            </div>
                        )}
                    </GlassCard>

                    {/* Parameters */}
                    <AnimatePresence>
                        {selectedProject && (
                            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }} className="space-y-6">
                                <GlassCard>
                                    <h4 className="text-sm font-bold text-slate-800 mb-4 uppercase tracking-wider">Loại Hình</h4>
                                    <div className="grid grid-cols-2 gap-3">
                                        {classifications.map(c => (
                                            <button
                                                key={c.id}
                                                onClick={() => setSelectedClassification(c.id)}
                                                className={`px-4 py-3 text-sm font-bold rounded-xl border transition-all ${selectedClassification === c.id ? 'bg-indigo-50 border-indigo-500 text-indigo-700' : 'bg-slate-50 border-transparent text-slate-500 hover:bg-white hover:border-slate-200'}`}
                                            >
                                                {c.name}
                                            </button>
                                        ))}
                                    </div>
                                </GlassCard>

                                <GlassCard>
                                    <h4 className="text-sm font-bold text-slate-800 mb-4 uppercase tracking-wider flex items-center gap-2"><Calendar className="w-4 h-4" /> Kế Hoạch</h4>
                                    <div className="grid grid-cols-2 gap-4 mb-4">
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-bold text-slate-400 uppercase">Bắt đầu</label>
                                            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold text-slate-700 outline-none focus:border-indigo-500" />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-bold text-slate-400 uppercase">Kết thúc</label>
                                            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold text-slate-700 outline-none focus:border-indigo-500" />
                                        </div>
                                    </div>
                                    <textarea value={note} onChange={e => setNote(e.target.value)} placeholder="Ghi chú thêm..." className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-indigo-500 h-24 resize-none" />
                                </GlassCard>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                {/* MIDDLE & RIGHT */}
                {selectedProject && (
                    <>
                        {/* Scope */}
                        <div className="xl:col-span-5 space-y-6">
                            <GlassCard className="min-h-[600px] flex flex-col">
                                <div className="flex items-center justify-between mb-6">
                                    <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2"><LayoutGrid className="w-5 h-5 text-emerald-600" /> Phạm Vi</h3>
                                </div>





                                {/* Category List - Virtual Scroll */}
                                <div className="flex-1">
                                    <VirtualCategoryList
                                        mainCategories={configuredMainCatIds.size > 0 ? mainCategories.filter(cat => configuredMainCatIds.has(cat.id)) : mainCategories}
                                        childCategoriesMap={childCategoriesMap}
                                        stationsMap={stationsMap}
                                        expandedCategories={expandedCategories}
                                        selectedMainCats={selectedMainCats}
                                        selectedChildCats={selectedChildCats}
                                        childAreaNames={childAreaNames}
                                        processMap={processMap}
                                        selectedClassification={selectedClassification}
                                        toggleMainCat={toggleMainCat}
                                        toggleChildCat={toggleChildCat}
                                        handleCategoryExpand={handleCategoryExpand}
                                        setSelectedChildCats={setSelectedChildCats}
                                        setGuidePopup={setGuidePopup}
                                        listHeight={540}
                                    />
                                </div>
                            </GlassCard>
                        </div>

                        {/* Team */}
                        <div className="xl:col-span-3 space-y-6">
                            <GlassCard className="h-full flex flex-col">
                                <div className="flex items-center justify-between mb-6">
                                    <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2"><Users className="w-5 h-5 text-indigo-600" /> Nhân Sự</h3>
                                    <span className="text-xs font-bold bg-indigo-100 text-indigo-600 px-2 py-1 rounded">{selectedUsers.length}</span>
                                </div>
                                <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                                    {users.map(u => {
                                        const isSelected = selectedUsers.includes(u.id);
                                        return (
                                            <div
                                                key={u.id}
                                                onClick={() => isSelected ? setSelectedUsers(selectedUsers.filter(id => id !== u.id)) : setSelectedUsers([...selectedUsers, u.id])}
                                                className={`p-3 rounded-xl cursor-pointer border transition-all flex items-center gap-3 ${isSelected ? 'bg-indigo-600 border-indigo-600 text-white shadow-md' : 'bg-white border-slate-100 hover:bg-slate-50'}`}
                                            >
                                                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${isSelected ? 'bg-white text-indigo-600' : 'bg-slate-100 text-slate-500'}`}>
                                                    {u.full_name.charAt(0)}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="text-sm font-bold truncate">{u.full_name}</div>
                                                    <div className={`text-[10px] uppercase font-bold ${isSelected ? 'text-indigo-200' : 'text-slate-400'}`}>{u.role}</div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </GlassCard>
                        </div>
                        {/* Guide Popup Modal */}
                        <AnimatePresence>
                            {guidePopup && (
                                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
                                    <motion.div
                                        initial={{ scale: 0.9, opacity: 0 }}
                                        animate={{ scale: 1, opacity: 1 }}
                                        exit={{ scale: 0.9, opacity: 0 }}
                                        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[85vh]"
                                    >
                                        <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                                            <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2">
                                                <HelpCircle className="w-5 h-5 text-indigo-600" />
                                                Hướng dẫn: {guidePopup.title}
                                            </h3>
                                            <button onClick={() => setGuidePopup(null)} className="p-2 hover:bg-slate-200 rounded-full text-slate-500 transition-colors">
                                                <X className="w-5 h-5" />
                                            </button>
                                        </div>
                                        <div className="p-6 overflow-y-auto custom-scrollbar flex-1 space-y-6">
                                            {guidePopup.text ? (
                                                <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100 text-slate-700 leading-relaxed whitespace-pre-line">
                                                    {guidePopup.text}
                                                </div>
                                            ) : (
                                                <p className="text-slate-400 italic text-center">Chua có hướng dẫn text.</p>
                                            )}

                                            {guidePopup.images && guidePopup.images.length > 0 && (
                                                <div className="space-y-3">
                                                    <h4 className="font-bold text-sm text-slate-700 uppercase tracking-wider">Hình ảnh mẫu ({guidePopup.images.length})</h4>
                                                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                                        {guidePopup.images.map((img, idx) => (
                                                            <div key={idx} className="group relative aspect-video rounded-lg overflow-hidden border border-slate-200 cursor-pointer shadow-sm hover:shadow-md transition-all" onClick={() => window.open(img, '_blank')}>
                                                                <img src={getImageUrl(img)} alt={`Guide ${idx}`} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                                                                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                                                                    <span className="bg-black/70 text-white text-xs px-2 py-1 rounded-full">Xem</span>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                        <div className="p-4 bg-slate-50 border-t border-slate-100 text-right">
                                            <PremiumButton onClick={() => setGuidePopup(null)} variant="primary" size="sm">Đóng</PremiumButton>
                                        </div>
                                    </motion.div>
                                </div>
                            )}
                        </AnimatePresence>
                    </>
                )}
            </div>
        </div>
    );
};

export default ManagerAllocationPage;
