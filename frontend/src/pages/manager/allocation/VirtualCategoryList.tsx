/**
 * VirtualCategoryList.tsx
 * Renders the 3-tier allocation category tree (Main -> Station -> Child)
 * using react-window List for maximum performance with large datasets.
 */
import React, { useMemo, useCallback, useRef } from 'react';
import { List } from 'react-window';
import { Check, ChevronDown, HelpCircle } from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Option {
    id: string;
    name: string;
    label?: string;
}

interface StationChildConfig {
    id: string;
    child_category_id: string;
    guide_text?: string;
    image_count?: number;
    process_ids?: string[];
    guide_images?: string[];
    project_classification_id?: string;
}

interface Station {
    id: string;
    name: string;
    id_main_category: string;
    id_project: string;
    child_category_ids?: string[];
    child_configs?: StationChildConfig[];
}

// ── Flat Node Model ───────────────────────────────────────────────────────────

type FlatNodeType = 'main' | 'station' | 'child';

interface FlatNode {
    type: FlatNodeType;
    id: string;
    mainId: string;
    stationId?: string;
    label: string;
    isMainSelected?: boolean;
    isMainExpanded?: boolean;
    isAllSelected?: boolean;
    isAnySelected?: boolean;
    visibleChildrenIds?: string[];
    childCategoryId?: string;
    isChildSelected?: boolean;
    hasGuide?: boolean;
    processNames?: string[];
    imageCount?: number;
    config?: StationChildConfig;
}

const ROW_HEIGHT: Record<FlatNodeType, number> = {
    main: 52,
    station: 44,
    child: 64,
};

// ── Props ─────────────────────────────────────────────────────────────────────

interface VirtualCategoryListProps {
    mainCategories: Option[];
    childCategoriesMap: Record<string, any[]>;
    stationsMap: Record<string, Station[]>;
    expandedCategories: Record<string, boolean>;
    selectedMainCats: Record<string, boolean>;
    selectedChildCats: Record<string, boolean>;
    childAreaNames: Record<string, string>;
    processMap: Record<string, string>;
    selectedClassification: string;
    toggleMainCat: (catId: string, checked: boolean) => void;
    toggleChildCat: (childId: string, mainId: string, checked: boolean) => void;
    handleCategoryExpand: (catId: string, expanded: boolean) => void;
    setSelectedChildCats: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
    setGuidePopup: (p: { title: string; text: string; images: string[] } | null) => void;
    listHeight?: number;
}

// ── Component ─────────────────────────────────────────────────────────────────

