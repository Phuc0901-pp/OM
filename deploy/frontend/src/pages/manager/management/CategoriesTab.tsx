import React, { useEffect, useState } from 'react';
import api from '../../../services/api';
import { Plus, Trash2, Folder, FolderOpen, ChevronRight, ChevronDown, Edit2, Pencil } from 'lucide-react';

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

    // Modals
    const [showAddMain, setShowAddMain] = useState(false);
    const [showAddChild, setShowAddChild] = useState<{ show: boolean, mainId: string | null }>({ show: false, mainId: null });

    // Edit State
    const [showEdit, setShowEdit] = useState<{ show: boolean, type: 'main' | 'child', id: string, name: string }>({ show: false, type: 'main', id: '', name: '' });

    // Confirm Delete State
    const [showConfirm, setShowConfirm] = useState<{ show: boolean, type: 'main' | 'child', id: string, name: string }>({ show: false, type: 'main', id: '', name: '' });

    const [newName, setNewName] = useState("");

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

    const handleDeleteMain = async (e: React.MouseEvent, id: string, name: string) => {
        e.stopPropagation();
        console.log("Delete main category clicked:", id);
        setShowConfirm({ show: true, type: 'main', id, name });
    };

    const confirmDelete = async () => {
        const { type, id } = showConfirm;
        setShowConfirm({ show: false, type: 'main', id: '', name: '' });

        try {
            console.log(`Sending DELETE request for ${type} category:`, id);
            if (type === 'main') {
                await api.delete(`/main-categories/${id}`);
                if (expandedMainId === id) setExpandedMainId(null);
                fetchMainCategories();
            } else {
                await api.delete(`/child-categories/${id}`);
                if (expandedMainId) fetchChildCategories(expandedMainId);
            }
        } catch (error) {
            console.error("Delete failed:", error);
            alert("Failed to delete");
        }
    };

    const handleDeleteChild = async (id: string, name: string) => {
        console.log("Delete child category clicked:", id);
        setShowConfirm({ show: true, type: 'child', id, name });
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
            {/* ... Header ... */}
            <div className="flex justify-between items-center">
                <h2 className="text-lg font-bold text-gray-800">Phân cấp danh mục</h2>
                <button
                    onClick={() => setShowAddMain(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors text-sm font-medium"
                >
                    <Plus className="w-4 h-4" /> Thêm danh mục chính
                </button>
            </div>

            <div className="space-y-3">
                {mainCategories.map(main => (
                    <div key={main.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden transition-all duration-200 shadow-sm hover:shadow-md">
                        {/* Main Category Header */}
                        <div
                            className={`p-4 flex items-center justify-between cursor-pointer ${expandedMainId === main.id ? 'bg-blue-50/50' : 'hover:bg-gray-50'}`}
                            onClick={() => setExpandedMainId(expandedMainId === main.id ? null : main.id)}
                        >
                            <div className="flex items-center gap-3">
                                {expandedMainId === main.id ? <ChevronDown className="w-5 h-5 text-blue-500" /> : <ChevronRight className="w-5 h-5 text-gray-400" />}
                                <div className={`p-2 rounded-lg ${expandedMainId === main.id ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-500'}`}>
                                    {expandedMainId === main.id ? <FolderOpen className="w-5 h-5" /> : <Folder className="w-5 h-5" />}
                                </div>
                                <span className={`font-medium ${expandedMainId === main.id ? 'text-blue-900' : 'text-gray-700'}`}>{main.name}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setShowEdit({ show: true, type: 'main', id: main.id, name: main.name });
                                    }}
                                    className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                >
                                    <Edit2 className="w-4 h-4" />
                                </button>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setShowAddChild({ show: true, mainId: main.id });
                                    }}
                                    className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors text-xs font-medium flex items-center gap-1"
                                >
                                    <Plus className="w-3 h-3" /> Thêm phụ
                                </button>
                                <button
                                    onClick={(e) => handleDeleteMain(e, main.id, main.name)}
                                    className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        </div>

                        {/* Child Categories List */}
                        {expandedMainId === main.id && (
                            <div className="bg-gray-50 border-t border-gray-100 p-4 pl-12 space-y-2">
                                {loadingChild ? (
                                    <div className="text-sm text-gray-400 italic pl-2">Đang tải danh mục phụ...</div>
                                ) : childCategories.length === 0 ? (
                                    <div className="text-sm text-gray-400 italic pl-2">Chưa có danh mục phụ.</div>
                                ) : (
                                    childCategories.map(child => (
                                        <div key={child.id} className="flex items-center justify-between bg-white p-3 rounded-lg border border-gray-100 group">
                                            <span className="text-sm text-gray-600 font-medium">{child.name}</span>
                                            <div className="flex items-center gap-1">
                                                <button
                                                    onClick={() => setShowEdit({ show: true, type: 'child', id: child.id, name: child.name })}
                                                    className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                                    title="Chỉnh sửa"
                                                >
                                                    <Pencil className="w-3.5 h-3.5" />
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteChild(child.id, child.name)}
                                                    className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                                    title="Xóa"
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {/* Modal for Add Main (Keep Existing) */}
            {showAddMain && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
                        <h3 className="text-lg font-bold mb-4">Danh mục chính mới</h3>
                        <input
                            autoFocus
                            type="text"
                            className="w-full px-4 py-2 border border-gray-200 rounded-xl mb-4 outline-none focus:ring-2 focus:ring-blue-100"
                            placeholder="vd: Điện"
                            value={newName}
                            onChange={(e) => setNewName(e.target.value)}
                        />
                        <div className="flex gap-3">
                            <button onClick={() => { setShowAddMain(false); setNewName(""); }} className="flex-1 px-4 py-2 bg-gray-100 rounded-xl text-gray-600 font-medium">Hủy</button>
                            <button onClick={handleCreateMain} className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-xl font-medium">Tạo</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal for Add Child (Keep Existing) */}
            {showAddChild.show && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
                        <h3 className="text-lg font-bold mb-4">Danh mục phụ mới</h3>
                        <input
                            autoFocus
                            type="text"
                            className="w-full px-4 py-2 border border-gray-200 rounded-xl mb-4 outline-none focus:ring-2 focus:ring-blue-100"
                            placeholder="vd: Biến tần"
                            value={newName}
                            onChange={(e) => setNewName(e.target.value)}
                        />
                        <div className="flex gap-3">
                            <button onClick={() => { setShowAddChild({ show: false, mainId: null }); setNewName(""); }} className="flex-1 px-4 py-2 bg-gray-100 rounded-xl text-gray-600 font-medium">Hủy</button>
                            <button onClick={handleCreateChild} className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-xl font-medium">Tạo</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit Modal */}
            {showEdit.show && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
                        <h3 className="text-lg font-bold mb-4">Chỉnh sửa danh mục {showEdit.type === 'main' ? 'Chính' : 'Phụ'}</h3>
                        <input
                            autoFocus
                            type="text"
                            className="w-full px-4 py-2 border border-gray-200 rounded-xl mb-4 outline-none focus:ring-2 focus:ring-blue-100"
                            value={showEdit.name}
                            onChange={(e) => setShowEdit({ ...showEdit, name: e.target.value })}
                        />
                        <div className="flex gap-3">
                            <button onClick={() => setShowEdit({ ...showEdit, show: false })} className="flex-1 px-4 py-2 bg-gray-100 rounded-xl text-gray-600 font-medium">Hủy</button>
                            <button onClick={handleUpdate} className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-xl font-medium">Lưu</button>
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
                            Bạn có chắc chắn muốn xóa {showConfirm.type === 'main' ? 'danh mục chính' : 'danh mục phụ'} <strong>"{showConfirm.name}"</strong>?
                            {showConfirm.type === 'main' && <span className="block mt-2 text-red-500 text-sm">⚠️ Tất cả danh mục phụ sẽ bị xóa!</span>}
                        </p>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowConfirm({ show: false, type: 'main', id: '', name: '' })}
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

export default CategoriesTab;
