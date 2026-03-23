import React, { useState, useEffect } from 'react';
import { Search, Image as ImageIcon, ChevronRight, ChevronDown, Folder, FileImage } from 'lucide-react';
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import ModernInput from '../../../../../components/common/ModernInput';
import api from '../../../../../services/api';

// --- Types ---
interface FileNode {
    id: string; // Full path or URL
    name: string;
    url?: string;
    type: 'folder' | 'file';
    children: FileNode[];
    isOpen?: boolean; // For folders
}

// --- Utils ---
const buildFileTree = (urls: string[]): FileNode[] => {
    const root: FileNode[] = [];
    const map: Record<string, FileNode> = {};

    urls.forEach((url) => {
        try {
            // Parse URL to get the path
            const urlObj = new URL(url);
            const path = urlObj.pathname.substring(1); // Remove leading slash
            // Split path. Convention: bucket/folder/file. 
            // MinIO URLs: /bucket/path/to/file.
            // We assume the first segment is bucket, but maybe not if behind proxy?
            // Let's iterate segments.
            const parts = path.split('/').filter(p => p);

            // If the URL is presigned, the 'bucket' is the first part of pathname?
            // Usually http://host/bucket/key.
            // Let's assume the first part is bucket and ignore it for the UI tree?
            // Or maybe the user WANTS to see the bucket?
            // "dev" is the bucket. User requested "2026/Q1".
            // So we probably want to skip the bucket name if possible.
            // Let's try to detect if the first part is "dev".
            let currentLevel = root;
            let currentPath = "";

            // Skip first part if it is likely the bucket name (e.g. 'dev')
            let startIndex = 0;
            if (parts.length > 0 && (parts[0] === 'dev' || parts[0] === 'public')) { // Quick hack for known buckets
                startIndex = 1;
            }

            for (let i = startIndex; i < parts.length; i++) {
                const part = decodeURIComponent(parts[i]);
                const isFile = i === parts.length - 1;
                currentPath = currentPath ? `${currentPath}/${part}` : part; // Logical path

                // Check if node exists at this level
                let node = currentLevel.find((n) => n.name === part && n.type === (isFile ? 'file' : 'folder'));

                if (!node) {
                    node = {
                        id: isFile ? url : `folder_${currentPath}`, // Files use URL as ID for DND
                        name: part,
                        type: isFile ? 'file' : 'folder',
                        url: isFile ? url : undefined,
                        children: [],
                        isOpen: false, // Default closed
                    };
                    currentLevel.push(node);
                    // Sort: Folders first, then files
                    currentLevel.sort((a, b) => {
                        if (a.type === b.type) return a.name.localeCompare(b.name);
                        return a.type === 'folder' ? -1 : 1;
                    });
                }

                if (!isFile) {
                    currentLevel = node.children;
                }
            }
        } catch (e) {
            console.warn("Invalid URL:", url);
        }
    });

    return root;
};


// --- Components ---

const DraggableFile = ({ file }: { file: FileNode }) => {
    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
        id: file.id,
        data: { url: file.url, name: file.name }
    });

    const style = {
        transform: CSS.Translate.toString(transform),
    };

    if (isDragging) {
        return (
            <div ref={setNodeRef} style={style} className="flex items-center gap-2 p-2 bg-indigo-50 rounded-lg border border-indigo-200 opacity-80 w-48">
                <FileImage className="w-4 h-4 text-indigo-500" />
                <span className="text-sm font-medium truncate">{file.name}</span>
            </div>
        )
    }

    return (
        <div
            ref={setNodeRef}
            {...listeners}
            {...attributes}
            style={style}
            className="flex items-center gap-2 p-1.5 hover:bg-slate-100 rounded-md cursor-grab active:cursor-grabbing group"
            title={file.name}
        >
            <div className="relative w-8 h-8 rounded overflow-hidden bg-slate-200 shrink-0 border border-slate-200">
                {file.url ? (
                    <img src={file.url} alt="" className="w-full h-full object-cover" />
                ) : <ImageIcon className="w-4 h-4 text-slate-400 m-auto mt-2" />}
            </div>

            <span className="text-sm text-slate-600 truncate flex-1 group-hover:text-slate-900 transition-colors">
                {file.name}
            </span>
        </div>
    );
};

