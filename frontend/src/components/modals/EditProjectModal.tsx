import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
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
    const [form, setForm] = useState({
        project_name: '',
        owner: '',
        area: 0,
        location: ''
    });
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (project) {
            setForm({
                project_name: project.project_name || '',
                owner: project.owner || '',
                area: project.area || 0,
                location: project.location || ''
            });
        }
    }, [project]);

    const handleSave = async () => {
        setLoading(true);
        try {
            await api.put(`/projects/${project.project_id || project.id}`, form);
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
                            value={form.project_name}
                            onChange={e => setForm({ ...form, project_name: e.target.value })}
                            placeholder="Nhập tên dự án..."
                        />
                        <ModernInput
                            label="Chủ sở hữu"
                            value={form.owner}
                            onChange={e => setForm({ ...form, owner: e.target.value })}
                            placeholder="Tên chủ sở hữu..."
                        />
                        <div className="grid grid-cols-2 gap-4">
                            <ModernInput
                                label="Vị trí"
                                value={form.location}
                                onChange={e => setForm({ ...form, location: e.target.value })}
                                placeholder="Địa điểm..."
                            />
                            <ModernInput
                                label="Diện tích (m²)"
                                type="number"
                                value={form.area}
                                onChange={e => setForm({ ...form, area: Number(e.target.value) })}
                                placeholder="0"
                            />
                        </div>

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
