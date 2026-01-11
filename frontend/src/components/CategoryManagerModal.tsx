
import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, Pencil, Save, Folder, FolderPlus, AlertCircle } from 'lucide-react';
import api from '../services/api';

interface MainCategory {
    id: string;
    name: string;
}

interface ChildCategory {
    id: string;
    name: string;
    main_category_id: string;
    requires_inverter?: boolean;
    column_key?: string;
}

interface CategoryManagerModalProps {
    isOpen: boolean;
    onClose: () => void;
    onChange: () => void; // Trigger refresh of parent data
}

const CategoryManagerModal: React.FC<CategoryManagerModalProps> = ({ isOpen, onClose, onChange }) => {
    const [mainCategories, setMainCategories] = useState<MainCategory[]>([]);
    const [selectedMain, setSelectedMain] = useState<MainCategory | null>(null);
    const [childCategories, setChildCategories] = useState<ChildCategory[]>([]);

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Edit/Add State
    const [editingItem, setEditingItem] = useState<{ id?: string, name: string, type: 'main' | 'child', requires_inverter?: boolean } | null>(null);

    useEffect(() => {
        if (isOpen) {
            fetchMainCategories();
        }
    }, [isOpen]);

    useEffect(() => {
        if (selectedMain) {
            fetchChildCategories(selectedMain.id);
        } else {
            setChildCategories([]);
        }
    }, [selectedMain]);

    const fetchMainCategories = async () => {
        try {
            const res = await api.get('/main-categories');
            setMainCategories(res.data);
        } catch (err) {
            console.error("Failed to fetch main categories", err);
        }
    };

    const fetchChildCategories = async (mainId: string) => {
        try {
            const res = await api.get(`/main-categories/${mainId}/children`);
            setChildCategories(res.data || []);
        } catch (err) {
            console.error("Failed to fetch child categories", err);
        }
    };

    const handleSave = async () => {
        if (!editingItem || !editingItem.name.trim()) return;

        try {
            setLoading(true);

            if (editingItem.type === 'main') {
                if (editingItem.id) {
                    // Update Main
                    await api.put(`/admin/tables/main_categories/${editingItem.id}`, { name: editingItem.name });
                } else {
                    // Create Main
                    await api.post('/main-categories', { name: editingItem.name });
                }
                fetchMainCategories();
            } else {
                if (editingItem.id) {
                    // Update Child - use new API with requires_inverter
                    await api.put(`/child-categories/${editingItem.id}`, {
                        name: editingItem.name,
                        requires_inverter: editingItem.requires_inverter ?? false
                    });
                } else {
                    // Create Child
                    if (!selectedMain) return;
                    await api.post('/child-categories', {
                        name: editingItem.name,
                        main_category_id: selectedMain.id,
                        requires_inverter: editingItem.requires_inverter ?? false
                    });
                }
                if (selectedMain) fetchChildCategories(selectedMain.id);
            }

            setEditingItem(null);
            onChange(); // Notify parent
        } catch (err: any) {
            console.error("Save failed", err);
            setError(err.response?.data?.error || "Failed to save category");
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id: string, type: 'main' | 'child') => {
        if (!window.confirm("Bạn có chắc chắn muốn xóa? Hành động này không thể hoàn tác và sẽ xóa tất cả dữ liệu liên quan!")) return;

        try {
            setLoading(true);
            if (type === 'main') {
                await api.delete(`/main-categories/${id}`);
                setMainCategories(prev => prev.filter(c => c.id !== id));
                if (selectedMain?.id === id) setSelectedMain(null);
            } else {
                await api.delete(`/child-categories/${id}`);
                setChildCategories(prev => prev.filter(c => c.id !== id));
            }
            onChange();
        } catch (err: any) {
            console.error("Delete failed", err);
            setError(err.response?.data?.error || "Failed to delete category");
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
            <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[85vh] shadow-2xl flex flex-col overflow-hidden">
                {/* Header */}
                <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                    <div className="flex items-center gap-2">
                        <Folder className="w-5 h-5 text-indigo-500" />
                        <h2 className="text-lg font-bold text-gray-800">Quản lý hạng mục</h2>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                        <X className="w-5 h-5 text-gray-500" />
                    </button>
                </div>

                <div className="flex-1 overflow-hidden grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-gray-100">

                    {/* Left: Main Categories */}
                    <div className="flex flex-col h-full bg-slate-50/50">
                        <div className="p-3 border-b flex justify-between items-center bg-white sticky top-0">
                            <h3 className="font-semibold text-gray-700">Hạng mục chính</h3>
                            <button
                                onClick={() => setEditingItem({ name: '', type: 'main' })}
                                className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 transition-colors flex items-center gap-1 text-sm font-medium"
                            >
                                <Plus className="w-4 h-4" /> Thêm
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-3 space-y-2">
                            {mainCategories.map(cat => (
                                <div
                                    key={cat.id}
                                    onClick={() => setSelectedMain(cat)}
                                    className={`p-3 rounded-xl border cursor-pointer transition-all flex justify-between items-center group
                                        ${selectedMain?.id === cat.id
                                            ? 'bg-white border-indigo-500 shadow-md ring-1 ring-indigo-500'
                                            : 'bg-white border-gray-200 hover:border-indigo-300 hover:shadow-sm'}
                                    `}
                                >
                                    <span className="font-medium text-gray-800">{cat.name}</span>
                                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button
                                            onClick={(e) => { e.stopPropagation(); setEditingItem({ id: cat.id, name: cat.name, type: 'main' }); }}
                                            className="p-1.5 hover:bg-amber-50 text-amber-500 rounded-lg"
                                        >
                                            <Pencil className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); handleDelete(cat.id, 'main'); }}
                                            className="p-1.5 hover:bg-red-50 text-red-500 rounded-lg"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Right: Child Categories */}
                    <div className="flex flex-col h-full bg-white">
                        <div className="p-3 border-b flex justify-between items-center bg-white sticky top-0">
                            <h3 className="font-semibold text-gray-700">
                                {selectedMain ? `Hạng mục phụ: ${selectedMain.name}` : 'Hạng mục phụ'}
                            </h3>
                            <button
                                disabled={!selectedMain}
                                onClick={() => selectedMain && setEditingItem({ name: '', type: 'child', requires_inverter: false })}
                                className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 transition-colors flex items-center gap-1 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <Plus className="w-4 h-4" /> Thêm
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-3 space-y-2">
                            {!selectedMain ? (
                                <div className="h-full flex flex-col items-center justify-center text-gray-400">
                                    <FolderPlus className="w-12 h-12 mb-2 opacity-50" />
                                    <p className="text-sm">Chọn hạng mục chính để xem chi tiết</p>
                                </div>
                            ) : childCategories.length === 0 ? (
                                <p className="text-center text-gray-400 text-sm mt-10 italic">Chưa có hạng mục phụ nào.</p>
                            ) : (
                                childCategories.map(child => (
                                    <div
                                        key={child.id}
                                        className="p-3 rounded-lg border border-gray-100 hover:border-indigo-100 hover:bg-indigo-50/30 transition-all flex justify-between items-center group"
                                    >
                                        <span className="text-gray-700">{child.name}</span>
                                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button
                                                onClick={() => setEditingItem({ id: child.id, name: child.name, type: 'child', requires_inverter: child.requires_inverter })}
                                                className="p-1.5 hover:bg-amber-50 text-amber-500 rounded-lg"
                                            >
                                                <Pencil className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(child.id, 'child')}
                                                className="p-1.5 hover:bg-red-50 text-red-500 rounded-lg"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>

                {/* Editor Modal Overlay */}
                {editingItem && (
                    <div className="absolute inset-0 z-10 bg-black/20 backdrop-blur-[1px] flex items-center justify-center p-4">
                        <div className="bg-white rounded-xl p-4 w-full max-w-sm shadow-xl animate-scale-up">
                            <h3 className="font-bold text-gray-800 mb-4">
                                {editingItem.id ? 'Sửa' : 'Thêm'} {editingItem.type === 'main' ? 'Hạng mục chính' : 'Hạng mục phụ'}
                            </h3>
                            <input
                                autoFocus
                                type="text"
                                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none mb-3"
                                placeholder="Nhập tên hạng mục..."
                                value={editingItem.name}
                                onChange={(e) => setEditingItem({ ...editingItem, name: e.target.value })}
                                onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                            />
                            {/* Requires Inverter Toggle - Only for Child Categories */}
                            {editingItem.type === 'child' && (
                                <label className="flex items-center gap-2 mb-4 cursor-pointer group">
                                    <input
                                        type="checkbox"
                                        checked={editingItem.requires_inverter ?? false}
                                        onChange={(e) => setEditingItem({ ...editingItem, requires_inverter: e.target.checked })}
                                        className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                                    />
                                    <span className="text-sm text-gray-700 group-hover:text-indigo-600 transition-colors">
                                        Yêu cầu chia Station/Inverter
                                    </span>
                                </label>
                            )}
                            <div className="flex justify-end gap-2">
                                <button
                                    onClick={() => setEditingItem(null)}
                                    className="px-3 py-1.5 text-gray-600 hover:bg-gray-100 rounded-lg text-sm font-medium"
                                >
                                    Hủy
                                </button>
                                <button
                                    onClick={handleSave}
                                    disabled={loading || !editingItem.name.trim()}
                                    className="px-3 py-1.5 bg-indigo-600 text-white hover:bg-indigo-700 rounded-lg text-sm font-medium flex items-center gap-1 disabled:opacity-50"
                                >
                                    <Save className="w-4 h-4" /> Lưu
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {error && (
                    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-red-100 border border-red-200 text-red-700 px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 text-sm animate-fade-in-up">
                        <AlertCircle className="w-4 h-4" />
                        {error}
                        <button onClick={() => setError(null)}><X className="w-3 h-3 ml-2" /></button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default CategoryManagerModal;