const FolderItem = ({ node, level = 0 }: { node: FileNode, level?: number }) => {
    const [isOpen, setIsOpen] = useState(level === 0); // Auto-open root folders

    if (node.type === 'file') {
        return (
            <div style={{ paddingLeft: `${level * 12}px` }}> {/* Indent files slightly less than folders */}
                <DraggableFile file={node} />
            </div>
        );
    }

    return (
        <div className="select-none">
            <div
                className="flex items-center gap-1.5 p-1.5 hover:bg-slate-100 rounded-md cursor-pointer text-slate-700 font-medium text-sm transition-colors"
                style={{ paddingLeft: `${(level) * 12}px` }}
                onClick={() => setIsOpen(!isOpen)}
            >
                {isOpen ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                <Folder className={`w-4 h-4 ${isOpen ? 'text-indigo-500' : 'text-slate-400'}`} fill={isOpen ? "currentColor" : "none"} />
                <span className="truncate">{node.name}</span>
            </div>

            {isOpen && (
                <div className="flex flex-col">
                    {node.children.length === 0 ? (
                        <div className="pl-8 py-1 text-xs text-slate-400 italic">Trống</div>
                    ) : (
                        node.children.map(child => (
                            <FolderItem key={child.id || child.name} node={child} level={level + 1} />
                        ))
                    )}
                </div>
            )}
        </div>
    );
};

const ImageLibrarySidebar = () => {
    const [searchTerm, setSearchTerm] = useState('');
    const [fileTree, setFileTree] = useState<FileNode[]>([]);
    const [loading, setLoading] = useState(false);
    const [rawUrls, setRawUrls] = useState<string[]>([]);

    useEffect(() => {
        fetchImages();
    }, []);

    useEffect(() => {
        // Rebuild tree when search changes or data updates
        if (rawUrls.length > 0) {
            let filteredUrls = rawUrls;
            if (searchTerm) {
                // Filter URLs that contain the search term
                filteredUrls = rawUrls.filter(url =>
                    decodeURIComponent(url).toLowerCase().includes(searchTerm.toLowerCase())
                );
            }
            const tree = buildFileTree(filteredUrls);
            setFileTree(tree);
        }
    }, [rawUrls, searchTerm]);

    const fetchImages = async () => {
        setLoading(true);
        try {
            const response = await api.get('/media/library');
            // Backend returns list of strings (Presigned URLs)
            const urls: string[] = response.data.data || [];

            // Fix localhost replacement if needed (for Presigned URLs it is complicated because signature depends on host)
            // Ideally backend returns correct host. 
            // If backend returns minio:9000, and user is on localhost:9000...
            // MinIO signature usually validates the host. If we change it, signature might break?
            // Actually, for downloaded content, usually host doesn't matter as much as Path & Query.
            // Let's TRY to replace host if it's 'minio'. 
            const fixedUrls = urls.map(url => url.replace('http://minio:9000', `http://${window.location.hostname}:9000`));

            setRawUrls(fixedUrls);

        } catch (error) {
            console.error("Failed to fetch library", error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="h-full flex flex-col">
            <div className="p-4 border-b border-slate-100">
                <h3 className="font-black text-slate-800 flex items-center gap-2 mb-3">
                    <Folder className="w-5 h-5 text-indigo-600" /> Thư viện ảnh
                </h3>
                <ModernInput
                    placeholder="Tìm ảnh..."
                    icon={<Search className="w-3.5 h-3.5" />}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="bg-slate-50 border-transparent text-sm"
                />
            </div>

            <div className="flex-1 overflow-y-auto p-2 custom-scrollbar">
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-10 gap-2">
                        <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                        <span className="text-xs text-slate-400">Đang tải...</span>
                    </div>
                ) : (
                    <>
                        {fileTree.length > 0 ? (
                            <div className="flex flex-col gap-0.5">
                                {fileTree.map(node => (
                                    <FolderItem key={node.name} node={node} />
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-10 text-slate-400 text-sm">
                                {rawUrls.length === 0 ? "Thư viện trống" : "Không tìm thấy kết quả"}
                            </div>
                        )}
                    </>
                )}
            </div>

            <div className="p-3 border-t border-slate-100 bg-slate-50 text-center">
                <button onClick={fetchImages} className="text-xs text-indigo-600 font-bold hover:underline">
                    Làm mới thư viện
                </button>
            </div>
        </div>
    );
};

export default ImageLibrarySidebar;
