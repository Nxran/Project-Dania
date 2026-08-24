import React, { useState, useEffect, createContext, useContext } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { LayoutDashboard, History, Settings as SettingsIcon, Clock, Activity, Menu, X } from 'lucide-react';

export const ConnectivityContext = createContext<{
  isOnline: boolean;
  setOnline: (online: boolean) => void;
}>({
  isOnline: true,
  setOnline: () => {},
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

  useEffect(() => {
    setTime(new Date().toLocaleTimeString('en-US', { hour12: false }));
    const timer = setInterval(() => {
      setTime(new Date().toLocaleTimeString('en-US', { hour12: false }));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const navItems = [
    { name: 'Dashboard', path: '/', icon: LayoutDashboard },
    { name: 'Savings Log', path: '/logs', icon: History },
    { name: 'Settings', path: '/settings', icon: SettingsIcon },
  ];

  return (
    <ConnectivityContext.Provider value={{ isOnline, setOnline }}>
      <div className="min-h-screen bg-[#030712] text-gray-100 flex flex-col md:flex-row font-sans">
      {/* Sidebar - Desktop */}
      <aside className="hidden md:flex flex-col w-64 glass-sidebar h-screen overflow-y-auto p-6 sticky top-0">
        <div className="flex items-center gap-3 mb-8">
          <div className="bg-emerald-500/10 p-2 rounded-lg border border-emerald-500/20 text-emerald-400 glow-vacant">
            <Activity className="h-6 w-6" />
          </div>
          <div>
            <h1 className="font-bold text-lg leading-tight tracking-wider bg-gradient-to-r from-emerald-400 to-teal-300 bg-clip-text text-transparent">
              SCEAS
            </h1>
            <p className="text-xs text-gray-400">Smart Campus Energy</p>
          </div>
        </div>

        <nav className="flex-1 space-y-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = router.pathname === item.path;
            return (
              <Link
                key={item.path}
                href={item.path}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group ${
                  isActive
                    ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.1)]'
                    : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/40 border border-transparent'
                }`}
              >
                <Icon className={`h-5 w-5 transition-transform duration-200 group-hover:scale-110 ${isActive ? 'text-emerald-400' : 'text-gray-400 group-hover:text-gray-200'}`} />
                <span className="font-medium text-sm">{item.name}</span>
              </Link>
            );
          })}
        </nav>

        <div className="pt-6 border-t border-gray-800/60 text-xs text-gray-500">
          <p>© 2026 SCEAS Project</p>
          <p className="mt-1">Version 1.0.0 (Beta)</p>
        </div>
      </aside>

      {/* Header & Main Content - Mobile Menu Toggle */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="h-16 border-b border-gray-800/60 glass-panel sticky top-0 z-40 px-4 md:px-8 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 text-gray-400 hover:text-gray-200 rounded-lg hover:bg-gray-850"
            >
              {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
            <h2 className="font-semibold text-lg hidden md:block text-gray-200">
              {navItems.find((item) => item.path === router.pathname)?.name || 'SCEAS Dashboard'}
            </h2>
            {/* Mobile Title */}
            <h2 className="font-bold text-lg md:hidden bg-gradient-to-r from-emerald-400 to-teal-300 bg-clip-text text-transparent">
              SCEAS
            </h2>
          </div>

          <div className="flex items-center gap-6">
            {/* Live Clock */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gray-900/60 border border-gray-800/60 text-gray-300">
              <Clock className="h-4 w-4 text-emerald-400" />
              <span className="font-mono text-sm tracking-widest">{time || '00:00:00'}</span>
            </div>

            {/* System Status */}
            <div className="flex items-center gap-2">
              <div className="relative flex h-2.5 w-2.5">
                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${isOnline ? 'bg-emerald-400' : 'bg-red-400'} opacity-75`}></span>
                <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${isOnline ? 'bg-emerald-500 shadow-[0_0_8px_#10b981]' : 'bg-red-500 shadow-[0_0_8px_#ef4444]'}`}></span>
              </div>
              <span className={`text-xs font-semibold ${isOnline ? 'text-emerald-400' : 'text-red-500'} tracking-wider`}>
                {isOnline ? 'SYSTEM ONLINE' : 'SYSTEM OFFLINE'}
              </span>
            </div>
          </div>
        </header>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div className="md:hidden glass-sidebar absolute top-16 left-0 right-0 z-30 p-4 border-b border-gray-850 animate-fade-in">
            <nav className="space-y-2">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = router.pathname === item.path;
                return (
                  <Link
                    key={item.path}
                    href={item.path}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
                      isActive
                        ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.1)]'
                        : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/40 border border-transparent'
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                    <span className="font-medium text-sm">{item.name}</span>
                  </Link>
                );
              })}
            </nav>
          </div>
        )}

        {/* Page Content */}
        <main className="flex-1 p-4 md:p-8 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
    </ConnectivityContext.Provider>
  );
}
