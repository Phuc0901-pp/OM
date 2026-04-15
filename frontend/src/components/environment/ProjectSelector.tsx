import React, { useState, useRef, useEffect, useMemo } from 'react';
import { ChevronDown, Check, FolderOpen, LayoutTemplate } from 'lucide-react';

interface Assign {
    id: string;
    project?: {
        id?: string;
        name: string;
    };
    template?: {
        id: string;
        name: string;
    };
    classification?: {
        name: string;
    };
}

interface ProjectSelectorProps {
    assigns: Assign[];
    selectedAssignId: string;
    onSelect: (id: string) => void;
}

const ProjectSelector: React.FC<ProjectSelectorProps> = ({ assigns, selectedAssignId, onSelect }) => {
    const dropdownRef = useRef<HTMLDivElement>(null);
    const [openDropdown, setOpenDropdown] = useState<'project' | 'template' | null>(null);

    // Group assigns by project name
    const projectGroups = useMemo(() => {
        const map: Record<string, { name: string; assigns: Assign[] }> = {};
        assigns.forEach(a => {
            const pName = a.project?.name || 'Dự án không tên';
            if (!map[pName]) map[pName] = { name: pName, assigns: [] };
            map[pName].assigns.push(a);
        });
        return Object.values(map);
    }, [assigns]);

    // Derived: which project is currently selected
    const selectedAssign = assigns.find(a => a.id === selectedAssignId);
    const selectedProjectName = selectedAssign?.project?.name || '';

    // Templates available for the currently selected project
    const templatesForProject = useMemo(() => {
        return assigns.filter(a => a.project?.name === selectedProjectName);
    }, [assigns, selectedProjectName]);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setOpenDropdown(null);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // When user selects a project: auto-select first assign in that project (if only 1 template, select it immediately)
    const handleSelectProject = (projectName: string) => {
        const group = projectGroups.find(g => g.name === projectName);
        if (!group) return;
        // Auto-select first assign in group
        onSelect(group.assigns[0].id);
        setOpenDropdown(null);
    };

    const handleSelectTemplate = (assignId: string) => {
        onSelect(assignId);
        setOpenDropdown(null);
    };

    const selectClass = `
        w-full group relative flex items-center justify-between gap-3 p-3.5 bg-white border-2 rounded-xl
        transition-all duration-300 overflow-hidden cursor-pointer
    `;
    const activeClass = 'border-indigo-500 shadow-lg ring-2 ring-indigo-500/10';
    const inactiveClass = 'border-slate-100 shadow-sm hover:border-indigo-300 hover:shadow-md';

    return (
        <div className="space-y-2 relative z-50" ref={dropdownRef}>

            {/* ─────── Dropdown 1: Project ─────── */}
            <div className="relative">
                <button
                    onClick={() => setOpenDropdown(openDropdown === 'project' ? null : 'project')}
                    className={`${selectClass} ${openDropdown === 'project' ? activeClass : inactiveClass}`}
                >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className={`flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center transition-colors duration-300 ${openDropdown === 'project' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500 group-hover:bg-indigo-50 group-hover:text-indigo-600'}`}>
                            <FolderOpen className="w-5 h-5" />
                        </div>
                        <div className="flex-1 text-left min-w-0">
                            <span className="block text-xs font-semibold text-slate-400 mb-0.5">Dự án đang làm việc</span>
                            <div
                                className="font-bold text-slate-800 truncate"
                                title={selectedProjectName}
                            >
                                {selectedProjectName || 'Chọn dự án...'}
                            </div>
                        </div>
                    </div>
                    <ChevronDown className={`flex-shrink-0 w-4 h-4 text-slate-400 transition-transform duration-300 ${openDropdown === 'project' ? 'rotate-180 text-indigo-500' : ''}`} />
                </button>

                {openDropdown === 'project' && (
                    <div className="absolute top-full left-0 mt-2 w-full bg-white rounded-xl shadow-2xl border border-slate-100 overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                        <div className="max-h-[260px] overflow-y-auto p-2 space-y-1 custom-scrollbar">
                            {projectGroups.map(group => {
                                const isSelected = group.name === selectedProjectName;
                                return (
                                    <button
                                        key={group.name}
                                        onClick={() => handleSelectProject(group.name)}
                                        className={`w-full flex items-center gap-3 p-3 rounded-lg transition-all duration-200 text-left ${isSelected
                                            ? 'bg-indigo-50 text-indigo-700 font-bold border border-indigo-100'
                                            : 'hover:bg-slate-50 text-slate-600 border border-transparent'
                                        }`}
                                    >
                                        <div className={`flex-shrink-0 w-2 h-2 rounded-full ${isSelected ? 'bg-indigo-500' : 'bg-slate-300'}`} />
                                        <div className="flex-1 min-w-0 truncate">{group.name}</div>
                                        <span className="flex-shrink-0 text-xs text-slate-400 tabular-nums">{group.assigns.length} mẫu</span>
                                        {isSelected && <Check className="flex-shrink-0 w-4 h-4 text-indigo-600" />}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>

            {/* ─────── Dropdown 2: Template (Mẫu) ─────── */}
            {selectedProjectName && (
                <div className="relative">
                    <button
                        onClick={() => setOpenDropdown(openDropdown === 'template' ? null : 'template')}
                        className={`${selectClass} ${openDropdown === 'template' ? activeClass : inactiveClass}`}
                    >
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                            <div className={`flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center transition-colors duration-300 ${openDropdown === 'template' ? 'bg-violet-600 text-white' : 'bg-slate-100 text-slate-500 group-hover:bg-violet-50 group-hover:text-violet-600'}`}>
                                <LayoutTemplate className="w-5 h-5" />
                            </div>
                            <div className="flex-1 text-left min-w-0">
                                <span className="block text-xs font-semibold text-slate-400 mb-0.5">Mẫu template</span>
                                <div
                                    className="font-bold text-slate-800 truncate"
                                    title={selectedAssign?.template?.name || 'Không có template'}
                                >
                                    {selectedAssign?.template?.name || (
                                        <span className="text-slate-400 font-normal italic">Chọn template...</span>
                                    )}
                                </div>
                            </div>
                        </div>
                        {templatesForProject.length > 1 && (
                            <ChevronDown className={`flex-shrink-0 w-4 h-4 text-slate-400 transition-transform duration-300 ${openDropdown === 'template' ? 'rotate-180 text-violet-500' : ''}`} />
                        )}
                    </button>

                    {openDropdown === 'template' && templatesForProject.length > 1 && (
                        <div className="absolute top-full left-0 mt-2 w-full bg-white rounded-xl shadow-2xl border border-slate-100 overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                            <div className="max-h-[260px] overflow-y-auto p-2 space-y-1 custom-scrollbar">
                                {templatesForProject.map(assign => {
                                    const isSelected = assign.id === selectedAssignId;
                                    const tplName = assign.template?.name || 'Không có tên mẫu';
                                    return (
                                        <button
                                            key={assign.id}
                                            onClick={() => handleSelectTemplate(assign.id)}
                                            className={`w-full flex items-center gap-3 p-3 rounded-lg transition-all duration-200 text-left ${isSelected
                                                ? 'bg-violet-50 text-violet-700 font-bold border border-violet-100'
                                                : 'hover:bg-slate-50 text-slate-600 border border-transparent'
                                            }`}
                                        >
                                            <div className={`flex-shrink-0 w-2 h-2 rounded-full ${isSelected ? 'bg-violet-500' : 'bg-slate-300'}`} />
                                            <div className="flex-1 min-w-0 truncate" title={tplName}>{tplName}</div>
                                            {isSelected && <Check className="flex-shrink-0 w-4 h-4 text-violet-600" />}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default ProjectSelector;
