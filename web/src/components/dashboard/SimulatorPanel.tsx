import React, { useState, useEffect, useRef } from 'react';
import {
  Sparkles,
  Zap,
  Cpu,
  Play,
  Check,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  TrendingDown,
  TrendingUp,
  AlertOctagon,
  Scale,
  Leaf,
  Coins,
  Clock,
  RotateCcw,
  ShieldCheck,
  Flame,
  Activity,
  Layers,
  Info,
  Power,
  PowerOff
} from 'lucide-react';
import { supabase } from '@/utils/supabase/client';

interface Room {
  id: string | number;
  name: string;
  status: 'OCCUPIED' | 'VACANT';
  nominal_power: number;
  category?: string;
  manual_override?: boolean;
}

interface SimulatorPanelProps {
  rooms: Room[];
  selectedRoomId: string | number | null;
  onActionComplete: () => void;
}

type DemoMode = 'SIDE_BY_SIDE' | 'TRADITIONAL_WASTAGE' | 'SCEAS_SAVINGS';

export default function SimulatorPanel({ rooms, selectedRoomId, onActionComplete }: SimulatorPanelProps) {
  const [activeMode, setActiveMode] = useState<DemoMode>('SIDE_BY_SIDE');
  const [targetRoomId, setTargetRoomId] = useState<string | number>(
    selectedRoomId || (rooms.length > 0 ? rooms[0].id : '')
  );

  // Synchronize target room if selectedRoomId prop changes
  useEffect(() => {
    if (selectedRoomId) {
      setTargetRoomId(selectedRoomId);
    } else if (rooms.length > 0) {
      setTargetRoomId(prev => (prev ? prev : rooms[0].id));
    }
  }, [selectedRoomId, rooms]);

  // Live Race Simulation States
  const [isRacing, setIsRacing] = useState(false);
  const [raceSecond, setRaceSecond] = useState(0);
  const [raceCompleted, setRaceCompleted] = useState(false);
  const [liveWastedRm, setLiveWastedRm] = useState(0);
  const [liveSavedRm, setLiveSavedRm] = useState(0);
  const [liveWastedKwh, setLiveWastedKwh] = useState(0);
  const [liveSavedKwh, setLiveSavedKwh] = useState(0);

  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const activeTargetId = targetRoomId || (selectedRoomId || (rooms.length > 0 ? rooms[0].id : ''));
  const currentRoom = rooms.find(r => r.id.toString() === activeTargetId?.toString());
  const nominalPower = currentRoom?.nominal_power || 1200;
  const raceIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (raceIntervalRef.current) clearInterval(raceIntervalRef.current);
    };
  }, []);

  // Web Audio Synthesizer for FYP Live Evaluation Chimes
  const playChime = (type: 'start' | 'tick' | 'success' | 'alert' | 'clear') => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();

      if (type === 'start') {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(440, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.25);
        gain.gain.setValueAtTime(0.15, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.3);
      } else if (type === 'tick') {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(600, ctx.currentTime);
        gain.gain.setValueAtTime(0.05, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.08);
      } else if (type === 'success') {
        const notes = [523.25, 659.25, 783.99, 1046.5];
        notes.forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.09);
          gain.gain.setValueAtTime(0.12, ctx.currentTime + idx * 0.09);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + idx * 0.09 + 0.3);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(ctx.currentTime + idx * 0.09);
          osc.stop(ctx.currentTime + idx * 0.09 + 0.3);
        });
      } else if (type === 'alert') {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(320, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(140, ctx.currentTime + 0.3);
        gain.gain.setValueAtTime(0.18, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.35);
      } else if (type === 'clear') {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(350, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(200, ctx.currentTime + 0.25);
        gain.gain.setValueAtTime(0.1, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.3);
      }
    } catch (e) {
      // Audio context might be restricted before user gesture
    }
  };

  const showToast = (msg: string, isError = false) => {
    if (isError) {
      setErrorMsg(msg);
      setTimeout(() => setErrorMsg(null), 5000);
    } else {
      setFeedback(msg);
      setTimeout(() => setFeedback(null), 4500);
    }
  };

  // =========================================================================
  // DEMO 1: Bilik Tradisional / Tanpa Wiring (Bukti Pembaziran Elektrik 1.5 Jam)
  // =========================================================================
  const runTraditionalWastageDemo = async () => {
    if (!activeTargetId) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      const nominal = nominalPower;
      const hoursWasted = 1.5;
      const kwhWasted = (nominal / 1000) * hoursWasted;
      const rmWasted = kwhWasted * 0.571;
      const co2Wasted = kwhWasted * 0.585;

      await supabase
        .from('rooms')
        .update({ status: 'OCCUPIED', manual_override: true })
        .eq('id', activeTargetId);

      await supabase.from('savings_log').insert([
        {
          room_id: activeTargetId,
          start_time: new Date(Date.now() - hoursWasted * 3600 * 1000).toISOString(),
          end_time: new Date().toISOString(),
          kwh_saved: kwhWasted,
          rm_saved: rmWasted,
          co2_saved: co2Wasted,
          log_type: 'WASTAGE',
          is_simulation: true,
        },
      ]);

      await supabase.from('notifications').insert([
        {
          user_id: 'admin',
          title: `🔴 PEMBAZIRAN TENAGA: ${currentRoom?.name || 'Makmal'}`,
          message: `Penderia mengesan bilik kosong selama ${hoursWasted} jam tetapi suis terbiar menyala! Pembaziran sebanyak ${kwhWasted.toFixed(3)} kWh (RM ${rmWasted.toFixed(2)}) direkodkan.`,
          type: 'OVERRIDE',
          module: 'ENERGY',
          link: `/logs`,
        },
      ]);

      playChime('alert');
      showToast(`🔴 Bukti Pembaziran: Bilik kosong tetapi suis terbiar ➔ ${kwhWasted.toFixed(3)} kWh (RM ${rmWasted.toFixed(2)}) direkodkan sebagai pembaziran.`);
      onActionComplete();
    } catch (err: any) {
      showToast(`❌ Ralat: ${err.message}`, true);
    } finally {
      setLoading(false);
    }
  };

  // =========================================================================
  // DEMO 2: Bilik Pintar SCEAS (Bukti Penjimatan Tenaga & Auto-Off 1.5 Jam)
  // =========================================================================
  const runSceasSavingsDemo = async () => {
    if (!activeTargetId) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      const nominal = nominalPower;
      const hoursSaved = 1.5;
      const kwhSaved = (nominal / 1000) * hoursSaved;
      const rmSaved = kwhSaved * 0.571;
      const co2Saved = kwhSaved * 0.585;

      await supabase
        .from('rooms')
        .update({ status: 'VACANT', manual_override: false })
        .eq('id', activeTargetId);

      await supabase.from('savings_log').insert([
        {
          room_id: activeTargetId,
          start_time: new Date(Date.now() - hoursSaved * 3600 * 1000).toISOString(),
          end_time: new Date().toISOString(),
          kwh_saved: kwhSaved,
          rm_saved: rmSaved,
          co2_saved: co2Saved,
          log_type: 'SAVINGS',
          is_simulation: true,
        },
      ]);

      await supabase.from('notifications').insert([
        {
          user_id: 'admin',
          title: `🟢 PENJIMATAN TENAGA (SCEAS): ${currentRoom?.name || 'Makmal'}`,
          message: `SCEAS Auto-Off memotong bekalan elektrik semasa bilik kosong! Sebanyak ${kwhSaved.toFixed(3)} kWh (RM ${rmSaved.toFixed(2)}) dan ${co2Saved.toFixed(3)} kg CO₂ berjaya diselamatkan.`,
          type: 'SAVINGS',
          module: 'ENERGY',
          link: `/logs`,
        },
      ]);

      playChime('success');
      showToast(`🟢 Bukti Penjimatan: Tiada orang ➔ SCEAS Auto-Off memotong suis ➔ ${kwhSaved.toFixed(3)} kWh (RM ${rmSaved.toFixed(2)}) BERJAYA DIJIMATKAN!`);
      onActionComplete();
    } catch (err: any) {
      showToast(`❌ Ralat: ${err.message}`, true);
    } finally {
      setLoading(false);
    }
  };

  // =========================================================================
  // DEMO 3: Perlumbaan Perbandingan Sisi-ke-Sisi (Side-by-Side Live Race 10s)
  // =========================================================================
  const startSideBySideRace = () => {
    if (isRacing) return;
    if (raceIntervalRef.current) clearInterval(raceIntervalRef.current);

    setIsRacing(true);
    setRaceCompleted(false);
    setRaceSecond(0);
    setLiveWastedRm(0);
    setLiveSavedRm(0);
    setLiveWastedKwh(0);
    setLiveSavedKwh(0);

    playChime('start');

    let sec = 0;
    const nominal = nominalPower;
    // 10 seconds live race simulates 1 full hour of room vacancy load
    // Each 1 second = 360 seconds (6 minutes) of equipment runtime
    const kwhPerSec = (nominal / 1000) / 10; // total 10s = (nominal/1000) kWh for 1 hour

    raceIntervalRef.current = setInterval(async () => {
      sec += 1;
      setRaceSecond(sec);
      playChime('tick');

      const currentKwh = sec * kwhPerSec;
      const currentRm = currentKwh * 0.571;

      setLiveWastedKwh(currentKwh);
      setLiveWastedRm(currentRm);
      setLiveSavedKwh(currentKwh);
      setLiveSavedRm(currentRm);

      if (sec >= 10) {
        if (raceIntervalRef.current) clearInterval(raceIntervalRef.current);
        setIsRacing(false);
        setRaceCompleted(true);
        playChime('success');

        try {
          await supabase.from('savings_log').insert([
            {
              room_id: activeTargetId,
              start_time: new Date(Date.now() - 3600000).toISOString(),
              end_time: new Date().toISOString(),
              kwh_saved: currentKwh,
              rm_saved: currentRm,
              co2_saved: currentKwh * 0.585,
              log_type: 'WASTAGE',
              is_simulation: true,
            },
            {
              room_id: activeTargetId,
              start_time: new Date(Date.now() - 3600000).toISOString(),
              end_time: new Date().toISOString(),
              kwh_saved: currentKwh,
              rm_saved: currentRm,
              co2_saved: currentKwh * 0.585,
              log_type: 'SAVINGS',
              is_simulation: true,
            },
          ]);

          onActionComplete();
          showToast(`🏆 Ujian 10s Selesai: SCEAS berjaya menyelamatkan RM ${currentRm.toFixed(2)} (${currentKwh.toFixed(3)} kWh) yang sepatutnya dibazirkan oleh bilik tradisional!`);
        } catch (e) {
          // Log insertion error handled gracefully
        }
      }
    }, 1000);
  };

  const handleClearSimulationData = async () => {
    if (!confirm('Adakah anda pasti mahu memadam semua rekod data ujian simulasi? (Data bacaan perkakasan fizikal sebenar tidak akan dipadamkan).')) return;
    setLoading(true);
    try {
      const { error } = await supabase.rpc('fn_clear_simulation_data');
      if (error) throw error;
      setLiveWastedRm(0);
      setLiveSavedRm(0);
      setLiveWastedKwh(0);
      setLiveSavedKwh(0);
      setRaceSecond(0);
      setRaceCompleted(false);
      playChime('clear');
      showToast('🧹 Semua data simulasi dan log bacaan ujian berjaya dibersihkan!');
      onActionComplete();
    } catch (err: any) {
      showToast(`❌ Ralat membersihkan data: ${err.message}`, true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="glass-panel rounded-3xl p-6 border border-slate-800/80 shadow-2xl space-y-6 relative overflow-hidden">
      {/* Background Accent Ambient Glow */}
      <div className="absolute top-0 right-1/4 w-96 h-32 bg-sapphire-500/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-1/4 w-96 h-32 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />

      {/* Top Header & Proof Engine Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-800/80 pb-5 relative z-10">
        <div className="flex items-start sm:items-center gap-3.5">
          <div className="p-3 rounded-2xl bg-gradient-to-br from-sapphire-500/20 to-teal-500/20 text-sapphire-400 border border-sapphire-500/30 shrink-0 shadow-[0_0_20px_rgba(59,130,246,0.15)]">
            <Scale className="w-6 h-6 text-sapphire-400" />
          </div>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h3 className="text-base sm:text-lg font-black text-slate-100 tracking-tight">
                Enjin Demonstrasi: Penjimatan Pintar vs Pembaziran Tradisional
              </h3>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-extrabold bg-gradient-to-r from-sapphire-500/20 to-teal-500/20 text-sapphire-300 border border-sapphire-500/40 uppercase tracking-wider shadow-sm">
                FYP PROOF ENGINE • POLISAS
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Membuktikan secara langsung perbezaan kos, penggunaan tenaga, dan jejak karbon antara bilik siap automasi SCEAS dan bilik manual tanpa automasi.
            </p>
          </div>
        </div>

        {/* Room Selector & Purge Button Action */}
        <div className="flex items-center gap-2.5 flex-wrap self-start lg:self-center">
          <div className="flex items-center gap-2 bg-slate-950/80 p-1.5 rounded-2xl border border-slate-800">
            <span className="text-[10px] font-mono font-bold text-slate-400 pl-2 uppercase">Bilik Sasaran:</span>
            <select
              value={activeTargetId.toString()}
              onChange={(e) => setTargetRoomId(e.target.value)}
              disabled={isRacing || loading}
              className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700/80 text-xs font-mono font-bold text-emerald-300 focus:outline-none focus:border-sapphire-500 transition disabled:opacity-50"
            >
              {rooms.map(r => (
                <option key={r.id} value={r.id}>
                  {r.name} ({r.nominal_power}W)
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={handleClearSimulationData}
            disabled={loading || isRacing}
            className="px-3.5 py-2 rounded-xl bg-slate-950/80 hover:bg-rose-500/20 border border-slate-800 hover:border-rose-500/40 text-slate-400 hover:text-rose-300 text-xs font-bold transition flex items-center gap-1.5 disabled:opacity-50"
            title="Padam Semua Rekod Ujian Simulasi (Clear Simulation Data)"
          >
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">Padam Data Ujian</span>
          </button>
        </div>
      </div>

      {/* Selected Room Parameter Quick Pill */}
      {currentRoom && (
        <div className="px-4 py-2.5 rounded-2xl bg-slate-950/60 border border-slate-800/80 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 font-mono">
            <span className="text-slate-400">Bilik Dipilih:</span>
            <span className="text-slate-100 font-bold">{currentRoom.name}</span>
            <span className="text-slate-500">•</span>
            <span className="text-slate-400">Beban Nominal:</span>
            <span className="text-emerald-400 font-bold">{nominalPower} Watt</span>
            <span className="text-slate-500">•</span>
            <span className="text-slate-400">Kadar Tarif TNB:</span>
            <span className="text-sapphire-400 font-bold">RM 0.571 / kWh</span>
          </div>

          <div className="flex items-center gap-2 text-[11px] font-mono text-slate-400">
            <span className="flex items-center gap-1">
              <Leaf className="w-3 h-3 text-teal-400 inline" />
              Faktor CO₂: <strong className="text-teal-300">0.585 kg/kWh</strong>
            </span>
          </div>
        </div>
      )}

      {/* Mode Selector (Segmented Controls) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 p-1.5 rounded-2xl bg-slate-950/80 border border-slate-800/90 text-xs font-bold font-mono">
        <button
          onClick={() => setActiveMode('SIDE_BY_SIDE')}
          className={`py-3 px-4 rounded-xl transition flex items-center justify-center gap-2.5 ${
            activeMode === 'SIDE_BY_SIDE'
              ? 'bg-sapphire-500 text-slate-950 font-black shadow-glow-sapphire'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
          }`}
        >
          <Scale className="w-4 h-4" />
          <span>⚖️ Perbandingan Sisi-ke-Sisi (Live Race 10s)</span>
        </button>

        <button
          onClick={() => setActiveMode('TRADITIONAL_WASTAGE')}
          className={`py-3 px-4 rounded-xl transition flex items-center justify-center gap-2.5 ${
            activeMode === 'TRADITIONAL_WASTAGE'
              ? 'bg-rose-500 text-white font-black shadow-glow-rose'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
          }`}
        >
          <TrendingDown className="w-4 h-4" />
          <span>🔴 Bukti Pembaziran Tradisional</span>
        </button>

        <button
          onClick={() => setActiveMode('SCEAS_SAVINGS')}
          className={`py-3 px-4 rounded-xl transition flex items-center justify-center gap-2.5 ${
            activeMode === 'SCEAS_SAVINGS'
              ? 'bg-emerald-500 text-slate-950 font-black shadow-glow-emerald'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
          }`}
        >
          <TrendingUp className="w-4 h-4" />
          <span>🟢 Bukti Penjimatan SCEAS</span>
        </button>
      </div>

      {/* Toast Feedback Messages */}
      {feedback && (
        <div className="p-4 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-bold animate-fade-in flex items-center gap-3 shadow-lg">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <span className="flex-1">{feedback}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-4 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs font-bold animate-fade-in flex items-center gap-3 shadow-lg">
          <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
          <span className="flex-1">{errorMsg}</span>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODE 1: SIDE-BY-SIDE LIVE RACE (PERLUMBAAN PEMBUKTIAN 10 SAAT)            */}
      {/* ========================================================================= */}
      {activeMode === 'SIDE_BY_SIDE' && (
        <div className="space-y-6 animate-fade-in">
          {/* Dual Comparison Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Left Card: Traditional Room (Wastage) */}
            <div className={`p-6 rounded-3xl bg-rose-950/20 border transition-all duration-300 space-y-4 relative overflow-hidden ${
              isRacing
                ? 'border-rose-500/70 shadow-glow-rose ring-1 ring-rose-500/30'
                : 'border-rose-500/30 hover:border-rose-500/50'
            }`}>
              <div className="absolute top-0 right-0 w-32 h-32 bg-rose-500/5 rounded-full blur-2xl pointer-events-none" />

              <div className="flex items-center justify-between gap-2 flex-wrap relative z-10">
                <span className="text-[10px] font-extrabold uppercase font-mono text-rose-400 bg-rose-500/20 px-3 py-1 rounded-full border border-rose-500/30 flex items-center gap-1.5">
                  <Power className="w-3 h-3 text-rose-400" />
                  Bilik Tradisional (Tanpa SCEAS)
                </span>
                <span className="text-[11px] text-rose-300 font-mono font-bold bg-rose-950/80 px-2.5 py-0.5 rounded-lg border border-rose-500/30">
                  Lampu &amp; Suis Terbiar ON
                </span>
              </div>

              <div className="relative z-10">
                <h5 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                  <AlertOctagon className="w-4 h-4 text-rose-400 shrink-0" />
                  Situasi: Bilik Kosong (Ketiadaan Orang)
                </h5>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  Penderia mengesan <strong className="text-rose-400">TIADA PENGHUNI</strong>, namun suis manual dibiarkan menyala kerana tiada automasi. Arus elektrik terus mengalir tanpa henti.
                </p>
              </div>

              {/* Live Metric Counters */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 relative z-10">
                <div className="p-4 rounded-2xl bg-slate-950/90 border border-rose-500/30 space-y-1">
                  <span className="text-[10px] uppercase font-mono text-slate-400 font-bold block">Wang Terbazir</span>
                  <div className="text-2xl lg:text-3xl font-black font-mono text-rose-400 tracking-tight">
                    RM {liveWastedRm.toFixed(2)}
                  </div>
                  <span className="text-[10px] text-rose-400/80 font-mono block">Tarif RM0.571/kWh</span>
                </div>

                <div className="p-4 rounded-2xl bg-slate-950/90 border border-rose-500/30 space-y-1">
                  <span className="text-[10px] uppercase font-mono text-slate-400 font-bold block">Tenaga Terbazir</span>
                  <div className="text-xl lg:text-2xl font-black font-mono text-rose-300 tracking-tight">
                    {liveWastedKwh.toFixed(3)} <span className="text-xs font-sans text-slate-400 font-normal">kWh</span>
                  </div>
                  <span className="text-[10px] text-slate-500 font-mono block">Beban {nominalPower}W</span>
                </div>

                <div className="p-4 rounded-2xl bg-slate-950/90 border border-rose-500/30 space-y-1">
                  <span className="text-[10px] uppercase font-mono text-slate-400 font-bold block">Karbon Terbebas</span>
                  <div className="text-xl lg:text-2xl font-black font-mono text-rose-300 tracking-tight">
                    {(liveWastedKwh * 0.585).toFixed(3)} <span className="text-xs font-sans text-slate-400 font-normal">kg</span>
                  </div>
                  <span className="text-[10px] text-slate-500 font-mono block">CO₂ Pelepasan</span>
                </div>
              </div>

              {/* Hardware Relay Emulation */}
              <div className="p-3 rounded-xl bg-slate-950/50 border border-rose-500/20 text-xs font-mono flex items-center justify-between text-slate-400">
                <span className="flex items-center gap-1.5 text-rose-400 font-bold">
                  <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                  Status Suis: SENTIASA ON
                </span>
                <span className="text-slate-300">Beban Semasa: {isRacing ? `${nominalPower}W` : '100%'}</span>
              </div>
            </div>

            {/* Right Card: Smart Room with SCEAS (Savings) */}
            <div className={`p-6 rounded-3xl bg-emerald-950/20 border transition-all duration-300 space-y-4 relative overflow-hidden ${
              isRacing
                ? 'border-emerald-500/70 shadow-glow-emerald ring-1 ring-emerald-500/30'
                : 'border-emerald-500/30 hover:border-emerald-500/50'
            }`}>
              <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-2xl pointer-events-none" />

              <div className="flex items-center justify-between gap-2 flex-wrap relative z-10">
                <span className="text-[10px] font-extrabold uppercase font-mono text-emerald-400 bg-emerald-500/20 px-3 py-1 rounded-full border border-emerald-500/30 flex items-center gap-1.5">
                  <ShieldCheck className="w-3 h-3 text-emerald-400" />
                  Bilik Pintar SCEAS (Siap Wiring)
                </span>
                <span className="text-[11px] text-emerald-300 font-mono font-bold bg-emerald-950/80 px-2.5 py-0.5 rounded-lg border border-emerald-500/30">
                  Auto-Off Relay Berfungsi
                </span>
              </div>

              <div className="relative z-10">
                <h5 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-emerald-400 shrink-0" />
                  Situasi: Bilik Kosong (Automasi SCEAS)
                </h5>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  Penderia PIR &amp; ultrasonik mengesan <strong className="text-emerald-400">TIADA PENGHUNI</strong> ➔ Geganti kuasa SCEAS memotong bekalan elektrik secara automatik!
                </p>
              </div>

              {/* Live Metric Counters */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 relative z-10">
                <div className="p-4 rounded-2xl bg-slate-950/90 border border-emerald-500/30 space-y-1">
                  <span className="text-[10px] uppercase font-mono text-slate-400 font-bold block">Wang Diselamatkan</span>
                  <div className="text-2xl lg:text-3xl font-black font-mono text-emerald-400 tracking-tight">
                    RM {liveSavedRm.toFixed(2)}
                  </div>
                  <span className="text-[10px] text-emerald-400/80 font-mono block">Jimat Bil Tenaga</span>
                </div>

                <div className="p-4 rounded-2xl bg-slate-950/90 border border-emerald-500/30 space-y-1">
                  <span className="text-[10px] uppercase font-mono text-slate-400 font-bold block">Tenaga Dijimatkan</span>
                  <div className="text-xl lg:text-2xl font-black font-mono text-emerald-300 tracking-tight">
                    {liveSavedKwh.toFixed(3)} <span className="text-xs font-sans text-slate-400 font-normal">kWh</span>
                  </div>
                  <span className="text-[10px] text-slate-500 font-mono block">Sifar Pembaziran</span>
                </div>

                <div className="p-4 rounded-2xl bg-slate-950/90 border border-emerald-500/30 space-y-1">
                  <span className="text-[10px] uppercase font-mono text-slate-400 font-bold block">Karbon Dielakkan</span>
                  <div className="text-xl lg:text-2xl font-black font-mono text-emerald-300 tracking-tight">
                    {(liveSavedKwh * 0.585).toFixed(3)} <span className="text-xs font-sans text-slate-400 font-normal">kg</span>
                  </div>
                  <span className="text-[10px] text-teal-400/80 font-mono block">Jejak Hijau</span>
                </div>
              </div>

              {/* Hardware Relay Emulation */}
              <div className="p-3 rounded-xl bg-slate-950/50 border border-emerald-500/20 text-xs font-mono flex items-center justify-between text-slate-400">
                <span className="flex items-center gap-1.5 text-emerald-400 font-bold">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  Status Suis: AUTO CUT-OFF
                </span>
                <span className="text-emerald-300 font-bold">Beban Semasa: 0 Watt</span>
              </div>
            </div>
          </div>

          {/* Action Row & 10-Second Live Progress Bar */}
          <div className="p-5 rounded-3xl bg-slate-950/70 border border-slate-800 shadow-xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h5 className="text-sm font-extrabold uppercase tracking-wider text-slate-200 flex items-center gap-2">
                  <Play className="w-4 h-4 text-sapphire-400" />
                  Ujian Perlumbaan Demonstrasi Sisi-ke-Sisi (10 Saat)
                </h5>
                <p className="text-xs text-slate-400 mt-1">
                  Tekan butang untuk menyaksikan kaunter wang &amp; tenaga bergerak secara langsung selama 10 saat (mempercepatkan simulasi 1 jam penggunaan beban penuh makmal).
                </p>
              </div>

              <button
                onClick={startSideBySideRace}
                disabled={isRacing || loading}
                className={`px-6 py-3.5 rounded-2xl font-black text-xs transition-all duration-200 flex items-center justify-center gap-2.5 shrink-0 shadow-lg ${
                  isRacing
                    ? 'bg-sapphire-600 text-white animate-pulse cursor-not-allowed'
                    : 'bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 hover:scale-[1.02] active:scale-[0.98] shadow-glow-emerald'
                } disabled:opacity-50`}
              >
                {isRacing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                    <span>Perlumbaan Berjalan ({raceSecond}s / 10s)...</span>
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 fill-current" />
                    <span>▶️ Mulakan Ujian Perlumbaan 10s</span>
                  </>
                )}
              </button>
            </div>

            {/* Live Progress Bar */}
            <div className="space-y-2">
              <div className="flex justify-between items-center text-xs font-mono">
                <span className="text-slate-400 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-sapphire-400" />
                  Masa Kemajuan: <strong className="text-slate-200">{raceSecond} / 10 Saat</strong>
                </span>
                <span className="text-sapphire-300 font-bold">
                  {((raceSecond / 10) * 100).toFixed(0)}% Selesai
                </span>
              </div>

              <div className="w-full bg-slate-900 rounded-full h-3 overflow-hidden border border-slate-800 p-0.5">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    isRacing
                      ? 'bg-gradient-to-r from-sapphire-500 via-teal-400 to-emerald-400 animate-pulse'
                      : raceCompleted
                      ? 'bg-emerald-500'
                      : 'bg-slate-700'
                  }`}
                  style={{ width: `${(raceSecond / 10) * 100}%` }}
                />
              </div>

              {/* Progress Milestones */}
              <div className="flex justify-between items-center text-[10px] font-mono text-slate-500 pt-1">
                <span>0s (Mula)</span>
                <span>2.5s (15 Minit)</span>
                <span>5.0s (30 Minit)</span>
                <span>7.5s (45 Minit)</span>
                <span>10s (1 Jam Selesai)</span>
              </div>
            </div>

            {/* Race Completed Result Callout */}
            {raceCompleted && (
              <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-950/40 via-teal-950/30 to-transparent border border-emerald-500/40 text-xs font-mono space-y-1.5 animate-fade-in">
                <div className="flex items-center gap-2 text-emerald-400 font-extrabold">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>KEPUTUSAN UJIAN SELESAI: SCEAS MENANG PENJIMATAN PENUH</span>
                </div>
                <p className="text-slate-300 font-sans leading-relaxed">
                  Dalam tempoh simulasi 1 jam beban {nominalPower} Watt, Bilik Pintar SCEAS berjaya menyelamatkan <strong className="text-emerald-300">RM {liveSavedRm.toFixed(2)}</strong> dan <strong className="text-emerald-300">{liveSavedKwh.toFixed(3)} kWh</strong> tenaga serta mengurangkan <strong className="text-teal-300">{(liveSavedKwh * 0.585).toFixed(3)} kg CO₂</strong> berbanding bilik manual tanpa automasi.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODE 2: SENARIO PEMBUKTIAN PEMBAZIRAN TRADISIONAL (Ketiadaan Automasi)     */}
      {/* ========================================================================= */}
      {activeMode === 'TRADITIONAL_WASTAGE' && (
        <div className="p-6 rounded-3xl bg-rose-950/15 border border-rose-500/30 space-y-5 animate-fade-in relative overflow-hidden">
          <div className="absolute -top-10 -right-10 w-40 h-40 bg-rose-500/5 rounded-full blur-3xl pointer-events-none" />

          <div className="flex items-center gap-3 text-rose-400 border-b border-rose-500/20 pb-4">
            <div className="p-2.5 rounded-2xl bg-rose-500/20 border border-rose-500/30">
              <AlertOctagon className="w-6 h-6" />
            </div>
            <div>
              <h4 className="text-base font-extrabold uppercase tracking-wider font-mono text-rose-200">
                Ujian Senario Tradisional (Ketiadaan Automasi &amp; Suis Terbiar)
              </h4>
              <p className="text-xs text-rose-300/80 mt-0.5">
                Simulasi situasi apabila pensyarah/pelajar beredar dari makmal tetapi terlupa mematikan suis
              </p>
            </div>
          </div>

          <p className="text-xs text-slate-300 leading-relaxed">
            Dalam senario bilik makmal konvensional, penderia pintar tidak dipasang. Selepas kelas berakhir, lampu dan soket terbiar menyala selama berjam-jam. Dengan menekan butang di bawah, sistem akan menyuntik rekod pembaziran 1.5 jam ke dalam pangkalan data Supabase untuk menunjukkan kos tersembunyi yang ditanggung oleh pihak institusi POLISAS.
          </p>

          {/* Simulation Parameter Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono">
            <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-rose-500/20">
              <span className="text-[10px] text-slate-400 block uppercase">Tempoh Terbiar</span>
              <span className="text-base font-bold text-slate-100 mt-1 block">1.5 Jam (90 Min)</span>
            </div>
            <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-rose-500/20">
              <span className="text-[10px] text-slate-400 block uppercase">Beban Bilik</span>
              <span className="text-base font-bold text-slate-100 mt-1 block">{nominalPower} Watt</span>
            </div>
            <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-rose-500/20">
              <span className="text-[10px] text-slate-400 block uppercase">Tenaga Terbazir</span>
              <span className="text-base font-bold text-rose-400 mt-1 block">
                {((nominalPower / 1000) * 1.5).toFixed(3)} kWh
              </span>
            </div>
            <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-rose-500/20">
              <span className="text-[10px] text-slate-400 block uppercase">Kos Pembaziran</span>
              <span className="text-base font-bold text-rose-400 mt-1 block">
                RM {(((nominalPower / 1000) * 1.5) * 0.571).toFixed(2)}
              </span>
            </div>
          </div>

          <button
            onClick={runTraditionalWastageDemo}
            disabled={loading}
            className="w-full sm:w-auto px-6 py-3.5 rounded-2xl bg-gradient-to-r from-rose-600 to-rose-500 hover:from-rose-500 hover:to-rose-400 text-white font-black text-xs transition-all duration-200 shadow-lg shadow-rose-950/50 flex items-center justify-center gap-2.5 disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <TrendingDown className="w-4 h-4" />}
            <span>🔴 Simulasikan Bilik Kosong Lampu Terbiar (Rekod Pembaziran 1.5 Jam)</span>
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODE 3: SENARIO PEMBUKTIAN PENJIMATAN PINTAR SCEAS (Automasi Penuh)        */}
      {/* ========================================================================= */}
      {activeMode === 'SCEAS_SAVINGS' && (
        <div className="p-6 rounded-3xl bg-emerald-950/15 border border-emerald-500/30 space-y-5 animate-fade-in relative overflow-hidden">
          <div className="absolute -top-10 -right-10 w-40 h-40 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />

          <div className="flex items-center gap-3 text-emerald-400 border-b border-emerald-500/20 pb-4">
            <div className="p-2.5 rounded-2xl bg-emerald-500/20 border border-emerald-500/30">
              <Sparkles className="w-6 h-6" />
            </div>
            <div>
              <h4 className="text-base font-extrabold uppercase tracking-wider font-mono text-emerald-200">
                Ujian Senario Pintar SCEAS (Automasi Auto-Off &amp; Penjimatan Tenaga)
              </h4>
              <p className="text-xs text-emerald-300/80 mt-0.5">
                Simulasi pemotongan bekalan elektrik automatik serta-merta apabila bilik dikosongkan
              </p>
            </div>
          </div>

          <p className="text-xs text-slate-300 leading-relaxed">
            Dalam sistem SCEAS, sebaik sahaja penderia PIR dan penderia ultrasonik mengesahkan ketiadaan manusia melepasi ambang masa selamat, mikropengawal ESP32 akan menghantar isyarat untuk memutuskan geganti (relay cut-off). Menekan butang di bawah akan merekodkan log penjimatan 1.5 jam ke pangkalan data Supabase bagi mengemas kini graf audit hijau.
          </p>

          {/* Simulation Parameter Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono">
            <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-emerald-500/20">
              <span className="text-[10px] text-slate-400 block uppercase">Tempoh Auto-Off</span>
              <span className="text-base font-bold text-slate-100 mt-1 block">1.5 Jam (90 Min)</span>
            </div>
            <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-emerald-500/20">
              <span className="text-[10px] text-slate-400 block uppercase">Beban Diselamatkan</span>
              <span className="text-base font-bold text-slate-100 mt-1 block">{nominalPower} Watt</span>
            </div>
            <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-emerald-500/20">
              <span className="text-[10px] text-slate-400 block uppercase">Tenaga Dijimatkan</span>
              <span className="text-base font-bold text-emerald-400 mt-1 block">
                {((nominalPower / 1000) * 1.5).toFixed(3)} kWh
              </span>
            </div>
            <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-emerald-500/20">
              <span className="text-[10px] text-slate-400 block uppercase">Wang Diselamatkan</span>
              <span className="text-base font-bold text-emerald-400 mt-1 block">
                RM {(((nominalPower / 1000) * 1.5) * 0.571).toFixed(2)}
              </span>
            </div>
          </div>

          <button
            onClick={runSceasSavingsDemo}
            disabled={loading}
            className="w-full sm:w-auto px-6 py-3.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 font-black text-xs transition-all duration-200 shadow-lg shadow-emerald-950/50 flex items-center justify-center gap-2.5 disabled:opacity-50 shadow-glow-emerald"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <TrendingUp className="w-4 h-4" />}
            <span>🟢 Simulasikan SCEAS Auto-Off (Rekod Penjimatan 1.5 Jam)</span>
          </button>
        </div>
      )}

      {/* Footer Notes & Energy Formulas */}
      <div className="pt-2 border-t border-slate-800/60 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 text-[11px] text-slate-500 font-mono">
        <div className="flex items-center gap-2">
          <Info className="w-3.5 h-3.5 text-sapphire-400 shrink-0" />
          <span>Formula: Pengiraan Berdasarkan Tarif B Komersial TNB (RM 0.571 / kWh) • Emisi Grid Semenanjung: 0.585 kg CO₂ / kWh</span>
        </div>
        <span className="text-slate-400">SCEAS v2.4 • Smart Campus Energy Audit System</span>
      </div>
    </div>
  );
}
