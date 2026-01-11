import { useState, useEffect, memo } from 'react';
import { Clock } from 'lucide-react';

const CurrentClock = memo(() => {
    // Force strict 24h format: HH:MM:SS
    // Force strict structure: HH:MM:SS Th X, DD/MM/YYYY
    const [timeStr, setTimeStr] = useState<string>('');

    useEffect(() => {
        const update = () => {
            const now = new Date();

            // 1. Time
            const h = now.getHours().toString().padStart(2, '0');
            const min = now.getMinutes().toString().padStart(2, '0');
            const s = now.getSeconds().toString().padStart(2, '0');

            // 2. Date
            const d = now.getDate().toString().padStart(2, '0');
            const m = (now.getMonth() + 1).toString().padStart(2, '0');
            const y = now.getFullYear();

            // 3. Day of week (Vietnamese)
            const days = ['CN', 'Th 2', 'Th 3', 'Th 4', 'Th 5', 'Th 6', 'Th 7'];
            const dayName = days[now.getDay()];

            // Clean un-ambiguous string
            setTimeStr(`${h}:${min}:${s} ${dayName}, ${d}/${m}/${y}`);
        };

        // Run immediately
        update();

        // Sync nicely with next second
        const now = new Date();
        const msUntilNextSecond = 1000 - now.getMilliseconds();

        let interval: NodeJS.Timeout;

        const timeout = setTimeout(() => {
            update();
            interval = setInterval(update, 1000);
        }, msUntilNextSecond);

        return () => {
            clearTimeout(timeout);
            if (interval) clearInterval(interval);
        };
    }, []);

    if (!timeStr) return null; // Prevent flash of empty/wrong time

    return (
        <div className="hidden xl:flex items-center gap-3 text-slate-600 bg-white/50 backdrop-blur-md px-4 py-2 rounded-2xl border border-white/60 shadow-sm hover:shadow-md transition-all cursor-default select-none group hover:bg-white/80">
            <div className="p-1.5 bg-blue-50 rounded-lg group-hover:scale-110 transition-transform">
                <Clock className="w-4 h-4 text-blue-600" />
            </div>
            <span className="text-sm font-bold font-mono text-slate-700 tabular-nums min-w-[170px] text-center">
                {timeStr}
            </span>
        </div>
    );
});

export default CurrentClock;
