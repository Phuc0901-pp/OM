import React from 'react';
import { Calendar } from 'lucide-react';
import { motion } from 'framer-motion';
import GlassCard from '../../../../components/common/GlassCard';
import type { Option } from '../../../../types/models';

interface AllocationParametersProps {
    classifications: Option[];
    selectedClassification: string;
    setSelectedClassification: (id: string) => void;
    startDate: string;
    setStartDate: (date: string) => void;
    endDate: string;
    setEndDate: (date: string) => void;
    note: string;
    setNote: (note: string) => void;
}

const AllocationParameters: React.FC<AllocationParametersProps> = ({
    classifications,
    selectedClassification,
    setSelectedClassification,
    startDate,
    setStartDate,
    endDate,
    setEndDate,
    note,
    setNote
}) => {
    return (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }} className="space-y-6">
            <GlassCard>
                <h4 className="text-sm font-bold text-slate-800 mb-4 uppercase tracking-wider">Loại Hình</h4>
                <div className="grid grid-cols-2 gap-3">
                    {classifications.map(c => (
                        <button
                            key={c.id}
                            onClick={() => setSelectedClassification(c.id)}
                            className={`px-4 py-3 text-sm font-bold rounded-xl border transition-all ${selectedClassification === c.id ? 'bg-indigo-50 border-indigo-500 text-indigo-700' : 'bg-slate-50 border-transparent text-slate-500 hover:bg-white hover:border-slate-200'}`}
                        >
                            {c.name}
                        </button>
                    ))}
                </div>
            </GlassCard>

            <GlassCard>
                <h4 className="text-sm font-bold text-slate-800 mb-4 uppercase tracking-wider flex items-center gap-2"><Calendar className="w-4 h-4" /> Kế Hoạch</h4>
                <div className="grid grid-cols-2 gap-4 mb-4">
                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase">Bắt đầu</label>
                        <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold text-slate-700 outline-none focus:border-indigo-500" />
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase">Kết thúc</label>
                        <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold text-slate-700 outline-none focus:border-indigo-500" />
                    </div>
                </div>
                <textarea value={note} onChange={e => setNote(e.target.value)} placeholder="Ghi chú thêm..." className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-indigo-500 h-24 resize-none" />
            </GlassCard>
        </motion.div>
    );
};

export default AllocationParameters;
