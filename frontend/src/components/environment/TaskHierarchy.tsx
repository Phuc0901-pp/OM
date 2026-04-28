import React, { useMemo, useState, useEffect, useRef } from 'react';
import {
 ClipboardList, FolderOpen, CheckCircle2, BookOpen,
 LayoutGrid, Tag, Search, X, Layers, Package, Cpu
} from 'lucide-react';
import GlassCard from '../common/GlassCard';
import TaskItem from '../../pages/user/environment/components/TaskItem';
import AssetTabBar from './AssetTabBar';
import { DetailAssign } from '../../pages/user/environment/types';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────
interface ParentGroup {
 parentName: string;
 processes: Record<string, DetailAssign[]>;
}

interface TaskHierarchyProps {
 groupedTasks: Record<string, Record<string, Record<string, ParentGroup>>>;
 expandedMain: Record<string, boolean>;
 setExpandedMain: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
 expandedChild: Record<string, boolean>;
 setExpandedChild: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
 expandedStation: Record<string, boolean>;
 setExpandedStation: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
 draftCaptures: Record<string, (string | Blob)[]>;
 draftNotes: Record<string, string>;
 editingTasks: Set<string>;
 submittingTasks: Set<string>;
 onOpenGuide: (subWorkId: string, subWorkName: string, workName: string) => void;
 onTaskEdit: (taskId: string) => void;
 onTaskSubmit: (taskId: string, overrideNote?: string) => void;
 onTaskCamera: (taskId: string) => void;
 onTaskReset: (taskId: string) => void;
 onTaskSaveNote: (taskId: string, note: string) => void;
 onTaskDeleteImage: (taskId: string, item: string | Blob, index: number) => void;
 onTaskViewImage: (taskId: string, images: (string | Blob)[], index: number) => void;
 selectedAssignId?: string;
 usersMap?: Record<string, string>;
}

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────
const isTaskDone = (t: DetailAssign) => t.status_approve === 1 || t.status_submit === 1;
const isTaskRejected = (t: DetailAssign) => t.status_reject === 1 && t.status_submit !== 1;

type ViewMode = 'asset' | 'category';

interface FlatTask {
 task: DetailAssign;
 mainCatName: string;
 childCatName: string;
 processName: string;
 assetKey: string;
 assetName: string; // parentName — the tab/section label (e.g. "INVERTER 01")
 childAssetName: string; // task.config?.asset?.name — the actual child asset (may differ)
}

interface SearchSuggestion {
 type: 'mainCat' | 'childCat' | 'asset';
 label: string;
 breadcrumb?: string;
 matchOn: string;
 filterField: 'mainCatName' | 'childCatName' | 'assetName';
}

