import { useState, useEffect, memo } from 'react';
import { Calendar, Clock as ClockIcon } from 'lucide-react';

/**
 * DigitalClock - Beautiful digital clock component for header
 * Shows: HH:MM:SS | Day DD/MM/YYYY
 * Responsive: Full display on desktop, compact on mobile
 */
const DigitalClock = memo(() => {
    const [time, setTime] = useState(new Date());

    useEffect(() => {
        // Sync to next second
        const now = new Date();
        const msUntilNextSecond = 1000 - now.getMilliseconds();

        let interval: NodeJS.Timeout;

        const timeout = setTimeout(() => {
            setTime(new Date());
            interval = setInterval(() => setTime(new Date()), 1000);
        }, msUntilNextSecond);

        return () => {
            clearTimeout(timeout);
            if (interval) clearInterval(interval);
        };
    }, []);

    // Format time: HH:MM:SS
    const hours = time.getHours().toString().padStart(2, '0');
    const minutes = time.getMinutes().toString().padStart(2, '0');
    const seconds = time.getSeconds().toString().padStart(2, '0');

    // Format date: Th X, DD/MM/YYYY
    const day = time.getDate().toString().padStart(2, '0');
    const month = (time.getMonth() + 1).toString().padStart(2, '0');
    const year = time.getFullYear();
    const weekDays = ['CN', 'Th 2', 'Th 3', 'Th 4', 'Th 5', 'Th 6', 'Th 7'];
    const weekDay = weekDays[time.getDay()];

    return (
        <>
            {/* Desktop Version - Minimal */}
            <div className="hidden lg:flex items-center gap-3 bg-white border border-slate-200 px-4 py-2 rounded-lg shadow-sm">
                <ClockIcon className="w-4 h-4 text-slate-500" />
                <div className="font-mono text-sm font-medium text-slate-700 tabular-nums">
                    {hours}:{minutes}:{seconds}
                </div>
                <span className="text-slate-300">|</span>
                <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-slate-500" />
                    <span className="text-xs text-slate-600 font-medium">{weekDay}, {day}/{month}/{year}</span>
                </div>
            </div>

            {/* Mobile Version - Compact */}
            <div className="flex lg:hidden items-center gap-2 bg-white border border-slate-200 px-3 py-1.5 rounded-lg shadow-sm">
                <ClockIcon className="w-3.5 h-3.5 text-slate-500" />
                <span className="font-mono text-xs font-medium text-slate-700 tabular-nums">{hours}:{minutes}</span>
            </div>
        </>
    );
});

DigitalClock.displayName = 'DigitalClock';

export default DigitalClock;
