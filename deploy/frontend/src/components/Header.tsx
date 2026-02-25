import { useState, useEffect, memo } from 'react';
import { Menu, ChevronDown, User, Settings, LogOut, MapPin, Bell, BellRing } from 'lucide-react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import DigitalClock from './common/DigitalClock';
import { useDeviceLocation } from '../hooks/useDeviceLocation';

interface HeaderProps {
    title: string;
    user: any;
    onMenuClick: () => void;
}

const Header = ({ title, user, onMenuClick }: HeaderProps) => {
    const [isProfileOpen, setIsProfileOpen] = useState(false);
    const [currentTime, setCurrentTime] = useState(new Date());
    const [weather, setWeather] = useState<{ temp: number; icon: string; text: string } | null>(null);
    const [isSubscribed, setIsSubscribed] = useState(false);

    // Check Notification Permission
    useEffect(() => {
        if ('Notification' in window && Notification.permission === 'granted') {
            setIsSubscribed(true);
        }
    }, []);

    // Get Device Location
    const { location: deviceLocation } = useDeviceLocation({ immediate: true });

    // Update time every minute
    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    // Fetch Weather
    useEffect(() => {
        const fetchWeather = async () => {
            try {
                // Get user's location based on hook or default to HCMC
                let query = 'Ho Chi Minh City';

                if (deviceLocation?.coords) {
                    query = `${deviceLocation.coords.latitude},${deviceLocation.coords.longitude}`;
                }

                // Using the user provided key: 20eecd9d606e4a31af844309260202
                const res = await fetch(`https://api.weatherapi.com/v1/current.json?key=20eecd9d606e4a31af844309260202&q=${query}&lang=vi`);
                const data = await res.json();
                if (data.current) {
                    setWeather({
                        temp: data.current.temp_c,
                        icon: data.current.condition.icon,
                        text: data.current.condition.text
                    });
                }
            } catch (e) {
                console.error("Weather fetch failed", e);
            }
        };
        fetchWeather();
        // Refresh weather every 30 mins
        const interval = setInterval(fetchWeather, 30 * 60 * 1000);
        return () => clearInterval(interval);
    }, [deviceLocation]); // Re-fetch when location is available

    // Title Mapping for Mobile Shortening
    const getMobileTitle = (originalTitle: string) => {
        const lower = originalTitle.toLowerCase();
        if (lower.includes('môi trường làm việc')) return 'Thực thi';
        if (lower.includes('thống kê')) return 'Thống kê';
        if (lower.includes('quản lý')) return 'Quản lý';
        // Add more mappings as needed, default to original
        return originalTitle;
    };

    const mobileTitle = getMobileTitle(title);

    // Format: dd/MM/yy HH:mm
    const dateStr = currentTime.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: '2-digit' });
    const timeStr = currentTime.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    const mobileClock = `${dateStr} ${timeStr}`;

    // Format Address for Display (take first 3 parts)
    const displayAddress = deviceLocation?.address
        ? deviceLocation.address.split(',').slice(0, 3).join(', ')
        : 'Đang định vị...';

    return (
        <header className="min-h-[calc(5rem+env(safe-area-inset-top))] h-auto py-2 pt-[calc(env(safe-area-inset-top)+0.5rem)] flex items-center justify-between px-6 md:px-8 fixed top-0 right-0 left-0 md:left-72 z-40 transition-[left] duration-300 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 transition-colors">

            {/* Content Container */}
            <div className="w-full flex items-center justify-between">
                <div className="flex items-center gap-4 min-w-0 flex-1">
                    {/* Mobile Menu Button */}
                    <button
                        onClick={onMenuClick}
                        className="p-2 -ml-2 text-slate-600 dark:text-slate-400 hover:bg-white/50 dark:hover:bg-slate-800 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-xl md:hidden shrink-0 transition-colors"
                    >
                        <Menu className="w-6 h-6" />
                    </button>

                    {/* Page Title */}
                    <div className="flex flex-col md:block pr-4 min-w-0">
                        {/* Desktop Title */}
                        <h2 className="hidden md:block text-xl font-black text-slate-800 dark:text-white tracking-tight truncate bg-gradient-to-r from-slate-800 to-slate-600 dark:from-white dark:to-slate-300 bg-clip-text text-transparent">
                            {title}
                        </h2>

                        {/* Mobile Title + Clock + Location */}
                        <div className="md:hidden flex flex-col min-w-0">
                            <h2 className="text-lg font-black text-slate-800 dark:text-white tracking-tight leading-none bg-gradient-to-r from-slate-800 to-slate-600 dark:from-white dark:to-slate-300 bg-clip-text text-transparent truncate">
                                {mobileTitle}
                            </h2>
                            <div className="flex flex-col mt-0.5">
                                <div className="flex items-center gap-3 mb-1">
                                    <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 font-mono leading-none">{timeStr}</span>
                                    {weather && (
                                        <div className="flex items-center gap-1 bg-slate-50 dark:bg-slate-800 px-1.5 py-0.5 rounded-md border border-slate-100 dark:border-slate-700">
                                            <img src={weather.icon} className="w-3 h-3" alt={weather.text} />
                                            <span className="text-[10px] font-bold text-slate-600 dark:text-slate-300 leading-none">{weather.temp}°</span>
                                        </div>
                                    )}
                                </div>
                                {deviceLocation && (
                                    <div className="flex items-start gap-1 text-[11px] font-medium text-slate-500 dark:text-slate-400 leading-tight">
                                        <MapPin className="w-3 h-3 shrink-0 mt-0.5 text-indigo-500" />
                                        <span>{deviceLocation.address.split(',').slice(0, 3).join(', ')}</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right Side Actions */}
                <div className="flex items-center gap-3 md:gap-5 shrink-0">

                    {/* Desktop Version - Location + Weather + Digital Clock */}
                    <div className="hidden md:flex items-center gap-3">
                        {/* Location Badge */}
                        {deviceLocation && (
                            <div
                                className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 dark:bg-indigo-900/30 rounded-lg border border-indigo-100 dark:border-indigo-800/50 text-indigo-700 dark:text-indigo-300 text-sm font-bold shadow-sm transition-all hover:shadow-md cursor-help"
                                title={deviceLocation.address}
                            >
                                <MapPin className="w-3.5 h-3.5 shrink-0" />
                                <span className="max-w-[180px] xl:max-w-[250px] truncate">{displayAddress}</span>
                            </div>
                        )}

                        {weather && (
                            <div className="hidden lg:flex items-center gap-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-1.5 rounded-lg shadow-sm">
                                <img src={weather.icon} className="w-5 h-5" alt={weather.text} />
                                <span className="text-sm font-bold text-slate-700 dark:text-slate-200">{weather.temp}°C</span>
                            </div>
                        )}
                        <DigitalClock />
                    </div>

                    {/* Notification Bell (Web Push Trigger) */}
                    <button
                        onClick={async () => {
                            if (isSubscribed) return; // Already subscribed
                            const { subscribeToPushNotifications } = await import('../services/notificationService');
                            await subscribeToPushNotifications();
                            if (Notification.permission === 'granted') {
                                setIsSubscribed(true);
                            }
                        }}
                        className={`p-2 rounded-xl transition-all border border-transparent 
                            ${isSubscribed
                                ? 'text-indigo-600 bg-indigo-50 dark:bg-indigo-900/30 dark:text-indigo-400'
                                : 'text-slate-500 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 hover:border-slate-200 dark:hover:border-slate-600'
                            }`}
                        title={isSubscribed ? "Đã bật thông báo" : "Bật thông báo"}
                    >
                        {isSubscribed ? <BellRing className="w-5 h-5" /> : <Bell className="w-5 h-5" />}
                    </button>

                    {/* Profile Dropdown */}
                    <div className="relative">
                        <button
                            onClick={() => setIsProfileOpen(!isProfileOpen)}
                            className="flex items-center gap-3 p-1.5 pl-3 pr-2 rounded-2xl hover:bg-white/60 dark:hover:bg-slate-800 border border-transparent hover:border-white/50 dark:hover:border-slate-700 transition-all group"
                        >
                            <div className="text-right hidden md:block">
                                <p className="text-sm font-bold text-slate-700 dark:text-slate-200 leading-none group-hover:text-indigo-700 dark:group-hover:text-indigo-400 transition-colors">
                                    {user?.full_name || 'User'}
                                </p>
                                <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mt-1 group-hover:text-indigo-400">
                                    {user?.role || 'Guest'}
                                </p>
                            </div>
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 p-0.5 shadow-lg shadow-indigo-200 dark:shadow-none group-hover:shadow-indigo-300 transition-all">
                                <div className="w-full h-full bg-white/20 backdrop-blur-sm rounded-[10px] flex items-center justify-center">
                                    <span className="text-white font-bold text-lg">
                                        {(user?.full_name || 'U').charAt(0).toUpperCase()}
                                    </span>
                                </div>
                            </div>
                        </button>
                    </div>
                </div>
            </div>
        </header>
    );
};

export default Header;
