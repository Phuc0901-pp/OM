import React from 'react';
import GlassCard from '../../../../components/common/GlassCard';
import PremiumButton from '../../../../components/common/PremiumButton';
import { RoleData } from './types';

interface ChangeRoleModalProps {
    isOpen: boolean;
    roles: RoleData[];
    selectedRoleId: string;
    setSelectedRoleId: (id: string) => void;
    onClose: () => void;
    onConfirm: () => void;
}

const ChangeRoleModal: React.FC<ChangeRoleModalProps> = ({
    isOpen,
    roles,
    selectedRoleId,
    setSelectedRoleId,
    onClose,
    onConfirm
}) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in">
            <GlassCard className="w-full max-w-sm !p-0 overflow-hidden">
                <div className="p-6 bg-white/80">
                    <h3 className="text-xl font-bold text-slate-800 mb-4">Đổi vai trò người dùng</h3>
                    <div className="space-y-4">
                        <div>
                            <label className="text-sm font-medium text-slate-700 mb-1 block">Chọn vai trò mới</label>
                            <select
                                className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary-100 focus:border-primary-400 outline-none bg-white"
                                value={selectedRoleId}
                                onChange={(e) => setSelectedRoleId(e.target.value)}
                            >
                                <option value="">Chọn một vai trò...</option>
                                {roles.map(r => (
                                    <option key={r.id} value={r.id}>{r.name}</option>
                                ))}
                            </select>
                        </div>
                        <div className="flex items-center gap-3 pt-4">
                            <PremiumButton variant="secondary" onClick={onClose} className="flex-1">
                                Hủy
                            </PremiumButton>
                            <PremiumButton onClick={onConfirm} className="flex-1">
                                Cập nhật
                            </PremiumButton>
                        </div>
                    </div>
                </div>
            </GlassCard>
        </div>
    );
};

export default ChangeRoleModal;
