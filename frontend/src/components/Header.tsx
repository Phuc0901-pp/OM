import { useState, useEffect } from 'react';
import { Menu, ChevronDown, User, Settings, LogOut, MapPin, Bell, BellRing, Sun, Cloud, CloudRain, CloudLightning, Snowflake, CloudSun, CloudFog, CloudDrizzle } from 'lucide-react';
import DigitalClock from './common/DigitalClock';
import { useDeviceLocation } from '../hooks/useDeviceLocation';
import NotificationBell from './common/NotificationBell';

interface HeaderProps {
    title: string;
    user: any;
    onMenuClick: () => void;
}

const Header = ({ title, user, onMenuClick }: HeaderProps) => {
    const [isProfileOpen, setIsProfileOpen] = useState(false);
    const [currentTime, setCurrentTime] = useState(new Date());
    const [weather, setWeather] = useState<{ temp: number; Icon: any; text: string; color?: string } | null>(null);
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

    // Fetch Weather (Open-Meteo - Free, No Key)
    useEffect(() => {
        const fetchWeather = async () => {
            try {
                let lat = 10.8231; // HCMC Default
                let lon = 106.6297;

                if (deviceLocation?.coords) {
                    lat = deviceLocation.coords.latitude;
                    lon = deviceLocation.coords.longitude;
                }

                const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`);
                const data = await res.json();

                if (data.current_weather) {
                    const code = data.current_weather.weathercode;
                    let Icon = Sun;
                    let text = "Nắng";
                    let colorClass = "text-yellow-500"; // Default Sunny color

                    // Detailed WMO Code Mapping
                    // 0: Clear sky
                    if (code === 0) { Icon = Sun; text = "Nắng"; colorClass = "text-yellow-500"; }
                    // 1, 2, 3: Mainly clear, partly cloudy, and overcast
                    else if (code >= 1 && code <= 3) { Icon = CloudSun; text = "Có mây"; colorClass = "text-slate-500"; }
                    // 45, 48: Fog
                    else if (code >= 45 && code <= 48) { Icon = CloudFog; text = "Sương mù"; colorClass = "text-slate-400"; }
                    // 51, 53, 55: Drizzle
                    else if (code >= 51 && code <= 55) { Icon = CloudDrizzle; text = "Mưa phùn"; colorClass = "text-sky-400"; }
                    // 61, 63, 65: Rain
                    else if (code >= 61 && code <= 67) { Icon = CloudRain; text = "Mưa"; colorClass = "text-blue-500"; }
                    // 71, 73, 75: Snow fall
                    else if (code >= 71 && code <= 77) { Icon = Snowflake; text = "Tuyết"; colorClass = "text-cyan-400"; }
                    // 80, 81, 82: Rain showers
                    else if (code >= 80 && code <= 82) { Icon = CloudRain; text = "Mưa rào"; colorClass = "text-blue-600"; }
                    // 95, 96, 99: Thunderstorm
                    else if (code >= 95) { Icon = CloudLightning; text = "Dông"; colorClass = "text-purple-600"; }

                    setWeather({
                        temp: data.current_weather.temperature,
                        Icon: Icon,
                        text: text,
                        color: colorClass
                    });
                }
            } catch (e) {
                console.error("Weather fetch failed", e);
            }
        };
        fetchWeather();
        const interval = setInterval(fetchWeather, 10 * 60 * 1000);
        return () => clearInterval(interval);
    }, [deviceLocation]);

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
                                            <weather.Icon className={`w-3 h-3 ${weather.color || 'text-sky-500'}`} />
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
                                <weather.Icon className={`w-5 h-5 ${weather.color || 'text-sky-500'}`} />
                                <span className="text-sm font-bold text-slate-700 dark:text-slate-200">{weather.temp}°C</span>
                            </div>
                        )}
                        <DigitalClock />
                    </div>

                    {/* Notification Bell */}
                    <NotificationBell />

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
