import React, { useState } from 'react';
import { supabase } from '@/utils/supabase/client';
import {
  Cpu,
  Power,
  PowerOff,
  ShieldCheck,
  Loader2,
  Sparkles,
  CheckCircle2,
  Zap,
  AlertTriangle,
  Copy,
  CheckCheck,
  Lightbulb,
  Radio
} from 'lucide-react';
import { useConnectivity } from '@/components/layout/DashboardLayout';

export interface Room {
  id: string | number;
  name: string;
  status: 'OCCUPIED' | 'VACANT';
  manual_override: boolean;
  nominal_power: number;
  category?: string;
  icon?: string;
  wiring_type?: string;
  last_heartbeat?: string;
  latitude?: number;
  longitude?: number;
  updated_at: string;
}

interface OverrideControlProps {
  room: Room | null;
  onRoomUpdated: (updatedRoom: Room) => void;
}

export default function OverrideControl({ room, onRoomUpdated }: OverrideControlProps) {
  const { setOnline } = useConnectivity();
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [lockedMode, setLockedMode] = useState<'AUTO' | 'FORCE_ON' | 'FORCE_OFF' | null>(null);
  const [copiedId, setCopiedId] = useState(false);

  if (!room) {
    return (
      <div className="glass-panel rounded-3xl p-6 flex flex-col justify-center items-center h-full text-center min-h-[260px] border border-slate-800/80 bg-slate-900/60">
        <div className="p-3 rounded-2xl bg-slate-800/80 text-slate-500 mb-3 border border-slate-700/50">
          <Cpu className="h-7 w-7 animate-pulse" />
        </div>
        <p className="text-sm font-bold text-slate-300">Tiada Makmal / Bilik Dipilih</p>
        <p className="text-xs text-slate-400 mt-1 max-w-xs leading-relaxed">
          Pilih mana-mana zon pada pelan lantai, peta, atau senarai bilik untuk mengaktifkan suis kawalan manual.
        </p>
      </div>
    );
  }

  const handleCopyId = () => {
    navigator.clipboard.writeText(room.id.toString());
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  const handleModeChange = async (mode: 'AUTO' | 'FORCE_ON' | 'FORCE_OFF') => {
    setLoading(true);
    setErrorMsg(null);
    setLockedMode(mode);

    let payload: Partial<Room> = {};
    if (mode === 'AUTO') {
      payload = { manual_override: false };
    } else if (mode === 'FORCE_ON') {
      payload = { manual_override: true, status: 'OCCUPIED' };
    } else {
      payload = { manual_override: true, status: 'VACANT' };
    }

    const expectedRoom = { ...room, ...payload } as Room;
    onRoomUpdated(expectedRoom);

    try {
      const { data, error } = await supabase
        .from('rooms')
        .update(payload)
        .eq('id', room.id)
        .select();

      if (error) throw error;

      setOnline(true);
      const modeLabels = {
        AUTO: 'AUTO (Kawalan Sensor Pintar)',
        FORCE_ON: 'FORCE ON (Lampu Dipaksa Nyala)',
        FORCE_OFF: 'FORCE OFF (Lampu Dipaksa Padam)',
      };
      setFeedback(`Mod ${modeLabels[mode]} telah diaktifkan untuk [${room.name}]`);
      setTimeout(() => setFeedback(null), 3500);

      if (data && data.length > 0) {
        onRoomUpdated(data[0] as Room);
      } else {
        onRoomUpdated(expectedRoom);
      }
    } catch (err: any) {
      setOnline(false);
      console.error('Error updating override control:', err);
      setErrorMsg(err.message || 'Gagal menghantar isyarat suis ke pelayan Supabase.');
      onRoomUpdated(room);
    } finally {
      setLockedMode(null);
      setLoading(false);
    }
  };

  const currentMode: 'AUTO' | 'FORCE_ON' | 'FORCE_OFF' = lockedMode || (
    !room.manual_override
      ? 'AUTO'
      : room.status === 'OCCUPIED'
      ? 'FORCE_ON'
      : 'FORCE_OFF'
  );

  const isRelayActive = room.status === 'OCCUPIED';

  return (
    <div className="glass-panel rounded-3xl p-5 sm:p-6 flex flex-col justify-between shadow-2xl border border-slate-800/80 bg-slate-900/75 min-h-[280px] relative overflow-hidden">
      {/* Background Decorative Gradient */}
      <div className="absolute top-0 right-0 w-48 h-48 bg-sapphire-500/5 rounded-full blur-3xl pointer-events-none" />

      <div>
        {/* Header Bar */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-4">
          <div>
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-sapphire-500/10 text-sapphire-400 border border-sapphire-500/20">
                <Radio className="w-4 h-4" />
              </div>
              <h3 className="text-slate-100 font-extrabold text-sm sm:text-base tracking-tight">
                Kawalan Suis Manual (Override Control)
              </h3>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Sasaran Bilik:{' '}
              <span className="text-emerald-400 font-extrabold">{room.name}</span>
              {room.nominal_power ? (
                <span className="text-slate-500 font-mono ml-2">({room.nominal_power}W)</span>
              ) : null}
            </p>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={handleCopyId}
              className="bg-slate-950/70 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 text-[11px] font-bold px-2.5 py-1 rounded-xl flex items-center gap-1 font-mono transition"
              title="Salin UUID Bilik untuk ESP32"
            >
              {copiedId ? (
                <CheckCheck className="h-3.5 w-3.5 text-emerald-400" />
              ) : (
                <Copy className="h-3.5 w-3.5 text-slate-400" />
              )}
              <span>ID: {room.id.toString().slice(0, 8)}...</span>
            </button>
          </div>
        </div>

        {/* Error Alert */}
        {errorMsg && (
          <div className="bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs px-3.5 py-2.5 rounded-2xl mb-3 flex items-center gap-2 animate-fade-in font-medium">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Success Feedback Alert */}
        {feedback && (
          <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs px-3.5 py-2.5 rounded-2xl mb-3 flex items-center gap-2 animate-fade-in font-medium">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="truncate">{feedback}</span>
          </div>
        )}

        {/* 3 Smart Control Mode Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 my-2">
          {/* 1. AUTO MODE */}
          <button
            onClick={() => handleModeChange('AUTO')}
            disabled={loading}
            className={`p-4 rounded-2xl border text-center transition-all duration-200 flex flex-col items-center justify-center relative overflow-hidden group ${
              currentMode === 'AUTO'
                ? 'bg-gradient-to-b from-emerald-500/20 to-emerald-950/40 border-emerald-500 text-emerald-300 shadow-[0_0_25px_rgba(16,185,129,0.25)] ring-1 ring-emerald-500/50'
                : 'bg-slate-950/50 border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-850/60 hover:border-slate-700'
            }`}
          >
            <div className={`p-2.5 rounded-xl mb-2 transition-transform duration-200 group-hover:scale-110 ${
              currentMode === 'AUTO' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-900 text-slate-400'
            }`}>
              <Cpu className="h-5 w-5" />
            </div>
            <span className="text-xs font-black tracking-wider uppercase">AUTO</span>
            <span className="text-[10px] text-slate-400 font-medium mt-0.5">Sensor &amp; Jadual</span>
            <span className="text-[9px] text-emerald-400/80 font-mono mt-1 font-semibold">PIR Pintar</span>
            {currentMode === 'AUTO' && (
              <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            )}
          </button>

          {/* 2. FORCE ON MODE */}
          <button
            onClick={() => handleModeChange('FORCE_ON')}
            disabled={loading}
            className={`p-4 rounded-2xl border text-center transition-all duration-200 flex flex-col items-center justify-center relative overflow-hidden group ${
              currentMode === 'FORCE_ON'
                ? 'bg-gradient-to-b from-rose-500/25 to-rose-950/40 border-rose-500 text-rose-300 shadow-[0_0_25px_rgba(244,63,94,0.3)] ring-1 ring-rose-500/50'
                : 'bg-slate-950/50 border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-850/60 hover:border-slate-700'
            }`}
          >
            <div className={`p-2.5 rounded-xl mb-2 transition-transform duration-200 group-hover:scale-110 ${
              currentMode === 'FORCE_ON' ? 'bg-rose-500/25 text-rose-400' : 'bg-slate-900 text-slate-400'
            }`}>
              <Power className="h-5 w-5" />
            </div>
            <span className="text-xs font-black tracking-wider uppercase">FORCE ON</span>
            <span className="text-[10px] text-slate-400 font-medium mt-0.5">Paksa Hidup</span>
            <span className="text-[9px] text-rose-400/80 font-mono mt-1 font-semibold">Relay Dibuka</span>
            {currentMode === 'FORCE_ON' && (
              <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-rose-400 animate-ping" />
            )}
          </button>

          {/* 3. FORCE OFF MODE */}
          <button
            onClick={() => handleModeChange('FORCE_OFF')}
            disabled={loading}
            className={`p-4 rounded-2xl border text-center transition-all duration-200 flex flex-col items-center justify-center relative overflow-hidden group ${
              currentMode === 'FORCE_OFF'
                ? 'bg-gradient-to-b from-slate-800/80 to-slate-900 border-sky-400 text-sky-200 shadow-[0_0_25px_rgba(56,189,248,0.2)] ring-1 ring-sky-400/50'
                : 'bg-slate-950/50 border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-850/60 hover:border-slate-700'
            }`}
          >
            <div className={`p-2.5 rounded-xl mb-2 transition-transform duration-200 group-hover:scale-110 ${
              currentMode === 'FORCE_OFF' ? 'bg-sky-500/20 text-sky-400' : 'bg-slate-900 text-slate-400'
            }`}>
              <PowerOff className="h-5 w-5" />
            </div>
            <span className="text-xs font-black tracking-wider uppercase">FORCE OFF</span>
            <span className="text-[10px] text-slate-400 font-medium mt-0.5">Paksa Padam</span>
            <span className="text-[9px] text-sky-400/80 font-mono mt-1 font-semibold">Relay Ditutup</span>
            {currentMode === 'FORCE_OFF' && (
              <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-sky-400 animate-ping" />
            )}
          </button>
        </div>
      </div>

      {/* Footer: Live Relay Status & Indicator */}
      <div className="mt-4 pt-4 border-t border-slate-800/80 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 text-xs text-slate-400">
        <div className="flex items-center gap-2">
          <span className="font-medium text-slate-400">Status Suis Relay Fizikal:</span>
          {loading && (
            <span className="flex items-center gap-1 text-emerald-400 font-mono text-[11px]">
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Menghantar arahan...
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center gap-1.5 font-mono font-extrabold text-[11px] uppercase px-3 py-1 rounded-full border shadow-sm ${
            isRelayActive
              ? 'bg-rose-500/20 text-rose-300 border-rose-500/40 shadow-[0_0_15px_rgba(244,63,94,0.2)]'
              : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-[0_0_15px_rgba(16,185,129,0.15)]'
          }`}>
            <span className={`w-2 h-2 rounded-full ${isRelayActive ? 'bg-rose-400 animate-pulse' : 'bg-emerald-400'}`} />
            {isRelayActive ? 'LAMPU MENYALA (BEBAN AKTIF)' : 'LAMPU PADAM (JIMAT TENAGA)'}
          </span>
        </div>
      </div>
    </div>
  );
}
