import { useState, useEffect } from 'react';
import { Plus, Settings, Trash, Edit, Save, X } from 'lucide-react';
import api from '../../../services/api';
import { Concept, ColumnDef } from '../../../types/concept';
import PremiumButton from '../../../components/common/PremiumButton';
import GlassCard from '../../../components/common/GlassCard';
import ModernInput from '../../../components/common/ModernInput';

const SettingsTab = () => {
    const [concepts, setConcepts] = useState<Concept[]>([]);
    const [allTables, setAllTables] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [editingConcept, setEditingConcept] = useState<Concept | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);

    // Form state
    const [formName, setFormName] = useState('');
    const [formDescription, setFormDescription] = useState('');
    const [formColumns, setFormColumns] = useState<ColumnDef[]>([]);

    useEffect(() => {
        fetchConcepts();
        fetchAllTables();
    }, []);

    const fetchConcepts = async () => {
        setLoading(true);
        try {
            const res = await api.get('/admin/concepts');
            setConcepts(res.data || []);
        } catch (error: any) {
            console.error('Failed to fetch concepts', error);
            alert('Lỗi khi tải dữ liệu: ' + (error.response?.data?.error || error.message));
        } finally {
            setLoading(false);
        }
    };

    const fetchAllTables = async () => {
        try {
            const res = await api.get('/admin/tables');
            if (Array.isArray(res.data)) {
                setAllTables(res.data);
            }
        } catch (error) {
            console.error('Failed to fetch all tables', error);
        }
    };

    const openCreateModal = () => {
        setEditingConcept(null);
        setFormName('');
        setFormDescription('');
        setFormColumns([]);
        setIsModalOpen(true);
    };

    const openEditModal = (concept: Concept) => {
        setEditingConcept(concept);
        setFormName(concept.name);
        setFormDescription(concept.description);
        setFormColumns(concept.columns);
        setIsModalOpen(true);
    };

    const addColumn = () => {
        setFormColumns([...formColumns, { name: '', label: '', type: 'text', required: false }]);
    };

    const updateColumn = (index: number, field: keyof ColumnDef, value: any) => {
        const updated = [...formColumns];
        updated[index] = { ...updated[index], [field]: value };
        setFormColumns(updated);
    };

    const removeColumn = (index: number) => {
        setFormColumns(formColumns.filter((_, i) => i !== index));
    };

    const handleSubmit = async () => {
        if (!formName.trim()) {
            alert('Vui lòng nhập tên khái niệm!');
            return;
        }
        if (formColumns.length === 0) {
            alert('Vui lòng thêm ít nhất 1 cột!');
            return;
        }

        setSubmitting(true);
        try {
            const payload = { name: formName, description: formDescription, columns: formColumns };
            console.log('Submitting concept:', payload);

            if (editingConcept) {
                await api.put(`/admin/concepts/${editingConcept.id}`, payload);
                alert('✅ Cập nhật khái niệm thành công!');
            } else {
                await api.post('/admin/concepts', payload);
                alert('✅ Tạo khái niệm thành công!');
            }
            fetchConcepts();
            setIsModalOpen(false);
        } catch (error: any) {
            console.error('Failed to save concept', error);
            alert('❌ Lỗi: ' + (error.response?.data?.error || error.message || 'Không thể lưu khái niệm'));
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Xóa concept này?')) return;
        try {
            await api.delete(`/admin/concepts/${id}`);
            fetchConcepts();
        } catch (error) {
            console.error('Failed to delete concept', error);
        }
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <Settings className="w-6 h-6 text-blue-600" />
                    <div>
                        <h2 className="text-2xl font-bold text-slate-800">Cài đặt</h2>
                        <p className="text-sm text-slate-500">Tạo và quản lý các khái niệm dữ liệu</p>
                    </div>
                </div>
                <PremiumButton variant="primary" onClick={openCreateModal} icon={<Plus className="w-4 h-4" />}>
                    Tạo khái niệm mới
                </PremiumButton>
            </div>

            {/* Concepts List */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {loading ? (
                    <div className="col-span-full text-center py-12 text-slate-500">Đang tải...</div>
                ) : concepts.length === 0 ? (
                    <div className="col-span-full text-center py-12 text-slate-500">Chưa có khái niệm nào</div>
                ) : (
                    concepts.map(concept => (
                        <GlassCard key={concept.id} className="p-5 hover:shadow-lg transition-shadow">
                            <h3 className="font-bold text-lg text-slate-800 mb-2">{concept.name}</h3>
                            <p className="text-sm text-slate-600 mb-4">{concept.description || 'Không có mô tả'}</p>
                            <div className="text-xs text-slate-500 mb-4">
                                Cột: <span className="font-semibold">{concept.columns.length}</span>
                            </div>
                            <div className="flex gap-2">
                                <PremiumButton size="sm" variant="ghost" onClick={() => openEditModal(concept)} icon={<Edit className="w-3 h-3" />}>
                                    Sửa
                                </PremiumButton>
                                <PremiumButton size="sm" variant="danger" onClick={() => handleDelete(concept.id)} icon={<Trash className="w-3 h-3" />}>
                                    Xóa
                                </PremiumButton>
                            </div>
                        </GlassCard>
                    ))
                )}
            </div>

            {/* All Tables Section */}
            <div className="mt-12">
                <div className="mb-6">
                    <h3 className="text-xl font-bold text-slate-800 mb-2">Tất cả bảng trong Database</h3>
                    <p className="text-sm text-slate-500">Danh sách toàn bộ các bảng PostgreSQL</p>
                </div>
                <GlassCard className="overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-slate-50 border-b border-slate-200">
                                <tr>
                                    <th className="px-4 py-3 text-left text-xs font-bold uppercase text-slate-600">Table Name</th>
                                    <th className="px-4 py-3 text-left text-xs font-bold uppercase text-slate-600">Type</th>
                                    <th className="px-4 py-3 text-right text-xs font-bold uppercase text-slate-600">Rows</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {allTables.length === 0 ? (
                                    <tr>
                                        <td colSpan={3} className="px-4 py-8 text-center text-slate-500">
                                            Đang tải...
                                        </td>
                                    </tr>
                                ) : (
                                    allTables.map((table, idx) => (
                                        <tr key={idx} className="hover:bg-slate-50 transition-colors">
                                            <td className="px-4 py-3 font-mono text-sm text-slate-800">{table.table_name}</td>
                                            <td className="px-4 py-3 text-sm text-slate-600">
                                                <span className={`px-2 py-1 rounded text-xs font-medium ${concepts.find(c => c.name === table.table_name)
                                                        ? 'bg-purple-100 text-purple-700'
                                                        : 'bg-slate-100 text-slate-700'
                                                    }`}>
                                                    {concepts.find(c => c.name === table.table_name) ? 'Dynamic' : 'Static'}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-sm text-slate-600 text-right font-semibold">
                                                {table.row_count || 0}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </GlassCard>
            </div>

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <GlassCard className="w-full max-w-3xl max-h-[85vh] overflow-auto">
                        <div className="p-6 border-b border-slate-200">
                            <h3 className="text-xl font-bold text-slate-800">
                                {editingConcept ? 'Chỉnh sửa khái niệm' : 'Tạo khái niệm mới'}
                            </h3>
                        </div>

                        <div className="p-6 space-y-6">
                            {/* Name */}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">Tên khái niệm *</label>
                                <ModernInput value={formName} onChange={e => setFormName(e.target.value)} placeholder="VD: equipment, location" />
                            </div>

                            {/* Description */}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">Mô tả</label>
                                <textarea
                                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    rows={3}
                                    value={formDescription}
                                    onChange={e => setFormDescription(e.target.value)}
                                    placeholder="Mô tả ngắn về khái niệm này"
                                />
                            </div>

                            {/* Columns */}
                            <div>
                                <div className="flex items-center justify-between mb-3">
                                    <label className="block text-sm font-medium text-slate-700">Định nghĩa cột</label>
                                    <PremiumButton size="sm" variant="ghost" onClick={addColumn} icon={<Plus className="w-3 h-3" />}>
                                        Thêm cột
                                    </PremiumButton>
                                </div>

                                <div className="space-y-3">
                                    {formColumns.map((col, idx) => (
                                        <div key={idx} className="p-4 border border-slate-200 rounded-lg bg-slate-50 space-y-3">
                                            <div className="grid grid-cols-2 gap-3">
                                                <ModernInput
                                                    placeholder="Tên cột (VD: temperature)"
                                                    value={col.name}
                                                    onChange={e => updateColumn(idx, 'name', e.target.value)}
                                                />
                                                <ModernInput
                                                    placeholder="Nhãn hiển thị (VD: Nhiệt độ)"
                                                    value={col.label}
                                                    onChange={e => updateColumn(idx, 'label', e.target.value)}
                                                />
                                            </div>
                                            <div className="grid grid-cols-3 gap-3">
                                                <select
                                                    className="px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                                    value={col.type}
                                                    onChange={e => updateColumn(idx, 'type', e.target.value)}
                                                >
                                                    <option value="text">Text</option>
                                                    <option value="number">Number</option>
                                                    <option value="boolean">Boolean</option>
                                                    <option value="date">Date</option>
                                                </select>
                                                <ModernInput
                                                    placeholder="Đơn vị (tùy chọn)"
                                                    value={col.unit || ''}
                                                    onChange={e => updateColumn(idx, 'unit', e.target.value)}
                                                />
                                                <label className="flex items-center gap-2 px-4">
                                                    <input
                                                        type="checkbox"
                                                        checked={col.required}
                                                        onChange={e => updateColumn(idx, 'required', e.target.checked)}
                                                    />
                                                    <span className="text-sm">Bắt buộc</span>
                                                </label>
                                            </div>
                                            <div className="text-right">
                                                <button onClick={() => removeColumn(idx)} className="text-red-600 text-sm hover:underline">
                                                    Xóa cột
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="p-6 border-t border-slate-200 flex justify-end gap-3">
                            <PremiumButton variant="ghost" onClick={() => setIsModalOpen(false)} icon={<X className="w-4 h-4" />}>
                                Hủy
                            </PremiumButton>
                            <PremiumButton
                                variant="primary"
                                onClick={handleSubmit}
                                loading={submitting}
                                disabled={submitting || !formName.trim() || formColumns.length === 0}
                                icon={<Save className="w-4 h-4" />}
                            >
                                Lưu
                            </PremiumButton>
                        </div>
                    </GlassCard>
                </div>
            )}
        </div>
    );
};

export default SettingsTab;
