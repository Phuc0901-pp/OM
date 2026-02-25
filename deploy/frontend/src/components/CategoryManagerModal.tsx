
import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { X, Plus, Trash2, Pencil, Save, Folder, FolderPlus, AlertCircle, CheckSquare, Square } from 'lucide-react';
import api from '../services/api';

interface MainCategory {
    id: string;
    name: string;
}

interface ChildCategory {
    id: string;
    name: string;
    main_category_id: string;
    station_id?: string; // New
    requires_inverter?: boolean;
    column_key?: string;
}

interface Station {
    id: string;
    name: string;
    main_category_id: string;
    child_category_ids?: string[]; // Selected child categories for this station
}

interface CategoryManagerModalProps {
    isOpen: boolean;
    onClose: () => void;
    onChange: () => void;
    projectId?: string;
}

const CategoryManagerModal: React.FC<CategoryManagerModalProps> = ({ isOpen, onClose, onChange, projectId }) => {
    const [mainCategories, setMainCategories] = useState<MainCategory[]>([]);
    const [selectedMain, setSelectedMain] = useState<MainCategory | null>(null);
    const [stations, setStations] = useState<Station[]>([]);
    const [selectedStation, setSelectedStation] = useState<Station | null>(null);
    const [childCategories, setChildCategories] = useState<ChildCategory[]>([]);

    // Track local changes for batch save
    const [localSelections, setLocalSelections] = useState<Set<string>>(new Set());
    const [hasChanges, setHasChanges] = useState(false);

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Edit/Add State
    const [editingItem, setEditingItem] = useState<{ id?: string, name: string, type: 'main' | 'station' | 'child', requires_inverter?: boolean } | null>(null);

    useEffect(() => {
        if (isOpen) {
            fetchMainCategories();
        }
    }, [isOpen]);

    useEffect(() => {
        if (selectedMain) {
            fetchStations(selectedMain.id);
            setSelectedStation(null); // Reset selection
            setChildCategories([]);
        } else {
            setStations([]);
            setChildCategories([]);
        }
    }, [selectedMain]);

    useEffect(() => {
        if (selectedStation && selectedMain) {
            // Fetch child categories by main_category_id (not station_id)
            fetchChildCategories(selectedMain.id);
        } else {
            setChildCategories([]);
        }
    }, [selectedStation]);

    // Initialize local selections from station's saved child_category_ids
    useEffect(() => {
        if (selectedStation) {
            // Use station's saved child_category_ids if available
            const savedIds = selectedStation.child_category_ids || [];
            setLocalSelections(new Set(savedIds));
            setHasChanges(false);
        }
    }, [selectedStation]);

    const fetchMainCategories = async () => {
        try {
            const res = await api.get('/main-categories');
            setMainCategories(res.data);
        } catch (err) {
            console.error("Failed to fetch main categories", err);
        }
    };

    const fetchStations = async (mainId: string) => {
        try {
            const params: any = { main_category_id: mainId };
            if (projectId) params.project_id = projectId;
            // Use generic search endpoint
            const res = await api.get(`/stations`, { params });
            setStations(res.data || []);
        } catch (err) {
            console.error("Failed to fetch stations", err);
        }
    };

    const fetchChildCategories = async (mainCategoryId: string) => {
        try {
            // Fetch by main_category_id
            const res = await api.get(`/main-categories/${mainCategoryId}/children`);
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
                    await api.put(`/admin/tables/main_categories/${editingItem.id}`, { name: editingItem.name });
                } else {
                    await api.post('/main-categories', { name: editingItem.name });
                }
                fetchMainCategories();
            } else if (editingItem.type === 'station') {
                if (editingItem.id) {
                    await api.put(`/stations/${editingItem.id}`, { name: editingItem.name });
                } else {
                    if (!selectedMain) return;
                    const payload: any = { name: editingItem.name, main_category_id: selectedMain.id };
                    if (projectId) payload.project_id = projectId;
                    await api.post('/stations', payload);
                }
                if (selectedMain) fetchStations(selectedMain.id);
            } else {
                if (editingItem.id) {
                    await api.put(`/child-categories/${editingItem.id}`, {
                        name: editingItem.name,
                        requires_inverter: editingItem.requires_inverter ?? false
                    });
                } else {
                    if (!selectedStation) return;
                    await api.post('/child-categories', {
                        name: editingItem.name,
                        station_id: selectedStation.id, // Now linked to station
                        // Backend might need update to handle station_id map to main_id if needed, or we send both
                        main_category_id: selectedMain?.id, // Keep linking main for backward compat if needed
                        requires_inverter: editingItem.requires_inverter ?? false
                    });
                }
                // Reload child categories using main_category_id
                if (selectedMain) fetchChildCategories(selectedMain.id);
            }

            setEditingItem(null);
            onChange();
        } catch (err: any) {
            console.error("Save failed", err);
            setError(err.response?.data?.error || "Failed to save category");
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id: string, type: 'main' | 'station' | 'child') => {
        if (!window.confirm("Bạn có chắc chắn muốn xóa? Hành động này không thể hoàn tác và sẽ xóa tất cả dữ liệu liên quan!")) return;

        try {
            setLoading(true);
            if (type === 'main') {
                await api.delete(`/main-categories/${id}`);
                setMainCategories(prev => prev.filter(c => c.id !== id));
                if (selectedMain?.id === id) setSelectedMain(null);
            } else if (type === 'station') {
                await api.delete(`/stations/${id}`);
                setStations(prev => prev.filter(c => c.id !== id));
                if (selectedStation?.id === id) setSelectedStation(null);
            } else {
                await api.delete(`/child-categories/${id}`);
                setChildCategories(prev => prev.filter(c => c.id !== id));
            }
            onChange();
        } catch (err: any) {
            console.error("Delete failed", err);
            setError(err.response?.data?.error || "Failed to delete item");
        } finally {
            setLoading(false);
        }
    };

    // Toggle child category selection (local state only, no API call)
    const handleToggleChildStation = (child: ChildCategory) => {
        if (!selectedStation) return;

        const newSelections = new Set(localSelections);
        if (newSelections.has(child.id)) {
            newSelections.delete(child.id);
        } else {
            newSelections.add(child.id);
        }
        setLocalSelections(newSelections);
        setHasChanges(true);
    };

    // Initialize local selections when station changes
    const initializeSelections = () => {
        if (selectedStation) {
            const selected = new Set(
                childCategories
                    .filter(c => c.station_id === selectedStation.id)
                    .map(c => c.id)
            );
            setLocalSelections(selected);
            setHasChanges(false);
        }
    };

    // Save all station configuration to Station's child_category_ids field
    const handleSaveStationConfig = async () => {
        if (!selectedStation || !selectedMain) return;

        try {
            setLoading(true);

            // Convert Set to array for API
            const childCategoryIDs = Array.from(localSelections);

            // Single API call to save station config
            await api.put(`/stations/${selectedStation.id}/config`, {
                child_category_ids: childCategoryIDs
            });

            // Refetch stations to sync UI with database
            await fetchStations(selectedMain.id);

            // Update the selected station with new data
            setSelectedStation(prev => prev ? {
                ...prev,
                child_category_ids: childCategoryIDs
            } : null);

            setHasChanges(false);
            onChange();
        } catch (err: any) {
            console.error("Save failed", err);
            setError(err.response?.data?.error || "Failed to save station configuration");
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return ReactDOM.createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
            <div className="bg-white rounded-2xl w-full max-w-6xl h-[80vh] shadow-2xl flex flex-col overflow-hidden">
                {/* Header */}
                <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                    <div className="flex items-center gap-2">
                        <Folder className="w-5 h-5 text-indigo-500" />
                        <h2 className="text-lg font-bold text-gray-800">Quản lý hạng mục</h2>
                    </div>
                    <div className="flex items-center gap-2">
                        {hasChanges && selectedStation && (
                            <button
                                onClick={handleSaveStationConfig}
                                disabled={loading}
                                className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors flex items-center gap-2 text-sm font-medium disabled:opacity-50"
                            >
                                <Save className="w-4 h-4" />
                                Lưu cấu hình trạm
                            </button>
                        )}
                        <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                            <X className="w-5 h-5 text-gray-500" />
                        </button>
                    </div>
                </div>

                <div className="flex-1 overflow-hidden flex flex-col md:flex-row divide-y md:divide-y-0 md:divide-x divide-gray-100 min-h-0">

                    {/* Column 1: Main Categories */}
                    <div className="flex flex-col h-full bg-slate-50/50 flex-1 min-w-0">
                        <div className="p-3 border-b flex justify-between items-center bg-white sticky top-0">
                            <h3 className="font-semibold text-gray-700">Hạng mục chính</h3>
                            <button
                                onClick={() => setEditingItem({ name: '', type: 'main' })}
                                className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 transition-colors flex items-center gap-1 text-sm font-medium"
                            >
                                <Plus className="w-4 h-4" /> Thêm
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar min-h-0">
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

                    {/* Column 2: Stations (Khu vực) */}
                    <div className="flex flex-col h-full bg-white flex-1 min-w-0">
                        <div className="p-3 border-b flex justify-between items-center bg-white sticky top-0">
                            <h3 className="font-semibold text-gray-700">
                                {selectedMain ? `Hạng mục phụ: ${selectedMain.name}` : 'Hạng mục phụ'}
                            </h3>
                            <button
                                disabled={!selectedMain}
                                onClick={() => selectedMain && setEditingItem({ name: '', type: 'station' })}
                                className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 transition-colors flex items-center gap-1 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <Plus className="w-4 h-4" /> Thêm
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar min-h-0">
                            {!selectedMain ? (
                                <div className="h-full flex flex-col items-center justify-center text-gray-400">
                                    <p className="text-sm">Chọn hạng mục chính trước</p>
                                </div>
                            ) : stations.length === 0 ? (
                                <p className="text-center text-gray-400 text-sm mt-10 italic">Chưa có hạng mục phụ nào.</p>
                            ) : (
                                stations.map(station => (
                                    <div
                                        key={station.id}
                                        onClick={() => setSelectedStation(station)}
                                        className={`p-3 rounded-xl border cursor-pointer transition-all flex justify-between items-center group
                                            ${selectedStation?.id === station.id
                                                ? 'bg-white border-indigo-500 shadow-md ring-1 ring-indigo-500'
                                                : 'bg-white border-gray-200 hover:border-indigo-300 hover:shadow-sm'}
                                        `}
                                    >
                                        <span className="text-gray-700">{station.name}</span>
                                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button
                                                onClick={(e) => { e.stopPropagation(); setEditingItem({ id: station.id, name: station.name, type: 'station' }); }}
                                                className="p-1.5 hover:bg-amber-50 text-amber-500 rounded-lg"
                                            >
                                                <Pencil className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); handleDelete(station.id, 'station'); }}
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

                    {/* Column 3: Child Categories */}
                    <div className="flex flex-col h-full bg-slate-50/50 flex-1 min-w-0">
                        <div className="p-3 border-b flex justify-between items-center bg-white sticky top-0">
                            <h3 className="font-semibold text-gray-700">
                                {selectedStation ? `Công việc: ${selectedStation.name}` : 'Công việc'}
                            </h3>
                            <button
                                disabled={!selectedStation}
                                onClick={() => selectedStation && setEditingItem({ name: '', type: 'child', requires_inverter: false })}
                                className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 transition-colors flex items-center gap-1 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <Plus className="w-4 h-4" /> Thêm
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar min-h-0">
                            {!selectedStation ? (
                                <div className="h-full flex flex-col items-center justify-center text-gray-400">
                                    <FolderPlus className="w-12 h-12 mb-2 opacity-50" />
                                    <p className="text-sm">Chọn hạng mục phụ để xem chi tiết</p>
                                </div>
                            ) : childCategories.length === 0 ? (
                                <p className="text-center text-gray-400 text-sm mt-10 italic">Chưa có công việc nào.</p>
                            ) : (
                                childCategories.map(child => {
                                    const isSelected = localSelections.has(child.id);
                                    return (
                                        <div
                                            key={child.id}
                                            className={`p-3 rounded-lg border transition-all flex justify-between items-center group cursor-pointer
                                                ${isSelected
                                                    ? 'border-green-300 bg-green-50/50'
                                                    : 'border-gray-100 hover:border-indigo-100 hover:bg-indigo-50/30'}`}
                                            onClick={() => handleToggleChildStation(child)}
                                        >
                                            <div className="flex items-center gap-2">
                                                {isSelected ? (
                                                    <CheckSquare className="w-5 h-5 text-green-600" />
                                                ) : (
                                                    <Square className="w-5 h-5 text-gray-400" />
                                                )}
                                                <span className={isSelected ? 'text-green-700 font-medium' : 'text-gray-700'}>
                                                    {child.name}
                                                </span>
                                            </div>
                                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); setEditingItem({ id: child.id, name: child.name, type: 'child', requires_inverter: child.requires_inverter }); }}
                                                    className="p-1.5 hover:bg-amber-50 text-amber-500 rounded-lg"
                                                >
                                                    <Pencil className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); handleDelete(child.id, 'child'); }}
                                                    className="p-1.5 hover:bg-red-50 text-red-500 rounded-lg"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>
                </div>

                {/* Editor Modal Overlay */}
                {editingItem && (
                    <div className="absolute inset-0 z-10 bg-black/20 backdrop-blur-[1px] flex items-center justify-center p-4">
                        <div className="bg-white rounded-xl p-4 w-full max-w-sm shadow-xl animate-scale-up">
                            <h3 className="font-bold text-gray-800 mb-4">
                                {editingItem.id ? 'Sửa' : 'Thêm'} {
                                    editingItem.type === 'main' ? 'Hạng mục chính' :
                                        editingItem.type === 'station' ? 'Hạng mục phụ' : 'Công việc'
                                }
                            </h3>
                            <input
                                autoFocus
                                type="text"
                                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none mb-3"
                                placeholder="Nhập tên..."
                                value={editingItem.name}
                                onChange={(e) => setEditingItem({ ...editingItem, name: e.target.value })}
                                onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                            />
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
        </div>,
        document.body
    );
};

export default CategoryManagerModal;
