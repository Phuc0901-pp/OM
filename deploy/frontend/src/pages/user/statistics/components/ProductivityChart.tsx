import React from 'react';
import { BarChart, Bar, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { BarChart3 } from 'lucide-react';
import GlassCard from '../../../../components/common/GlassCard';

interface TimeStat {
    time_point: string;
    assigned: number;
    completed: number;
    in_progress: number;
}

interface ProductivityChartProps {
    data: TimeStat[];
    loading: boolean;
}

const ProductivityChart: React.FC<ProductivityChartProps> = ({ data, loading }) => {
    // Custom Tooltip
    const CustomTooltip = ({ active, payload, label }: any) => {
        if (active && payload && payload.length) {
            return (
                <div className="bg-white/95 backdrop-blur-md p-4 rounded-2xl shadow-xl border border-slate-100">
                    <p className="text-xs font-bold text-slate-400 mb-2 uppercase tracking-wider">{label}</p>
                    <div className="space-y-1">
                        {payload.map((entry: any, index: number) => (
                            <div key={index} className="flex items-center gap-2 text-sm font-bold">
                                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }}></div>
                                <span className="text-slate-600 min-w-[80px]">{entry.name}:</span>
                                <span style={{ color: entry.color }}>{entry.value}</span>
                            </div>
                        ))}
                    </div>
                </div>
            );
        }
        return null;
    };

    if (loading && data.length === 0) {
        return (
            <GlassCard className="h-[400px] flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-10 h-10 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin"></div>
                    <p className="text-slate-400 text-sm font-medium">Đang tải dữ liệu biểu đồ...</p>
                </div>
            </GlassCard>
        );
    }

    return (
        <GlassCard className="h-[400px] flex flex-col">
            <div className="flex items-center justify-between mb-6 px-2">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-indigo-50 rounded-lg">
                        <BarChart3 className="w-5 h-5 text-indigo-600" />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-slate-700">Biểu đồ năng suất</h3>
                        <p className="text-xs text-slate-400 font-medium">Tiến độ thực hiện theo thời gian</p>
                    </div>
                </div>
            </div>

            <div className="flex-1 w-full min-h-0">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data} barSize={32} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <defs>
                            <linearGradient id="gradCompleted" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#10b981" stopOpacity={1} />
                                <stop offset="100%" stopColor="#34d399" stopOpacity={0.8} />
                            </linearGradient>
                            <linearGradient id="gradProgress" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#3b82f6" stopOpacity={1} />
                                <stop offset="100%" stopColor="#60a5fa" stopOpacity={0.8} />
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                        <XAxis
                            dataKey="time_point"
                            axisLine={false}
                            tickLine={false}
                            tick={{ fontSize: 11, fill: '#64748b', fontWeight: 600 }}
                            dy={10}
                        />
                        <YAxis
                            axisLine={false}
                            tickLine={false}
                            tick={{ fontSize: 11, fill: '#64748b', fontWeight: 600 }}
                        />
                        <Tooltip cursor={{ fill: '#f8fafc', opacity: 0.8 }} content={<CustomTooltip />} />
                        <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px', fontSize: '12px', fontWeight: 600 }} />

                        <Bar
                            dataKey="completed"
                            name="Hoàn thành"
                            stackId="a"
                            fill="url(#gradCompleted)"
                            radius={[0, 0, 4, 4]}
                            animationDuration={1500}
                        />
                        <Bar
                            dataKey="in_progress"
                            name="Đang thực hiện"
                            stackId="a"
                            fill="url(#gradProgress)"
                            radius={[4, 4, 0, 0]}
                            animationDuration={1500}
                        />
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </GlassCard>
    );
};

export default ProductivityChart;
