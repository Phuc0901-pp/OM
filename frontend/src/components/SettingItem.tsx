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
        <div className="flex items-center justify-between p-4 hover:bg-gray-50 rounded-xl transition-colors">
            <div className="flex items-start gap-4">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Icon className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                    <h4 className="font-medium text-gray-900">{title}</h4>
                    <p className="text-sm text-gray-500 mt-0.5">{description}</p>
                </div>
            </div>
            {action && (
                <div className="flex-shrink-0">
                    {action}
                </div>
            )}
        </div>
    );
};

export default SettingItem;
