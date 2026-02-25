// Refactored ProjectSetupPage - Clean, maintainable version
// Uses custom hook and helper functions for separation of concerns

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    ChevronLeft, Save, CheckCircle, ChevronDown, ChevronRight,
    Settings, FileText, Activity, CheckSquare, Square
} from 'lucide-react';
import PremiumButton from '../../../../components/common/PremiumButton';
import GlassCard from '../../../../components/common/GlassCard';
import CategoryManagerModal from '../../../../components/CategoryManagerModal';
import EditProjectModal from '../../../../components/modals/EditProjectModal';

import { useProjectSetup } from './useProjectSetup';
import { ChildCategory, Station } from './types';

const ProjectSetupPage: React.FC = () => {
    const navigate = useNavigate();
    const [showEditModal, setShowEditModal] = useState(false);
    const [isManagerOpen, setIsManagerOpen] = useState(false);

    const {
        id,
        project,
        categories,
        stationsMap,
        childCategoriesMap,
        availableProcesses,
        availableClassifications,
        loading,
        error,
        selectedCategoryIds,
        selectedChild,
        selectedStationId,
        expandedMain,
        expandedStation,
        configForm,
        isManagerRoute,
        setExpandedMain,
        setExpandedStation,
        setSelectedStationId,
        handleBack,
        handleSelectChild,
        handleSaveConfig,
        handleToggleCategory,
        handleFileUpload,
        updateCharacteristic,
        updateProcessIds,
        fetchData,
        fetchStationsForMain
    } = useProjectSetup();

    const handleEditProjectInfo = () => {
        if (isManagerRoute) {
            setShowEditModal(true);
        } else {
            navigate(`/admin/database?tab=projects&search=${id}`);
        }
    };

    const handleMainCategoryClick = (catId: string) => {
        const newExpanded = expandedMain === catId ? null : catId;
        setExpandedMain(newExpanded);
        setExpandedStation(null);
        if (newExpanded && !stationsMap[catId]) {
            fetchStationsForMain(catId);
        }
    };

    const handleRemoveGuideImage = (idx: number) => {
        const images = [...(configForm.characteristics.guide_images || [])];
        images.splice(idx, 1);
        updateCharacteristic('guide_images', images);
    };

    const toggleProcess = (processId: string) => {
        const currentIds = configForm.process_ids;
        const newIds = currentIds.includes(processId)
            ? currentIds.filter(id => id !== processId)
            : [...currentIds, processId];
        updateProcessIds(newIds);
    };

    return (
        <div className="space-y-6 animate-fade-in pb-20">
            {/* Header */}
            <div className="flex items-center gap-4 bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                <button onClick={handleBack} className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 transition-colors">
                    <ChevronLeft className="w-5 h-5" />
                </button>
                <div>
                    <h1 className="text-xl font-bold text-slate-800">
                        {loading ? 'Đang tải...' : (project?.project_name || 'Không tìm thấy dự án')}
                    </h1>
                    <p className="text-sm text-slate-500">Cấu hình danh mục, quy trình và thông số.</p>
                </div>
                <div className="ml-auto flex gap-3">
                    <PremiumButton variant="ghost" onClick={handleEditProjectInfo} icon={<Settings className="w-4 h-4" />}>
                        Chỉnh sửa thông tin dự án
                    </PremiumButton>
                    <PremiumButton variant="primary" onClick={handleBack} icon={<CheckCircle className="w-4 h-4" />}>
                        Hoàn tất
                    </PremiumButton>
                </div>
            </div>

            {error && (
                <div className="bg-red-50 text-red-600 p-4 rounded-xl border border-red-100 flex items-center gap-3">
                    <span className="font-bold">Lỗi:</span> {error}
                </div>
            )}

            {/* Content */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left: Category Tree */}
                <div className="lg:col-span-1 space-y-4">
                    <div className="flex justify-between items-center px-2">
                        <h3 className="font-bold text-slate-700">Danh mục chính</h3>
                        <button
                            onClick={() => setIsManagerOpen(true)}
                            className="text-xs font-bold text-indigo-600 hover:bg-indigo-50 px-2 py-1 rounded transition-colors"
                        >
                            + Quản lý
                        </button>
                    </div>

                    {categories.map(cat => {
                        const stations = stationsMap[cat.id] || [];
                        const isExpanded = expandedMain === cat.id;

                        return (
                            <div key={cat.id} className="space-y-2">
                                {/* Main Category Header */}
                                <div
                                    onClick={() => handleMainCategoryClick(cat.id)}
                                    className={`p-4 rounded-xl border cursor-pointer transition-all flex justify-between items-center
                                        ${isExpanded ? 'bg-indigo-50 border-indigo-200 shadow-sm' : 'bg-white border-slate-200 hover:border-indigo-200'}`}
                                >
                                    <span className="font-bold text-slate-800">{cat.name}</span>
                                    {isExpanded
                                        ? <ChevronDown className="w-4 h-4 text-indigo-500" />
                                        : <ChevronRight className="w-4 h-4 text-slate-400" />}
                                </div>

                                {/* Stations */}
                                {isExpanded && (
                                    <div className="pl-4 space-y-2 animate-slide-in">
                                        {stations.length === 0 ? (
                                            <p className="text-xs text-slate-400 italic pl-2">Chưa có khu vực nào</p>
                                        ) : (
                                            stations.map(station => (
                                                <StationItem
                                                    key={station.id}
                                                    station={station}
                                                    childCategoriesMap={childCategoriesMap}
                                                    isExpanded={expandedStation === station.id}
                                                    selectedChild={selectedChild}
                                                    selectedCategoryIds={selectedCategoryIds}
                                                    onToggleExpand={() => setExpandedStation(expandedStation === station.id ? null : station.id)}
                                                    onSelectChild={(child) => {
                                                        handleSelectChild(child);
                                                        setSelectedStationId(station.id);
                                                    }}
                                                    onToggleCategory={handleToggleCategory}
                                                />
                                            ))
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>

                {/* Right: Config Panel */}
                <div className="lg:col-span-2">
                    {selectedChild ? (
                        <GlassCard className="h-full flex flex-col relative !p-0 overflow-hidden">
                            {/* Panel Header */}
                            <div className="p-6 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
                                <div>
                                    <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                                        <Settings className="w-5 h-5 text-indigo-500" />
                                        Cấu hình: {selectedChild.name}
                                    </h2>
                                    <p className="text-xs text-slate-500">Thiết lập quy trình và thông số kỹ thuật.</p>
                                </div>
                                <PremiumButton size="sm" onClick={handleSaveConfig} icon={<Save className="w-4 h-4" />}>
                                    Lưu cấu hình
                                </PremiumButton>
                            </div>

                            {/* Panel Content */}
                            <div className="p-6 space-y-8 overflow-y-auto max-h-[600px] custom-scrollbar">
                                {/* Classification Select */}
                                <ConfigSection title="Loại hình công việc" icon={<CheckSquare className="w-4 h-4" />}>
                                    <select
                                        className="w-full p-3 bg-white border border-slate-200 rounded-lg text-sm focus:border-indigo-500 outline-none"
                                        value={configForm.characteristics.project_classification_id || ''}
                                        onChange={(e) => updateCharacteristic('project_classification_id', e.target.value)}
                                    >
                                        <option value="">-- Chọn loại hình công việc --</option>
                                        {availableClassifications.map(cls => (
                                            <option key={cls.id} value={cls.id}>{cls.name}</option>
                                        ))}
                                    </select>
                                </ConfigSection>

                                {/* Process Selection */}
                                <ConfigSection title="1. Quy trình làm việc" icon={<Activity className="w-4 h-4" />}>
                                    {availableProcesses.length > 0 ? (
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                            {availableProcesses.map((proc) => {
                                                const isSelected = configForm.process_ids.includes(proc.id);
                                                return (
                                                    <ProcessCard
                                                        key={proc.id}
                                                        process={proc}
                                                        isSelected={isSelected}
                                                        onClick={() => toggleProcess(proc.id)}
                                                    />
                                                );
                                            })}
                                        </div>
                                    ) : (
                                        <div className="p-4 bg-orange-50 text-orange-600 rounded-lg text-sm border border-orange-100">
                                            Chưa có quy trình nào được tạo trong hệ thống.
                                        </div>
                                    )}
                                </ConfigSection>

                                {/* Guide & Config */}
                                <ConfigSection title="2. Hướng dẫn & Cấu hình" icon={<FileText className="w-4 h-4" />}>
                                    <p className="text-xs text-slate-500 mb-3">Nhập hướng dẫn và số lượng ảnh yêu cầu.</p>

                                    {/* Guide Text */}
                                    <div className="mb-4">
                                        <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">
                                            Văn bản hướng dẫn
                                        </label>
                                        <textarea
                                            placeholder="Nhập hướng dẫn chi tiết..."
                                            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:border-indigo-500 outline-none resize-none h-32"
                                            value={configForm.characteristics.guide_text || ''}
                                            onChange={(e) => updateCharacteristic('guide_text', e.target.value)}
                                        />
                                    </div>

                                    {/* Image Count */}
                                    <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100 mb-4">
                                        <label className="text-xs font-bold text-blue-700 uppercase mb-2 block">
                                            Số lượng ảnh yêu cầu
                                        </label>
                                        <input
                                            type="number"
                                            min="0"
                                            className="w-full md:w-1/3 p-3 bg-white border border-blue-200 rounded-lg text-lg font-semibold focus:border-blue-500 outline-none"
                                            value={configForm.characteristics.image_count || ''}
                                            onChange={(e) => updateCharacteristic('image_count', parseInt(e.target.value) || 0)}
                                        />
                                    </div>

                                    {/* Guide Images */}
                                    <div className="bg-green-50/50 p-4 rounded-xl border border-green-100">
                                        <label className="text-xs font-bold text-green-700 uppercase mb-2 block">
                                            Ảnh hướng dẫn
                                        </label>
                                        <div className="flex flex-wrap gap-2 mb-2">
                                            {(configForm.characteristics.guide_images || []).map((img, idx) => (
                                                <div key={idx} className="relative group">
                                                    <img src={img} alt={`Guide ${idx + 1}`} className="w-20 h-20 object-cover rounded-lg border border-green-200" />
                                                    <button
                                                        onClick={() => handleRemoveGuideImage(idx)}
                                                        className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                                                    >×</button>
                                                </div>
                                            ))}
                                        </div>
                                        <label className="inline-flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg cursor-pointer hover:bg-green-600 text-sm font-medium">
                                            <input type="file" accept="image/*" multiple className="hidden" onChange={handleFileUpload} />
                                            + Thêm ảnh hướng dẫn
                                        </label>
                                    </div>
                                </ConfigSection>
                            </div>
                        </GlassCard>
                    ) : (
                        <GlassCard className="h-full min-h-[500px] flex items-center justify-center text-slate-400 flex-col gap-4">
                            <Settings className="w-12 h-12 opacity-50" />
                            <p>Chọn một danh mục phụ để cấu hình.</p>
                        </GlassCard>
                    )}
                </div>
            </div>

            {/* Modals */}
            <CategoryManagerModal
                isOpen={isManagerOpen}
                onClose={() => setIsManagerOpen(false)}
                onChange={() => fetchData()}
                projectId={id}
            />
            <EditProjectModal
                isOpen={showEditModal}
                onClose={() => setShowEditModal(false)}
                onSuccess={() => fetchData()}
                project={project}
            />
        </div>
    );
};

// Sub-components
interface ConfigSectionProps {
    title: string;
    icon: React.ReactNode;
    children: React.ReactNode;
}

const ConfigSection: React.FC<ConfigSectionProps> = ({ title, icon, children }) => (
    <div className="space-y-3">
        <div className="flex items-center gap-2 text-indigo-700 font-semibold border-b border-indigo-100 pb-2">
            {icon}
            {title}
        </div>
        {children}
    </div>
);

interface ProcessCardProps {
    process: { id: string; name?: string; description?: string };
    isSelected: boolean;
    onClick: () => void;
}

const ProcessCard: React.FC<ProcessCardProps> = ({ process, isSelected, onClick }) => (
    <div
        onClick={onClick}
        className={`p-4 rounded-xl border cursor-pointer transition-all flex items-start gap-3
            ${isSelected ? 'bg-indigo-50 border-indigo-500 ring-1 ring-indigo-500' : 'bg-white border-slate-200 hover:border-indigo-300'}`}
    >
        <div className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center
            ${isSelected ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-slate-300 bg-white'}`}>
            {isSelected && <CheckCircle className="w-3 h-3" />}
        </div>
        <div>
            <div className="font-bold text-sm text-slate-800 mb-1">{process.name || 'Unnamed Process'}</div>
            <div className="text-xs text-slate-500 line-clamp-2">{process.description || 'No description'}</div>
        </div>
    </div>
);

interface StationItemProps {
    station: Station;
    childCategoriesMap: Record<string, ChildCategory>;
    isExpanded: boolean;
    selectedChild: ChildCategory | null;
    selectedCategoryIds: Set<string>;
    onToggleExpand: () => void;
    onSelectChild: (child: ChildCategory) => void;
    onToggleCategory: (childId: string, e: React.MouseEvent) => void;
}

const StationItem: React.FC<StationItemProps> = ({
    station,
    childCategoriesMap,
    isExpanded,
    selectedChild,
    selectedCategoryIds,
    onToggleExpand,
    onSelectChild,
    onToggleCategory
}) => {
    const childIds = station.child_category_ids || [];
    const stationChildren = childIds.map(cid => childCategoriesMap[cid]).filter(Boolean);

    return (
        <div className="space-y-2">
            <div
                onClick={onToggleExpand}
                className={`p-3 rounded-lg border cursor-pointer transition-all flex justify-between items-center
                    ${isExpanded ? 'bg-green-50 border-green-200' : 'bg-white border-slate-100 hover:border-green-100'}`}
            >
                <span className="text-sm font-medium text-slate-700">{station.name}</span>
                {isExpanded
                    ? <ChevronDown className="w-3 h-3 text-green-500" />
                    : <ChevronRight className="w-3 h-3 text-slate-400" />}
            </div>

            {isExpanded && (
                <div className="pl-4 space-y-1 animate-slide-in">
                    {stationChildren.length === 0 ? (
                        <p className="text-xs text-slate-400 italic">Chưa cấu hình hạng mục</p>
                    ) : (
                        stationChildren.map(child => (
                            <div
                                key={child.id}
                                onClick={() => onSelectChild(child)}
                                className={`p-2.5 rounded-lg border cursor-pointer flex items-center justify-between group transition-all
                                    ${selectedChild?.id === child.id
                                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-md'
                                        : 'bg-white border-slate-100 hover:border-indigo-100 text-slate-600'}`}
                            >
                                <div className="flex items-center gap-2 overflow-hidden">
                                    <div
                                        onClick={(e) => onToggleCategory(child.id, e)}
                                        className={`shrink-0 transition-colors hover:scale-110
                                            ${selectedChild?.id === child.id ? 'text-white' : 'text-indigo-600'}`}
                                    >
                                        {selectedCategoryIds.has(child.id)
                                            ? <CheckSquare className="w-4 h-4" />
                                            : <Square className="w-4 h-4" />}
                                    </div>
                                    <span className={`text-xs font-medium truncate ${selectedChild?.id === child.id ? 'text-white' : 'group-hover:text-indigo-600'}`}>
                                        {child.name}
                                    </span>
                                </div>
                                <ChevronRight className={`w-3 h-3 shrink-0 ${selectedChild?.id === child.id ? 'text-white' : 'text-slate-300'}`} />
                            </div>
                        ))
                    )}
                </div>
            )}
        </div>
    );
};

export default ProjectSetupPage;
