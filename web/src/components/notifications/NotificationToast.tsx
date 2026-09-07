import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Zap, X, ArrowRight, ShieldAlert, Info, Bell } from 'lucide-react';
import { useRouter } from 'next/router';
import { InAppNotification } from './NotificationBell';

interface NotificationToastProps {
  notification: InAppNotification | null;
  onClose: () => void;
  durationMs?: number;
}

export default function NotificationToast({
  notification,
  onClose,
  durationMs = 6000,
}: NotificationToastProps) {
  const router = useRouter();
  const [isVisible, setIsVisible] = useState(false);
  const [progress, setProgress] = useState(100);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!notification) {
      setIsVisible(false);
      return;
    }

    // Trigger animation in
    setIsVisible(true);
    setProgress(100);

    // Trigger mobile haptic vibration (buzz-buzz pattern like WhatsApp)
    try {
      if (typeof window !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate([120, 60, 120]);
      }
    } catch {
      // Ignore vibration restrictions
    }

    // Progress bar countdown
    const startTime = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, 100 - (elapsed / durationMs) * 100);
      setProgress(remaining);
      if (remaining <= 0) {
        clearInterval(interval);
      }
    }, 50);

    // Auto dismiss timer
    const timer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(onClose, 300); // Allow exit animation
    }, durationMs);

    return () => {
      clearTimeout(timer);
      clearInterval(interval);
    };
  }, [notification, durationMs, onClose]);

  if (!notification && !isVisible) return null;

  const handleActionClick = () => {
    setIsVisible(false);
    setTimeout(() => {
      onClose();
      if (notification?.link) {
        router.push(notification.link);
      } else {
        router.push('/logs');
      }
    }, 200);
  };

  const getModuleBadge = (type: string, module: string) => {
    switch (type?.toUpperCase()) {
      case 'SAVINGS':
        return {
          icon: <Zap className="w-3.5 h-3.5" />,
          label: 'PENJIMATAN PINTAR',
          bg: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
          accent: '#10b981',
        };
      case 'OVERRIDE':
        return {
          icon: <ShieldAlert className="w-3.5 h-3.5" />,
          label: 'KAWALAN MANUAL',
          bg: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
          accent: '#f59e0b',
        };
      default:
        return {
          icon: <Info className="w-3.5 h-3.5" />,
          label: module || 'SISTEM',
          bg: 'bg-sky-500/20 text-sky-400 border-sky-500/30',
          accent: '#0ea5e9',
        };
    }
  };

  const badge = notification ? getModuleBadge(notification.type, notification.module) : null;

  if (!mounted || typeof document === 'undefined') return null;
  if (!notification && !isVisible) return null;

  return createPortal(
    <div
      className={`fixed top-3 sm:top-5 left-1/2 -translate-x-1/2 z-[99999] w-[94%] sm:w-[420px] max-w-md transition-all duration-300 ease-out pointer-events-auto ${
        isVisible ? 'translate-y-0 opacity-100 scale-100' : '-translate-y-6 opacity-0 scale-95'
      }`}
      role="alert"
      aria-live="assertive"
    >
      <div
        className="relative overflow-hidden rounded-2xl sm:rounded-3xl bg-slate-900/95 border border-emerald-500/40 shadow-[0_12px_45px_rgba(0,0,0,0.65),0_0_25px_rgba(16,185,129,0.2)] backdrop-blur-2xl p-3.5 sm:p-4 cursor-pointer hover:border-emerald-400/60 transition"
        onClick={handleActionClick}
      >
        {/* Top App Header Row (WhatsApp Style) */}
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-2 min-w-0">
            {/* WhatsApp / SCEAS mini brand badge */}
            <div className="flex items-center justify-center w-5 h-5 rounded-lg bg-emerald-500 text-slate-950 font-black text-[10px] shadow-sm shrink-0">
              <Zap className="w-3 h-3 fill-slate-950" />
            </div>
            <span className="text-[11px] font-extrabold tracking-wider text-emerald-400 uppercase">
              SCEAS
            </span>
            <span className="text-slate-600 text-xs">•</span>
            <span className="text-[10px] font-semibold text-slate-400 truncate">
              {badge?.label}
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span className="text-[10px] text-slate-400 font-mono">sekarang</span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsVisible(false);
                setTimeout(onClose, 250);
              }}
              className="p-1 rounded-full text-slate-400 hover:text-slate-100 hover:bg-slate-800/80 transition"
              aria-label="Tutup"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Main Body */}
        <div className="flex items-start gap-3">
          {/* Avatar Icon */}
          <div className="p-2.5 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 shrink-0 mt-0.5 shadow-inner">
            {badge?.icon || <Bell className="w-4 h-4" />}
          </div>

          {/* Texts */}
          <div className="flex-1 min-w-0 pr-1">
            <h4 className="text-xs sm:text-sm font-bold text-slate-100 tracking-tight leading-snug line-clamp-1">
              {notification?.title}
            </h4>
            <p className="text-[11px] sm:text-xs text-slate-300 mt-0.5 leading-relaxed line-clamp-2">
              {notification?.message}
            </p>
          </div>

          {/* Navigation Chevron */}
          <div className="shrink-0 self-center text-slate-500 hover:text-emerald-400 transition">
            <ArrowRight className="w-4 h-4" />
          </div>
        </div>

        {/* Progress Bar (Time Remaining indicator) */}
        <div className="absolute bottom-0 left-0 right-0 h-[2.5px] bg-slate-800/60 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-300 transition-all duration-75 ease-linear"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </div>,
    document.body
  );
}
