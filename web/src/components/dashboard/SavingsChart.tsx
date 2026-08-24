import React, { useState, useEffect, useMemo } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import {
  TrendingUp,
  TrendingDown,
  Zap,
  Coins,
  Leaf,
  Scale,
  Sparkles,
  Layers,
  Info,
  ShieldCheck,
  Flame,
  Activity,
} from 'lucide-react';

interface Room {
  id: string | number;
  name: string;
  status?: 'OCCUPIED' | 'VACANT';
  nominal_power?: number;
  [key: string]: any;
}

interface SavingsLog {
  id: string | number;
  room_id: string | number;
  start_time?: string;
  end_time?: string;
  kwh_saved: number | string;
  rm_saved: number | string;
  co2_saved: number | string;
  log_type?: string;
  is_simulation?: boolean;
  created_at: string;
  [key: string]: any;
}

interface SavingsChartProps {
  rooms?: Room[];
  savingsLogs?: SavingsLog[];
}

type MetricType = 'kwh' | 'rm' | 'co2';

export default function SavingsChart({ rooms = [], savingsLogs = [] }: SavingsChartProps) {
  const [mounted, setMounted] = useState(false);
  const [metric, setMetric] = useState<MetricType>('kwh');
  const [selectedRoomFilter, setSelectedRoomFilter] = useState<string>('ALL');

  useEffect(() => {
    setMounted(true);
  }, []);

  // Filter logs by selected room if applicable
  const filteredLogs = useMemo(() => {
    if (!savingsLogs || savingsLogs.length === 0) return [];
    if (selectedRoomFilter === 'ALL') return savingsLogs;
    return savingsLogs.filter(
      (log) => log.room_id?.toString() === selectedRoomFilter.toString()
    );
  }, [savingsLogs, selectedRoomFilter]);

  // Sort logs chronologically (oldest to newest) for cumulative calculation
  const sortedLogs = useMemo(() => {
    return [...filteredLogs].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
  }, [filteredLogs]);

  // Calculate cumulative stats & chart series
  const { chartData, totalCumulativeSaved, totalCumulativeWasted, efficiencyRate } = useMemo(() => {
    let cumSaved = 0;
    let cumWasted = 0;

    const data: Array<{
      time: string;
      fullDate: string;
      rawDate: string;
      'Penjimatan SCEAS': number;
      'Pembaziran Dikesan': number;
      net: number;
    }> = [];

    const totalLogs = sortedLogs.length;

    if (totalLogs > 0) {
      for (let i = 0; i < totalLogs; i++) {
        const log = sortedLogs[i];
        let val = 0;
        if (metric === 'kwh') val = parseFloat(log.kwh_saved?.toString() || '0') || 0;
        else if (metric === 'rm') val = parseFloat(log.rm_saved?.toString() || '0') || 0;
        else val = parseFloat(log.co2_saved?.toString() || '0') || 0;

        if (log.log_type === 'WASTAGE') {
          cumWasted += val;
        } else {
          cumSaved += val;
        }

        const date = new Date(log.created_at);
        const timeFormatted = isNaN(date.getTime())
          ? `L#${i + 1}`
          : date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const dateFormatted = isNaN(date.getTime())
          ? ''
          : date.toLocaleDateString([], { day: '2-digit', month: 'short' });

        data.push({
          time: timeFormatted,
          fullDate: dateFormatted,
          rawDate: log.created_at,
          'Penjimatan SCEAS': parseFloat(cumSaved.toFixed(3)),
          'Pembaziran Dikesan': parseFloat(cumWasted.toFixed(3)),
          net: parseFloat((cumSaved - cumWasted).toFixed(3)),
        });
      }
    }

    const totalCombined = cumSaved + cumWasted;
    const eff = totalCombined > 0 ? (cumSaved / totalCombined) * 100 : 100;

    return {
      chartData: data,
      totalCumulativeSaved: cumSaved,
      totalCumulativeWasted: cumWasted,
      efficiencyRate: parseFloat(eff.toFixed(1)),
    };
  }, [sortedLogs, metric]);

  const getMetricSymbol = () => {
    if (metric === 'kwh') return 'kWh';
    if (metric === 'rm') return 'RM';
    return 'kg CO₂';
  };

  const formatDisplayValue = (val: number) => {
    if (metric === 'rm') {
      return `RM ${val.toLocaleString('ms-MY', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`;
    }
    return `${val.toLocaleString('ms-MY', {
      minimumFractionDigits: 3,
      maximumFractionDigits: 3,
    })} ${getMetricSymbol()}`;
  };

  if (!mounted) {
    return (
      <div className="glass-panel rounded-3xl p-6 h-[460px] flex flex-col items-center justify-center border border-slate-800/80 shadow-2xl">
        <div className="flex items-center gap-3 text-slate-400 font-mono text-sm">
          <Activity className="w-5 h-5 text-emerald-400 animate-spin" />
          <span>Memuatkan modul visualisasi Recharts SCEAS...</span>
        </div>
      </div>
    );
  }

  // Custom Glassmorphic Tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || !payload.length) return null;

    const dataPoint = payload[0]?.payload;
    const savedVal = payload.find((p: any) => p.dataKey === 'Penjimatan SCEAS')?.value ?? 0;
    const wastedVal = payload.find((p: any) => p.dataKey === 'Pembaziran Dikesan')?.value ?? 0;
    const netDiff = savedVal - wastedVal;

    return (
      <div className="bg-[#090d16]/95 backdrop-blur-xl border border-slate-700/80 rounded-2xl p-4 shadow-[0_12px_36px_rgba(30,58,138,0.35)] text-slate-100 min-w-[240px] animate-fade-in pointer-events-none">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-2.5 mb-2.5">
          <div className="flex items-center gap-1.5 text-xs text-slate-300 font-mono font-bold">
            <span>🕒 {label}</span>
            {dataPoint?.fullDate && (
              <span className="text-[10px] text-slate-400 font-normal">({dataPoint.fullDate})</span>
            )}
          </div>
          <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-black bg-sapphire-500/20 text-sapphire-300 border border-sapphire-500/30">
            {getMetricSymbol()}
          </span>
        </div>

        {/* Values */}
        <div className="space-y-2.5 text-xs">
          {/* Penjimatan SCEAS */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-emerald-400 font-semibold">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
              <span>Penjimatan SCEAS</span>
            </div>
            <span className="font-mono font-black text-emerald-300">
              {metric === 'rm' ? `RM ${savedVal.toFixed(2)}` : `${savedVal.toFixed(3)} ${getMetricSymbol()}`}
            </span>
          </div>

          {/* Pembaziran Dikesan */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-rose-400 font-semibold">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-400 shadow-[0_0_8px_rgba(244,63,94,0.8)]" />
              <span>Pembaziran Dikesan</span>
            </div>
            <span className="font-mono font-black text-rose-300">
              {metric === 'rm' ? `RM ${wastedVal.toFixed(2)}` : `${wastedVal.toFixed(3)} ${getMetricSymbol()}`}
            </span>
          </div>

          {/* Net Diff */}
          <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px]">
            <span className="text-slate-400 font-medium">Baki Bersih:</span>
            <span
              className={`font-mono font-black flex items-center gap-0.5 ${
                netDiff >= 0 ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              {netDiff >= 0 ? '+' : ''}
              {metric === 'rm' ? `RM ${netDiff.toFixed(2)}` : `${netDiff.toFixed(3)} ${getMetricSymbol()}`}
            </span>
          </div>
        </div>
      </div>
    );
  };

  const metricTabs = [
    { id: 'kwh', label: '⚡ Tenaga (kWh)', short: 'kWh', icon: Zap },
    { id: 'rm', label: '💰 Kos (RM)', short: 'RM', icon: Coins },
    { id: 'co2', label: '🌱 Karbon (kg CO₂)', short: 'kg CO₂', icon: Leaf },
  ] as const;

  return (
    <div className="glass-panel rounded-3xl p-6 flex flex-col border border-slate-800/80 shadow-2xl relative overflow-hidden">
      {/* Top Header & Interactive Controls */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h3 className="text-slate-100 font-extrabold text-base sm:text-lg tracking-tight">
              Analisis Kumulatif: Penjimatan vs Pembaziran
            </h3>
            <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full flex items-center gap-1 shadow-sm">
              <TrendingUp className="h-3 w-3" /> Live Analytics
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1 max-w-2xl leading-relaxed">
            Perbandingan masa nyata antara tenaga yang berjaya dijimatkan oleh SCEAS (Hijau) melawan pembaziran yang dikesan akibat lampu dibiarkan menyala (Merah).
          </p>
        </div>

        {/* Right Controls: Room Selector & Metric Pills Switcher */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 w-full lg:w-auto self-end lg:self-auto">
          {/* Room Filter Selector */}
          {rooms && rooms.length > 0 && (
            <div className="relative">
              <select
                value={selectedRoomFilter}
                onChange={(e) => setSelectedRoomFilter(e.target.value)}
                className="w-full sm:w-auto appearance-none bg-slate-950/80 text-xs font-mono font-bold text-slate-200 border border-slate-800 hover:border-slate-700 rounded-2xl px-3.5 py-2 pr-8 focus:outline-none focus:border-sapphire-500 transition cursor-pointer"
              >
                <option value="ALL">🏛️ Semua Bilik (POLISAS)</option>
                {rooms.map((room) => (
                  <option key={room.id} value={room.id.toString()}>
                    📍 {room.name}
                  </option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2.5 text-slate-400">
                <Layers className="h-3.5 w-3.5" />
              </div>
            </div>
          )}

          {/* Metric Switcher Pills */}
          <div className="flex bg-slate-950/90 p-1 rounded-2xl border border-slate-800 shadow-inner">
            {metricTabs.map((m) => {
              const IconComponent = m.icon;
              const isActive = metric === m.id;
              return (
                <button
                  key={m.id}
                  onClick={() => setMetric(m.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all duration-200 flex items-center gap-1.5 ${
                    isActive
                      ? 'bg-emerald-500 text-slate-950 shadow-glow-emerald font-black scale-[1.02]'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/50'
                  }`}
                >
                  <IconComponent className={`w-3.5 h-3.5 ${isActive ? 'text-slate-950' : 'text-slate-400'}`} />
                  <span>{m.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Mini HUD Summary Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 mb-6">
        {/* HUD 1: Cumulative Saved */}
        <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800/80 relative overflow-hidden flex items-center justify-between group hover:border-emerald-500/40 transition">
          <div className="absolute -right-4 -bottom-4 w-16 h-16 bg-emerald-500/5 rounded-full blur-xl group-hover:bg-emerald-500/10 transition" />
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              Kumulatif Penjimatan
            </span>
            <div className="text-lg font-black font-mono text-emerald-400 mt-0.5 tracking-tight flex items-baseline gap-1">
              <span>{formatDisplayValue(totalCumulativeSaved)}</span>
            </div>
            <span className="text-[10px] text-emerald-300/80 font-mono flex items-center gap-1 mt-0.5">
              <Sparkles className="w-3 h-3 text-emerald-400" />
              Sistem Automatik SCEAS
            </span>
          </div>
          <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shrink-0">
            <TrendingUp className="w-4 h-4" />
          </div>
        </div>

        {/* HUD 2: Cumulative Wastage */}
        <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800/80 relative overflow-hidden flex items-center justify-between group hover:border-rose-500/40 transition">
          <div className="absolute -right-4 -bottom-4 w-16 h-16 bg-rose-500/5 rounded-full blur-xl group-hover:bg-rose-500/10 transition" />
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              Kumulatif Pembaziran
            </span>
            <div className="text-lg font-black font-mono text-rose-400 mt-0.5 tracking-tight flex items-baseline gap-1">
              <span>{formatDisplayValue(totalCumulativeWasted)}</span>
            </div>
            <span className="text-[10px] text-rose-300/80 font-mono flex items-center gap-1 mt-0.5">
              <Flame className="w-3 h-3 text-rose-400" />
              Lampu Dibiarkan Menyala
            </span>
          </div>
          <div className="p-2.5 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20 shrink-0">
            <TrendingDown className="w-4 h-4" />
          </div>
        </div>

        {/* HUD 3: Kecekapan & Baki Bersih */}
        <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800/80 relative overflow-hidden flex items-center justify-between group hover:border-sapphire-500/40 transition">
          <div className="absolute -right-4 -bottom-4 w-16 h-16 bg-sapphire-500/5 rounded-full blur-xl group-hover:bg-sapphire-500/10 transition" />
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              Indeks Kecekapan
            </span>
            <div className="text-lg font-black font-mono text-sapphire-400 mt-0.5 tracking-tight flex items-baseline gap-1.5">
              <span>{efficiencyRate}%</span>
              <span className="text-[10px] text-slate-400 font-sans font-normal">
                ({totalCumulativeSaved >= totalCumulativeWasted ? 'Net Penjimatan' : 'Net Defisit'})
              </span>
            </div>
            <span className="text-[10px] text-sapphire-300 font-mono flex items-center gap-1 mt-0.5">
              <ShieldCheck className="w-3 h-3 text-sapphire-400" />
              Baki: {totalCumulativeSaved >= totalCumulativeWasted ? '+' : ''}
              {formatDisplayValue(totalCumulativeSaved - totalCumulativeWasted)}
            </span>
          </div>
          <div className="p-2.5 rounded-xl bg-sapphire-500/10 text-sapphire-400 border border-sapphire-500/20 shrink-0">
            <Scale className="w-4 h-4" />
          </div>
        </div>
      </div>

      {/* Chart Visualizer or Empty State */}
      <div className="w-full h-[320px] sm:h-[350px] relative">
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={chartData}
              margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
            >
              <defs>
                {/* Emerald Gradient for Penjimatan */}
                <linearGradient id="sceasGradientSaved" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.45} />
                  <stop offset="60%" stopColor="#059669" stopOpacity={0.15} />
                  <stop offset="98%" stopColor="#059669" stopOpacity={0.0} />
                </linearGradient>

                {/* Rose Gradient for Pembaziran */}
                <linearGradient id="sceasGradientWasted" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.45} />
                  <stop offset="60%" stopColor="#e11d48" stopOpacity={0.15} />
                  <stop offset="98%" stopColor="#e11d48" stopOpacity={0.0} />
                </linearGradient>
              </defs>

              <CartesianGrid
                strokeDasharray="3 3"
                stroke="#1e293b"
                vertical={false}
              />

              <XAxis
                dataKey="time"
                stroke="#475569"
                tickLine={{ stroke: '#334155' }}
                axisLine={{ stroke: '#334155' }}
                tick={{
                  fill: '#94a3b8',
                  fontSize: 10,
                  fontFamily: 'JetBrains Mono, monospace',
                }}
              />

              <YAxis
                stroke="#475569"
                tickLine={{ stroke: '#334155' }}
                axisLine={{ stroke: '#334155' }}
                tick={{
                  fill: '#94a3b8',
                  fontSize: 10,
                  fontFamily: 'JetBrains Mono, monospace',
                }}
                unit={` ${getMetricSymbol().split(' ')[0]}`}
              />

              <Tooltip content={<CustomTooltip />} />

              <Area
                type="monotone"
                dataKey="Penjimatan SCEAS"
                stroke="#10b981"
                strokeWidth={2.5}
                fillOpacity={1}
                fill="url(#sceasGradientSaved)"
                activeDot={{
                  r: 5,
                  fill: '#10b981',
                  stroke: '#0f172a',
                  strokeWidth: 2,
                }}
              />

              <Area
                type="monotone"
                dataKey="Pembaziran Dikesan"
                stroke="#f43f5e"
                strokeWidth={2.5}
                fillOpacity={1}
                fill="url(#sceasGradientWasted)"
                activeDot={{
                  r: 5,
                  fill: '#f43f5e',
                  stroke: '#0f172a',
                  strokeWidth: 2,
                }}
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center border border-dashed border-slate-800 rounded-2xl bg-slate-950/30">
            <div className="p-3 rounded-2xl bg-slate-900 border border-slate-800 text-slate-500 mb-3 animate-pulse">
              <Zap className="w-8 h-8" />
            </div>
            <h4 className="text-sm font-bold text-slate-300">
              Tiada Rekod Log Penjimatan / Pembaziran Dikesan
            </h4>
            <p className="text-xs text-slate-500 mt-1.5 max-w-md">
              Graf kumulatif akan dihasilkan secara automatik sebaik sahaja sistem SCEAS merekodkan sesi penjimatan tenaga atau mengesan kejadian lampu terbiar.
            </p>
          </div>
        )}
      </div>

      {/* Chart Footer Legend */}
      <div className="pt-4 mt-2 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-400">
        <div className="flex items-center gap-4 flex-wrap font-mono">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
            <span className="text-slate-300 font-bold">Penjimatan SCEAS</span>
            <span className="text-[10px] text-slate-500">(Auto Switch-off / PIR / Jadual)</span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-400 shadow-[0_0_8px_rgba(244,63,94,0.8)]" />
            <span className="text-slate-300 font-bold">Pembaziran Dikesan</span>
            <span className="text-[10px] text-slate-500">(Bilik Kosong Lampu Terpasang)</span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 font-mono text-[11px] text-slate-400 bg-slate-950 px-3 py-1 rounded-xl border border-slate-800">
          <Info className="w-3.5 h-3.5 text-sapphire-400" />
          <span>Jumlah Entri: <strong className="text-slate-200">{sortedLogs.length} rekod</strong></span>
        </div>
      </div>
    </div>
  );
}
