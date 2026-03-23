import React from 'react';
import { Users } from 'lucide-react';
import GlassCard from '../../../../components/common/GlassCard';
import type { User } from '../../../../types/models';

interface TeamSelectionProps {
    users: User[];
    selectedUsers: string[];
    roles: any[];
    toggleUser: (userId: string) => void;
}

const TeamSelection: React.FC<TeamSelectionProps> = ({ users, roles, selectedUsers, toggleUser }) => {
    // Find ID of Role Engineer to filter user. Fallback static UUID from previous code just in case
    const engineerRoles = roles.filter(r => r.name?.toLowerCase().includes('engineer'));
    const engineerRoleIds = engineerRoles.map(r => r.id);
    const validEngineerRoleIds = ['bd1f7356-07e4-4a63-b3b2-ce72db489436', ...engineerRoleIds];

    const getRoleName = (roleId?: string) => {
        if (!roleId) return 'N/A';
        const found = roles.find(r => r.id === roleId);
        return found ? found.name : 'N/A';
    };
    return (
        <div className="xl:col-span-3 space-y-6">
            <GlassCard className="h-full flex flex-col">
                <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2"><Users className="w-5 h-5 text-indigo-600" /> Nhân Sự</h3>
                    <span className="text-xs font-bold bg-indigo-100 text-indigo-600 px-2 py-1 rounded">{selectedUsers.length}</span>
                </div>
                <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                    {users
                        .filter(u => validEngineerRoleIds.includes(u.role_id || u.id_role || '') || (u.role || u.role_model)?.name?.toLowerCase().includes('engineer'))
                        .map(u => {
                            const isSelected = selectedUsers.includes(u.id);
                            return (
                                <div
                                    key={u.id}
                                    onClick={() => toggleUser(u.id)}
                                    className={`p-3 rounded-xl cursor-pointer border transition-all flex items-center gap-3 ${isSelected ? 'bg-indigo-600 border-indigo-600 text-white shadow-md' : 'bg-white border-slate-100 hover:bg-slate-50'}`}
                                >
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${isSelected ? 'bg-white text-indigo-600' : 'bg-slate-100 text-slate-500'}`}>
                                        {u.name?.charAt(0) ?? '?'}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="text-sm font-bold truncate">{u.name}</div>
                                        <div className={`text-[10px] uppercase font-bold ${isSelected ? 'text-indigo-200' : 'text-slate-400'}`}>
                                            {(u.role || u.role_model)?.name ?? getRoleName(u.role_id || u.id_role)}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                </div>
            </GlassCard>
        </div>
    );
};

export default TeamSelection;
