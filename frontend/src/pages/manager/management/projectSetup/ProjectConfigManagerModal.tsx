import React, { useState, useEffect, useCallback } from 'react';
import ReactDOM from 'react-dom';
import { X, Plus, Trash2, Settings, LayoutGrid, Folder, Layers, Camera, ChevronRight, ChevronDown, BookOpen, AlertCircle, Save, Pencil, Check, Search, Minus } from 'lucide-react';
import api from '../../../../services/api';
import { Asset, Work, SubWork, Process, Config, Template } from './components/types';
import ConfigTab from './components/ConfigTab';
import WorkTab from './components/WorkTab';
import AssetTab from './components/AssetTab';
import TemplateTab from './components/TemplateTab';

export type Tab = 'work' | 'asset' | 'config' | 'template';

export interface Props {
 isOpen: boolean;
 onClose: () => void;
 onChange: () => void;
 projectId?: string;
}

const ProjectConfigManagerModal: React.FC<Props> = ({ isOpen, onClose, onChange, projectId }) => {
 const [activeTab, setActiveTab] = useState<Tab>('config');
 const [assets, setAssets] = useState<Asset[]>([]);
 const [works, setWorks] = useState<Work[]>([]);
 const [subWorks, setSubWorks] = useState<SubWork[]>([]);
 const [processes, setProcesses] = useState<Process[]>([]);

 const fetchBase = useCallback(async () => {
 try {
 const [assetsRes, worksRes, subWorksRes, procsRes] = await Promise.all([
 api.get('/assets', { params: projectId ? { project_id: projectId } : {} }).catch(() => ({ data: [] })),
 api.get('/works').catch(() => ({ data: [] })),
 api.get('/sub-works').catch(() => ({ data: [] })),
 api.get('/process').catch(() => ({ data: [] })),
 ]);
 setAssets(assetsRes.data || []);
 setWorks(worksRes.data || []);
 setSubWorks(subWorksRes.data || []);
 setProcesses(procsRes.data || []);
 } catch (e) {
 console.error('Failed to fetch base data', e);
 }
 }, [projectId]);

 useEffect(() => {
 if (isOpen) {
 fetchBase();
 }
 }, [isOpen, fetchBase]);

 const handleRefresh = () => {
 fetchBase();
 onChange();
 };

 if (!isOpen) return null;

 const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
 { id: 'work', label: 'Hạng mục chính (Work)', icon: <Folder className="w-3.5 h-3.5" /> },
 { id: 'asset', label: 'Tài sản (Asset)', icon: <LayoutGrid className="w-3.5 h-3.5" /> },
 { id: 'config', label: 'Cấu hình (Config)', icon: <Settings className="w-3.5 h-3.5" /> },
 { id: 'template', label: 'Các Mẫu (Template)', icon: <BookOpen className="w-3.5 h-3.5" /> },
 ];

 return ReactDOM.createPortal(
 <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
 <div className="bg-white rounded-2xl w-full max-w-5xl h-[85vh] shadow-2xl flex flex-col overflow-hidden">
 {/* Header */}
 <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50 shrink-0">
 <div className="flex items-center gap-2">
 <Folder className="w-5 h-5 text-indigo-500" />
 <h2 className="text-lg font-bold text-gray-800">Quản lý hạng mục</h2>
 </div>
 <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
 <X className="w-5 h-5 text-gray-500" />
 </button>
 </div>

 {/* Tabs */}
 <div className="flex border-b border-gray-100 shrink-0 bg-white px-4 gap-1 pt-2">
 {tabs.map(tab => (
 <button
 key={tab.id}
 onClick={() => setActiveTab(tab.id)}
 className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold rounded-t-lg border-b-2 transition-all ${activeTab === tab.id
 ? 'text-indigo-600 border-indigo-600 bg-indigo-50'
 : 'text-slate-500 border-transparent hover:text-indigo-500 hover:bg-slate-50'
 }`}
 >
 {tab.icon}
 {tab.label}
 </button>
 ))}
 </div>

 {/* Tab Content */}
 <div className="flex-1 min-h-0 overflow-hidden">
 {activeTab === 'config' && (
 <ConfigTab
 projectId={projectId}
 assets={assets}
 works={works}
 subWorks={subWorks}
 processes={processes}
 onRefresh={handleRefresh}
 />
 )}
 {activeTab === 'work' && (
 <WorkTab works={works} subWorks={subWorks} processes={processes} onRefresh={handleRefresh} />
 )}
 {activeTab === 'asset' && (
 <AssetTab projectId={projectId} assets={assets} onRefresh={handleRefresh} />
 )}
 {activeTab === 'template' && (
 <TemplateTab
 projectId={projectId}
 assets={assets}
 works={works}
 subWorks={subWorks}
 processes={processes}
 />
 )}
 </div>
 </div>
 </div>,
 document.body
 );
};

export default ProjectConfigManagerModal;
