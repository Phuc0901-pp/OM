import React from 'react';
import { LucideIcon } from 'lucide-react';

interface SettingItemProps {
    icon: LucideIcon;
    title: string;
    description: string;
    action?: React.ReactNode;
}

const SettingItem: React.FC<SettingItemProps> = ({
    icon: Icon,
    title,
    description,
    action
}) => {
    return (
        <div className="flex items-center justify-between p-4 rounded-xl border border-gray-100 dark:border-slate-700 bg-white/50 dark:bg-slate-800/50 hover:bg-white dark:hover:bg-slate-800 transition-colors">
            <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300">
                    <Icon className="w-5 h-5" />
                </div>
                <div>
                    <h3 className="font-bold text-gray-800 dark:text-gray-200">{title}</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{description}</p>
                </div>
            </div>
            {action}
        </div>
    );
};

export default SettingItem;
