import { useState, useEffect, memo } from 'react';
import { Bell, Search, Menu, ChevronDown, User, Settings, LogOut } from 'lucide-react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import DigitalClock from './common/DigitalClock';


interface HeaderProps {
    title: string;
    user: any;
    onMenuClick: () => void;
}

const Header = ({ title, user, onMenuClick }: HeaderProps) => {
    const [isProfileOpen, setIsProfileOpen] = useState(false);

    return (
        <header className="h-[calc(5rem+env(safe-area-inset-top))] pt-[env(safe-area-inset-top)] flex items-center justify-between px-6 md:px-8 fixed top-0 right-0 left-0 md:left-72 z-40 transition-[left] duration-300 bg-white border-b border-slate-200">

            {/* Content Container */}
            <div className="w-full flex items-center justify-between">
                <div className="flex items-center gap-4 min-w-0 flex-1">
                    {/* Mobile Menu Button */}
                    <button
                        onClick={onMenuClick}
                        className="p-2 -ml-2 text-slate-600 hover:bg-white/50 hover:text-indigo-600 rounded-xl md:hidden shrink-0 transition-colors"
                    >
                        <Menu className="w-6 h-6" />
                    </button>

                    {/* Page Title */}
                    <h2 className="text-xl font-black text-slate-800 tracking-tight truncate pr-4 bg-gradient-to-r from-slate-800 to-slate-600 bg-clip-text text-transparent">
                        {title}
                    </h2>
                </div>

                {/* Right Side Actions */}
                <div className="flex items-center gap-3 md:gap-5 shrink-0">

                    {/* Digital Clock */}
                    <DigitalClock />

                    {/* Search - Responsive */}
                    <div className="relative hidden md:block group">
                        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 group-focus-within:text-indigo-500 transition-colors" />
                        <input
                            type="text"
                            placeholder="Tìm kiếm..."
                            className="pl-10 pr-4 py-2.5 bg-slate-100/50 hover:bg-white border border-transparent hover:border-indigo-100 focus:border-indigo-300 rounded-2xl text-sm outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all w-48 lg:w-64 shadow-inner"
                        />
                    </div>
                    <button className="md:hidden p-2.5 text-slate-500 hover:bg-white hover:text-indigo-600 rounded-xl transition-all">
                        <Search className="w-5 h-5" />
                    </button>

                    {/* Notifications */}
                    <button className="relative p-2.5 text-slate-500 hover:bg-white hover:text-indigo-600 rounded-xl transition-all group">
                        <Bell className="w-5 h-5 group-hover:animate-swing" />
                        <span className="absolute top-2 right-2.5 w-2 h-2 bg-red-500 rounded-full border-2 border-white/80 animate-ping"></span>
                        <span className="absolute top-2 right-2.5 w-2 h-2 bg-red-500 rounded-full border-2 border-white/80"></span>
                    </button>

                    {/* Profile Dropdown */}
                    <div className="relative">
                        <button
                            onClick={() => setIsProfileOpen(!isProfileOpen)}
                            className="flex items-center gap-3 p-1.5 pl-3 pr-2 rounded-2xl hover:bg-white/60 border border-transparent hover:border-white/50 transition-all group"
                        >
                            <div className="text-right hidden md:block">
                                <p className="text-sm font-bold text-slate-700 leading-none group-hover:text-indigo-700 transition-colors">
                                    {user?.full_name || 'User'}
                                </p>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-1 group-hover:text-indigo-400">
                                    {user?.role || 'Guest'}
                                </p>
                            </div>
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 p-0.5 shadow-lg shadow-indigo-200 group-hover:shadow-indigo-300 transition-all">
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