// ─────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────
const TaskHierarchy: React.FC<TaskHierarchyProps> = ({
 groupedTasks,
 draftCaptures,
 draftNotes,
 editingTasks,
 submittingTasks,
 onTaskEdit,
 onTaskSubmit,
 onTaskCamera,
 onTaskReset,
 onTaskSaveNote,
 onTaskDeleteImage,
 onTaskViewImage,
 selectedAssignId,
 usersMap = {},
  onOpenGuide,
}) => {
 const [viewMode, setViewMode] = useState<ViewMode>('asset');
 const [activeTabKey, setActiveTabKey] = useState<string>('');
 const [searchTerm, setSearchTerm] = useState('');
 const [showSuggestions, setShowSuggestions] = useState(false);
 const [activeFilter, setActiveFilter] = useState<SearchSuggestion | null>(null);
 const searchRef = useRef<HTMLInputElement>(null);
 const searchContainerRef = useRef<HTMLDivElement>(null);
 const [dropdownRect, setDropdownRect] = useState<{ top: number; left: number; width: number } | null>(null);

 const updateDropdownRect = () => {
 if (searchContainerRef.current) {
 const r = searchContainerRef.current.getBoundingClientRect();
 setDropdownRect({ top: r.bottom + 8, left: r.left, width: r.width });
 }
 };

 // ── Empty State ──
 if (Object.keys(groupedTasks).length === 0 && selectedAssignId) {
 return (
 <GlassCard className="text-center py-12">
 <ClipboardList className="w-16 h-16 text-slate-300 mx-auto mb-4" />
 <h3 className="text-lg font-bold text-slate-600 mb-2">Chưa có công việc</h3>
 <p className="text-slate-400">Liên hệ quản lý để được phân công công việc chi tiết</p>
 </GlassCard>
 );
 }

 // ─────────────────────────────────────────────
 // 1. FLAT TASK LIST
 // ─────────────────────────────────────────────
 // eslint-disable-next-line react-hooks/rules-of-hooks
 const allFlatTasks = useMemo((): FlatTask[] => {
 const result: FlatTask[] = [];
 Object.entries(groupedTasks)
 .sort(([a], [b]) => a.localeCompare(b, 'vi-VN', { numeric: true, sensitivity: 'base' }))
 .forEach(([mainCat, childGroups]) => {
 Object.entries(childGroups)
 .sort(([a], [b]) => a.localeCompare(b, 'vi-VN', { numeric: true, sensitivity: 'base' }))
 .forEach(([childCat, parentGroups]) => {
 Object.entries(parentGroups)
 .sort(([, a], [, b]) => a.parentName.localeCompare(b.parentName, 'vi-VN', { numeric: true, sensitivity: 'base' }))
 .forEach(([parentGroupKey, { parentName, processes }]) => {
 Object.entries(processes)
 .sort(([a], [b]) => a.localeCompare(b, 'vi-VN', { numeric: true, sensitivity: 'base' }))
 .forEach(([processName, tasks]) => {
 [...tasks]
 .sort((a, b) => (a.config?.asset?.name || '').localeCompare(b.config?.asset?.name || '', 'vi-VN', { numeric: true, sensitivity: 'base' }))
 .forEach(task => {
 const childAssetName = task.config?.asset?.name || parentName;
 result.push({ task, mainCatName: mainCat, childCatName: childCat, processName, assetKey: parentGroupKey, assetName: parentName, childAssetName });
 });
 });
 });
 });
 });
 return result;
 }, [groupedTasks]);

 // ─────────────────────────────────────────────
 // 2. SEARCH SUGGESTIONS
 // ─────────────────────────────────────────────
 // eslint-disable-next-line react-hooks/rules-of-hooks
 const suggestions = useMemo((): SearchSuggestion[] => {
 if (!searchTerm.trim()) return [];
 const q = searchTerm.toLowerCase();
 const seen = new Set<string>();
 const result: SearchSuggestion[] = [];
 allFlatTasks.forEach(ft => {
 const mcKey = `mc:${ft.mainCatName}`;
 if (!seen.has(mcKey) && ft.mainCatName.toLowerCase().includes(q)) {
 seen.add(mcKey);
 result.push({ type: 'mainCat', label: ft.mainCatName, matchOn: ft.mainCatName, filterField: 'mainCatName' });
 }
 const ccKey = `cc:${ft.mainCatName}:${ft.childCatName}`;
 if (!seen.has(ccKey) && ft.childCatName.toLowerCase().includes(q)) {
 seen.add(ccKey);
 result.push({ type: 'childCat', label: ft.childCatName, breadcrumb: ft.mainCatName, matchOn: ft.childCatName, filterField: 'childCatName' });
 }
 const aKey = `asset:${ft.assetName}`;
 if (!seen.has(aKey) && ft.assetName.toLowerCase().includes(q)) {
 seen.add(aKey);
 result.push({ type: 'asset', label: ft.assetName, matchOn: ft.assetName, filterField: 'assetName' });
 }
 });
 return result.slice(0, 10);
 }, [allFlatTasks, searchTerm]);

 // ─────────────────────────────────────────────
 // 3. FILTER
 // ─────────────────────────────────────────────
 // eslint-disable-next-line react-hooks/rules-of-hooks
 const filteredTasks = useMemo(() => {
 if (!activeFilter) return allFlatTasks;
 return allFlatTasks.filter(ft => ft[activeFilter.filterField] === activeFilter.matchOn);
 }, [allFlatTasks, activeFilter]);

 // ─────────────────────────────────────────────
 // 4. VIEWS from filteredTasks
 // ─────────────────────────────────────────────
 // eslint-disable-next-line react-hooks/rules-of-hooks
 const { assetTabs, assetGroupsByKey, catTabs, catGroupsByKey } = useMemo(() => {
 // ── ASSET VIEW ──
 type AssetTab = { key: string; label: string; totalTasks: number; doneTasks: number; pendingReviewTasks: number; rejectedTasks: number };
 type AssetGroup = { mainCatName: string; childCatName: string; tasks: FlatTask[] };
 const assetTabMap = new Map<string, AssetTab>();
 const assetGrpMap = new Map<string, AssetGroup[]>();

 for (const ft of filteredTasks) {
 if (!assetTabMap.has(ft.assetKey)) {
 assetTabMap.set(ft.assetKey, { key: ft.assetKey, label: ft.assetName, totalTasks: 0, doneTasks: 0, pendingReviewTasks: 0, rejectedTasks: 0 });
 assetGrpMap.set(ft.assetKey, []);
 }
 const tab = assetTabMap.get(ft.assetKey)!;
 tab.totalTasks++;
 if (isTaskDone(ft.task)) tab.doneTasks++;
 if (ft.task.status_submit === 1 && ft.task.status_approve !== 1 && ft.task.status_reject !== 1) tab.pendingReviewTasks++;
 if (isTaskRejected(ft.task)) tab.rejectedTasks++;
 const groups = assetGrpMap.get(ft.assetKey)!;
 let pg = groups.find(g => g.mainCatName === ft.mainCatName && g.childCatName === ft.childCatName);
 if (!pg) { pg = { mainCatName: ft.mainCatName, childCatName: ft.childCatName, tasks: [] }; groups.push(pg); }
 pg.tasks.push(ft);
 }

 // ── CATEGORY VIEW ──
 type CatTab = { key: string; label: string; totalTasks: number; doneTasks: number; pendingReviewTasks: number; rejectedTasks: number };
 type CatGroup = { childCatName: string; tasks: FlatTask[] };
 const catTabMap = new Map<string, CatTab>();
 const catGrpMap = new Map<string, CatGroup[]>();

 for (const ft of filteredTasks) {
 const key = ft.mainCatName;
 if (!catTabMap.has(key)) {
 catTabMap.set(key, { key, label: ft.mainCatName, totalTasks: 0, doneTasks: 0, pendingReviewTasks: 0, rejectedTasks: 0 });
 catGrpMap.set(key, []);
 }
 const tab = catTabMap.get(key)!;
 tab.totalTasks++;
 if (isTaskDone(ft.task)) tab.doneTasks++;
 if (ft.task.status_submit === 1 && ft.task.status_approve !== 1 && ft.task.status_reject !== 1) tab.pendingReviewTasks++;
 if (isTaskRejected(ft.task)) tab.rejectedTasks++;
 const groups = catGrpMap.get(key)!;
 let cg = groups.find(g => g.childCatName === ft.childCatName);
 if (!cg) { cg = { childCatName: ft.childCatName, tasks: [] }; groups.push(cg); }
 cg.tasks.push(ft);
 }

 return {
 assetTabs: Array.from(assetTabMap.values()),
 assetGroupsByKey: assetGrpMap,
 catTabs: Array.from(catTabMap.values()),
 catGroupsByKey: catGrpMap,
 };
 }, [filteredTasks]);

 // ─────────────────────────────────────────────
 // 5. TAB RESOLUTION
 // ─────────────────────────────────────────────
 const currentTabs = viewMode === 'asset' ? assetTabs : catTabs;
 const isValidTab = currentTabs.some(t => t.key === activeTabKey);
 const resolvedActive = isValidTab ? activeTabKey : (currentTabs.length > 0 ? currentTabs[0].key : '');

 // eslint-disable-next-line react-hooks/rules-of-hooks
 useEffect(() => {
 if (!isValidTab && currentTabs.length > 0) setActiveTabKey(currentTabs[0].key);
 }, [isValidTab, currentTabs]);

 // eslint-disable-next-line react-hooks/rules-of-hooks
 useEffect(() => { setActiveTabKey(''); }, [viewMode]);

 const activeAssetGroups = viewMode === 'asset' ? (assetGroupsByKey.get(resolvedActive) || []) : [];
 const activeCatGroups = viewMode === 'category' ? (catGroupsByKey.get(resolvedActive) || []) : [];

 // ─────────────────────────────────────────────
 // 6. RENDER HELPERS
 // ─────────────────────────────────────────────
 // Smart label: show childAssetName only when it differs from the parent asset group
 const makeTaskLabel = (ft: FlatTask): string => {
 const isDifferent = ft.childAssetName.trim().toLowerCase() !== ft.assetName.trim().toLowerCase();
 return isDifferent ? `${ft.processName} @ ${ft.childAssetName}` : ft.processName;
 };

 const renderTask = (ft: FlatTask, label: string) => (
 <TaskItem
 key={ft.task.id}
 task={ft.task}
 processName={label}
 config={ft.task.config}
 isEditing={editingTasks.has(ft.task.id)}
 isSubmitting={submittingTasks.has(ft.task.id)}
 draftCaptures={draftCaptures[ft.task.id] || []}
 draftNote={draftNotes[ft.task.id]}
 onEdit={() => onTaskEdit(ft.task.id)}
 onSubmit={(note?: string) => onTaskSubmit(ft.task.id, note)}
 onCamera={() => onTaskCamera(ft.task.id)}
 onReset={() => onTaskReset(ft.task.id)}
 onSaveNote={(note: string) => onTaskSaveNote(ft.task.id, note)}
 onDeleteImage={(val: string | Blob, idx: number) => onTaskDeleteImage(ft.task.id, val, idx)}
 onViewImage={(imgs: (string | Blob)[], idx: number) => onTaskViewImage(ft.task.id, imgs, idx)}
 usersMap={usersMap}
 />
 );

 const renderGroup = (
 tasks: FlatTask[],
 header: React.ReactNode,
 labelFn: (ft: FlatTask) => string,
 groupKey: string
 ) => {
 const done = tasks.filter(ft => isTaskDone(ft.task)).length;
 const allDone = done === tasks.length;
 return (
 <div key={groupKey}>
 <div className="flex items-center gap-2 px-2 pb-2">
 <FolderOpen className={`w-4 h-4 shrink-0 ${allDone ? 'text-emerald-500' : 'text-indigo-500'}`} strokeWidth={2.5} />
 <div className="flex-1 min-w-0">{header}</div>
        {tasks.length > 0 && onOpenGuide && (
          <button
            onClick={() => {
              const sw = tasks[0].task.config?.sub_work;
              if (sw) onOpenGuide(sw.id, sw.name, sw.work?.name || '');
            }}
            className="flex items-center gap-1 text-[10px] font-bold text-teal-600 bg-teal-50 border border-teal-200 px-2 py-0.5 rounded-full hover:bg-teal-100 transition-colors mr-2 shrink-0"
            title="Xem hướng dẫn hạng mục này"
          >
            <BookOpen className="w-3 h-3" />
            Hướng dẫn
          </button>
        )}
 {allDone ? (
 <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
 ) : (
 <span className="text-[11px] font-bold text-slate-400 shrink-0 bg-slate-100 px-2 py-0.5 rounded-full">
 {done}/{tasks.length}
 </span>
 )}
 </div>
 <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
 <div className="divide-y divide-slate-100 ">
 {tasks.map(ft => renderTask(ft, labelFn(ft)))}
 </div>
 </div>
 </div>
 );
 };

 // Category view: sub-groups tasks by asset inside the card
 const renderCategoryGroup = (group: { childCatName: string; tasks: FlatTask[] }, i: number) => {
 const done = group.tasks.filter(ft => isTaskDone(ft.task)).length;
 const allDone = done === group.tasks.length;

 // Group tasks by assetName (preserve insertion order)
 const byAsset: { assetName: string; tasks: FlatTask[] }[] = [];
 group.tasks.forEach(ft => {
 let bucket = byAsset.find(b => b.assetName === ft.assetName);
 if (!bucket) { bucket = { assetName: ft.assetName, tasks: [] }; byAsset.push(bucket); }
 bucket.tasks.push(ft);
 });

 return (
 <div key={`cat-${resolvedActive}-${group.childCatName}-${i}`}>
 {/* Section header (outside card) */}
 <div className="flex items-center gap-2 px-2 pb-2">
 <FolderOpen className={`w-4 h-4 shrink-0 ${allDone ? 'text-emerald-500' : 'text-indigo-500'}`} strokeWidth={2.5} />
 <span className="flex-1 text-xs font-bold text-indigo-600 truncate">{group.childCatName}</span>
          {group.tasks.length > 0 && onOpenGuide && (
            <button
              onClick={() => {
                const sw = group.tasks[0].task.config?.sub_work;
                if (sw) onOpenGuide(sw.id, sw.name, sw.work?.name || '');
              }}
              className="flex items-center gap-1 text-[10px] font-bold text-teal-600 bg-teal-50 border border-teal-200 px-2 py-0.5 rounded-full hover:bg-teal-100 transition-colors mr-2 shrink-0"
              title="Xem hướng dẫn hạng mục này"
            >
              <BookOpen className="w-3 h-3" />
              Hướng dẫn
            </button>
          )}
 {allDone ? (
 <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
 ) : (
 <span className="text-[11px] font-bold text-slate-400 shrink-0 bg-slate-100 px-2 py-0.5 rounded-full">
 {done}/{group.tasks.length}
 </span>
 )}
 </div>

 {/* Card with asset sub-sections */}
 <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
 {byAsset.map((bucket, bi) => {
 const bucketDone = bucket.tasks.filter(ft => isTaskDone(ft.task)).length;
 const bucketAllDone = bucketDone === bucket.tasks.length;
 return (
 <div key={`${bucket.assetName}-${bi}`}>
 {/* Asset inline section header */}
 <div className={`flex items-center gap-2 px-4 py-2 ${
 bi > 0 ? 'border-t-2 border-slate-100 mt-0' : ''
 } bg-slate-50/60 `}>
 <span className="w-1.5 h-1.5 rounded-full shrink-0 bg-indigo-400" />
 <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider flex-1">
 {bucket.assetName}
 </span>
 {bucketAllDone ? (
 <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
 ) : (
 <span className="text-[10px] font-semibold text-slate-400">
 {bucketDone}/{bucket.tasks.length}
 </span>
 )}
 </div>
 {/* Tasks for this asset — child asset shown when ≠ parentAsset */}
 <div className="divide-y divide-slate-100 ">
 {bucket.tasks.map(ft => renderTask(ft, makeTaskLabel(ft)))}
 </div>
 </div>
 );
 })}
 </div>
 </div>
 );
 };

 const BADGE_STYLES: Record<SearchSuggestion['type'], string> = {
 asset: 'bg-indigo-100 text-indigo-700',
 childCat: 'bg-emerald-100 text-emerald-700',
 mainCat: 'bg-amber-100 text-amber-700',
 };
 const TYPE_LABELS: Record<SearchSuggestion['type'], string> = {
 asset: 'Tài sản', childCat: 'Công việc', mainCat: 'Hạng mục',
 };

 // ─────────────────────────────────────────────
 // RENDER
 // ─────────────────────────────────────────────
 return (
 <div className="flex flex-col gap-0 pb-6">

 {/* ── Sticky Controls: Toggle + Search ── */}
 <div className="sticky top-0 z-20 bg-slate-50/95 backdrop-blur-sm border-b border-slate-200 px-3 pt-3 pb-2 space-y-2">

 {/* Segmented Control */}
 <div className="flex gap-1 bg-slate-100 rounded-xl p-1">
 {([['asset', 'Theo Tài sản', LayoutGrid], ['category', 'Theo Hạng mục', Tag]] as const).map(([mode, label, Icon]) => (
 <button
 key={mode}
 onClick={() => setViewMode(mode as ViewMode)}
 className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-bold rounded-lg transition-all ${
 viewMode === mode
 ? 'bg-white text-indigo-700 shadow-sm'
 : 'text-slate-500 hover:text-slate-700 '
 }`}
 >
 <Icon className="w-3.5 h-3.5" />
 {label}
 </button>
 ))}
 </div>

 {/* Smart Search */}
 <div className="relative" ref={searchContainerRef}>
 <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-2 shadow-sm">
 <Search className="w-4 h-4 text-slate-400 shrink-0" />
 {activeFilter ? (
 <div className="flex items-center gap-1.5 flex-1 min-w-0">
 <span className={`flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full shrink-0 ${BADGE_STYLES[activeFilter.type]}`}>
 {activeFilter.breadcrumb && <span className="opacity-60 mr-1">{activeFilter.breadcrumb} ›</span>}
 {activeFilter.label}
 </span>
 <button onClick={() => { setActiveFilter(null); setSearchTerm(''); }} className="text-slate-400 hover:text-slate-600">
 <X className="w-3.5 h-3.5" />
 </button>
 </div>
 ) : (
 <input
 ref={searchRef}
 type="text"
 value={searchTerm}
 onChange={e => { setSearchTerm(e.target.value); setShowSuggestions(true); updateDropdownRect(); }}
 onFocus={() => { setShowSuggestions(true); updateDropdownRect(); }}
 onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
 placeholder="Tìm hạng mục, tên công việc, tài sản..."
 className="flex-1 text-sm bg-transparent outline-none text-slate-800 placeholder:text-slate-400"
 />
 )}
 {searchTerm && !activeFilter && (
 <button onClick={() => setSearchTerm('')} className="text-slate-400 hover:text-slate-600 shrink-0">
 <X className="w-3.5 h-3.5" />
 </button>
 )}
 </div>
 </div>
 </div>

 {/* Suggestion Dropdown — rendered FIXED to escape sticky stacking context */}
 {showSuggestions && suggestions.length > 0 && !activeFilter && dropdownRect && (
 <div
 style={{
 position: 'fixed',
 top: dropdownRect.top,
 left: dropdownRect.left,
 width: dropdownRect.width,
 zIndex: 9999,
 }}
 className="bg-white rounded-2xl border border-slate-200 shadow-2xl overflow-hidden"
 >
 <div className="px-4 pt-3 pb-1.5 border-b border-slate-100 ">
 <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Gợi ý tìm kiếm</p>
 </div>
 <div className="py-1 max-h-64 overflow-y-auto">
 {suggestions.map((s, i) => {
 const iconMap = {
 mainCat: <Layers className="w-4 h-4 text-amber-500 shrink-0" />,
 childCat: <Tag className="w-4 h-4 text-emerald-500 shrink-0" />,
 asset: <Cpu className="w-4 h-4 text-indigo-500 shrink-0" />,
 };
 const chipMap = {
 mainCat: 'text-amber-700 bg-amber-50 border-amber-200 ',
 childCat: 'text-emerald-700 bg-emerald-50 border-emerald-200 ',
 asset: 'text-indigo-700 bg-indigo-50 border-indigo-200 ',
 };
 const chipLabel = { mainCat: 'Hạng mục', childCat: 'Công việc', asset: 'Tài sản' };
 return (
 <button
 key={i}
 onMouseDown={() => { setActiveFilter(s); setSearchTerm(''); setShowSuggestions(false); }}
 className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 text-left transition-colors group"
 >
 <div className={`p-1 rounded-lg ${s.type === 'mainCat' ? 'bg-amber-50 ' : s.type === 'childCat' ? 'bg-emerald-50 ' : 'bg-indigo-50 '}`}>
 {iconMap[s.type]}
 </div>
 <div className="flex-1 min-w-0">
 {s.breadcrumb && (
 <p className="text-[10px] text-slate-400 font-semibold mb-0.5 truncate">
 {s.breadcrumb} ›
 </p>
 )}
 <p className="text-sm font-semibold text-slate-800 truncate group-hover:text-indigo-700 transition-colors">
 {s.label}
 </p>
 </div>
 <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${chipMap[s.type]}`}>
 {chipLabel[s.type]}
 </span>
 </button>
 );
 })}
 </div>
 </div>
 )}

 {/* ── Tab Bar ── */}
 {currentTabs.length > 0 && (
 <AssetTabBar
 tabs={currentTabs}
 activeTab={resolvedActive}
 onSelect={setActiveTabKey}
 />
 )}

 {/* ── Task Groups ── */}
 <div className="pt-4 px-2 space-y-6">

 {/* ASSET VIEW */}
 {viewMode === 'asset' && activeAssetGroups.map((group, i) =>
 renderGroup(
 group.tasks,
 <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 min-w-0">
 <span className="text-xs font-bold text-slate-800 uppercase tracking-wider leading-tight">{group.mainCatName}</span>
 <span className="text-slate-300 shrink-0">›</span>
 <span className="text-xs font-bold text-indigo-600 leading-tight">{group.childCatName}</span>
 </div>,
 ft => makeTaskLabel(ft),
 `asset-${resolvedActive}-${group.mainCatName}-${group.childCatName}-${i}`
 )
 )}

 {/* CATEGORY VIEW — 3-tier: Tab(mainCat) > Card(childCat) > InlineSection(asset) > Task */}
 {viewMode === 'category' && activeCatGroups.map((group, i) =>
 renderCategoryGroup(group, i)
 )}

 {/* Empty State */}
 {((viewMode === 'asset' && activeAssetGroups.length === 0) ||
 (viewMode === 'category' && activeCatGroups.length === 0)) && (
 <GlassCard className="text-center py-12">
 <ClipboardList className="w-16 h-16 text-slate-300 mx-auto mb-4" />
 <h3 className="text-lg font-bold text-slate-600 mb-2">Không có công việc</h3>
 <p className="text-slate-400 text-sm">
 {activeFilter ? 'Không tìm thấy kết quả phù hợp với bộ lọc.' : 'Chọn tab khác để xem công việc.'}
 </p>
 </GlassCard>
 )}
 </div>
 </div>
 );
};

export default TaskHierarchy;
