import React, { useEffect, useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import api from '../../../services/api';
import {
    Folder,
    Image as ImageIcon,
    Download,
    ChevronRight,
    Search,
    Loader2,
    UserCheck,
    LogIn,
    LogOut
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// --- Types ---
interface FileNode {
    name: string;
    path: string;
    type: 'folder' | 'file';
    children?: Record<string, FileNode>;
    size?: number;
    fileLabel?: string; // For distinguishing photo types (Check-in, Check-out, etc.)
}

interface AttendanceRecord {
    id: string;
    date_checkin?: string;
    date_checkout?: string;
    personnel_photo?: string;
    id_card_front?: string;
    id_card_back?: string;
    safety_card_front?: string;
    safety_card_back?: string;
    tools_photos?: string;
    documents_photos?: string;
    checkout_img_url?: string;
    address_checkin?: string;
    address_checkout?: string;
    user?: {
        full_name?: string;
        name?: string;
        email?: string;
    };
    project?: {
        project_name?: string;
    };
}

// --- CONFIG: Folder Name Aliases ---
const ROOT_DISPLAY_MAP: Record<string, string> = {
    "2026": "Công việc",
    "Q1": "Chấm công",
};

// --- Helper: Get proxy-aware image src ---
// Also handles JSON array strings like ["http://....jpg"]
const getImageSrc = (path: string) => {
    if (!path) return '';
    // Unwrap JSON arrays stored as strings
    if (path.startsWith('[') || path.startsWith('\'')) {
        try {
            const arr = JSON.parse(path);
            if (Array.isArray(arr) && arr.length > 0) path = arr[0];
        } catch { /* use as-is */ }
    }
    if (path.startsWith('http://') || path.startsWith('https://')) return path;
    return `/api/media/proxy?key=${encodeURIComponent(path)}`;
};

// --- Helper: Parse JSON array safely ---
const parseJsonArray = (str?: string): string[] => {
    if (!str) return [];
    try {
        const parsed = JSON.parse(str);
        if (Array.isArray(parsed)) return parsed.filter(Boolean);
        if (typeof parsed === 'string') return [parsed];
    } catch {
        if (str.startsWith('http')) return [str];
    }
    return [];
};

// --- Helper: Format attendance date to folder name ---
const formatDateFolder = (dateStr?: string): string => {
    if (!dateStr) return 'Không rõ ngày';
    const d = new Date(dateStr);
    return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

// --- Helper: Get user display name ---
const getUserName = (record: AttendanceRecord): string => {
    return record.user?.full_name || record.user?.name || record.user?.email || 'Nhân viên';
};

const ATTENDANCE_FOLDER_KEY = 'Chấm công';

const ReportsPage = () => {
    // --- State ---
    const [loading, setLoading] = useState(true);
    const [allKeys, setAllKeys] = useState<string[]>([]);
    const [attendanceHistory, setAttendanceHistory] = useState<AttendanceRecord[]>([]);
    const [currentPath, setCurrentPath] = useState<string[]>([]);
    const [previewImage, setPreviewImage] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');

    // --- Fetch Data ---
    useEffect(() => {
        fetchAll();
    }, []);

    const fetchAll = async () => {
        setLoading(true);
        try {
            const [libraryRes, attendanceRes] = await Promise.allSettled([
                api.get('/media/library'),
                api.get('/attendance/history/all?limit=500')
            ]);

            if (libraryRes.status === 'fulfilled' && libraryRes.value.data?.data) {
                setAllKeys(libraryRes.value.data.data);
            }
            if (attendanceRes.status === 'fulfilled') {
                const data = attendanceRes.value.data;
                setAttendanceHistory(Array.isArray(data) ? data : []);
            }
        } catch (err) {
            console.error("Failed to fetch data", err);
        } finally {
            setLoading(false);
        }
    };

    // --- Build Attendance virtual tree ---
    const buildAttendanceTree = (records: AttendanceRecord[]): Record<string, FileNode> => {
        const root: Record<string, FileNode> = {};

        const addFile = (
            dateFolder: string,
            userFolder: string,
            actionFolder: string,
            fileName: string,
            imagePath: string
        ) => {
            if (!root[dateFolder]) root[dateFolder] = { name: dateFolder, path: dateFolder, type: 'folder', children: {} };
            const dateNode = root[dateFolder];

            if (!dateNode.children![userFolder]) {
                dateNode.children![userFolder] = { name: userFolder, path: `${dateFolder}/${userFolder}`, type: 'folder', children: {} };
            }
            const userNode = dateNode.children![userFolder];

            if (!userNode.children![actionFolder]) {
                userNode.children![actionFolder] = { name: actionFolder, path: `${dateFolder}/${userFolder}/${actionFolder}`, type: 'folder', children: {} };
            }
            const actionNode = userNode.children![actionFolder];

            if (!actionNode.children![fileName]) {
                actionNode.children![fileName] = {
                    name: fileName,
                    path: imagePath,
                    type: 'file'
                };
            }
        };

        records.forEach((rec) => {
            const dateFolder = formatDateFolder(rec.date_checkin || rec.date_checkout);
            const userFolder = getUserName(rec);

            // Check-in photos — all fields may be stored as JSON array strings in DB
            const checkinFolder = `▶ Check-in${rec.date_checkin ? ` (${new Date(rec.date_checkin).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })})` : ''}`;
            parseJsonArray(rec.personnel_photo).forEach((url, i) => addFile(dateFolder, userFolder, checkinFolder, `Ảnh nhân viên${i > 0 ? ' ' + (i + 1) : ''}.jpg`, url));
            parseJsonArray(rec.id_card_front).forEach((url, i) => addFile(dateFolder, userFolder, checkinFolder, `CCCD mặt trước${i > 0 ? ' ' + (i + 1) : ''}.jpg`, url));
            parseJsonArray(rec.id_card_back).forEach((url, i) => addFile(dateFolder, userFolder, checkinFolder, `CCCD mặt sau${i > 0 ? ' ' + (i + 1) : ''}.jpg`, url));
            parseJsonArray(rec.safety_card_front).forEach((url, i) => addFile(dateFolder, userFolder, checkinFolder, `Thẻ an toàn trước${i > 0 ? ' ' + (i + 1) : ''}.jpg`, url));
            parseJsonArray(rec.safety_card_back).forEach((url, i) => addFile(dateFolder, userFolder, checkinFolder, `Thẻ an toàn sau${i > 0 ? ' ' + (i + 1) : ''}.jpg`, url));
            parseJsonArray(rec.tools_photos).forEach((url, i) => addFile(dateFolder, userFolder, checkinFolder, `Ảnh thiết bị ${i + 1}.jpg`, url));
            parseJsonArray(rec.documents_photos).forEach((url, i) => addFile(dateFolder, userFolder, checkinFolder, `Tài liệu ${i + 1}.jpg`, url));

            // Check-out photos
            const checkoutFolder = `◀ Check-out${rec.date_checkout ? ` (${new Date(rec.date_checkout).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })})` : ''}`;
            parseJsonArray(rec.checkout_img_url).forEach((url, i) => addFile(dateFolder, userFolder, checkoutFolder, `Ảnh check-out ${i + 1}.jpg`, url));
            if (!rec.checkout_img_url && rec.date_checkout) {
                // Empty checkout folder just as info — skip adding file to avoid empty
            }
        });

        return root;
    };

    // --- Build Tree Structure from MinIO Keys + Attendance ---
    const fileTree = useMemo(() => {
        const root: Record<string, FileNode> = {};

        // 1. Build MinIO tree (excluding the old "Q1" folder which was the placeholder, and "Checkin"/"Checkout" folders)
        const addToTree = (parts: string[], currentNode: Record<string, FileNode>, fullPath: string, level: number = 0) => {
            if (parts.length === 0) return;
            const part = decodeURIComponent(parts[0]);
            const isFile = parts.length === 1;

            // Skip the old placeholder "Q1" ONLY if it's a root folder
            if (level === 0 && part === 'Q1') return;

            // Skip raw attendance folders since we have a dedicated virtual tree for them
            if (part === 'Checkin' || part === 'Checkout') return;

            if (!currentNode[part]) {
                currentNode[part] = {
                    name: part,
                    path: isFile ? fullPath : fullPath.split(part)[0] + part + '/',
                    type: isFile ? 'file' : 'folder',
                    children: {}
                };
            }
            if (!isFile) {
                addToTree(parts.slice(1), currentNode[part].children!, fullPath, level + 1);
            }
        };

        allKeys.forEach(key => {
            if (searchTerm && !key.toLowerCase().includes(searchTerm.toLowerCase())) return;
            const parts = key.split('/').filter(p => p !== '');
            addToTree(parts, root, key, 0);
        });

        // 2. Build the real "Chấm công" folder from attendance DB data
        const filteredHistory = searchTerm
            ? attendanceHistory.filter(r =>
                getUserName(r).toLowerCase().includes(searchTerm.toLowerCase()) ||
                formatDateFolder(r.date_checkin).includes(searchTerm)
            )
            : attendanceHistory;

        const attendanceTree = buildAttendanceTree(filteredHistory);
        root[ATTENDANCE_FOLDER_KEY] = {
            name: ATTENDANCE_FOLDER_KEY,
            path: ATTENDANCE_FOLDER_KEY,
            type: 'folder',
            children: attendanceTree
        };

        return root;
    }, [allKeys, attendanceHistory, searchTerm]);

    // --- Navigation Logic ---
    const currentFolder = useMemo(() => {
        let current = fileTree;
        for (const part of currentPath) {
            if (current[part] && current[part].children) {
                current = current[part].children!;
            } else {
                return {};
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

    // --- Helper: Get folder icon / color based on attendance folder context ---
    const isInsideAttendance = currentPath[0] === ATTENDANCE_FOLDER_KEY;
    const getAttendanceFolderColor = (name: string) => {
        if (name.startsWith('▶')) return 'text-green-500 fill-green-50';
        if (name.startsWith('◀')) return 'text-orange-500 fill-orange-50';
        return 'text-blue-400 fill-blue-50';
    };

    // --- Actions ---
    const handleDownload = (node: FileNode) => {
        if (node.type === 'file') {
            const link = document.createElement('a');
            link.href = getImageSrc(node.path);
            link.download = node.name;
            link.target = '_blank';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } else {
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
        if (currentPath.length === 0) return;
        const prefix = currentPath.join('/') + '/';
        const name = currentPath[currentPath.length - 1];
        const link = document.createElement('a');
        link.href = `/api/media/download-zip?prefix=${encodeURIComponent(prefix)}`;
        link.download = `${name}.zip`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    // --- Count items recursively for display ---
    const countItems = (node: FileNode): number => {
        if (node.type === 'file') return 1;
        return Object.values(node.children || {}).length;
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
                    {currentPath.length > 0 && !isInsideAttendance && (
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
                                const isAttendanceRoot = currentPath.length === 0 && name === ATTENDANCE_FOLDER_KEY;
                                const folderColorClass = isInsideAttendance ? getAttendanceFolderColor(name) : 'text-blue-400 fill-blue-50';

                                return (
                                    <motion.div
                                        key={name}
                                        initial={{ opacity: 0, scale: 0.95 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        exit={{ opacity: 0, scale: 0.95 }}
                                        transition={{ duration: 0.2 }}
                                        className={`group relative bg-white p-3 rounded-xl border shadow-sm hover:shadow-md transition-all cursor-pointer select-none flex flex-col items-center gap-3 ${isAttendanceRoot
                                            ? 'border-green-200 hover:border-green-400 bg-green-50/30'
                                            : 'border-slate-200 hover:border-indigo-300'
                                            }`}
                                        onClick={() => node.type === 'folder' ? handleNavigate(name) : setPreviewImage(node.path)}
                                    >
                                        {/* Icon / Thumbnail */}
                                        <div className="w-full aspect-square bg-slate-50 rounded-lg flex items-center justify-center overflow-hidden relative">
                                            {node.type === 'folder' ? (
                                                isAttendanceRoot ? (
                                                    <div className="flex flex-col items-center gap-1">
                                                        <UserCheck className="w-10 h-10 text-green-500" />
                                                    </div>
                                                ) : (
                                                    <Folder className={`w-12 h-12 ${folderColorClass}`} />
                                                )
                                            ) : (
                                                (() => {
                                                    const src = getImageSrc(node.path);
                                                    const isImg = src && (
                                                        node.name.toLowerCase().endsWith('.jpg') ||
                                                        node.name.toLowerCase().endsWith('.png') ||
                                                        node.name.toLowerCase().endsWith('.jpeg') ||
                                                        node.path.includes('cloudinary') ||
                                                        node.path.includes('res.cloudinary')
                                                    );
                                                    return isImg ? (
                                                        <img
                                                            src={src}
                                                            alt={displayName}
                                                            loading="lazy"
                                                            className="w-full h-full object-cover"
                                                            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                                        />
                                                    ) : (
                                                        <ImageIcon className="w-10 h-10 text-slate-400" />
                                                    );
                                                })()
                                            )}

                                            {/* Hover Overlay */}
                                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 backdrop-blur-[1px]">
                                                {!isInsideAttendance && (
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); handleDownload(node); }}
                                                        className="p-2 bg-white rounded-full text-slate-700 hover:text-indigo-600 shadow-lg hover:scale-110 transition-transform"
                                                        title={node.type === 'folder' ? "Tải thư mục (Zip)" : "Tải ảnh"}
                                                    >
                                                        <Download className="w-4 h-4" />
                                                    </button>
                                                )}
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
                                                {node.type === 'folder'
                                                    ? `${countItems(node)} mục`
                                                    : isAttendanceRoot
                                                        ? `${attendanceHistory.length} bản ghi`
                                                        : 'File'}
                                            </p>
                                        </div>

                                        {/* Check-in / Check-out badge */}
                                        {isInsideAttendance && node.type === 'folder' && (
                                            <div className={`absolute top-2 left-2 p-1 rounded-full ${name.startsWith('▶') ? 'bg-green-100' : name.startsWith('◀') ? 'bg-orange-100' : 'bg-blue-100'}`}>
                                                {name.startsWith('▶') ? (
                                                    <LogIn className="w-3 h-3 text-green-600" />
                                                ) : name.startsWith('◀') ? (
                                                    <LogOut className="w-3 h-3 text-orange-600" />
                                                ) : null}
                                            </div>
                                        )}
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
                                src={getImageSrc(previewImage)}
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
