import React, { useState, useEffect, createContext, useContext } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import {
  LayoutDashboard,
  Building2,
  History,
  Settings as SettingsIcon,
  Clock,
  Activity,
  Menu,
  X,
  Sun,
  Moon,
  Zap,
} from 'lucide-react';
import NotificationBell from '@/components/notifications/NotificationBell';
import PushPermissionModal from '@/components/notifications/PushPermissionModal';

export const ConnectivityContext = createContext<{
  isOnline: boolean;
  setOnline: (online: boolean) => void;
  theme: 'dark' | 'light';
  toggleTheme: () => void;
}>({
  isOnline: true,
  setOnline: () => {},
  theme: 'dark',
  toggleTheme: () => {},
});

export const useConnectivity = () => useContext(ConnectivityContext);

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const router = useRouter();
  const [time, setTime] = useState<string>('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isOnline, setOnline] = useState<boolean>(true);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  useEffect(() => {
    const savedTheme = localStorage.getItem('sceas_theme') as 'dark' | 'light';
    if (savedTheme) {
      setTheme(savedTheme);
      document.documentElement.classList.toggle('light', savedTheme === 'light');
    }
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    localStorage.setItem('sceas_theme', nextTheme);
    document.documentElement.classList.toggle('light', nextTheme === 'light');
  };

  useEffect(() => {
    setTime(new Date().toLocaleTimeString('en-US', { hour12: false }));
    const timer = setInterval(() => {
      setTime(new Date().toLocaleTimeString('en-US', { hour12: false }));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const navItems = [
    { name: 'Pusat Kawalan', path: '/', icon: LayoutDashboard },
    { name: 'Direktori Makmal', path: '/scan', icon: Building2 },
    { name: 'Rekod Audit', path: '/logs', icon: History },
    { name: 'Tetapan Sistem', path: '/settings', icon: SettingsIcon },
  ];

  const isItemActive = (path: string) => {
    if (path === '/') {
      return router.pathname === '/';
    }
    if (path === '/scan') {
      return router.pathname === '/scan' || router.pathname.startsWith('/book');
    }
    return router.pathname.startsWith(path);
  };

  const getCurrentTitle = () => {
    if (router.pathname === '/') return 'Pusat Kawalan';
    if (router.pathname === '/scan' || router.pathname.startsWith('/book')) return 'Direktori Makmal';
    if (router.pathname.startsWith('/logs')) return 'Rekod Audit';
    if (router.pathname.startsWith('/settings')) return 'Tetapan Sistem';
    return 'Pusat Kawalan';
  };

  return (
    <ConnectivityContext.Provider value={{ isOnline, setOnline, theme, toggleTheme }}>
      <div
        className={`min-h-screen ${
          theme === 'dark' ? 'bg-[#020617] text-slate-100' : 'bg-slate-50 text-slate-900'
        } flex flex-col md:flex-row font-sans transition-colors duration-300`}
      >
        {/* Push Notification Popout Modal */}
        <PushPermissionModal />

        {/* Sidebar - Desktop */}
        <aside className="hidden md:flex flex-col w-64 glass-sidebar h-screen overflow-y-auto p-6 sticky top-0 border-r border-slate-800/60 transition-colors duration-300">
          {/* Header sidebar */}
          <div className="flex items-center gap-3 mb-8">
            <div className="bg-sapphire-500/15 p-2.5 rounded-2xl border border-sapphire-500/30 text-sapphire-400 shadow-[0_0_15px_rgba(59,130,246,0.2)]">
              <Activity className="h-6 w-6" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="font-extrabold text-xl leading-tight tracking-wider bg-gradient-to-r from-sapphire-400 via-sky-300 to-teal-300 bg-clip-text text-transparent">
                  SCEAS
                </h1>
                <span className="px-1.5 py-0.5 text-[10px] font-bold font-mono rounded-md bg-sapphire-500/20 text-sapphire-300 border border-sapphire-500/30">
                  v2.0 PRO
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-medium truncate">Smart Energy Automation</p>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="flex-1 space-y-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = isItemActive(item.path);
              return (
                <Link
                  key={item.path}
                  href={item.path}
                  className={`flex items-center gap-3 px-4 py-3 rounded-2xl transition-all duration-200 group ${
                    isActive
                      ? 'bg-sapphire-500/15 border border-sapphire-500/30 text-sapphire-300 font-bold shadow-[0_0_20px_rgba(59,130,246,0.15)]'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-850/60 border border-transparent font-medium'
                  }`}
                >
                  <Icon
                    className={`h-5 w-5 transition-transform duration-200 group-hover:scale-110 ${
                      isActive ? 'text-sapphire-400' : 'text-slate-400 group-hover:text-slate-200'
                    }`}
                  />
                  <span className="text-sm">{item.name}</span>
                </Link>
              );
            })}
          </nav>

          {/* Kad Pantas Sistem */}
          <div className="p-4 rounded-2xl bg-sapphire-500/5 border border-sapphire-500/20 text-xs mb-4">
            <div className="flex items-center gap-2 text-sapphire-400 font-bold mb-1">
              <Zap className="w-4 h-4" />
              <span>Smart Edge Control</span>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              ESP32 &amp; Supabase Realtime Automation Aktif.
            </p>
          </div>

          {/* Footer sidebar */}
          <div className="pt-4 border-t border-slate-800/60 text-xs text-slate-500 flex justify-between items-center">
            <span className="font-medium tracking-wide">POLISAS SEMAMBU</span>
            <span className="flex items-center gap-1.5 text-[10px] font-mono font-bold text-emerald-400">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              ONLINE
            </span>
          </div>
        </aside>

        {/* Header & Main Content */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Top Header Bar */}
          <header className="h-16 border-b border-slate-800/60 glass-panel sticky top-0 z-40 px-4 md:px-8 flex items-center justify-between transition-colors duration-300">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="md:hidden p-2 text-slate-400 hover:text-slate-200 rounded-xl hover:bg-slate-850 transition"
                aria-label="Buka Menu Navigasi"
              >
                {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
              </button>

              {/* Current Page Title - Desktop */}
              <h2 className="font-bold text-lg hidden md:block text-slate-100">
                {getCurrentTitle()}
              </h2>

              {/* Mobile Title Frame */}
              <div className="flex items-center gap-2 md:hidden">
                <h2 className="font-extrabold text-lg bg-gradient-to-r from-sapphire-400 via-sky-300 to-teal-300 bg-clip-text text-transparent">
                  SCEAS
                </h2>
                <span className="text-slate-600 text-xs">•</span>
                <span className="text-xs font-semibold text-slate-300">{getCurrentTitle()}</span>
              </div>
            </div>

            <div className="flex items-center gap-3 sm:gap-4">
              {/* JetBrains Mono Digital Clock */}
              <div className="hidden sm:flex items-center gap-2 bg-slate-950/60 px-3.5 py-1.5 rounded-xl border border-slate-800 text-xs font-mono text-slate-300 shadow-sm">
                <Clock className="h-3.5 w-3.5 text-sapphire-400" />
                <span>{time || '--:--:--'}</span>
              </div>

              {/* Supabase Connection Status Badge */}
              <div
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors ${
                  isOnline
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                    : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                }`}
              >
                <span
                  className={`h-2 w-2 rounded-full ${
                    isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'
                  }`}
                />
                <span className="hidden sm:inline font-mono">{isOnline ? 'ONLINE' : 'OFFLINE'}</span>
              </div>

              {/* Apple-style Theme Toggle Button */}
              <button
                onClick={toggleTheme}
                className="p-2 rounded-xl bg-slate-950/60 border border-slate-800 text-slate-300 hover:text-white transition shadow-sm hover:scale-105 active:scale-95"
                title={theme === 'dark' ? 'Tukar ke Tema Cerah' : 'Tukar ke Tema Gelap'}
                aria-label="Tukar Tema Paparan"
              >
                {theme === 'dark' ? (
                  <Sun className="h-4 w-4 text-amber-400 transition-transform hover:rotate-45" />
                ) : (
                  <Moon className="h-4 w-4 text-sapphire-400 transition-transform hover:-rotate-12" />
                )}
              </button>

              {/* Notification Bell */}
              <NotificationBell />
            </div>
          </header>

          {/* Mobile Drawer */}
          {mobileMenuOpen && (
            <div className="md:hidden glass-panel border-b border-slate-800 p-4 space-y-2 animate-fade-in">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = isItemActive(item.path);
                return (
                  <Link
                    key={item.path}
                    href={item.path}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center gap-3 px-4 py-3 rounded-2xl transition-all duration-200 ${
                      isActive
                        ? 'bg-sapphire-500/15 text-sapphire-300 font-bold border border-sapphire-500/30 shadow-[0_0_20px_rgba(59,130,246,0.15)]'
                        : 'text-slate-400 hover:bg-slate-850/60 font-medium'
                    }`}
                  >
                    <Icon className={`h-5 w-5 ${isActive ? 'text-sapphire-400' : 'text-slate-400'}`} />
                    <span className="text-sm font-semibold">{item.name}</span>
                  </Link>
                );
              })}
            </div>
          )}

          {/* Main Body */}
          <main className="flex-1 p-4 md:p-8 overflow-y-auto">
            {children}
          </main>
        </div>
      </div>
    </ConnectivityContext.Provider>
  );
}
