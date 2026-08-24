import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Bell, CheckCheck, Loader2, Zap, ShieldAlert, Info, ArrowRight, Volume2, VolumeX } from 'lucide-react';
import { supabase } from '@/utils/supabase/client';
import Link from 'next/link';

export interface InAppNotification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: string;
  module: string;
  link?: string | null;
  is_read: boolean;
  created_at: string;
}

function playChime() {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15);

    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.35);
  } catch (e) {
    // Ignore audio restrictions
  }
}

export default function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<InAppNotification[]>([]);
  const [markingAll, setMarkingAll] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const prevCountRef = useRef<number>(0);

  const fetchNotifications = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      if (data) {
        const unread = data.filter((n: InAppNotification) => !n.is_read).length;
        if (unread > prevCountRef.current && prevCountRef.current !== 0 && soundEnabled) {
          playChime();
        }
        prevCountRef.current = unread;
        setNotifications(data as InAppNotification[]);
      }
    } catch (err) {
      console.error('Error fetching notifications:', err);
    }
  }, [soundEnabled]);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 4000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const unreadCount = notifications.filter(n => !n.is_read).length;

  const handleMarkAsRead = async (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
    try {
      await supabase.from('notifications').update({ is_read: true }).eq('id', id);
    } catch (err) {
      console.error('Error marking as read:', err);
    }
  };

  const handleMarkAllRead = async () => {
    setMarkingAll(true);
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    try {
      await supabase.from('notifications').update({ is_read: true }).eq('is_read', false);
    } catch (err) {
      console.error('Error marking all as read:', err);
    } finally {
      setMarkingAll(false);
    }
  };

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayNotifs = notifications.filter(n => new Date(n.created_at) >= today);
  const olderNotifs = notifications.filter(n => new Date(n.created_at) < today);

  const getTypeIcon = (type: string) => {
    switch (type.toUpperCase()) {
      case 'SAVINGS':
        return <Zap className="w-3.5 h-3.5 text-emerald-400" />;
      case 'OVERRIDE':
        return <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />;
      default:
        return <Info className="w-3.5 h-3.5 text-blue-400" />;
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2.5 rounded-xl bg-gray-900/60 hover:bg-gray-800/60 border border-gray-800/80 text-gray-300 hover:text-white transition"
        title="Notifikasi Sistem"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4.5 min-w-[18px] items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-extrabold text-white shadow-lg animate-pulse">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-3 w-80 sm:w-96 rounded-2xl bg-gray-900/95 border border-gray-800/80 shadow-2xl backdrop-blur-xl z-50 overflow-hidden text-gray-200 animate-fade-in">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800/60 bg-gray-950/60">
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-emerald-400" />
              <span className="text-xs font-bold uppercase tracking-wider text-gray-200">Notifikasi</span>
              {unreadCount > 0 && (
                <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-rose-500/20 text-rose-400">
                  {unreadCount} baharu
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setSoundEnabled(!soundEnabled)}
                className="p-1 text-gray-400 hover:text-gray-200 rounded transition"
                title={soundEnabled ? 'Matikan Bunyi' : 'Hidupkan Bunyi'}
              >
                {soundEnabled ? <Volume2 className="w-3.5 h-3.5 text-emerald-400" /> : <VolumeX className="w-3.5 h-3.5 text-gray-500" />}
              </button>

              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllRead}
                  disabled={markingAll}
                  className="text-[11px] font-semibold text-gray-400 hover:text-emerald-400 flex items-center gap-1 transition"
                >
                  {markingAll ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCheck className="w-3 h-3" />}
                  <span>Tanda semua</span>
                </button>
              )}
            </div>
          </div>

          {/* Body List */}
          <div className="max-h-80 overflow-y-auto divide-y divide-gray-800/40 text-xs">
            {notifications.length === 0 ? (
              <div className="py-10 text-center text-gray-500">
                <Bell className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p>Tiada notifikasi baharu</p>
              </div>
            ) : (
              <>
                {todayNotifs.length > 0 && (
                  <div>
                    <div className="px-4 py-1.5 bg-gray-950/40 text-[10px] font-bold uppercase tracking-widest text-gray-500">
                      Hari Ini
                    </div>
                    {todayNotifs.map(n => (
                      <div
                        key={n.id}
                        onClick={() => handleMarkAsRead(n.id)}
                        className={`p-3.5 flex items-start gap-3 hover:bg-gray-800/40 cursor-pointer transition ${!n.is_read ? 'bg-emerald-500/5' : ''}`}
                      >
                        <div className="p-2 rounded-xl bg-gray-800/60 shrink-0 mt-0.5">
                          {getTypeIcon(n.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-0.5">
                            <h5 className={`text-xs ${!n.is_read ? 'font-bold text-emerald-300' : 'font-medium text-gray-300'}`}>
                              {n.title}
                            </h5>
                            {!n.is_read && (
                              <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_6px_#10b981]" />
                            )}
                          </div>
                          <p className="text-[11px] text-gray-400 line-clamp-2 leading-relaxed">
                            {n.message}
                          </p>
                          <span className="text-[10px] text-gray-500 mt-1 block font-mono">
                            {new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {olderNotifs.length > 0 && (
                  <div>
                    <div className="px-4 py-1.5 bg-gray-950/40 text-[10px] font-bold uppercase tracking-widest text-gray-500">
                      Sebelumnya
                    </div>
                    {olderNotifs.map(n => (
                      <div
                        key={n.id}
                        onClick={() => handleMarkAsRead(n.id)}
                        className={`p-3.5 flex items-start gap-3 hover:bg-gray-800/40 cursor-pointer transition ${!n.is_read ? 'bg-emerald-500/5' : ''}`}
                      >
                        <div className="p-2 rounded-xl bg-gray-800/60 shrink-0 mt-0.5">
                          {getTypeIcon(n.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-0.5">
                            <h5 className={`text-xs ${!n.is_read ? 'font-bold text-gray-200' : 'font-medium text-gray-400'}`}>
                              {n.title}
                            </h5>
                          </div>
                          <p className="text-[11px] text-gray-400 line-clamp-2 leading-relaxed">
                            {n.message}
                          </p>
                          <span className="text-[10px] text-gray-500 mt-1 block font-mono">
                            {new Date(n.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Footer */}
          <div className="p-2.5 bg-gray-950/60 border-t border-gray-800/60 text-center">
            <Link
              href="/logs"
              onClick={() => setIsOpen(false)}
              className="text-[11px] font-bold text-emerald-400 hover:text-emerald-300 flex items-center justify-center gap-1 transition"
            >
              <span>Lihat Rekod Audit Penuh</span>
              <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
