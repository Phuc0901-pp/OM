import React, { useState, useEffect, useCallback } from 'react';
import {
    X, Plus, Trash2, Settings, LayoutGrid, Folder, Layers, Camera,
    ChevronRight, ChevronDown, BookOpen, AlertCircle, Save, Pencil, Check, Search, Minus
} from 'lucide-react';
import api from '../../../../../services/api';
import { Asset, Work, SubWork, Process, Config, Template } from './types';


interface AssetTreeNode extends Asset { children: AssetTreeNode[]; }

const buildAssetTree = (assets: Asset[]): AssetTreeNode[] => {
    const map: Record<string, AssetTreeNode> = {};
    const roots: AssetTreeNode[] = [];
    assets.forEach(a => { map[a.id] = { ...a, children: [] }; });
    assets.forEach(a => {
        if (a.parent_id && map[a.parent_id]) {
            map[a.parent_id].children.push(map[a.id]);
        } else {
            roots.push(map[a.id]);
        }
    });
    return roots;
};

interface AssetNodeProps {
    node: AssetTreeNode;
    level: number;
    onDelete: (id: string) => void;
    onAddChild: (parentId: string) => void;
}

const AssetNode: React.FC<AssetNodeProps> = ({ node, level, onDelete, onAddChild }) => {
    const [expanded, setExpanded] = useState(true);
    const hasChildren = node.children.length > 0;
    const isLeaf = level > 0;

    return (
        <div>
            <div
                className={`group flex items-center justify-between px-3 py-2.5 rounded-lg border transition-all
                    ${isLeaf
                        ? 'border-emerald-100 bg-emerald-50/50 ml-4 mb-1'
                        : 'border-slate-200 bg-white hover:border-emerald-200 mb-1'
                    }`}
            >
                <div className="flex items-center gap-2 text-sm">
                    {/* Expand/collapse for parent nodes */}
                    {hasChildren ? (
                        <button
                            onClick={() => setExpanded(p => !p)}
                            className="text-slate-400 hover:text-emerald-600 transition-colors p-0.5"
                        >
                            {expanded
                                ? <ChevronDown className="w-3.5 h-3.5" />
                                : <ChevronRight className="w-3.5 h-3.5" />
                            }
                        </button>
                    ) : (
                        <div className="w-5 flex items-center justify-center">
                            {isLeaf
                                ? <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                                : <LayoutGrid className="w-3.5 h-3.5 text-emerald-400" />
                            }
                        </div>
                    )}
                    <span className={`font-medium ${isLeaf ? 'text-emerald-700 text-xs' : 'text-slate-700 text-sm'}`}>
                        {node.name}
                    </span>
                    {hasChildren && (
                        <span className="text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-full ml-1">
                            {node.children.length} thiết bị con
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                    {/* Add sub-asset button */}
                    <button
                        onClick={() => onAddChild(node.id)}
                        className="p-1 text-emerald-500 hover:text-emerald-700 hover:bg-emerald-50 rounded text-[10px] flex items-center gap-0.5 font-semibold border border-transparent hover:border-emerald-200"
                        title="Thêm thiết bị con"
                    >
                        <Plus className="w-3 h-3" /> Con
                    </button>
                    <button
                        onClick={() => onDelete(node.id)}
                        className="p-1 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded"
                        title="Xóa"
                    >
                        <Trash2 className="w-3.5 h-3.5" />
                    </button>
                </div>
            </div>
            {hasChildren && expanded && (
                <div className="ml-4 pl-3 border-l-2 border-dashed border-emerald-100">
                    {node.children.map(child => (
                        <AssetNode
                            key={child.id}
                            node={child}
                            level={level + 1}
                            onDelete={onDelete}
                            onAddChild={onAddChild}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};

const AssetTab: React.FC<{ projectId?: string; assets: Asset[]; onRefresh: () => void }> = ({ projectId, assets, onRefresh }) => {
    const [newName, setNewName] = useState('');
    const [selectedParentId, setSelectedParentId] = useState<string>('');
    const [bulkCount, setBulkCount] = useState<number | ''>(1);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Trigger form to add child of specific parent
    const handleAddChild = (parentId: string) => {
        setSelectedParentId(parentId);
        setNewName('');
        setBulkCount(1);
        document.getElementById('asset-name-input')?.focus();
    };

    const handleAdd = async () => {
        const count = typeof bulkCount === 'number' ? bulkCount : 1;
        if (!newName.trim() || count < 1 || count > 100) return;
        setLoading(true);
        setError(null);
        try {
            if (count === 1) {
                const payload: Record<string, any> = { name: newName };
                if (projectId) payload.id_project = projectId;
                if (selectedParentId) payload.parent_id = selectedParentId;
                await api.post('/assets', payload);
            } else {
                const promises = [];
                for (let i = 1; i <= count; i++) {
                    const payload: Record<string, any> = { name: `${newName.trim()} ${i.toString().padStart(2, '0')}` };
                    if (projectId) payload.id_project = projectId;
                    if (selectedParentId) payload.parent_id = selectedParentId;
                    promises.push(api.post('/assets', payload));
                }
                await Promise.all(promises);
            }
            setNewName('');
            setBulkCount(1);
            setSelectedParentId('');
            onRefresh();
        } catch (e: any) { setError(e.response?.data?.error || 'Lỗi'); } finally { setLoading(false); }
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm('Xóa tài sản này? (Các thiết bị con sẽ bị xóa theo)')) return;
        try { await api.delete(`/assets/${id}`); onRefresh(); } catch { setError('Xóa thất bại.'); }
    };

    const assetTree = buildAssetTree(assets);
    const parentAsset = selectedParentId ? assets.find(a => a.id === selectedParentId) : null;

    return (
        <div className="p-5 space-y-4 overflow-y-auto h-full custom-scrollbar">
            {error && <p className="text-red-500 text-sm px-3 py-2 bg-red-50 rounded-lg border border-red-200">{error}</p>}

            {/* Header */}
            <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                <LayoutGrid className="w-4 h-4 text-emerald-400" /> Tài sản dự án
                <span className="text-[10px] text-slate-400 font-normal ml-1">({assets.length} tổng cộng)</span>
            </h3>

            {/* Add Form */}
            <div className="flex flex-col gap-2 bg-slate-50 rounded-xl p-3 border border-slate-200">
                {/* Parent selector */}
                <div className="flex items-center gap-2">
                    <label className="text-[11px] font-semibold text-slate-500 whitespace-nowrap">Thuộc thiết bị:</label>
                    <select
                        value={selectedParentId}
                        onChange={e => setSelectedParentId(e.target.value)}
                        className="flex-1 px-2 py-1.5 text-[11px] border border-slate-200 rounded-lg focus:ring-1 focus:ring-emerald-300 outline-none bg-white"
                    >
                        <option value="">(Thiết bị gốc)</option>
                        {assets.filter(a => !a.parent_id).map(a => (
                            <option key={a.id} value={a.id}>{a.name}</option>
                        ))}
                    </select>
                </div>

                {/* Parent preview badge */}
                {parentAsset && (
                    <div className="flex items-center gap-1 text-[11px] text-emerald-700 bg-emerald-50 border border-emerald-100 px-2.5 py-1 rounded-full w-fit">
                        <LayoutGrid className="w-3 h-3" /> Thêm vào: <span className="font-bold">{parentAsset.name}</span>
                        <button onClick={() => setSelectedParentId('')} className="ml-1 text-slate-400 hover:text-red-400">
                            <X className="w-3 h-3" />
                        </button>
                    </div>
                )}

                {/* Name input + Add button */}
                <div className="flex gap-2">
                    <input
                        id="asset-name-input"
                        type="text"
                        placeholder={parentAsset ? `Tên chuỗi/thiết bị con bên trong ${parentAsset.name}...` : "Tên tài sản/thiết bị..."}
                        className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-300 focus:border-emerald-400 outline-none bg-white min-w-0"
                        value={newName}
                        onChange={e => setNewName(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleAdd()}
                    />
                    <div className="flex items-center gap-1.5 border border-slate-200 bg-white rounded-lg px-2 shrink-0" title="Số lượng tạo hàng loạt (Tự thêm số 01, 02...)">
                        <span className="text-xs text-slate-500 font-medium">SL:</span>
                        <input
                            type="number"
                            min={1}
                            max={100}
                            className="w-10 py-1.5 text-sm text-center outline-none bg-transparent"
                            value={bulkCount}
                            onChange={e => {
                                const val = e.target.value;
                                setBulkCount(val === '' ? '' : Number(val));
                            }}
                        />
                    </div>
                    <button
                        onClick={handleAdd}
                        disabled={loading || !newName.trim()}
                        className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-1.5 shrink-0"
                    >
                        <Plus className="w-4 h-4" /> Thêm
                    </button>
                </div>
            </div>

            {/* Tree list */}
            <div className="space-y-1">
                {assetTree.map(node => (
                    <AssetNode
                        key={node.id}
                        node={node}
                        level={0}
                        onDelete={handleDelete}
                        onAddChild={handleAddChild}
                    />
                ))}
                {assets.length === 0 && <p className="text-xs text-slate-400 text-center py-5">Chưa có tài sản nào.</p>}
            </div>
        </div>
    );
};


export default AssetTab;
