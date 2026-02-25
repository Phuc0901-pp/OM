import { useState, useEffect, useCallback } from 'react';
import api from '../../../services/api';
import {
    Activity, Users, Bell, CheckCircle, Radio, TrendingUp,
    Layers, Wifi, Clock, RefreshCw
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface TypeCount { type: string; count: number; }
interface HourlyBucket { hour: string; count: number; }

interface NotificationMetrics {
    ccu: number;
    total_connections: number;
    total_7d: number;
    total_30d: number;
    read_rate_30d: number;
    total_unread: number;
    push_sub_count: number;
    queue_depth: number;
    type_breakdown: TypeCount[];
    hourly_delivery: HourlyBucket[];
    timestamp: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TYPE_COLORS: Record<string, string> = {
    success: '#10b981',
    error: '#ef4444',
    warning: '#f59e0b',
    info: '#3b82f6',
};

const TYPE_LABELS: Record<string, string> = {
    success: 'Phê duyệt',
    error: 'Từ chối',
    warning: 'Phân công',
    info: 'Thông tin',
};

function MiniBar({ value, max, color }: { value: number; max: number; color: string }) {
    const pct = max > 0 ? (value / max) * 100 : 0;
    return (
        <div className="flex items-center gap-3">
            <div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden">
                <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{ width: `${pct}%`, backgroundColor: color }}
                />
            </div>
            <span className="text-xs text-slate-400 w-8 text-right">{value}</span>
        </div>
    );
}

function Sparkline({ data }: { data: HourlyBucket[] }) {
    if (!data || data.length === 0) {
        return <div className="h-16 flex items-center justify-center text-slate-500 text-xs">Chưa có dữ liệu</div>;
    }
    const max = Math.max(...data.map(d => d.count), 1);
    const width = 400;
    const height = 64;
    const step = width / Math.max(data.length - 1, 1);

    const points = data.map((d, i) => ({
        x: i * step,
        y: height - (d.count / max) * (height - 8),
    }));

    const pathD = points.map((p, i) =>
        i === 0 ? `M ${p.x},${p.y}` : `L ${p.x},${p.y}`
    ).join(' ');

    const areaD = `${pathD} L ${points[points.length - 1].x},${height} L 0,${height} Z`;

    return (
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-16" preserveAspectRatio="none">
            <defs>
                <linearGradient id="sparkGrad" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="#6366f1" stopOpacity="0.4" />
                    <stop offset="100%" stopColor="#6366f1" stopOpacity="0" />
                </linearGradient>
            </defs>
            <path d={areaD} fill="url(#sparkGrad)" />
            <path d={pathD} stroke="#6366f1" strokeWidth="2" fill="none" strokeLinejoin="round" />
            {points.map((p, i) => (
                <circle key={i} cx={p.x} cy={p.y} r="3" fill="#6366f1" />
            ))}
        </svg>
    );
}

// ─── StatCard ─────────────────────────────────────────────────────────────────

interface StatCardProps {
    icon: React.ElementType;
    label: string;
    value: string | number;
    sub?: string;
    highlight?: boolean;
    pulse?: boolean;
    color?: string;
}

function StatCard({ icon: Icon, label, value, sub, highlight, pulse, color = '#6366f1' }: StatCardProps) {
    return (
        <div
            className="relative overflow-hidden rounded-2xl p-5"
            style={{
                background: highlight
                    ? `linear-gradient(135deg, ${color}22, ${color}11)`
                    : 'rgba(255,255,255,0.04)',
                border: `1px solid ${highlight ? color + '44' : 'rgba(255,255,255,0.08)'}`,
                backdropFilter: 'blur(12px)',
            }}
        >
            {/* Glow blob */}
            {highlight && (
                <div
                    className="absolute -top-4 -right-4 w-20 h-20 rounded-full blur-2xl opacity-30"
                    style={{ backgroundColor: color }}
                />
            )}
            <div className="relative z-10 flex items-start justify-between">
                <div>
                    <p className="text-xs text-slate-400 mb-1 uppercase tracking-widest">{label}</p>
                    <p className="text-3xl font-bold text-white">{value}</p>
                    {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
                </div>
                <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center"
                    style={{ backgroundColor: color + '22' }}
                >
                    <Icon className={`w-5 h-5`} style={{ color }} />
                    {pulse && (
                        <span
                            className="absolute top-1 right-1 w-2 h-2 rounded-full animate-ping"
                            style={{ backgroundColor: color }}
                        />
                    )}
                </div>
            </div>
        </div>
    );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function NotificationMonitoringPage() {
    const [metrics, setMetrics] = useState<NotificationMetrics | null>(null);
    const [loading, setLoading] = useState(true);
    const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
    const [autoRefresh, setAutoRefresh] = useState(true);

    const fetchMetrics = useCallback(async () => {
        try {
            const res = await api.get<NotificationMetrics>('/admin/notification-metrics');
            setMetrics(res.data);
            setLastRefresh(new Date());
        } catch (e) {
            console.error('Failed to fetch metrics', e);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchMetrics();
        if (!autoRefresh) return;
        const interval = setInterval(fetchMetrics, 10_000); // refresh every 10s
        return () => clearInterval(interval);
    }, [fetchMetrics, autoRefresh]);

    const maxType = metrics?.type_breakdown
        ? Math.max(...metrics.type_breakdown.map(t => t.count), 1)
        : 1;

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full min-h-[400px]">
                <div className="flex flex-col items-center gap-3">
                    <div className="w-10 h-10 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                    <p className="text-slate-400 text-sm">Đang tải dữ liệu...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen p-6" style={{ background: 'linear-gradient(135deg, #0f0f1a 0%, #1a1a2e 100%)' }}>
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                        <Activity className="w-6 h-6 text-indigo-400" />
                        Notification Monitoring
                    </h1>
                    <p className="text-slate-400 text-sm mt-1">
                        Cập nhật lần cuối: {lastRefresh.toLocaleTimeString('vi-VN')}
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => setAutoRefresh(v => !v)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${autoRefresh
                                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/30'
                                : 'bg-white/10 text-slate-300'
                            }`}
                    >
                        <Radio className="w-4 h-4" />
                        {autoRefresh ? 'Live' : 'Paused'}
                    </button>
                    <button
                        onClick={fetchMetrics}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/10 text-slate-300 text-sm hover:bg-white/15 transition-all"
                    >
                        <RefreshCw className="w-4 h-4" />
                        Refresh
                    </button>
                </div>
            </div>

            {/* KPI Row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <StatCard
                    icon={Wifi}
                    label="CCU Online"
                    value={metrics?.ccu ?? 0}
                    sub={`${metrics?.total_connections ?? 0} kết nối`}
                    highlight
                    pulse={autoRefresh}
                    color="#10b981"
                />
                <StatCard
                    icon={Bell}
                    label="Tổng 7 ngày"
                    value={metrics?.total_7d?.toLocaleString() ?? 0}
                    sub="Thông báo đã gửi"
                    color="#6366f1"
                />
                <StatCard
                    icon={CheckCircle}
                    label="Tỷ lệ đọc (30d)"
                    value={`${(metrics?.read_rate_30d ?? 0).toFixed(1)}%`}
                    sub={`${metrics?.total_unread ?? 0} chưa đọc`}
                    highlight={(metrics?.read_rate_30d ?? 0) > 70}
                    color="#f59e0b"
                />
                <StatCard
                    icon={Layers}
                    label="Job Queue"
                    value={metrics?.queue_depth ?? 0}
                    sub="Pending async push"
                    highlight={(metrics?.queue_depth ?? 0) > 50}
                    color={(metrics?.queue_depth ?? 0) > 50 ? '#ef4444' : '#6366f1'}
                />
            </div>

            {/* Row 2 */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <StatCard icon={Users} label="Push Subscriptions" value={metrics?.push_sub_count?.toLocaleString() ?? 0} sub="Thiết bị đã đăng ký" color="#a78bfa" />
                <StatCard icon={TrendingUp} label="Tổng 30 ngày" value={metrics?.total_30d?.toLocaleString() ?? 0} sub="Thông báo đã gửi" color="#22d3ee" />
                <StatCard icon={Clock} label="WS Connections" value={metrics?.total_connections ?? 0} sub={`${metrics?.ccu ?? 0} user online`} color="#f472b6" />
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Hourly Sparkline */}
                <div
                    className="rounded-2xl p-5"
                    style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
                >
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-semibold text-white">Phân phối theo giờ (24h)</h3>
                        <span className="text-xs text-slate-500">Số thông báo / giờ</span>
                    </div>
                    <Sparkline data={metrics?.hourly_delivery ?? []} />
                    {metrics?.hourly_delivery && metrics.hourly_delivery.length > 0 && (
                        <div className="flex justify-between mt-2 text-xs text-slate-500">
                            <span>{metrics.hourly_delivery[0]?.hour?.slice(11) ?? ''}</span>
                            <span>Bây giờ</span>
                        </div>
                    )}
                </div>

                {/* Type Breakdown */}
                <div
                    className="rounded-2xl p-5"
                    style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
                >
                    <h3 className="text-sm font-semibold text-white mb-4">Phân loại thông báo (30d)</h3>
                    {metrics?.type_breakdown && metrics.type_breakdown.length > 0 ? (
                        <div className="space-y-4">
                            {metrics.type_breakdown.map(t => (
                                <div key={t.type}>
                                    <div className="flex items-center justify-between mb-1">
                                        <span
                                            className="text-xs font-medium px-2 py-0.5 rounded-full"
                                            style={{
                                                backgroundColor: (TYPE_COLORS[t.type] ?? '#6366f1') + '22',
                                                color: TYPE_COLORS[t.type] ?? '#6366f1',
                                            }}
                                        >
                                            {TYPE_LABELS[t.type] ?? t.type}
                                        </span>
                                        <span className="text-xs text-slate-400">{((t.count / (metrics.total_30d || 1)) * 100).toFixed(0)}%</span>
                                    </div>
                                    <MiniBar value={t.count} max={maxType} color={TYPE_COLORS[t.type] ?? '#6366f1'} />
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="flex items-center justify-center h-24 text-slate-500 text-sm">
                            Chưa có dữ liệu 30 ngày
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