const VirtualCategoryList: React.FC<VirtualCategoryListProps> = ({
    mainCategories,
    childCategoriesMap,
    stationsMap,
    expandedCategories,
    selectedMainCats,
    selectedChildCats,
    childAreaNames,
    processMap,
    selectedClassification,
    toggleMainCat,
    toggleChildCat,
    handleCategoryExpand,
    setSelectedChildCats,
    setGuidePopup,
    listHeight = 540,
}) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const listRef = useRef<any>(null);

    // ── Flatten 3-tier tree based on expansion state ──────────────────────────
    const flatNodes = useMemo<FlatNode[]>(() => {
        const nodes: FlatNode[] = [];

        mainCategories.forEach(mainCat => {
            const stations = stationsMap[mainCat.id] || [];
            const flatChildren = childCategoriesMap[mainCat.id] || [];
            const isMainExpanded = expandedCategories[mainCat.id] || false;
            const isMainSelected = selectedMainCats[mainCat.id] || false;

            // Compute visibility
            const visibleStationsCount = stations.reduce((count, station) => {
                const ids = station.child_category_ids || [];
                const hasVisible = ids.some(childId => {
                    const cfg = (station.child_configs || []).find(c => c.child_category_id === childId);
                    if (!cfg) return false;
                    if (selectedClassification && cfg.project_classification_id !== selectedClassification) return false;
                    return true;
                });
                return hasVisible ? count + 1 : count;
            }, 0);

            if (visibleStationsCount === 0 && flatChildren.length === 0) return;

            // Main category row
            nodes.push({
                type: 'main',
                id: mainCat.id,
                mainId: mainCat.id,
                label: mainCat.name,
                isMainSelected,
                isMainExpanded,
            });

            if (!isMainExpanded) return;

            const hasStations = stations.length > 0;

            if (hasStations) {
                stations.forEach(station => {
                    const stationIds = station.child_category_ids || [];
                    const visibleIds = stationIds.filter(childId => {
                        const cfg = (station.child_configs || []).find(c => c.child_category_id === childId);
                        if (!cfg) return false;
                        if (selectedClassification && cfg.project_classification_id !== selectedClassification) return false;
                        return true;
                    });
                    if (visibleIds.length === 0) return;

                    const isAllSelected = visibleIds.every(id => selectedChildCats[id]);
                    const isAnySelected = visibleIds.some(id => selectedChildCats[id]);

                    // Station row
                    nodes.push({
                        type: 'station',
                        id: station.id,
                        mainId: mainCat.id,
                        stationId: station.id,
                        label: station.name,
                        isAllSelected,
                        isAnySelected,
                        visibleChildrenIds: visibleIds,
                    });

                    // Child rows under station
                    visibleIds.forEach(childId => {
                        const child = flatChildren.find((c: any) => c.id === childId);
                        if (!child) return;
                        const isChildSelected = selectedChildCats[childId] || false;
                        const childConfig = (station.child_configs || []).find(c => c.child_category_id === childId);
                        const hasGuide = !!(childConfig && (childConfig.guide_text || (childConfig.guide_images && childConfig.guide_images.length > 0)));
                        const processNames: string[] = [];
                        if (childConfig?.process_ids) {
                            childConfig.process_ids.forEach((pid: string) => {
                                if (processMap[pid]) processNames.push(processMap[pid]);
                            });
                        }
                        nodes.push({
                            type: 'child',
                            id: `${station.id}_${childId}`,
                            mainId: mainCat.id,
                            stationId: station.id,
                            childCategoryId: childId,
                            label: child.name,
                            isChildSelected,
                            hasGuide,
                            processNames,
                            imageCount: childConfig?.image_count,
                            config: childConfig,
                        });
                    });
                });
            } else {
                // Flat (no stations)
                flatChildren.forEach((child: any) => {
                    nodes.push({
                        type: 'child',
                        id: child.id,
                        mainId: mainCat.id,
                        childCategoryId: child.id,
                        label: child.name,
                        isChildSelected: selectedChildCats[child.id] || false,
                        hasGuide: false,
                        processNames: [],
                    });
                });
            }
        });

        return nodes;
    }, [mainCategories, childCategoriesMap, stationsMap, expandedCategories, selectedMainCats, selectedChildCats, childAreaNames, processMap, selectedClassification]);

    // Invalidate react-window row size cache whenever list changes
    React.useEffect(() => {
        listRef.current?.resetAfterIndex?.(0);
    }, [flatNodes.length]);

    const getItemSize = useCallback((index: number) => {
        const node = flatNodes[index];
        return node ? ROW_HEIGHT[node.type] : 52;
    }, [flatNodes]);

    // ── Row Renderer ──────────────────────────────────────────────────────────
    const RowRenderer = useCallback(({ index, style }: { index: number; style: React.CSSProperties }) => {
        const node = flatNodes[index];
        if (!node) return null;

        // ── Main Category ──────────────────────────────────────────────────
        if (node.type === 'main') {
            const { id, label, isMainSelected, isMainExpanded } = node;
            return (
                <div style={style} className={`border-b flex items-center transition-colors ${isMainSelected ? 'bg-emerald-50/60' : 'bg-white hover:bg-slate-50'}`}>
                    <div className="flex items-center px-3 gap-2 w-full h-full">
                        <div
                            onClick={e => { e.stopPropagation(); toggleMainCat(id, !isMainSelected); }}
                            className={`w-5 h-5 shrink-0 rounded border-2 flex items-center justify-center cursor-pointer transition-colors ${isMainSelected ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-slate-300 hover:border-emerald-400'}`}
                        >
                            {isMainSelected && <Check className="w-3 h-3" />}
                        </div>
                        <div className="flex-1 cursor-pointer" onClick={() => handleCategoryExpand(id, !isMainExpanded)}>
                            <h4 className={`font-bold text-sm ${isMainSelected ? 'text-emerald-900' : 'text-slate-700'}`}>{label}</h4>
                        </div>
                        <ChevronDown
                            className={`w-4 h-4 text-slate-400 transition-transform cursor-pointer ${isMainExpanded ? 'rotate-180' : ''}`}
                            onClick={() => handleCategoryExpand(id, !isMainExpanded)}
                        />
                    </div>
                </div>
            );
        }

        // ── Station ────────────────────────────────────────────────────────
        if (node.type === 'station') {
            const { label, isAnySelected, visibleChildrenIds = [] } = node;
            const isAllSel = visibleChildrenIds.every(id => selectedChildCats[id]);
            return (
                <div style={style} className="border-b bg-slate-100/80 flex items-center">
                    <div className="flex items-center px-4 gap-2 w-full">
                        <div
                            onClick={() => {
                                const next = !isAllSel;
                                setSelectedChildCats(prev => {
                                    const updated = { ...prev };
                                    visibleChildrenIds.forEach(id => { updated[id] = next; });
                                    return updated;
                                });
                            }}
                            className={`w-4 h-4 shrink-0 rounded border flex items-center justify-center cursor-pointer ${isAnySelected ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-slate-300 bg-white'}`}
                        >
                            {isAnySelected && <Check className="w-2.5 h-2.5" />}
                        </div>
                        <span className="text-xs font-bold text-slate-600 uppercase tracking-wide">{label}</span>
                    </div>
                </div>
            );
        }

        // ── Child ──────────────────────────────────────────────────────────
        if (node.type === 'child') {
            const { childCategoryId, mainId, label, isChildSelected, hasGuide, processNames = [], imageCount, config } = node;
            if (!childCategoryId) return null;
            return (
                <div style={style} className={`border-b flex items-center transition-colors ${isChildSelected ? 'bg-emerald-50' : 'hover:bg-slate-50'}`}>
                    <div className="flex items-center justify-between px-5 gap-2 w-full">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                            <div
                                onClick={() => toggleChildCat(childCategoryId, mainId, !isChildSelected)}
                                className={`w-4 h-4 shrink-0 rounded border flex items-center justify-center cursor-pointer transition-colors ${isChildSelected ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-slate-300 hover:border-emerald-400'}`}
                            >
                                {isChildSelected && <Check className="w-3 h-3" />}
                            </div>
                            <div className="min-w-0 flex flex-col gap-0.5">
                                <div className="flex items-center gap-1.5">
                                    <span className={`text-sm font-medium truncate ${isChildSelected ? 'text-emerald-900' : 'text-slate-600'}`}>{label}</span>
                                    {hasGuide && (
                                        <div
                                            onClick={e => {
                                                e.stopPropagation();
                                                setGuidePopup({ title: label, text: config?.guide_text || '', images: config?.guide_images || [] });
                                            }}
                                            className="text-indigo-400 hover:text-indigo-600 cursor-pointer shrink-0"
                                        >
                                            <HelpCircle className="w-3.5 h-3.5" />
                                        </div>
                                    )}
                                </div>
                                <div className="flex items-center gap-2 text-[11px]">
                                    {processNames.length > 0 && <span className="text-indigo-600">📋 {processNames.join(', ')}</span>}
                                    {(imageCount ?? 0) > 0 && <span className="text-amber-600">📷 {imageCount} ảnh</span>}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            );
        }

        return null;
    }, [flatNodes, toggleMainCat, toggleChildCat, handleCategoryExpand, setSelectedChildCats, setGuidePopup, selectedChildCats]);

    if (flatNodes.length === 0) {
        return (
            <div className="flex items-center justify-center h-40 text-slate-400 text-sm">
                Không có hạng mục nào phù hợp.
            </div>
        );
    }

    return (
        <List
            listRef={listRef}
            style={{ height: listHeight, width: '100%' }}
            rowCount={flatNodes.length}
            rowHeight={(index) => getItemSize(index)}
            rowComponent={(props) => <RowRenderer index={props.index} style={props.style} />}
            rowProps={{}}
        />
    );
};

export default VirtualCategoryList;
