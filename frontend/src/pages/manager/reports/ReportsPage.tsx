import React, { useEffect, useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import api from '../../../services/api';
import { parseSafeDate } from '../../../utils/timeUtils';
import { addHours } from 'date-fns';
import {
    Folder,
    Image as ImageIcon,
    Download,
    ChevronRight,
    Search,
    Loader2,
    UserCheck,
    LogIn,
    LogOut,
    Home,
    MoreHorizontal,
    ArrowLeft,
    Trash2
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
// Also handles JSON array strings like ["http://minio:2603/....jpg"]
const getImageSrc = (path: string) => {
    if (!path) return '';
    // Unwrap JSON arrays stored as strings
    if (path.startsWith('[') || path.startsWith('\'')) {
        try {
            const arr = JSON.parse(path);
            if (Array.isArray(arr) && arr.length > 0) path = arr[0];
        } catch {
            // Fallback: strip brackets manually
            const cleaned = path.trim().replace(/^\[|\]$/g, '');
            const parts = cleaned.split(',').map(s => s.trim().replace(/^['"]|['"]$/g, ''));
            if (parts.length > 0 && parts[0]) path = parts[0];
        }
    }
    // Detect internal Docker MinIO URL — route through backend proxy
    const lower = path.toLowerCase();
    if (lower.includes('minio') || lower.includes(':2603')) {
        try {
            const urlObj = new URL(path);
            let key = urlObj.pathname.replace(/^\//, ''); // remove leading /
            if (key.startsWith('dev/')) key = key.substring(4); // strip bucket
            return `/api/media/proxy?key=${encodeURIComponent(key)}`;
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
        // Fallback: If it's a pseudo-JSON array string like '["http..."]' that failed to parse
        let cleanedStr = str.trim();
        if (cleanedStr.startsWith('[') && cleanedStr.endsWith(']')) {
            // Remove brackets and split by comma
            cleanedStr = cleanedStr.substring(1, cleanedStr.length - 1);
            // Remove extra quotes
            const parts = cleanedStr.split(',').map(s => s.trim().replace(/^['"]|['"]$/g, ''));
            return parts.filter(Boolean);
        }
        if (str.startsWith('http')) return [str];
    }
    return [];
};

// --- Helper: Format attendance date to folder name ---
const formatDateFolder = (dateStr?: string): string => {
    if (!dateStr) return 'Không rõ ngày';
    const d = new Date(dateStr);
    return d.toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', day: '2-digit', month: '2-digit', year: 'numeric' });
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
    const [deletingPrefix, setDeletingPrefix] = useState<string | null>(null);

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
            folderPaths: string[],
            fileName: string,
            imagePath: string
        ) => {
            let currentLevel = root;

            // Build out all folder nodes dynamically
            for (let i = 0; i < folderPaths.length; i++) {
                const folderName = folderPaths[i];
                if (!currentLevel[folderName]) {
                    // Calculate path dynamically based on history
                    const fullPath = folderPaths.slice(0, i + 1).join('/');
                    currentLevel[folderName] = { name: folderName, path: fullPath, type: 'folder', children: {} };
                }
                currentLevel = currentLevel[folderName].children!;
            }

            // Add file to the deepest folder
            if (!currentLevel[fileName]) {
                currentLevel[fileName] = {
                    name: fileName,
                    path: imagePath,
                    type: 'file'
                };
            }
        };

        records.forEach((rec) => {
            const dateFolder = formatDateFolder(rec.date_checkin || rec.date_checkout);
            const userFolder = getUserName(rec);

            // Helper to get descriptive names for subfolders
            const getFolderNameMap: Record<string, string> = {
                "personnel_photo": "Ảnh nhân sự",
                "id_card_front": "CCCD mặt trước",
                "id_card_back": "CCCD mặt sau",
                "safety_card_front": "Thẻ an toàn mặt trước",
                "safety_card_back": "Thẻ an toàn mặt sau",
                "tools_photos": "Công cụ",
                "documents_photos": "Biên bản"
            };

            // Process Check-in photos
            const checkinTimeStr = rec.date_checkin ? ` (${addHours(parseSafeDate(rec.date_checkin), 7).toLocaleTimeString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit' })})` : '';
            const checkinFolder = `▶ Check-in${checkinTimeStr}`;
            const checkinBase = [dateFolder, userFolder, checkinFolder];

            parseJsonArray(rec.personnel_photo).forEach((url, i) => addFile([...checkinBase, "Ảnh nhân sự"], `Ảnh nhân sự ${i + 1}.jpg`, url));
            parseJsonArray(rec.id_card_front).forEach((url, i) => addFile([...checkinBase, "CCCD"], `CCCD mặt trước ${i + 1}.jpg`, url));
            parseJsonArray(rec.id_card_back).forEach((url, i) => addFile([...checkinBase, "CCCD"], `CCCD mặt sau ${i + 1}.jpg`, url));
            parseJsonArray(rec.safety_card_front).forEach((url, i) => addFile([...checkinBase, "Thẻ an toàn"], `Thẻ an toàn mặt trước ${i + 1}.jpg`, url));
            parseJsonArray(rec.safety_card_back).forEach((url, i) => addFile([...checkinBase, "Thẻ an toàn"], `Thẻ an toàn mặt sau ${i + 1}.jpg`, url));
            parseJsonArray(rec.tools_photos).forEach((url, i) => addFile([...checkinBase, "Công cụ"], `Thiết bị ${i + 1}.jpg`, url));
            parseJsonArray(rec.documents_photos).forEach((url, i) => addFile([...checkinBase, "Biên bản"], `Tài liệu ${i + 1}.jpg`, url));

            // Process Check-out photos
            const checkoutTimeStr = rec.date_checkout ? ` (${addHours(parseSafeDate(rec.date_checkout), 7).toLocaleTimeString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit' })})` : '';
            const checkoutFolder = `◀ Check-out${checkoutTimeStr}`;
            const checkoutBase = [dateFolder, userFolder, checkoutFolder];

            if (rec.checkout_img_url) {
                let parsedMap: any;
                // Try to see if it's the new complex JSON structure
                if (rec.checkout_img_url.trim().startsWith('{')) {
                    try { parsedMap = JSON.parse(rec.checkout_img_url); } catch { }
                }

                if (parsedMap && typeof parsedMap === 'object' && !Array.isArray(parsedMap)) {
                    // NEW BEHAVIOR: Checkout URLs exist as a map of field_keys -> url string
                    Object.keys(parsedMap).forEach((fieldKey) => {
                        const folderTarget = getFolderNameMap[fieldKey] || "Khác";
                        const targetArrStr = parsedMap[fieldKey];
                        let arr: string[] = [];
                        if (Array.isArray(targetArrStr)) {
                            arr = targetArrStr;
                        } else if (typeof targetArrStr === 'string') {
                            arr = parseJsonArray(targetArrStr);
                        }

                        arr.forEach((url, i) => {
                            // Clean up any extra quotes that might have survived the JSON parse step
                            const cleanUrl = typeof url === 'string' ? url.replace(/^['"]|['"]$/g, '') : url;
                            // Map ID cards to general "CCCD" and Safety cards to "Thẻ an toàn" like check-in does
                            let mappedParent = folderTarget;
                            if (fieldKey.includes("id_card")) mappedParent = "CCCD";
                            if (fieldKey.includes("safety_card")) mappedParent = "Thẻ an toàn";

                            addFile([...checkoutBase, mappedParent], `${getFolderNameMap[fieldKey] || "Ảnh"} ${i + 1}.jpg`, cleanUrl);
                        });
                    });
                } else {
                    // FALLBACK: Backwards compatibility for single string or plain string array checkouts
                    parseJsonArray(rec.checkout_img_url).forEach((url, i) => addFile([...checkoutBase, "Ảnh nhân sự"], `Ảnh nhân sự ${i + 1}.jpg`, url));
                }
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

            // Hide the raw MinIO "Attendance" folder — it's already represented by the virtual "Chấm công" folder
            if (part.toLowerCase() === 'attendance') return;

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
    const handleDeleteFolder = async (e: React.MouseEvent, node: FileNode) => {
        e.stopPropagation();

        // Compute the MinIO prefix for this folder
        const folderPath = currentPath.length > 0
            ? [...currentPath, node.name].join('/') + '/'
            : node.name + '/';

        const confirmed = window.confirm(
            `Bạn có chắc chắn muốn xóa thư mục "${node.name}" và TẤT CẢ dữ liệu bên trong?\n\n[Warning] Hành động này KHÔNG THỂ hoàn tác!`
        );
        if (!confirmed) return;

        setDeletingPrefix(folderPath);
        try {
            await api.delete('/media/folder', { params: { prefix: folderPath } });
            // Refresh library after deletion
            await fetchAll();
        } catch (err: any) {
            const msg = err?.response?.data?.error || 'Xóa thất bại, vui lòng thử lại.';
            alert(`❌ ${msg}`);
        } finally {
            setDeletingPrefix(null);
        }
    };

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

    // --- Breadcrumb helpers ---
    const formatBreadcrumbName = (raw: string, isRoot: boolean = false): string => {
        const displayed = getDisplayName(raw, isRoot);
        return displayed
            .replace(/-/g, ' ')
            .replace(/_/g, ' ')
            .replace(/\b\w/g, (c) => c.toUpperCase())
            .trim();
    };

    // State for expanded '...' in breadcrumb
    const [breadcrumbExpanded, setBreadcrumbExpanded] = React.useState(false);
    React.useEffect(() => { setBreadcrumbExpanded(false); }, [currentPath.length]);

    // Build collapsed crumb list (max 4 visible, collapse middle)
    const MAX_CRUMBS = 3;
    const buildCrumbs = () => {
        if (breadcrumbExpanded || currentPath.length <= MAX_CRUMBS) {
            return currentPath.map((part, idx) => ({ part, idx, ellipsis: false }));
        }
        // Show first 1 and last 2
        const first = [{ part: currentPath[0], idx: 0, ellipsis: false }];
        const last = currentPath.slice(-2).map((part, i) => ({ part, idx: currentPath.length - 2 + i, ellipsis: false }));
        return [...first, { part: '...', idx: -1, ellipsis: true }, ...last];
    };
    const crumbs = buildCrumbs();

    // --- Render ---
    return (
        <div className="h-[calc(100vh-100px)] p-4 md:p-8 flex flex-col gap-6 font-sans text-slate-600">
            {/* Premium Header */}
            <div className="shrink-0 relative overflow-hidden bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl rounded-3xl p-6 md:p-8 shadow-xl dark:shadow-2xl border border-white/20 dark:border-white/5 transition-colors">
                <div className="absolute top-0 right-0 w-80 h-80 bg-gradient-to-br from-emerald-400/20 to-teal-600/20 rounded-full blur-3xl -z-10"></div>
                <div className="relative z-10 flex flex-col gap-1">
                    <h1 className="text-3xl md:text-4xl font-black bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 bg-clip-text text-transparent">
                        Thư Viện Đồng Bộ
                    </h1>
                    <p className="text-gray-600 dark:text-slate-400 font-medium">Quản lý và tra cứu hồ sơ hình dữ liệu</p>
                </div>
            </div>

            <div className="flex-1 flex flex-col bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden min-h-0">

                {/* ═══ TOOLBAR - TIER 1: Breadcrumb Navigation ═══ */}
                <div className="px-4 pt-3 pb-0 border-b border-slate-100 bg-white">
                    {/* Back Button + Breadcrumb Row */}
                    <div className="flex items-center gap-2 mb-3">
                        {/* Back button when not at root */}
                        {currentPath.length > 0 && (
                            <button
                                onClick={() => handleBreadcrumbClick(currentPath.length - 2)}
                                className="flex items-center justify-center w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors shrink-0"
                                title="Quay lại"
                            >
                                <ArrowLeft className="w-3.5 h-3.5" />
                            </button>
                        )}

                        {/* Scrollable breadcrumb trail */}
                        <div className="flex items-center gap-1 overflow-x-auto flex-1 pb-0" style={{ scrollbarWidth: 'none' }}>
                            {/* Home = root */}
                            <button
                                onClick={handleRootClick}
                                title="Thư viện gốc"
                                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all whitespace-nowrap shrink-0 ${currentPath.length === 0
                                        ? 'bg-indigo-100 text-indigo-700 ring-1 ring-indigo-200'
                                        : 'text-slate-500 hover:bg-slate-100'
                                    }`}
                            >
                                <Home className="w-3 h-3" />
                                Thư viện
                            </button>

                            {crumbs.map(({ part, idx, ellipsis }, i) => (
                                <React.Fragment key={i}>
                                    <ChevronRight className="w-3.5 h-3.5 text-slate-300 shrink-0" />
                                    {ellipsis ? (
                                        <button
                                            onClick={() => setBreadcrumbExpanded(true)}
                                            className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold text-slate-400 hover:bg-slate-100 transition-all shrink-0"
                                            title="Xem đường dẫn đầy đủ"
                                        >
                                            <MoreHorizontal className="w-4 h-4" />
                                        </button>
                                    ) : (
                                        <button
                                            onClick={() => handleBreadcrumbClick(idx)}
                                            className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all whitespace-nowrap shrink-0 ${idx === currentPath.length - 1
                                                    ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-200'
                                                    : 'text-slate-500 hover:bg-slate-100'
                                                }`}
                                        >
                                            {formatBreadcrumbName(part, idx === 0)}
                                        </button>
                                    )}
                                </React.Fragment>
                            ))}
                        </div>
                    </div>

                    {/* ═══ TOOLBAR - TIER 2: Context + Search + Actions ═══ */}
                    <div className="flex items-center justify-between gap-4 pb-3">
                        {/* Left: Current folder info */}
                        <div className="flex items-center gap-2 min-w-0">
                            {currentPath.length === 0 ? (
                                <div className="flex items-center gap-2">
                                    <div className="w-7 h-7 rounded-lg bg-emerald-100 flex items-center justify-center shrink-0">
                                        <Folder className="w-4 h-4 text-emerald-600" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold text-slate-700 leading-tight">Tất cả dữ liệu</p>
                                        <p className="text-[11px] text-slate-400">{Object.keys(currentFolder).length} thư mục gốc</p>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex items-center gap-2 min-w-0">
                                    <div className="w-7 h-7 rounded-lg bg-indigo-100 flex items-center justify-center shrink-0">
                                        <Folder className="w-4 h-4 text-indigo-600" />
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-sm font-bold text-slate-800 truncate leading-tight">
                                            {formatBreadcrumbName(currentPath[currentPath.length - 1], currentPath.length === 1)}
                                        </p>
                                        <p className="text-[11px] text-slate-400">{Object.keys(currentFolder).length} mục</p>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Right: Search + Download */}
                        <div className="flex items-center gap-2 shrink-0">
                            <div className="relative">
                                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                                <input
                                    type="text"
                                    placeholder="Tìm kiếm file..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500/20 outline-none w-44 transition-all focus:w-60 bg-slate-50 focus:bg-white"
                                />
                            </div>

                            {currentPath.length > 0 && !isInsideAttendance && (
                                <button
                                    onClick={handleDownloadCurrentFolder}
                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-indigo-600 to-indigo-500 text-white text-xs font-semibold rounded-lg hover:from-indigo-700 hover:to-indigo-600 transition-all shadow-sm shadow-indigo-200 whitespace-nowrap"
                                >
                                    <Download className="w-3.5 h-3.5" />
                                    Tải thư mục
                                </button>
                            )}
                        </div>
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
                                                    {/* Download Button: Hide for virtual folders, show for real folders and ALL files */}
                                                    {(node.type === 'file' || (!isInsideAttendance && !(currentPath.length === 0 && name === ATTENDANCE_FOLDER_KEY))) && (
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
                                                    {/* Delete button: only for real MinIO folders (not virtual Attendance) */}
                                                    {node.type === 'folder' && !isInsideAttendance && !(currentPath.length === 0 && name === ATTENDANCE_FOLDER_KEY) && (
                                                        <button
                                                            onClick={(e) => handleDeleteFolder(e, node)}
                                                            disabled={deletingPrefix !== null}
                                                            className="p-2 bg-red-500 rounded-full text-white hover:bg-red-600 shadow-lg hover:scale-110 transition-transform disabled:opacity-50 disabled:cursor-not-allowed"
                                                            title="Xóa thư mục"
                                                        >
                                                            {deletingPrefix === ([...currentPath, node.name].join('/') + '/') ? (
                                                                <Loader2 className="w-4 h-4 animate-spin" />
                                                            ) : (
                                                                <Trash2 className="w-4 h-4" />
                                                            )}
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
        </div>
    );
};

export default ReportsPage;
