import React, { useState, useEffect } from 'react';
import { X, ChevronDown } from 'lucide-react';
import GlassCard from '../common/GlassCard';
import ModernInput from '../common/ModernInput';
import PremiumButton from '../common/PremiumButton';
import api from '../../services/api';

interface EditProjectModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    project: any;
}

const EditProjectModal = ({ isOpen, onClose, onSuccess, project }: EditProjectModalProps) => {
    const [owners, setOwners] = useState<any[]>([]);
    const [form, setForm] = useState({
        name: '',
        id_owner: '',
        location: ''
    });
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (isOpen) {
            // Fetch owners when modal opens
            api.get('/owners')
                .then(res => setOwners(Array.isArray(res.data) ? res.data : []))
                .catch(err => console.error("Failed to load owners", err));
        }
    }, [isOpen]);

    useEffect(() => {
        if (project) {
            setForm({
                name: project.name || project.project_name || '',
                id_owner: project.id_owner || project.owner?.id || '',
                location: project.location || ''
            });
        }
    }, [project]);

    const handleSave = async () => {
        if (!form.name.trim() || !form.id_owner) {
            alert("Vui lòng nhập tên dự án và chọn chủ sở hữu.");
            return;
        }

        setLoading(true);
        try {
            await api.put(`/projects/${project.project_id || project.id}`, {
                name: form.name,
                id_owner: form.id_owner,
                location: form.location
            });
            onSuccess();
            onClose();
        } catch (error) {
            console.error("Failed to update project", error);
            alert("Lưu thông tin dự án thất bại.");
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in">
            <GlassCard className="w-full max-w-md !p-0 overflow-hidden">
                <div className="p-6 bg-white/80">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-xl font-bold text-slate-800">Cập nhật thông tin dự án</h3>
                        <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    <div className="space-y-4">
                        <ModernInput
                            label="Tên dự án"
                            value={form.name}
                            onChange={e => setForm({ ...form, name: e.target.value })}
                            placeholder="Nhập tên dự án..."
                        />
                        
                        <div className="space-y-1">
                            <label className="block text-sm font-medium text-slate-700">Chủ sở hữu</label>
                            <div className="relative">
                                <select
                                    value={form.id_owner}
                                    onChange={(e) => setForm({ ...form, id_owner: e.target.value })}
                                    className="w-full px-4 py-3 bg-white/50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all appearance-none text-slate-700 font-medium"
                                >
                                    <option value="" disabled>-- Chọn chủ sở hữu --</option>
                                    {owners.map(o => (
                                        <option key={o.id} value={o.id}>{o.name}</option>
                                    ))}
                                </select>
                                <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                            </div>
                        </div>

                        <ModernInput
                            label="Vị trí"
                            value={form.location}
                            onChange={e => setForm({ ...form, location: e.target.value })}
                            placeholder="Địa điểm..."
                        />

                        <div className="flex gap-3 pt-4">
                            <PremiumButton
                                variant="secondary"
                                onClick={onClose}
                                className="flex-1"
                            >
                                Hủy
                            </PremiumButton>
                            <PremiumButton
                                onClick={handleSave}
                                loading={loading}
                                className="flex-1"
                            >
                                Lưu thay đổi
                            </PremiumButton>
                        </div>
                    </div>
                </div>
            </GlassCard>
        </div>
    );
};

export default EditProjectModal;
