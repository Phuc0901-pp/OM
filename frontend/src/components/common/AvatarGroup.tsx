import React, { useState } from 'react';

interface AvatarGroupProps {
    names: string;
    maxVisible?: number;
    size?: 'sm' | 'md';
}
const getInitials = (fullName: string): string => {
    const parts = fullName.trim().split(/\s+/);
    if (parts.length === 0 || !parts[0]) return '?';
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
};
const getAvatarColor = (name: string): string => {
    const palette = [
        'from-violet-500 to-purple-600',
        'from-blue-500 to-indigo-600',
        'from-teal-500 to-emerald-600',
        'from-rose-500 to-pink-600',
        'from-amber-500 to-orange-600',
        'from-sky-500 to-cyan-600',
        'from-indigo-500 to-blue-700',
        'from-emerald-500 to-teal-700',
    ];
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
        hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return palette[Math.abs(hash) % palette.length];
};

const AvatarGroup: React.FC<AvatarGroupProps> = ({ names, maxVisible = 3, size = 'sm' }) => {
    const [tooltipVisible, setTooltipVisible] = useState(false);

    const nameList = names
        ? names.split(',').map(n => n.trim()).filter(Boolean)
        : [];

    if (nameList.length === 0) {
        return <span className="text-xs text-slate-400 italic">Chưa phân công</span>;
    }

    const visible = nameList.slice(0, maxVisible);
    const overflow = nameList.slice(maxVisible);
    const hasOverflow = overflow.length > 0;

    const avatarSize = size === 'md' ? 'w-9 h-9 text-xs' : 'w-7 h-7 text-[10px]';
    const overflowSize = size === 'md' ? 'w-9 h-9 text-xs' : 'w-7 h-7 text-[10px]';

    return (
        <div
            className="relative flex items-center"
            onMouseEnter={() => setTooltipVisible(true)}
            onMouseLeave={() => setTooltipVisible(false)}
        >
            {/* Avatar stack */}
            <div className="flex -space-x-2">
                {visible.map((name, idx) => (
                    <div
                        key={idx}
                        className={`${avatarSize} rounded-full bg-gradient-to-br ${getAvatarColor(name)} flex items-center justify-center font-bold text-white ring-2 ring-white shrink-0 shadow-sm`}
                        title={name}
                    >
                        {getInitials(name)}
                    </div>
                ))}
                {hasOverflow && (
                    <div
                        className={`${overflowSize} rounded-full bg-slate-100 border-2 border-slate-200 flex items-center justify-center font-bold text-slate-500 ring-2 ring-white shrink-0`}
                    >
                        +{overflow.length}
                    </div>
                )}
            </div>

            {/* Tooltip full name list - hiện khi hover */}
            {tooltipVisible && nameList.length > 0 && (
                <div className="absolute bottom-full left-0 mb-2 z-50 animate-in fade-in slide-in-from-bottom-1 duration-150">
                    <div className="bg-slate-900 text-white rounded-xl shadow-2xl shadow-slate-900/30 border border-slate-700/50 p-3 min-w-[160px] max-w-[240px]">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                            {nameList.length} nhân sự
                        </p>
                        <ul className="space-y-1.5">
                            {nameList.map((name, idx) => (
                                <li key={idx} className="flex items-center gap-2">
                                    <div
                                        className={`w-5 h-5 rounded-full bg-gradient-to-br ${getAvatarColor(name)} flex items-center justify-center text-[9px] font-black text-white shrink-0`}
                                    >
                                        {getInitials(name)}
                                    </div>
                                    <span className="text-xs text-slate-200 font-medium truncate">{name}</span>
                                </li>
                            ))}
                        </ul>
                        {/* Arrow */}
                        <div className="absolute top-full left-4 w-0 h-0 border-l-[5px] border-l-transparent border-r-[5px] border-r-transparent border-t-[5px] border-t-slate-900" />
                    </div>
                </div>
            )}
        </div>
    );
};

export default AvatarGroup;
