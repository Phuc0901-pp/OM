import { useState, useEffect } from 'react';
import {
    Save, Check, Plus, X, ChevronRight, CheckCircle2,
    LayoutGrid, Calendar, Users, Zap, Layers, Search,
    AlertCircle, Briefcase, ChevronDown, Rocket,
    MoreHorizontal, Filter, ArrowRight
} from 'lucide-react';
import api from '../../../services/api';
import { motion, AnimatePresence } from 'framer-motion';
import GlassCard from '../../../components/common/GlassCard';
import PremiumButton from '../../../components/common/PremiumButton';
import ModernInput from '../../../components/common/ModernInput';

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

const ManagerAllocationPage = () => {
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

    // Creation States
    const [isAddingMain, setIsAddingMain] = useState(false);
    const [newMainName, setNewMainName] = useState("");
    const [addingChildFor, setAddingChildFor] = useState<string | null>(null);
    const [newChildName, setNewChildName] = useState("");

    // UI States
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [isProjectListExpanded, setIsProjectListExpanded] = useState(true);

    // --- Effects ---

    useEffect(() => {
        const fetchData = async () => {
            try {
                const storedUser = localStorage.getItem('user');
                const currentUser = storedUser ? JSON.parse(storedUser) : null;
                const currentUserId = currentUser?.id;

                const [projRes, classRes, mainRes] = await Promise.all([
                    api.get('/projects'),
                    api.get('/project-classification'),
                    api.get('/main-categories')
                ]);

                setProjects(projRes.data);
                setClassifications(classRes.data);
                setMainCategories(mainRes.data);

                if (currentUserId) {
                    try {
                        const userRes = await api.get(`/users/my-team?manager_id=${currentUserId}`);
                        setUsers((userRes.data || []).filter((u: User) => u.role === 'user'));
                    } catch (err) {
                        setUsers([]);
                    }
                }
            } catch (error) {
                console.error("Error fetching initial data", error);
            }
        };
        fetchData();
    }, []);

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

        // const checkProject = async () => {
        //     try {
        //         const res = await api.get(`/allocations/check/${selectedProject}`);
        //         // Notify if exists? Optional
        //     } catch (error) { }
        // };
        // checkProject();

        setIsProjectListExpanded(false);

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
                    }
                });

                setCharValues(newValues);
                setChildAreaNames(newAreaNames);
                setExpandedCategories(prev => ({ ...prev, ...newExpanded }));
                setSelectedMainCats(prev => ({ ...prev, ...newSelectedMain }));
                setSelectedChildCats(prev => ({ ...prev, ...newSelectedChild }));
                setQuantities(data);
            } catch (error) {
                setCharValues({});
                setQuantities({});
            }
        };
        fetchCharacteristics();
    }, [selectedProject, mainCategories, childCategoriesMap]);

    // --- Helpers ---

    const toSnakeCase = (str: string) => str.toLowerCase().trim().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');

    const handleCategoryExpand = (catId: string, expanded: boolean) => {
        setExpandedCategories(prev => ({ ...prev, [catId]: expanded }));
    };

    const toggleMainCat = (catId: string, checked: boolean) => {
        setSelectedMainCats(prev => ({ ...prev, [catId]: checked }));
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

    const handleAddMainCategory = async () => {
        if (!newMainName.trim()) return;
        try {
            const res = await api.post('/main-categories', { name: newMainName });
            setMainCategories([...mainCategories, res.data]);
            setNewMainName("");
            setIsAddingMain(false);
        } catch (error) { }
    };

    const handleAddChildCategory = async (mainId: string) => {
        if (!newChildName.trim()) return;
        try {
            const res = await api.post('/child-categories', { name: newChildName, main_category_id: mainId });
            setChildCategoriesMap(prev => ({
                ...prev,
                [mainId]: [...(prev[mainId] || []), res.data]
            }));
            setNewChildName("");
            setAddingChildFor(null);
        } catch (error) { }
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

        const payload = {
            user_ids: selectedUsers,
            id_project: selectedProject,
            id_project_classification: selectedClassification,
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
                                    <button onClick={() => setIsAddingMain(true)} className="flex items-center gap-1 text-xs font-bold text-white bg-emerald-500 hover:bg-emerald-600 px-3 py-1.5 rounded-lg transition-colors"><Plus className="w-3 h-3" /> Thêm</button>
                                </div>

                                {/* Stats & Inputs */}
                                <div className="grid grid-cols-2 gap-4 mb-6">
                                    <div className="bg-emerald-50/50 rounded-xl p-4 border border-emerald-100 flex flex-col items-center justify-center text-center">
                                        <span className="text-xs font-bold text-emerald-600 uppercase">Nhà Trạm</span>
                                        <span className="text-3xl font-black text-emerald-700">{quantities['inv_station'] || 0}</span>
                                    </div>
                                    <div className="bg-indigo-50/50 rounded-xl p-4 border border-indigo-100 flex flex-col items-center justify-center text-center">
                                        <span className="text-xs font-bold text-indigo-600 uppercase">Inverter</span>
                                        <span className="text-3xl font-black text-indigo-700">{quantities['inverter'] || 0}</span>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4 mb-6">
                                    {["Station", "Inverter"].map(label => (
                                        <div key={label} className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm">
                                            <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Nhập SL {label}</p>
                                            <input type="number" min="0" placeholder="0" className="w-full font-bold text-lg outline-none text-slate-800"
                                                onChange={(e) => {
                                                    const val = parseInt(e.target.value) || 0;
                                                    setQuantities(prev => {
                                                        const next = { ...prev };
                                                        mainCategories.forEach(cat => {
                                                            if ((label === "Inverter" && cat.name.toLowerCase().includes("inverter")) || (label === "Station" && !cat.name.toLowerCase().includes("inverter"))) {
                                                                next[toSnakeCase(cat.name)] = val;
                                                            }
                                                        });
                                                        return next;
                                                    });
                                                    setCharValues(prev => {
                                                        const next = { ...prev };
                                                        mainCategories.forEach(cat => {
                                                            const isInverter = cat.name.toLowerCase().includes("inverter");
                                                            if ((label === "Inverter" && isInverter) || (label === "Station" && !isInverter)) {
                                                                const children = childCategoriesMap[cat.id] || [];
                                                                children.forEach(child => next[child.id] = FIXED_QUANTITY_ITEMS.includes(child.name) ? "1" : String(val));
                                                            }
                                                        });
                                                        return next;
                                                    });
                                                    setSelectedMainCats(prev => {
                                                        const next = { ...prev };
                                                        mainCategories.forEach(cat => {
                                                            const isInverter = cat.name.toLowerCase().includes("inverter");
                                                            if ((label === "Inverter" && isInverter) || (label === "Station" && !isInverter)) next[cat.id] = true;
                                                        });
                                                        return next;
                                                    });
                                                }}
                                            />
                                        </div>
                                    ))}
                                </div>

                                {isAddingMain && (
                                    <div className="mb-4 flex items-center gap-2 p-2 bg-white border border-indigo-200 rounded-xl shadow-sm animate-in fade-in slide-in-from-top-2">
                                        <input autoFocus type="text" value={newMainName} onChange={e => setNewMainName(e.target.value)} placeholder="Tên hạng mục..." className="flex-1 bg-transparent outline-none text-sm font-medium" onKeyDown={e => e.key === 'Enter' && handleAddMainCategory()} />
                                        <button onClick={handleAddMainCategory} className="p-1.5 bg-emerald-500 text-white rounded-lg"><Check className="w-3 h-3" /></button>
                                        <button onClick={() => setIsAddingMain(false)} className="p-1.5 text-slate-400 hover:bg-slate-100 rounded-lg"><X className="w-3 h-3" /></button>
                                    </div>
                                )}

                                {/* Category List */}
                                <div className="flex-1 overflow-y-auto space-y-3 custom-scrollbar pr-1">
                                    {mainCategories.map(mainCat => {
                                        const isExpanded = expandedCategories[mainCat.id] || false;
                                        const isSelected = selectedMainCats[mainCat.id] || false;
                                        const children = childCategoriesMap[mainCat.id] || [];
                                        const quantity = quantities[toSnakeCase(mainCat.name)] || 0;

                                        return (
                                            <div key={mainCat.id} className={`border rounded-xl transition-all duration-300 overflow-hidden ${isSelected ? 'border-emerald-500/50 bg-emerald-50/10 shadow-sm' : 'border-slate-100 bg-white hover:border-slate-300'}`}>
                                                <div className="p-3 flex items-center">
                                                    <div onClick={(e) => { e.stopPropagation(); toggleMainCat(mainCat.id, !isSelected); }} className={`w-5 h-5 rounded border mr-3 flex items-center justify-center cursor-pointer transition-colors ${isSelected ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-slate-300 hover:border-emerald-400'}`}>
                                                        {isSelected && <Check className="w-3 h-3" />}
                                                    </div>
                                                    <div onClick={() => handleCategoryExpand(mainCat.id, !isExpanded)} className={`mr-2 cursor-pointer transition-transform duration-300 ${isExpanded ? 'rotate-90 text-slate-800' : 'text-slate-400'}`}><ChevronRight className="w-4 h-4" /></div>
                                                    <span onClick={() => handleCategoryExpand(mainCat.id, !isExpanded)} className="flex-1 font-bold text-sm text-slate-700 cursor-pointer">{mainCat.name}</span>

                                                    {isExpanded && <input type="number" className="w-10 bg-transparent text-right font-bold text-slate-800 text-sm outline-none mr-2" value={quantity || ''} placeholder="-" onChange={e => handleMainQuantityChange(mainCat, e.target.value)} />}
                                                    <button onClick={e => { e.stopPropagation(); setAddingChildFor(mainCat.id); }} className="text-slate-300 hover:text-emerald-500"><Plus className="w-4 h-4" /></button>
                                                </div>

                                                <AnimatePresence>
                                                    {isExpanded && (
                                                        <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="bg-slate-50 border-t border-slate-100 pl-11 pr-3 py-2 space-y-1">
                                                            {children.map(child => {
                                                                const isChildSelected = selectedChildCats[child.id] || false;
                                                                return (
                                                                    <div key={child.id} className="flex items-center justify-between py-1 group">
                                                                        <div className="flex items-center gap-2">
                                                                            <div onClick={() => toggleChildCat(child.id, mainCat.id, !isChildSelected)} className={`w-4 h-4 rounded border flex items-center justify-center cursor-pointer ${isChildSelected ? 'bg-emerald-500 border-emerald-500' : 'border-slate-300 hover:border-emerald-400 bg-white'}`}>{isChildSelected && <Check className="w-2.5 h-2.5 text-white" />}</div>
                                                                            <span className={`text-xs font-medium ${isChildSelected ? 'text-slate-800' : 'text-slate-500'}`}>{child.name}</span>
                                                                        </div>
                                                                        <div className="flex items-center">
                                                                            {childAreaNames[child.id] && <span className="text-[10px] text-slate-400 mr-2 italic font-medium">{childAreaNames[child.id]}</span>}
                                                                            <input
                                                                                disabled={(!isChildSelected && !selectedMainCats[mainCat.id]) || FIXED_QUANTITY_ITEMS.includes(child.name)}
                                                                                type="number"
                                                                                className={`w-12 text-right bg-transparent text-xs font-bold outline-none border-b border-transparent focus:border-emerald-300 ${(!isChildSelected && !selectedMainCats[mainCat.id]) ? 'opacity-30' : ''}`}
                                                                                value={FIXED_QUANTITY_ITEMS.includes(child.name) ? "1" : (charValues[child.id] || '')}
                                                                                onChange={e => handleCharChange(child.id, e.target.value)}
                                                                            />
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })}
                                                            {addingChildFor === mainCat.id && (
                                                                <div className="flex items-center gap-2 py-1 animate-in fade-in">
                                                                    <div className="w-1 h-1 bg-emerald-400 rounded-full"></div>
                                                                    <input autoFocus type="text" value={newChildName} onChange={e => setNewChildName(e.target.value)} placeholder="Tên hoạt động..." className="flex-1 bg-transparent text-xs outline-none text-emerald-700" onKeyDown={e => e.key === 'Enter' && handleAddChildCategory(mainCat.id)} />
                                                                    <button onClick={() => handleAddChildCategory(mainCat.id)} className="text-[10px] bg-emerald-500 text-white px-2 py-0.5 rounded font-bold">Lưu</button>
                                                                </div>
                                                            )}
                                                        </motion.div>
                                                    )}
                                                </AnimatePresence>
                                            </div>
                                        );
                                    })}
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
                    </>
                )}
            </div>
        </div>
    );
};

export default ManagerAllocationPage;
