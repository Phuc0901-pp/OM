import React, { useEffect, useState } from 'react';
import api from '../../../services/api';
import { Plus, Trash2, Folder, FolderOpen, ChevronRight, Edit2, Pencil, Check, X } from 'lucide-react';
import ConfirmModal from '../../../components/ConfirmModal';
import GlassCard from '../../../components/common/GlassCard';
import PremiumButton from '../../../components/common/PremiumButton';
import { motion, AnimatePresence } from 'framer-motion';

interface MainCategory {
    id: string;
    name: string;
}

interface ChildCategory {
    id: string;
    name: string;
    main_category_id: string;
}

const CategoriesTab = () => {
    const [mainCategories, setMainCategories] = useState<MainCategory[]>([]);
    const [expandedMainId, setExpandedMainId] = useState<string | null>(null);
    const [childCategories, setChildCategories] = useState<ChildCategory[]>([]);
    const [loadingChild, setLoadingChild] = useState(false);

    // Modals & Inputs
    const [showAddMain, setShowAddMain] = useState(false);
    const [showAddChild, setShowAddChild] = useState<{ show: boolean, mainId: string | null }>({ show: false, mainId: null });

    // Edit State
    const [showEdit, setShowEdit] = useState<{ show: boolean, type: 'main' | 'child', id: string, name: string }>({ show: false, type: 'main', id: '', name: '' });

    const [newName, setNewName] = useState("");

    // Confirm Modal State
    const [confirmState, setConfirmState] = useState<{
        isOpen: boolean;
        title: string;
        message: string;
        onConfirm: () => void;
    }>({ isOpen: false, title: '', message: '', onConfirm: () => { } });

    useEffect(() => {
        fetchMainCategories();
    }, []);

    useEffect(() => {
        if (expandedMainId) {
            fetchChildCategories(expandedMainId);
        } else {
            setChildCategories([]);
        }
    }, [expandedMainId]);

    const fetchMainCategories = async () => {
        try {
            const res = await api.get('/main-categories');
            setMainCategories(res.data);
        } catch (error) { console.error(error); }
    };

    const fetchChildCategories = async (mainId: string) => {
        setLoadingChild(true);
        try {
            const res = await api.get(`/main-categories/${mainId}/children`);
            setChildCategories(res.data);
        } catch (error) { console.error(error); }
        finally { setLoadingChild(false); }
    };

    const handleCreateMain = async () => {
        if (!newName) return;
        try {
            await api.post('/main-categories', { name: newName });
            setNewName("");
            setShowAddMain(false);
            fetchMainCategories();
        } catch (error) { alert("Failed to create category"); }
    };

    const handleCreateChild = async () => {
        if (!newName || !showAddChild.mainId) return;
        try {
            await api.post('/child-categories', {
                name: newName,
                main_category_id: showAddChild.mainId
            });
            setNewName("");

            // Refresh logic
            if (expandedMainId === showAddChild.mainId) {
                fetchChildCategories(showAddChild.mainId);
            } else {
                setExpandedMainId(showAddChild.mainId);
            }
            setShowAddChild({ show: false, mainId: null });
        } catch (error) { alert("Failed to create sub-category"); }
    };

    const handleDeleteMain = (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        setConfirmState({
            isOpen: true,
            title: "Xóa danh mục chính",
            message: "Bạn có chắc chắn muốn xóa danh mục này? Tất cả danh mục con và công việc liên quan sẽ bị xóa vĩnh viễn.",
            onConfirm: async () => {
                try {
                    await api.delete(`/main-categories/${id}`);
                    if (expandedMainId === id) setExpandedMainId(null);
                    fetchMainCategories();
                } catch (error) { alert("Xóa thất bại"); }
            }
        });
    };

    const handleDeleteChild = (id: string) => {
        setConfirmState({
            isOpen: true,
            title: "Xóa danh mục phụ",
            message: "Bạn có chắc chắn muốn xóa danh mục phụ này không?",
            onConfirm: async () => {
                try {
                    await api.delete(`/child-categories/${id}`);
                    if (expandedMainId) fetchChildCategories(expandedMainId);
                } catch (error) { alert("Xóa thất bại"); }
            }
        });
    };

    const handleUpdate = async () => {
        if (!showEdit.name) return;
        try {
            const url = showEdit.type === 'main'
                ? `/main-categories/${showEdit.id}`
                : `/child-categories/${showEdit.id}`;

            await api.put(url, { name: showEdit.name });

            setShowEdit({ show: false, type: 'main', id: '', name: '' });

            // Refresh
            if (showEdit.type === 'main') {
                fetchMainCategories();
            } else {
                if (expandedMainId) fetchChildCategories(expandedMainId);
            }
        } catch (error: any) {
            const msg = error.response?.data?.error || "Failed to update category";
            alert(msg);
        }
    };

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header */}
            <GlassCard className="!p-4 flex justify-between items-center">
                <div>
                    <h2 className="text-lg font-bold text-slate-800">Phân cấp danh mục</h2>
                    <p className="text-sm text-slate-500">Quản lý cây danh mục công việc</p>
                </div>
                {showAddMain ? (
                    <div className="flex items-center gap-2 animate-fade-in">
                        <input
                            autoFocus
                            type="text"
                            placeholder="Tên danh mục mới..."
                            className="px-4 py-2 bg-white/50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-primary-500/20"
                            value={newName}
                            onChange={(e) => setNewName(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleCreateMain()}
                        />
                        <button onClick={handleCreateMain} className="p-2 bg-primary-600 text-white rounded-xl hover:bg-primary-700 transition-colors shadow-lg shadow-primary-500/20"><Check className="w-4 h-4" /></button>
                        <button onClick={() => { setShowAddMain(false); setNewName(""); }} className="p-2 bg-slate-100 text-slate-600 rounded-xl hover:bg-slate-200 transition-colors"><X className="w-4 h-4" /></button>
                    </div>
                ) : (
                    <PremiumButton
                        onClick={() => setShowAddMain(true)}
                        icon={<Plus className="w-4 h-4" />}
                    >
                        Thêm danh mục chính
                    </PremiumButton>
                )}
            </GlassCard>

            <div className="space-y-3">
                <AnimatePresence>
                    {mainCategories.map(main => (
                        <motion.div
                            key={main.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                        >
                            <div className={`
                                bg-white/70 backdrop-blur-md border rounded-xl overflow-hidden transition-all duration-300 shadow-sm hover:shadow-md
                                ${expandedMainId === main.id ? 'border-primary-200 ring-2 ring-primary-500/10' : 'border-white/40'}
                            `}>
                                {/* Main Category Row */}
                                <div
                                    className={`p-4 flex items-center justify-between cursor-pointer ${expandedMainId === main.id ? 'bg-primary-50/30' : 'hover:bg-white/50'}`}
                                    onClick={() => setExpandedMainId(expandedMainId === main.id ? null : main.id)}
                                >
                                    <div className="flex items-center gap-4">
                                        <motion.div
                                            animate={{ rotate: expandedMainId === main.id ? 90 : 0 }}
                                            transition={{ duration: 0.2 }}
                                        >
                                            <ChevronRight className={`w-5 h-5 ${expandedMainId === main.id ? 'text-primary-500' : 'text-slate-400'}`} />
                                        </motion.div>

                                        <div className={`p-2.5 rounded-xl ${expandedMainId === main.id ? 'bg-gradient-to-br from-primary-400 to-indigo-500 text-white shadow-lg shadow-primary-500/30' : 'bg-slate-100 text-slate-500'}`}>
                                            {expandedMainId === main.id ? <FolderOpen className="w-5 h-5" /> : <Folder className="w-5 h-5" />}
                                        </div>

                                        <span className={`font-semibold text-lg ${expandedMainId === main.id ? 'text-primary-900' : 'text-slate-700'}`}>{main.name}</span>
                                    </div>

                                    <div className="flex items-center gap-2 opacity-0 hover:opacity-100 transition-opacity">
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setShowEdit({ show: true, type: 'main', id: main.id, name: main.name });
                                            }}
                                            className="p-2 text-slate-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                                        >
                                            <Edit2 className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setShowAddChild({ show: true, mainId: main.id });
                                            }}
                                            className="p-2 text-primary-600 hover:bg-primary-50 rounded-lg transition-colors text-xs font-bold flex items-center gap-1 bg-primary-50/50"
                                        >
                                            <Plus className="w-3.5 h-3.5" /> Thêm phụ
                                        </button>
                                        <button
                                            onClick={(e) => handleDeleteMain(e, main.id)}
                                            className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>

                                {/* Child Categories List */}
                                <AnimatePresence>
                                    {expandedMainId === main.id && (
                                        <motion.div
                                            initial={{ height: 0, opacity: 0 }}
                                            animate={{ height: 'auto', opacity: 1 }}
                                            exit={{ height: 0, opacity: 0 }}
                                            transition={{ duration: 0.3 }}
                                            className="overflow-hidden"
                                        >
                                            <div className="bg-slate-50/50 border-t border-slate-100 p-4 pl-[4.5rem] pr-4 space-y-2">
                                                {showAddChild.mainId === main.id && showAddChild.show && (
                                                    <div className="flex items-center gap-2 mb-3 bg-white p-2 rounded-xl border border-primary-200 shadow-sm animate-slide-in">
                                                        <input
                                                            autoFocus
                                                            type="text"
                                                            placeholder="Tên danh mục phụ..."
                                                            className="flex-1 px-3 py-1.5 bg-transparent outline-none text-sm font-medium"
                                                            value={newName}
                                                            onChange={(e) => setNewName(e.target.value)}
                                                            onKeyDown={(e) => e.key === 'Enter' && handleCreateChild()}
                                                        />
                                                        <button onClick={handleCreateChild} className="p-1.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 shadow-md"><Check className="w-3.5 h-3.5" /></button>
                                                        <button onClick={() => { setShowAddChild({ show: false, mainId: null }); setNewName(""); }} className="p-1.5 text-slate-500 hover:bg-slate-100 rounded-lg"><X className="w-3.5 h-3.5" /></button>
                                                    </div>
                                                )}

                                                {loadingChild ? (
                                                    <div className="text-sm text-slate-400 italic">Đang tải danh mục phụ...</div>
                                                ) : childCategories.length === 0 ? (
                                                    <div className="text-sm text-slate-400 italic">Chưa có danh mục phụ.</div>
                                                ) : (
                                                    childCategories.map(child => (
                                                        <div key={child.id} className="flex items-center justify-between bg-white p-3 rounded-xl border border-slate-100 shadow-sm hover:border-primary-200 hover:shadow-md transition-all group">
                                                            <div className="flex items-center gap-3">
                                                                <div className="w-1.5 h-1.5 rounded-full bg-slate-300 group-hover:bg-primary-400 transition-colors"></div>
                                                                <span className="text-sm text-slate-700 font-medium group-hover:text-primary-700 transition-colors">{child.name}</span>
                                                            </div>
                                                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                <button
                                                                    onClick={() => setShowEdit({ show: true, type: 'child', id: child.id, name: child.name })}
                                                                    className="p-1.5 text-slate-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                                                                >
                                                                    <Pencil className="w-3.5 h-3.5" />
                                                                </button>
                                                                <button
                                                                    onClick={() => handleDeleteChild(child.id)}
                                                                    className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                                                >
                                                                    <Trash2 className="w-3.5 h-3.5" />
                                                                </button>
                                                            </div>
                                                        </div>
                                                    ))
                                                )}
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        </motion.div>
                    ))}
                </AnimatePresence>
            </div>

            {/* Edit Modal (Generic) */}
            {showEdit.show && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in">
                    <GlassCard className="w-full max-w-sm !p-0 overflow-hidden">
                        <div className="p-6 bg-white/90">
                            <h3 className="text-lg font-bold text-slate-800 mb-4">Chỉnh sửa danh mục</h3>
                            <input
                                autoFocus
                                type="text"
                                className="w-full px-4 py-2 border border-slate-200 rounded-xl mb-4 outline-none focus:ring-2 focus:ring-primary-100 focus:border-primary-400"
                                value={showEdit.name}
                                onChange={(e) => setShowEdit({ ...showEdit, name: e.target.value })}
                                onKeyDown={(e) => e.key === 'Enter' && handleUpdate()}
                            />
                            <div className="flex gap-3">
                                <PremiumButton variant="secondary" onClick={() => setShowEdit({ ...showEdit, show: false })} className="flex-1">Hủy</PremiumButton>
                                <PremiumButton onClick={handleUpdate} className="flex-1">Lưu</PremiumButton>
                            </div>
                        </div>
                    </GlassCard>
                </div>
            )}

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

export default CategoriesTab;
