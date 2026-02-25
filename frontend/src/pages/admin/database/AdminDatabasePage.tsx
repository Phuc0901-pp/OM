import { useState, useEffect, useMemo } from 'react';
import api from '../../../services/api';
import {
    Database, Users, Briefcase, Layers, FileText, Clock, Filter, ListTree, Table, Settings,
    Plus, Eye, Pencil, Trash2, Save, RefreshCw, X, AlertTriangle, Search
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import GlassCard from '../../../components/common/GlassCard';
import PremiumTable, { ColumnDef } from '../../../components/common/PremiumTable';
import PremiumButton from '../../../components/common/PremiumButton';
import ModernInput from '../../../components/common/ModernInput';
import SettingsTab from './SettingsTab';
import AddColumnModal from '../../../components/modals/AddColumnModal';

import { useSearchParams } from 'react-router-dom';

const AdminDatabasePage = () => {
    const [searchParams, setSearchParams] = useSearchParams();

    // Get list from URL or default to 'users'
    const collection = searchParams.get('tab') || 'users';

    const setCollection = (id: string) => {
        setSearchParams({ tab: id });
    };

    const [data, setData] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState(searchParams.get('search') || '');
    const [concepts, setConcepts] = useState<any[]>([]);

    // Selection for Bulk Actions
    const [selectedIds, setSelectedIds] = useState<Set<any>>(new Set());

    // Detailed View Modal
    const [selectedItem, setSelectedItem] = useState<any | null>(null);

    // Edit/Create Modal
    const [isEditOpen, setIsEditOpen] = useState(false);
    const [formMode, setFormMode] = useState<'create' | 'edit'>('create');
    const [formData, setFormData] = useState<any>({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showAddColumnModal, setShowAddColumnModal] = useState(false);

    // Static tables  
    const staticTables = [
        { id: 'users', label: 'Users', icon: Users },
        { id: 'projects', label: 'Projects', icon: Briefcase },
        { id: 'assign', label: 'Assign', icon: Layers },
        { id: 'task_details', label: 'Task Details', icon: FileText },
        { id: 'attendances', label: 'Attendances', icon: Clock },
        { id: 'teams', label: 'Teams', icon: Users },
        { id: 'roles', label: 'Roles', icon: Filter },
        { id: 'main_categories', label: 'Main Cats', icon: ListTree },
        { id: 'child_categories', label: 'Child Cats', icon: ListTree },
        { id: 'checklist_templates', label: 'Checklist Tmpl', icon: ListTree }, // Added checklist_templates
        { id: 'project_classification', label: 'Proj Class', icon: Database },
        { id: 'project_characteristics', label: 'Proj Chars', icon: Database },
        { id: 'view_allocations', label: 'VIEW: Allocations', icon: Table, isView: true },
        { id: 'settings', label: 'Cài đặt', icon: Settings, isSettings: true },
    ];

    // Merge static tables with dynamic concepts
    const conceptTabs = concepts.map(concept => ({
        id: concept.name,
        label: concept.name.toUpperCase(),
        icon: Database,
        isDynamic: true,
        isView: false,
        isSettings: false
    }));

    const tables = [...staticTables, ...conceptTabs];

    const isViewOnly = tables.find(t => t.id === collection)?.isView;

    // Fetch concepts on mount
    useEffect(() => {
        const fetchConcepts = async () => {
            try {
                const res = await api.get('/admin/concepts');
                if (Array.isArray(res.data)) setConcepts(res.data);
            } catch (error) {
                console.error('Failed to fetch concepts:', error);
            }
        };
        fetchConcepts();
    }, []);

    useEffect(() => {
        fetchData();
        setSelectedItem(null);
        setIsEditOpen(false);
        setSelectedIds(new Set());
    }, [collection]);

    const fetchData = async () => {
        setLoading(true);
        setData([]);
        setSelectedIds(new Set());
        try {
            let endpoint = collection === 'view_allocations' ? '/allocations' : `/admin/tables/${collection}`;
            const res = await api.get(endpoint);

            if (Array.isArray(res.data)) setData(res.data);
            else if (res.data && Array.isArray(res.data.data)) setData(res.data.data);
            else setData([]);
        } catch (error) {
            console.error("Failed to fetch data", error);
        } finally {
            setLoading(false);
        }
    };

    // Filter Data
    const filteredData = data.filter(item =>
        JSON.stringify(item).toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Dynamic Columns Logic
    let headers = filteredData.length > 0 ? Object.keys(filteredData[0]) : [];

    // If table is empty and it's a dynamic table, get columns from concept
    const currentConcept = concepts.find(c => c.name === collection);
    if (headers.length === 0 && currentConcept && currentConcept.columns) {
        // Build headers from concept columns
        headers = ['id', ...currentConcept.columns.map((col: any) => col.name), 'created_at', 'updated_at'];
    }

    const displayHeaders = headers.slice(0, 6); // Limit displayed columns

    const getRecordId = (row: any) => {
        if (!row) return undefined;
        if (row.id !== undefined) return row.id;
        if (row.project_id !== undefined) return row.project_id;
        return undefined;
    };

    // Bulk Delete
    const handleBulkDelete = async () => {
        const count = selectedIds.size;
        if (count === 0) return;
        if (!window.confirm(`⚠️ DANGER: Delete ALL ${count} selected records?`)) return;

        try {
            await api.post(`/admin/tables/${collection}/bulk-delete`, { ids: Array.from(selectedIds) });
            alert(`Deleted ${count} records.`);
            fetchData();
        } catch (error: any) {
            alert("Failed to delete: " + (error.response?.data?.error || error.message));
        }
    }

    // Single Delete
    const handleDelete = async (id: string | number) => {
        if (!window.confirm(`Delete record ID: ${id}?`)) return;
        try {
            await api.delete(`/admin/tables/${collection}/${id}`);
            fetchData();
        } catch (error: any) {
            alert("Failed to delete: " + (error.response?.data?.error || error.message));
        }
    };

    // Save/Create
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            const payload = { ...formData };
            if (formMode === 'create') {
                delete payload.id;
                delete payload.project_id;
                delete payload.created_at;
                delete payload.updated_at;
                await api.post(`/admin/tables/${collection}`, payload);
                alert("Created successfully!");
            } else {
                const id = getRecordId(payload);
                await api.put(`/admin/tables/${collection}/${id}`, payload);
                alert("Updated successfully!");
            }
            setIsEditOpen(false);
            fetchData();
        } catch (error: any) {
            alert("Failed to save: " + (error.response?.data?.error || error.message));
        } finally {
            setIsSubmitting(false);
        }
    };

    // Generate Actions for PremiumTable
    const tableActions = useMemo(() => {
        if (isViewOnly) return undefined;
        return (row: any) => {
            const id = getRecordId(row);
            return (
                <div className="flex gap-2 justify-end">
                    <button type="button" onClick={(e) => { e.stopPropagation(); setSelectedItem(row); }} className="p-1.5 hover:bg-indigo-50 text-indigo-600 rounded-lg"><Eye className="w-4 h-4" /></button>
                    <button type="button" onClick={(e) => { e.stopPropagation(); setFormMode('edit'); setFormData({ ...row }); setIsEditOpen(true); }} className="p-1.5 hover:bg-amber-50 text-amber-600 rounded-lg"><Pencil className="w-4 h-4" /></button>
                    <button type="button" onClick={(e) => { e.stopPropagation(); handleDelete(id); }} className="p-1.5 hover:bg-red-50 text-red-600 rounded-lg"><Trash2 className="w-4 h-4" /></button>
                </div>
            );
        };
    }, [isViewOnly]);

    // Build PremiumTable Columns
    const columns: ColumnDef<any>[] = useMemo(() => {
        if (!displayHeaders.length) return [];
        return [
            ...displayHeaders.map(key => ({
                header: key,
                accessor: key as keyof any
            })),
            {
                header: 'Actions',
                accessor: () => null,
                cell: (_: any, row: any) => tableActions ? tableActions(row) : (
                    <button onClick={() => setSelectedItem(row)} className="p-1.5 hover:bg-indigo-50 text-indigo-600 rounded-lg"><Eye className="w-4 h-4" /></button>
                )
            }
        ];
    }, [displayHeaders, tableActions]);


    const renderFormInput = (key: string) => {
        if (['id', 'created_at', 'updated_at', 'deleted_at'].includes(key)) return null;
        const val = formData[key];
        const isLong = typeof val === 'string' && val.length > 50;
        const isObj = typeof val === 'object' && val !== null;

        return (
            <div key={key} className="mb-4">
                <label className="block text-xs font-bold uppercase text-slate-500 mb-1">{key}</label>
                {(isObj || isLong) ? (
                    <textarea value={isObj ? JSON.stringify(val) : val} onChange={e => setFormData({ ...formData, [key]: e.target.value })} className="w-full p-2 bg-slate-50 border rounded text-sm font-mono h-24 outline-none focus:border-indigo-500" />
                ) : (
                    <input type={typeof val === 'number' ? 'number' : 'text'} value={val || ''} onChange={e => setFormData({ ...formData, [key]: e.target.value })} className="w-full p-2 bg-slate-50 border rounded text-sm outline-none focus:border-indigo-500" />
                )}
            </div>
        );
    };

    return (
        <div className="space-y-6 pb-10">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-lg border border-slate-200 shadow-sm">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-slate-900 rounded-lg">
                        <Database className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800">Database Inspector</h1>
                        <p className="text-sm text-slate-500">Admin-Level Data Management</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    {selectedIds.size > 0 && (
                        <PremiumButton variant="danger" size="sm" onClick={handleBulkDelete} icon={<Trash2 className="w-3 h-3" />}>Delete ({selectedIds.size})</PremiumButton>
                    )}
                    {collection !== 'settings' && !isViewOnly && (
                        <PremiumButton
                            variant="ghost"
                            size="sm"
                            onClick={() => setShowAddColumnModal(true)}
                            icon={<Plus className="w-4 h-4" />}
                        >
                            Thêm trường
                        </PremiumButton>
                    )}
                    {!isViewOnly && <PremiumButton variant="primary" size="sm" onClick={() => { setFormMode('create'); setFormData({}); setIsEditOpen(true); }} icon={<Plus className="w-4 h-4" />}>Thêm bản ghi</PremiumButton>}
                    <PremiumButton variant="glass" size="sm" onClick={fetchData} className="px-3"><RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /></PremiumButton>
                </div>
            </div>

            {/* Table Selection */}
            <div className="overflow-x-auto pb-2 scrollbar-hide -mx-4 px-4 md:mx-0 md:px-0">
                <div className="flex gap-2 w-max">
                    {tables.map(t => (
                        <button
                            key={t.id}
                            onClick={() => setCollection(t.id)}
                            className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all border flex items-center gap-2 ${collection === t.id ? 'bg-slate-800 text-white border-slate-800 shadow-lg scale-105' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50 hover:border-slate-300'}`}
                        >
                            <t.icon className="w-3.5 h-3.5" /> {t.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Content */}
            {collection === 'settings' ? (
                <SettingsTab />
            ) : (
                <>
                    {/* Table */}
                    <GlassCard className="overflow-hidden">
                        <div className="p-4 border-b border-slate-100">
                            <ModernInput
                                placeholder="Search records..."
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                icon={<Search className="w-4 h-4" />}
                                className="max-w-md bg-slate-50/50"
                            />
                        </div>
                        <div className="flex-1 p-4">
                            <PremiumTable
                                columns={columns}
                                data={filteredData}
                                keyField="id"
                                isLoading={loading}
                                onRowClick={(row) => setSelectedItem(row)}
                            />
                        </div>
                    </GlassCard>
                </>
            )}

            {/* Edit/Create Modal */}
            <AnimatePresence>
                {isEditOpen && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="w-full max-w-2xl">
                            <GlassCard className="max-h-[85vh] flex flex-col !p-0 overflow-hidden">
                                <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-white/50">
                                    <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2">
                                        {formMode === 'create' ? <Plus className="w-5 h-5 text-emerald-500" /> : <Pencil className="w-5 h-5 text-amber-500" />}
                                        {formMode === 'create' ? 'Create Record' : 'Edit Record'}
                                    </h3>
                                    <button onClick={() => setIsEditOpen(false)} className="p-2 hover:bg-slate-100 rounded-full"><X className="w-5 h-5 text-slate-400" /></button>
                                </div>
                                <form onSubmit={handleSubmit} className="flex-1 overflow-auto p-6 bg-slate-50/30">
                                    <div className="mb-6 p-4 bg-amber-50/50 border border-amber-100 rounded-xl flex items-start gap-3 text-xs text-amber-800">
                                        <AlertTriangle className="w-5 h-5 shrink-0 text-amber-500" />
                                        <p className="leading-relaxed">Editing raw database records bypasses validation logic. Ensure data integrity before saving.</p>
                                    </div>
                                    {headers.map(key => renderFormInput(key))}
                                </form>
                                <div className="p-5 border-t border-slate-100 bg-white/50 flex justify-end gap-3">
                                    <PremiumButton variant="ghost" onClick={() => setIsEditOpen(false)}>Cancel</PremiumButton>
                                    <PremiumButton variant="primary" onClick={handleSubmit} loading={isSubmitting} icon={<Save className="w-4 h-4" />}>Save Changes</PremiumButton>
                                </div>
                            </GlassCard>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* JSON View Modal */}
            <AnimatePresence>
                {selectedItem && !isEditOpen && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="w-full max-w-3xl">
                            <GlassCard className="max-h-[80vh] flex flex-col !p-0 overflow-hidden">
                                <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-white/50">
                                    <h3 className="font-bold text-slate-800">Raw Data (JSON)</h3>
                                    <button onClick={() => setSelectedItem(null)} className="p-2 hover:bg-slate-100 rounded-full"><X className="w-4 h-4 text-slate-400" /></button>
                                </div>
                                <div className="flex-1 overflow-auto bg-[#1e1e1e] p-6">
                                    <pre className="text-xs md:text-sm font-mono text-[#dcdcaa] leading-relaxed select-text">{JSON.stringify(selectedItem, null, 2)}</pre>
                                </div>
                            </GlassCard>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Add Column Modal */}
            {showAddColumnModal && (
                <AddColumnModal
                    table={collection}
                    onClose={() => setShowAddColumnModal(false)}
                    onSuccess={() => {
                        fetchData();
                        setShowAddColumnModal(false);
                    }}
                />
            )}
        </div>
    );
};

export default AdminDatabasePage;
