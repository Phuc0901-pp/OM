import { useState, useEffect } from 'react';
import { Plus, AlertTriangle, Eye, Check } from 'lucide-react';
import api from '../../services/api';
import PremiumButton from '../common/PremiumButton';
import GlassCard from '../common/GlassCard';
import ModernInput from '../common/ModernInput';

interface AddColumnModalProps {
    table: string;
    onClose: () => void;
    onSuccess: () => void;
}

const AddColumnModal = ({ table, onClose, onSuccess }: AddColumnModalProps) => {
    const [columnName, setColumnName] = useState('');
    const [dataType, setDataType] = useState('VARCHAR');
    const [length, setLength] = useState<number | ''>(255);
    const [nullable, setNullable] = useState(true);
    const [defaultValue, setDefaultValue] = useState('');
    const [hasForeignKey, setHasForeignKey] = useState(false);
    const [fkTable, setFkTable] = useState('');
    const [fkColumn, setFkColumn] = useState('id');

    const [sqlPreview, setSqlPreview] = useState('');
    const [showPreview, setShowPreview] = useState(false);
    const [loading, setLoading] = useState(false);

    const dataTypes = ['VARCHAR', 'TEXT', 'INTEGER', 'BIGINT', 'UUID', 'BOOLEAN', 'TIMESTAMP', 'DATE', 'NUMERIC'];

    const tables = ['users', 'projects', 'assign', 'task_details', 'teams', 'roles', 'main_categories', 'child_categories'];

    const generatePreview = async () => {
        try {
            const payload: any = {
                column_name: columnName,
                data_type: dataType,
                nullable,
            };

            if (dataType === 'VARCHAR' && length) {
                payload.length = parseInt(length.toString());
            }

            if (defaultValue) {
                payload.default_value = defaultValue;
            }

            if (hasForeignKey && fkTable) {
                payload.foreign_key = { table: fkTable, column: fkColumn };
            }

            const res = await api.post(`/admin/schema/${table}/preview-add-column`, payload);
            setSqlPreview(res.data.sql);
            setShowPreview(true);
        } catch (error: any) {
            alert('Error: ' + (error.response?.data?.error || 'Failed to generate preview'));
        }
    };

    const handleSubmit = async () => {
        if (!confirm('⚠️ CẢNH BÁO: Bạn sắp thay đổi cấu trúc database! Tiếp tục?')) return;

        setLoading(true);
        try {
            const payload: any = {
                column_name: columnName,
                data_type: dataType,
                nullable,
            };

            if (dataType === 'VARCHAR' && length) {
                payload.length = parseInt(length.toString());
            }

            if (defaultValue) {
                payload.default_value = defaultValue;
            }

            if (hasForeignKey && fkTable) {
                payload.foreign_key = { table: fkTable, column: fkColumn };
            }

            await api.post(`/admin/schema/${table}/add-column`, payload);
            alert('✅ Column added successfully!');
            onSuccess();
            onClose();
        } catch (error: any) {
            alert('Error: ' + (error.response?.data?.error || 'Failed to add column'));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <GlassCard className="w-full max-w-3xl max-h-[90vh] overflow-auto">
                <div className="p-6 border-b border-slate-200 bg-white/50">
                    <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                        <Plus className="w-5 h-5" />
                        Thêm trường cho {table}
                    </h3>
                </div>

                <div className="p-6 space-y-6">
                    {/* Warning */}
                    <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                        <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                        <div className="text-sm text-amber-800">
                            <p className="font-semibold mb-1">Thao tác nguy hiểm!</p>
                            <p>Việc thêm cột sẽ thay đổi cấu trúc database. Hãy chắc chắn bạn hiểu rõ những gì mình đang làm.</p>
                        </div>
                    </div>

                    {/* Column Name */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                            Tên cột * <span className="text-xs text-slate-500">(lowercase, alphanumeric, underscore only)</span>
                        </label>
                        <ModernInput
                            value={columnName}
                            onChange={e => setColumnName(e.target.value.toLowerCase())}
                            placeholder="example_column"
                        />
                    </div>

                    {/* Data Type & Length */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">Kiểu dữ liệu *</label>
                            <select
                                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                value={dataType}
                                onChange={e => setDataType(e.target.value)}
                            >
                                {dataTypes.map(dt => (
                                    <option key={dt} value={dt}>{dt}</option>
                                ))}
                            </select>
                        </div>
                        {dataType === 'VARCHAR' && (
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">Length</label>
                                <ModernInput
                                    type="number"
                                    value={length}
                                    onChange={e => setLength(e.target.value ? parseInt(e.target.value) : '')}
                                />
                            </div>
                        )}
                    </div>

                    {/* Nullable & Default */}
                    <div className="grid grid-cols-2 gap-4">
                        <label className="flex items-center gap-2 px-4 py-2 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50">
                            <input
                                type="checkbox"
                                checked={nullable}
                                onChange={e => setNullable(e.target.checked)}
                            />
                            <span className="text-sm font-medium">Nullable</span>
                        </label>
                        <div>
                            <ModernInput
                                placeholder="Default value (optional)"
                                value={defaultValue}
                                onChange={e => setDefaultValue(e.target.value)}
                            />
                        </div>
                    </div>

                    {/* Foreign Key */}
                    <div>
                        <label className="flex items-center gap-2 mb-3">
                            <input
                                type="checkbox"
                                checked={hasForeignKey}
                                onChange={e => setHasForeignKey(e.target.checked)}
                            />
                            <span className="text-sm font-medium">Foreign Key</span>
                        </label>

                        {hasForeignKey && (
                            <div className="grid grid-cols-2 gap-4 p-4 bg-slate-50 rounded-lg border border-slate-200">
                                <div>
                                    <label className="block text-xs font-medium text-slate-600 mb-1">Referenced Table</label>
                                    <select
                                        className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                        value={fkTable}
                                        onChange={e => setFkTable(e.target.value)}
                                    >
                                        <option value="">Select table...</option>
                                        {tables.map(t => (
                                            <option key={t} value={t}>{t}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-slate-600 mb-1">Referenced Column</label>
                                    <ModernInput
                                        value={fkColumn}
                                        onChange={e => setFkColumn(e.target.value)}
                                        placeholder="id"
                                        className="text-sm"
                                    />
                                </div>
                            </div>
                        )}
                    </div>

                    {/* SQL Preview */}
                    {showPreview && sqlPreview && (
                        <div className="p-4 bg-slate-900 rounded-lg">
                            <div className="flex items-center gap-2 text-emerald-400 mb-2">
                                <Eye className="w-4 h-4" />
                                <span className="text-xs font-bold uppercase">SQL Preview</span>
                            </div>
                            <pre className="text-xs text-slate-300 whitespace-pre-wrap font-mono">{sqlPreview}</pre>
                        </div>
                    )}
                </div>

                {/* Actions */}
                <div className="p-6 border-t border-slate-200 flex justify-between">
                    <div>
                        <PremiumButton variant="ghost" onClick={generatePreview} icon={<Eye className="w-4 h-4" />}>
                            Preview SQL
                        </PremiumButton>
                    </div>
                    <div className="flex gap-3">
                        <PremiumButton variant="ghost" onClick={onClose}>
                            Cancel
                        </PremiumButton>
                        <PremiumButton
                            variant="primary"
                            onClick={handleSubmit}
                            loading={loading}
                            disabled={!columnName || !dataType}
                            icon={<Check className="w-4 h-4" />}
                        >
                            Thêm trường
                        </PremiumButton>
                    </div>
                </div>
            </GlassCard>
        </div>
    );
};

export default AddColumnModal;
