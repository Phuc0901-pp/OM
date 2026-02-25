import React, { useEffect, useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import api from '../../../services/api';
import {
    Folder,
    Image as ImageIcon,
    Download,
    ChevronRight,
    Search,
    Loader2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// --- Types ---
interface FileNode {
    name: string;
    path: string; // Full key
    type: 'folder' | 'file';
    children?: Record<string, FileNode>;
    size?: number; // Optional
}

// --- CONFIG: Folder Name Aliases ---
// Only applied at the ROOT level
const ROOT_DISPLAY_MAP: Record<string, string> = {
    "2026": "Công việc",
    "Q1": "Chấm công",
    // "Tài liệu hướng dẫn": "Tài liệu hướng dẫn" // Default is fine
};

const ReportsPage = () => {
    // --- State ---
    const [loading, setLoading] = useState(true);
    const [allKeys, setAllKeys] = useState<string[]>([]);
    const [currentPath, setCurrentPath] = useState<string[]>([]); // Current breadcrumb path
    const [previewImage, setPreviewImage] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');

    // --- Fetch Data ---
    useEffect(() => {
        fetchLibrary();
    }, []);

    const fetchLibrary = async () => {
        setLoading(true);
        try {
            const res = await api.get('/media/library');
            if (res.data && res.data.data) {
                setAllKeys(res.data.data);
            }
        } catch (err) {
            console.error("Failed to fetch library", err);
        } finally {
            setLoading(false);
        }
    };

    // --- Build Tree Structure from Keys ---
    const fileTree = useMemo(() => {
        const root: Record<string, FileNode> = {};

        const addToTree = (parts: string[], currentNode: Record<string, FileNode>, fullPath: string) => {
            if (parts.length === 0) return;

            const part = decodeURIComponent(parts[0]);
            const isFile = parts.length === 1;

            if (!currentNode[part]) {
                currentNode[part] = {
                    name: part,
                    path: isFile ? fullPath : fullPath.split(part)[0] + part + '/',
                    // Note: fullPath construction logic for folders is implicit
                    type: isFile ? 'file' : 'folder',
                    children: {}
                };
            }

            if (!isFile) {
                addToTree(parts.slice(1), currentNode[part].children!, fullPath);
            }
        };

        allKeys.forEach(key => {
            // Filter by search term if active
            if (searchTerm && !key.toLowerCase().includes(searchTerm.toLowerCase())) return;

            const parts = key.split('/');
            // Filter empty parts
            const cleanParts = parts.filter(p => p !== '');
            addToTree(cleanParts, root, key);
        });

        return root;
    }, [allKeys, searchTerm]);

    // --- Navigation Logic ---
    const currentFolder = useMemo(() => {
        let current = fileTree;
        for (const part of currentPath) {
            if (current[part] && current[part].children) {
                current = current[part].children!;
            } else {
                return {}; // Path not found
            }
        }
        return current;
    }, [fileTree, currentPath]);

    const handleNavigate = (folderName: string) => {
        setCurrentPath(prev => [...prev, folderName]);
    };

    const handleBreadcrumbClick = (index: number) => {
        setCurrentPath(prev => prev.slice(0, index + 1));
    };

    const handleRootClick = () => setCurrentPath([]);

    // --- Helper: Get Display Name ---
    const getDisplayName = (name: string, isRootLevel: boolean) => {
        if (isRootLevel && ROOT_DISPLAY_MAP[name]) {
            return ROOT_DISPLAY_MAP[name];
        }
        return name;
    };

    // --- Actions ---
    const handleDownload = (node: FileNode) => {
        if (node.type === 'file') {
            // Download Single File
            const link = document.createElement('a');
            link.href = `/api/media/proxy?key=${encodeURIComponent(node.path)}`;
            link.download = node.name;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } else {
            // Download Folder Zip
            const prefix = [...currentPath, node.name].join('/') + '/';
            const link = document.createElement('a');
            link.href = `/api/media/download-zip?prefix=${encodeURIComponent(prefix)}`;
            link.download = `${node.name}.zip`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    };

    const handleDownloadCurrentFolder = () => {
        if (currentPath.length === 0) return; // Don't allow downloading root
        const prefix = currentPath.join('/') + '/';
        const name = currentPath[currentPath.length - 1];

        const link = document.createElement('a');
        link.href = `/api/media/download-zip?prefix=${encodeURIComponent(prefix)}`;
        link.download = `${name}.zip`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    // --- Render ---
    return (
        <div className="h-[calc(100vh-100px)] flex flex-col bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            {/* Toolbar */}
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div className="flex items-center gap-2 overflow-x-auto text-sm text-slate-600 custom-scrollbar pb-1">
                    <button
                        onClick={handleRootClick}
                        className={`hover:bg-slate-200 px-2 py-1 rounded transition-colors ${currentPath.length === 0 ? 'font-bold text-indigo-600' : ''}`}
                    >
                        Thư viện
                    </button>
                    {currentPath.map((part, idx) => (
                        <React.Fragment key={idx}>
                            <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                            <button
                                onClick={() => handleBreadcrumbClick(idx)}
                                className={`hover:bg-slate-200 px-2 py-1 rounded transition-colors whitespace-nowrap ${idx === currentPath.length - 1 ? 'font-bold text-indigo-600' : ''}`}
                            >
                                {getDisplayName(part, idx === 0)}
                            </button>
                        </React.Fragment>
                    ))}
                </div>

                <div className="flex items-center gap-3">
                    {/* Search */}
                    <div className="relative">
                        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                            type="text"
                            placeholder="Tìm kiếm file..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-9 pr-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500/20 outline-none w-64 transition-all focus:w-80"
                        />
                    </div>

                    {/* Download Current Folder */}
                    {currentPath.length > 0 && (
                        <button
                            onClick={handleDownloadCurrentFolder}
                            className="flex items-center gap-2 px-3 py-1.5 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"
                        >
                            <Download className="w-4 h-4" />
                            Tải thư mục
                        </button>
                    )}
                </div>
            </div>

            {/* Content Grid */}
            <div className="flex-1 overflow-y-auto p-6 bg-slate-50/30">
                {loading ? (
                    <div className="h-full flex flex-col items-center justify-center text-slate-400">
                        <Loader2 className="w-8 h-8 animate-spin mb-2" />
                        <span className="text-sm">Đang tải dữ liệu...</span>
                    </div>
                ) : Object.keys(currentFolder).length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-slate-400 opacity-60">
                        <Folder className="w-16 h-16 mb-4 stroke-1" />
                        <p>Thư mục trống</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                        <AnimatePresence>
                            {Object.entries(currentFolder).map(([name, node]) => {
                                const displayName = getDisplayName(name, currentPath.length === 0);
                                return (
                                    <motion.div
                                        key={name}
                                        initial={{ opacity: 0, scale: 0.95 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        exit={{ opacity: 0, scale: 0.95 }}
                                        transition={{ duration: 0.2 }}
                                        className="group relative bg-white p-3 rounded-xl border border-slate-200 shadow-sm hover:shadow-md hover:border-indigo-300 transition-all cursor-pointer select-none flex flex-col items-center gap-3"
                                        onClick={() => node.type === 'folder' ? handleNavigate(name) : setPreviewImage(node.path)}
                                    >
                                        {/* Icon / Thumbnail */}
                                        <div className="w-full aspect-square bg-slate-50 rounded-lg flex items-center justify-center overflow-hidden relative">
                                            {node.type === 'folder' ? (
                                                <Folder className="w-12 h-12 text-blue-400 fill-blue-50" />
                                            ) : (
                                                (name.toLowerCase().endsWith('.jpg') || name.toLowerCase().endsWith('.png') || name.toLowerCase().endsWith('.jpeg')) ? (
                                                    <img
                                                        src={`/api/media/proxy?key=${encodeURIComponent(node.path)}`}
                                                        alt={displayName}
                                                        loading="lazy"
                                                        className="w-full h-full object-cover"
                                                    />
                                                ) : name.toLowerCase().endsWith('.txt') ? (
                                                    <div className="w-12 h-12 text-slate-400">
                                                        <svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-book-icon lucide-book">
                                                            <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H19a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H6.5a1 1 0 0 1 0-5H20" />
                                                        </svg>
                                                    </div>
                                                ) : (
                                                    <ImageIcon className="w-10 h-10 text-slate-400" />
                                                )
                                            )}

                                            {/* Hover Overlay */}
                                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 backdrop-blur-[1px]">
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); handleDownload(node); }}
                                                    className="p-2 bg-white rounded-full text-slate-700 hover:text-indigo-600 shadow-lg hover:scale-110 transition-transform"
                                                    title={node.type === 'folder' ? "Tải thư mục (Zip)" : "Tải ảnh"}
                                                >
                                                    <Download className="w-4 h-4" />
                                                </button>
                                                {node.type === 'file' && (
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); setPreviewImage(node.path); }}
                                                        className="p-2 bg-white rounded-full text-slate-700 hover:text-indigo-600 shadow-lg hover:scale-110 transition-transform"
                                                        title="Xem trước"
                                                    >
                                                        <ImageIcon className="w-4 h-4" />
                                                    </button>
                                                )}
                                            </div>
                                        </div>

                                        {/* Name */}
                                        <div className="text-center w-full">
                                            <p className="text-sm font-medium text-slate-700 truncate w-full" title={displayName}>
                                                {displayName}
                                            </p>
                                            <p className="text-xs text-slate-400 mt-0.5">
                                                {node.type === 'folder' ? `${Object.keys(node.children || {}).length} items` : 'Item'}
                                            </p>
                                        </div>
                                    </motion.div>
                                );
                            })}
                        </AnimatePresence>
                    </div>
                )}
            </div>

            {/* Image Preview Modal */}
            {createPortal(
                <AnimatePresence>
                    {previewImage && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 z-[99999] bg-black/95 backdrop-blur-sm flex items-center justify-center p-4"
                            onClick={() => setPreviewImage(null)}
                        >
                            <motion.img
                                initial={{ scale: 0.9 }}
                                animate={{ scale: 1 }}
                                exit={{ scale: 0.9 }}
                                src={`/api/media/proxy?key=${encodeURIComponent(previewImage)}`}
                                alt="Preview"
                                className="max-w-full max-h-full rounded-lg shadow-2xl"
                                onClick={(e) => e.stopPropagation()}
                            />
                            <button
                                className="absolute top-4 right-4 text-white hover:text-red-400 p-2"
                                onClick={() => setPreviewImage(null)}
                            >
                                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </motion.div>
                    )}
                </AnimatePresence>,
                document.body
            )}
        </div>
    );
};

export default ReportsPage;
