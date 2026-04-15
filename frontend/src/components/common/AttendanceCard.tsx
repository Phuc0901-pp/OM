import React from 'react';
import { Briefcase, User as UserIcon, MapPin, Clock } from 'lucide-react';
import { format, addHours } from 'date-fns';
import { vi } from 'date-fns/locale';
import { getImageUrl } from '../../utils/imageUtils';
import { parseSafeDate } from '../../utils/timeUtils';

interface AttendanceDetail {
    id: string;
    user?: { id: string; full_name: string; email: string };
    project?: { project_name: string; location: string };
    status_checkin: number;
    date_checkin: string;
    status_checkout: number;
    date_checkout: string;
    created_at: string;
    personnel_photo?: string;
    checkout_img_url?: string;
    address_checkin?: string;
    address_checkout?: string;
    checkout_approved_at?: string;
    checkout_rejected_at?: string;
    checkout_reject_reason?: string;
}

interface AttendanceCardProps {
    data: AttendanceDetail;
    type?: string;
    onImageClick: (src: string, alt: string) => void;
}

const AttendanceCard: React.FC<AttendanceCardProps> = ({ data, type, onImageClick }) => {
    const isCheckout = type === 'checkout_status' || type === 'checkout_request';
    const isCheckin = type === 'checkin';

    return (
        <div className="bg-gradient-to-br from-slate-50 to-indigo-50/30 dark:from-slate-800/50 dark:to-indigo-900/10 rounded-xl p-4 space-y-3 border border-slate-100 dark:border-slate-700">
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1">
                <Briefcase className="w-3.5 h-3.5" />
                Thông tin chấm công
            </p>

            {/* User & Project Info */}
            <div className="flex flex-wrap gap-3 text-xs">
                {data.user?.full_name && (
                    <span className="flex items-center gap-1 bg-white dark:bg-slate-800 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-600 font-medium text-slate-700 dark:text-slate-300">
                        <UserIcon className="w-3 h-3 text-indigo-500" /> {data.user.full_name}
                    </span>
                )}
                {data.project?.project_name && (
                    <span className="flex items-center gap-1 bg-white dark:bg-slate-800 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-600 font-medium text-slate-700 dark:text-slate-300">
                        <MapPin className="w-3 h-3 text-emerald-500" /> {data.project.project_name}
                    </span>
                )}
            </div>

            {/* Times */}
            <div className="grid grid-cols-2 gap-3">
                {/* Checkin */}
                <div className={`rounded-lg p-3 ${isCheckin ? 'ring-2 ring-emerald-400 bg-emerald-50 dark:bg-emerald-900/20' : 'bg-white dark:bg-slate-800'} border border-slate-200 dark:border-slate-600`}>
                    <p className="text-[10px] font-bold text-emerald-600 uppercase mb-1">Check-in</p>
                    {data.date_checkin ? (
                        <p className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {format(addHours(parseSafeDate(data.date_checkin), 7), "HH:mm", { locale: vi })}
                        </p>
                    ) : (
                        <p className="text-xs text-slate-400 italic">---</p>
                    )}
                    {data.address_checkin && (
                        <p className="text-[10px] text-slate-500 mt-1 truncate" title={data.address_checkin}>{data.address_checkin}</p>
                    )}
                </div>

                {/* Checkout */}
                <div className={`rounded-lg p-3 ${isCheckout ? 'ring-2 ring-indigo-400 bg-indigo-50 dark:bg-indigo-900/20' : 'bg-white dark:bg-slate-800'} border border-slate-200 dark:border-slate-600`}>
                    <p className="text-[10px] font-bold text-indigo-600 uppercase mb-1">Check-out</p>
                    {data.date_checkout ? (
                        <p className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {format(addHours(parseSafeDate(data.date_checkout), 7), "HH:mm", { locale: vi })}
                        </p>
                    ) : (
                        <p className="text-xs text-amber-500 italic">Chưa checkout</p>
                    )}
                    {data.address_checkout && (
                        <p className="text-[10px] text-slate-500 mt-1 truncate" title={data.address_checkout}>{data.address_checkout}</p>
                    )}
                </div>
            </div>

            {/* Photos */}
            <div className="flex flex-col gap-3">
                {data.personnel_photo && (
                    <div>
                        <p className="text-[10px] font-bold text-slate-500 uppercase mb-1">Ảnh Check-in</p>
                        <MultiImageCell src={data.personnel_photo} label="Ảnh Check-in" onImageClick={onImageClick} />
                    </div>
                )}
                {data.checkout_img_url && (
                    <div className="mt-2">
                        <p className="text-[10px] font-bold text-slate-500 uppercase mb-1">Ảnh Check-out</p>
                        <MultiImageCell src={data.checkout_img_url} label="Ảnh Check-out" onImageClick={onImageClick} />
                    </div>
                )}
            </div>

            {/* Rejection Reason */}
            {data.checkout_reject_reason && (
                <div className="text-xs bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-2 rounded-lg border border-red-100 dark:border-red-900/30">
                    <strong>Lý do từ chối:</strong> {data.checkout_reject_reason}
                </div>
            )}
        </div>
    );
};

// Helper for parsing JSON array of images safely
// Handles both simple array format: ["url1", "url2"]
// AND new checkout object map format: { "personnel_photo": "[\"url\"]", ... }
const MultiImageCell = ({ src, label, onImageClick }: { src?: string, label: string, onImageClick: (src: string, alt: string) => void }) => {
    if (!src) return null;

    let images: string[] = [];
    const trimmed = src.trim();

    if (trimmed.startsWith('{')) {
        // JSON Object map (new checkout format)
        try {
            const parsedObject = JSON.parse(trimmed);
            Object.values(parsedObject).forEach((val: any) => {
                if (typeof val === 'string') {
                    if (val.trim().startsWith('[')) {
                        try {
                            const subArr = JSON.parse(val);
                            if (Array.isArray(subArr)) {
                                images.push(...subArr.filter((item: any) => typeof item === 'string'));
                            }
                        } catch {
                            images.push(val);
                        }
                    } else {
                        images.push(val);
                    }
                } else if (Array.isArray(val)) {
                    images.push(...val.filter((item: any) => typeof item === 'string'));
                }
            });
        } catch { /* ignore */ }
    } else if (trimmed.startsWith('[')) {
        // JSON Array (normal checkin format)
        try {
            const parsed = JSON.parse(trimmed);
            if (Array.isArray(parsed) && parsed.length > 0) {
                images = parsed.filter((item: any) => typeof item === 'string');
            }
        } catch {
            // Fallback for malformed JSON
            let cleanedStr = trimmed.substring(1, trimmed.length - 1);
            const parts = cleanedStr.split(',').map(s => s.trim().replace(/^['"]|['"]$/g, ''));
            images = parts.filter(Boolean);
        }
    } else {
        images = [trimmed];
    }

    // Strip any leftover JSON quotes from URL strings
    images = images.map(u => u.replace(/^['"]|['"]$/g, '')).filter(Boolean);

    if (images.length === 0) return null;

    return (
        <div className="flex flex-wrap gap-2">
            {images.map((imgSrc, index) => (
                <img
                    key={index}
                    src={getImageUrl(imgSrc)}
                    alt={`${label} ${index + 1}`}
                    className="w-16 h-16 object-cover rounded-lg border border-slate-200 dark:border-slate-600 cursor-pointer hover:ring-2 hover:ring-indigo-500 transition-all"
                    onClick={() => onImageClick(getImageUrl(imgSrc), `${label} ${index + 1}`)}
                />
            ))}
        </div>
    );
};

export default AttendanceCard;
export type { AttendanceDetail };
