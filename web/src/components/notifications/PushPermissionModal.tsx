import React, { useState, useEffect } from 'react';
import { Bell, ShieldCheck, Zap, X } from 'lucide-react';
import { usePushNotifications } from '@/hooks/usePushNotifications';

export default function PushPermissionModal() {
  const { isSupported, permission, requestPermission } = usePushNotifications();
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isSupported) return;
    const dismissedUntil = localStorage.getItem('sceas_notif_dismissed');
    const now = Date.now();

    if (permission === 'default' && (!dismissedUntil || now > parseInt(dismissedUntil, 10))) {
      const timer = setTimeout(() => {
        setIsOpen(true);
      }, 1500);
      return () => clearTimeout(timer);
    } else {
      setIsOpen(false);
    }
  }, [isSupported, permission]);

  const handleEnable = async () => {
    setLoading(true);
    const res = await requestPermission();
    setLoading(false);
    if (res === 'granted' || res === 'denied') {
      setIsOpen(false);
    }
  };

  const handleDismiss = () => {
    localStorage.setItem('sceas_notif_dismissed', (Date.now() + 24 * 60 * 60 * 1000).toString());
    setIsOpen(false);
  };

  if (!isOpen || permission !== 'default') return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-md p-6 overflow-hidden rounded-3xl bg-gray-900/90 border border-emerald-500/30 shadow-[0_0_50px_rgba(16,185,129,0.15)] text-gray-100">
        <div className="absolute -top-12 -right-12 w-36 h-36 bg-emerald-500/20 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute -bottom-12 -left-12 w-36 h-36 bg-teal-500/20 rounded-full blur-2xl pointer-events-none" />

        <button
          onClick={handleDismiss}
          className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-200 rounded-full hover:bg-gray-800/60 transition"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="relative p-3 bg-emerald-500/15 border border-emerald-500/30 rounded-2xl text-emerald-400">
            <Bell className="w-6 h-6 animate-bounce" />
            <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-emerald-400 rounded-full shadow-[0_0_8px_#10b981] animate-ping" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-100 tracking-tight">Aktifkan Notifikasi SCEAS</h3>
            <p className="text-xs text-emerald-400 font-medium">Push Alerts & Auto-Savings</p>
          </div>
        </div>

        <p className="text-sm text-gray-300 leading-relaxed mb-5">
          Dapatkan amaran segera apabila lampu makmal/rumah dipadamkan secara automatik, amaran pergerakan dikesan, serta pengiraan penjimatan elektrik (RM & kWh) secara langsung pada skrin anda.
        </p>

        <div className="space-y-2 mb-6 text-xs text-gray-400 bg-gray-950/40 p-3.5 rounded-2xl border border-gray-800/60">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>Notifikasi automatik apabila penjimatan terhasil</span>
          </div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-blue-400 shrink-0" />
            <span>Makluman segera jika mod Manual Override diaktifkan</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleDismiss}
            className="flex-1 px-4 py-2.5 rounded-xl border border-gray-700/60 text-xs font-semibold text-gray-400 hover:text-gray-200 hover:bg-gray-800/40 transition"
          >
            Nanti Sahaja
          </button>
          <button
            onClick={handleEnable}
            disabled={loading}
            className="flex-1 px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-gray-950 text-xs font-bold transition shadow-[0_0_20px_rgba(16,185,129,0.3)] disabled:opacity-50"
          >
            {loading ? 'Mengaktifkan...' : 'Aktifkan Sekarang'}
          </button>
        </div>
      </div>
    </div>
  );
}
