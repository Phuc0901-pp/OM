import React from 'react';
import { Briefcase, User as UserIcon, MapPin, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';

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
                            {format(new Date(data.date_checkin), "HH:mm", { locale: vi })}
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
                            {format(new Date(data.date_checkout), "HH:mm", { locale: vi })}
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
            <div className="flex gap-3 flex-wrap">
                {data.personnel_photo && (
                    <img
                        src={data.personnel_photo}
                        alt="Check-in Photo"
                        className="w-16 h-16 object-cover rounded-lg border border-slate-200 dark:border-slate-600 cursor-pointer hover:opacity-80 transition-opacity"
                        onClick={() => onImageClick(data.personnel_photo!, "Ảnh Check-in")}
                    />
                )}
                {data.checkout_img_url && (
                    <img
                        src={data.checkout_img_url}
                        alt="Check-out Photo"
                        className="w-16 h-16 object-cover rounded-lg border border-slate-200 dark:border-slate-600 cursor-pointer hover:opacity-80 transition-opacity"
                        onClick={() => onImageClick(data.checkout_img_url!, "Ảnh Check-out")}
                    />
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

export default AttendanceCard;
export type { AttendanceDetail };
