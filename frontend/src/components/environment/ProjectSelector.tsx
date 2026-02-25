import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';

interface Assign {
    id: string;
    project?: {
        project_name: string;
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
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Get selected project details
    const selectedProject = assigns.find(a => a.id === selectedAssignId);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleSelect = (id: string) => {
        onSelect(id);
        setIsOpen(false);
    };

    return (
        <div className="relative z-50 h-[120px]" ref={dropdownRef}>
            {/* Trigger Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`w-full h-full group relative flex items-center justify-between p-4 bg-white border-2 rounded-2xl transition-all duration-300 ${isOpen
                    ? 'border-indigo-500 shadow-xl ring-4 ring-indigo-500/10'
                    : 'border-slate-100 shadow-md hover:border-indigo-300 hover:shadow-lg'
                    }`}
            >
                <div className="flex items-center gap-4">
                    {/* Icon Box */}
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-colors duration-300 ${isOpen ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/30' : 'bg-slate-100 text-slate-500 group-hover:bg-indigo-50 group-hover:text-indigo-600'
                        }`}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
                            <path d="M13.4 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7.4" />
                            <path d="M2 6h4" />
                            <path d="M2 10h4" />
                            <path d="M2 14h4" />
                            <path d="M2 18h4" />
                            <path d="M21.378 5.626a1 1 0 1 0-3.004-3.004l-5.01 5.012a2 2 0 0 0-.506.854l-.837 2.87a.5.5 0 0 0 .62.62l2.87-.837a2 2 0 0 0 .854-.506z" />
                        </svg>
                    </div>

                    {/* Text Content */}
                    <div className="flex-1 text-left">
                        <span className="block text-xs font-semibold text-slate-400 mb-0.5 group-hover:text-indigo-500 transition-colors">
                            Dự án đang làm việc
                        </span>
                        <div className="font-bold text-slate-800 text-lg truncate pr-4">
                            {selectedProject?.project?.project_name || 'Chọn dự án...'}
                        </div>
                        {selectedProject?.classification?.name && (
                            <div className="text-xs font-medium text-indigo-500 bg-indigo-50 inline-block px-2 py-0.5 rounded mt-1 border border-indigo-100">
                                {selectedProject.classification.name}
                            </div>
                        )}
                    </div>
                </div>

                {/* Chevron */}
                <div className={`p-2 rounded-full transition-all duration-300 ${isOpen ? 'bg-indigo-50 text-indigo-600 rotate-180' : 'text-slate-300 group-hover:text-indigo-600 group-hover:bg-indigo-50'}`}>
                    <ChevronDown className="w-5 h-5" />
                </div>
            </button>

            {/* Dropdown Menu */}
            {isOpen && (
                <div className="absolute top-full left-0 mt-3 w-full md:w-[500px] bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="max-h-[320px] overflow-y-auto p-2 space-y-1 custom-scrollbar">
                        {assigns.map(assign => {
                            const isSelected = assign.id === selectedAssignId;
                            return (
                                <button
                                    key={assign.id}
                                    onClick={() => handleSelect(assign.id)}
                                    className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all duration-200 ${isSelected
                                        ? 'bg-indigo-50 text-indigo-700 font-bold border border-indigo-100'
                                        : 'hover:bg-slate-50 text-slate-600 hover:pl-4 border border-transparent'
                                        }`}
                                >
                                    <div className={`w-2 h-2 rounded-full ${isSelected ? 'bg-indigo-500' : 'bg-slate-300'}`}></div>
                                    <div className="flex-1 text-left">
                                        <div className="truncate">{assign.project?.project_name || 'Dự án không tên'}</div>
                                        {assign.classification?.name && (
                                            <div className={`text-xs mt-0.5 ${isSelected ? 'text-indigo-500/80' : 'text-slate-400'}`}>
                                                {assign.classification.name}
                                            </div>
                                        )}
                                    </div>
                                    {isSelected && <Check className="w-5 h-5 text-indigo-600" />}
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
};

export default ProjectSelector;
