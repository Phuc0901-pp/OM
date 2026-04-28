import React, { useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2, AlertCircle, Circle } from 'lucide-react';

interface AssetTabBarProps {
 tabs: {
 key: string;
 label: string;
 totalTasks: number;
 doneTasks: number;
 pendingReviewTasks: number;
 rejectedTasks: number;
 }[];
 activeTab: string;
 onSelect: (key: string) => void;
}

const AssetTabBar: React.FC<AssetTabBarProps> = ({ tabs, activeTab, onSelect }) => {
 const scrollRef = useRef<HTMLDivElement>(null);

 // Auto-scroll active tab into view when it changes
 useEffect(() => {
 if (!scrollRef.current) return;
 const activeEl = scrollRef.current.querySelector('[data-active="true"]') as HTMLElement;
 if (activeEl) {
 activeEl.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
 }
 }, [activeTab]);

 return (
 <div className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-sm">
 <div
 ref={scrollRef}
 className="flex gap-2 overflow-x-auto px-4 py-2.5 scrollbar-none"
 style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
 >
 {tabs.map((tab) => {
 const isActive = tab.key === activeTab;
 const isAllDone = tab.doneTasks === tab.totalTasks;
 const hasRejected = tab.rejectedTasks > 0;
 const hasPending = tab.pendingReviewTasks > 0;

 // Pick indicator color
 const indicatorColor = hasRejected
 ? 'bg-red-400'
 : hasPending
 ? 'bg-amber-400'
 : isAllDone
 ? 'bg-emerald-400'
 : 'bg-slate-300';

 return (
 <button
 key={tab.key}
 data-active={isActive}
 onClick={() => onSelect(tab.key)}
 className={`relative flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold whitespace-nowrap transition-all shrink-0 ${
 isActive
 ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/30'
 : 'bg-slate-100 text-slate-600 hover:bg-slate-200 '
 }`}
 >
 {/* Progress Dot */}
 <span className={`w-2 h-2 rounded-full shrink-0 ${indicatorColor}`} />

 {/* Label */}
 <span className="max-w-[120px] truncate">{tab.label}</span>

 {/* Task count badge */}
 <span
 className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
 isActive
 ? 'bg-white/25 text-white'
 : 'bg-white text-slate-500 '
 }`}
 >
 {tab.doneTasks}/{tab.totalTasks}
 </span>

 {/* Active underline indicator */}
 {isActive && (
 <motion.span
 layoutId="tab-indicator"
 className="absolute -bottom-[11px] left-1/2 -translate-x-1/2 w-4 h-0.5 bg-indigo-600 rounded-full"
 />
 )}
 </button>
 );
 })}
 </div>
 </div>
 );
};

export default AssetTabBar;
