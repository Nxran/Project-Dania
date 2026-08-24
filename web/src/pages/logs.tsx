import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/utils/supabase/client';
import {
  History,
  Leaf,
  Coins,
  Zap,
  RefreshCw,
  AlertTriangle,
  Filter,
  Search,
  Download,
  CheckCircle2,
  TrendingDown,
  TrendingUp,
  Scale,
  Calendar,
  Clock,
  Layers,
  ArrowUpDown,
  Building2,
  Flame,
  Award
} from 'lucide-react';
import { useConnectivity } from '@/components/layout/DashboardLayout';

interface Room {
  id: string | number;
  name: string;
  category?: string;
}

interface SavingsLog {
  id: string | number;
  room_id: string | number;
  start_time: string;
  end_time: string;
  kwh_saved: number | string;
  rm_saved: number | string;
  co2_saved: number | string;
  log_type?: string;
  is_simulation?: boolean;
  created_at: string;
}

export default function SavingsLogsPage() {
  const [logs, setLogs] = useState<SavingsLog[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Live Hardware vs Simulation filter
  const [dataSourceFilter, setDataSourceFilter] = useState<'HARDWARE' | 'SIMULATION'>('HARDWARE');
  
  // Table search & category filters
  const [categoryFilter, setCategoryFilter] = useState<'ALL' | 'SAVINGS' | 'WASTAGE'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRoomFilter, setSelectedRoomFilter] = useState<string>('ALL');

  const { setOnline } = useConnectivity();

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [roomsRes, logsRes] = await Promise.all([
        supabase.from('rooms').select('id, name, category').order('name', { ascending: true }),
        supabase.from('savings_log').select('*').order('created_at', { ascending: false }),
      ]);

      if (roomsRes.error) throw roomsRes.error;
      if (logsRes.error) throw logsRes.error;

      setOnline(true);

      if (roomsRes.data) setRooms(roomsRes.data as Room[]);

      if (logsRes.data) {
        setLogs(logsRes.data as SavingsLog[]);
      }
    } catch (err: any) {
      console.error('Error fetching savings logs:', err);
      setError(err.message || 'Gagal memuatkan rekod log tenaga.');
      setOnline(false);
    } finally {
      setLoading(false);
    }
  }, [setOnline]);

  useEffect(() => {
    fetchData();

    const channel = supabase
      .channel('savings-logs-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'savings_log' }, () => {
        fetchData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchData]);

  const formatDuration = (start: string, end: string) => {
    const diffMs = new Date(end).getTime() - new Date(start).getTime();
    if (diffMs <= 0) return '0 minit';
    const diffMins = Math.round(diffMs / 60000);
    if (diffMins < 60) return `${diffMins} minit`;
    const hrs = Math.floor(diffMins / 60);
    const mins = diffMins % 60;
    return `${hrs}j ${mins}m`;
  };

  const getRoom = useCallback((roomId: string | number) => {
    return rooms.find((rm) => rm.id.toString() === roomId.toString());
  }, [rooms]);

  const getRoomName = useCallback((roomId: string | number) => {
    const r = getRoom(roomId);
    return r ? r.name : `Makmal ${roomId.toString().slice(0, 8)}...`;
  }, [getRoom]);

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString('ms-MY', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  };

  // Filter logs strictly by Hardware vs Simulation first
  const sourceFilteredLogs = useMemo(() => {
    return logs.filter((log) => {
      if (dataSourceFilter === 'HARDWARE') return !log.is_simulation;
      if (dataSourceFilter === 'SIMULATION') return !!log.is_simulation;
      return true;
    });
  }, [logs, dataSourceFilter]);

  // Overall KPI sums based on data source
  const savingsOnly = useMemo(() => sourceFilteredLogs.filter((l) => l.log_type !== 'WASTAGE'), [sourceFilteredLogs]);
  const wastageOnly = useMemo(() => sourceFilteredLogs.filter((l) => l.log_type === 'WASTAGE'), [sourceFilteredLogs]);

  const totalKwhSaved = useMemo(() => {
    return savingsOnly.reduce((acc, log) => acc + (parseFloat(log.kwh_saved.toString()) || 0), 0);
  }, [savingsOnly]);

  const totalRmSaved = useMemo(() => {
    return savingsOnly.reduce((acc, log) => acc + (parseFloat(log.rm_saved.toString()) || 0), 0);
  }, [savingsOnly]);

  const totalKwhWasted = useMemo(() => {
    return wastageOnly.reduce((acc, log) => acc + (parseFloat(log.kwh_saved.toString()) || 0), 0);
  }, [wastageOnly]);

  const totalRmWasted = useMemo(() => {
    return wastageOnly.reduce((acc, log) => acc + (parseFloat(log.rm_saved.toString()) || 0), 0);
  }, [wastageOnly]);

  // Filter logs for the table based on search, category filter, and room selection
  const tableLogs = useMemo(() => {
    return sourceFilteredLogs.filter((log) => {
      // Category filter
      if (categoryFilter === 'SAVINGS' && log.log_type === 'WASTAGE') return false;
      if (categoryFilter === 'WASTAGE' && log.log_type !== 'WASTAGE') return false;

      // Room filter
      if (selectedRoomFilter !== 'ALL' && log.room_id.toString() !== selectedRoomFilter) {
        return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const roomName = getRoomName(log.room_id).toLowerCase();
        const query = searchQuery.toLowerCase();
        const matchesName = roomName.includes(query);
        const matchesDate = log.start_time.toLowerCase().includes(query) || log.end_time.toLowerCase().includes(query);
        if (!matchesName && !matchesDate) return false;
      }

      return true;
    });
  }, [sourceFilteredLogs, categoryFilter, selectedRoomFilter, searchQuery, getRoomName]);

  // Export to CSV
  const handleExportCSV = () => {
    if (tableLogs.length === 0) return;
    
    const headers = ['ID', 'Makmal', 'Kategori Log', 'Sumber Data', 'Masa Mula', 'Masa Tamat', 'Tempoh', 'Tenaga (kWh)', 'Kos (RM)', 'CO2 (kg)'];
    const rows = tableLogs.map(log => [
      log.id,
      getRoomName(log.room_id),
      log.log_type === 'WASTAGE' ? 'PEMBAZIRAN' : 'PENJIMATAN',
      log.is_simulation ? 'SIMULATION' : 'HARDWARE',
      new Date(log.start_time).toISOString(),
      new Date(log.end_time).toISOString(),
      formatDuration(log.start_time, log.end_time),
      parseFloat(log.kwh_saved.toString()).toFixed(4),
      parseFloat(log.rm_saved.toString()).toFixed(2),
      parseFloat(log.co2_saved.toString()).toFixed(4),
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `SCEAS_Audit_Log_${dataSourceFilter}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-10">
      {/* Header Section */}
      <div className="glass-panel p-6 rounded-3xl border border-slate-800/80 shadow-card-slate flex flex-col xl:flex-row justify-between items-start xl:items-center gap-5">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <div className="p-2.5 rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-[0_0_15px_rgba(16,185,129,0.15)]">
              <History className="w-5 h-5" />
            </div>
            <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-slate-100">
              Rekod Audit: Penjimatan vs Pembaziran Tenaga
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-sapphire-500/15 text-sapphire-400 border border-sapphire-500/30 font-mono uppercase">
              POLISAS AUDIT TRAIL
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-2 max-w-3xl leading-relaxed">
            Audit terperinci tenaga dijimatkan oleh SCEAS Auto-Off berbanding tenaga terbazir akibat suis terbiar tanpa kehadiran. Segala rekod disegerakkan secara masa nyata ke pangkalan data awan.
          </p>
        </div>

        {/* Action Controls & Data Filter Switch */}
        <div className="flex items-center gap-3 flex-wrap w-full xl:w-auto justify-start xl:justify-end">
          {/* Hardware vs Simulation Switch */}
          <div className="flex items-center p-1 rounded-2xl bg-slate-950/80 border border-slate-800 text-xs font-bold font-mono shadow-inner">
            <button
              onClick={() => setDataSourceFilter('HARDWARE')}
              className={`px-3.5 py-1.5 rounded-xl transition-all duration-200 ${
                dataSourceFilter === 'HARDWARE'
                  ? 'bg-emerald-500 text-slate-950 shadow-md font-extrabold shadow-emerald-500/20'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              🟢 Data Perkakasan (Lalai)
            </button>
            <button
              onClick={() => setDataSourceFilter('SIMULATION')}
              className={`px-3.5 py-1.5 rounded-xl transition-all duration-200 ${
                dataSourceFilter === 'SIMULATION'
                  ? 'bg-sapphire-500 text-white shadow-md font-extrabold shadow-sapphire-500/20'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              🧪 Data Simulasi
            </button>
          </div>

          <button
            onClick={handleExportCSV}
            disabled={tableLogs.length === 0}
            className="flex items-center gap-1.5 px-3.5 py-2 glass-panel hover:border-sapphire-500/40 text-slate-200 transition rounded-2xl text-xs font-bold shadow-sm disabled:opacity-40"
            title="Eksport jadual audit ke format CSV"
          >
            <Download className="h-4 w-4 text-sapphire-400" />
            <span>Eksport CSV</span>
          </button>

          <button
            onClick={fetchData}
            disabled={loading}
            className="flex items-center gap-1.5 px-3.5 py-2 glass-panel hover:border-emerald-500/40 text-slate-200 transition rounded-2xl text-xs font-bold shadow-sm"
          >
            <RefreshCw className={`h-4 w-4 text-emerald-400 ${loading ? 'animate-spin' : ''}`} />
            <span>Segarkan</span>
          </button>
        </div>
      </div>

      {/* 4 Dual-Metric KPI Cards (Tenaga Dijimatkan, Kos Diselamatkan, Tenaga Terbazir, Kos Terbazir) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
        {/* KPI 1: Tenaga Dijimatkan */}
        <div className="glass-panel rounded-3xl p-5 flex items-center justify-between border-l-4 border-l-emerald-500 border border-slate-800/80 shadow-card-slate relative overflow-hidden group hover:border-emerald-500/40 transition">
          <div className="absolute -right-8 -bottom-8 w-24 h-24 bg-emerald-500/5 rounded-full blur-2xl group-hover:bg-emerald-500/10 transition" />
          <div className="relative z-10">
            <span className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider block">
              Tenaga Dijimatkan
            </span>
            <h3 className="text-2xl font-extrabold text-emerald-400 mt-1 font-mono tracking-tight">
              {totalKwhSaved.toFixed(3)} <span className="text-xs text-slate-400 font-sans font-normal">kWh</span>
            </h3>
            <span className="text-[11px] text-emerald-300 font-mono font-bold flex items-center gap-1 mt-0.5">
              <TrendingUp className="w-3 h-3 inline text-emerald-400" />
              {savingsOnly.length} insiden SCEAS Auto-Off
            </span>
          </div>
          <div className="bg-emerald-500/10 p-3 rounded-2xl text-emerald-400 border border-emerald-500/20 shrink-0 relative z-10 shadow-[0_0_15px_rgba(16,185,129,0.15)]">
            <Zap className="h-6 w-6" />
          </div>
        </div>

        {/* KPI 2: Kos Diselamatkan */}
        <div className="glass-panel rounded-3xl p-5 flex items-center justify-between border-l-4 border-l-emerald-500 border border-slate-800/80 shadow-card-slate relative overflow-hidden group hover:border-emerald-500/40 transition">
          <div className="absolute -right-8 -bottom-8 w-24 h-24 bg-emerald-500/5 rounded-full blur-2xl group-hover:bg-emerald-500/10 transition" />
          <div className="relative z-10">
            <span className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider block">
              Kos Diselamatkan
            </span>
            <h3 className="text-2xl font-extrabold text-emerald-400 mt-1 font-mono tracking-tight">
              RM {totalRmSaved.toFixed(2)}
            </h3>
            <span className="text-[11px] text-emerald-300 font-mono font-bold flex items-center gap-1 mt-0.5">
              <Coins className="w-3 h-3 inline text-emerald-400" />
              Penjimatan Bil Elektrik TNB
            </span>
          </div>
          <div className="bg-emerald-500/10 p-3 rounded-2xl text-emerald-400 border border-emerald-500/20 shrink-0 relative z-10 shadow-[0_0_15px_rgba(16,185,129,0.15)]">
            <Coins className="h-6 w-6" />
          </div>
        </div>

        {/* KPI 3: Tenaga Terbazir */}
        <div className="glass-panel rounded-3xl p-5 flex items-center justify-between border-l-4 border-l-rose-500 border border-slate-800/80 shadow-card-slate relative overflow-hidden group hover:border-rose-500/40 transition">
          <div className="absolute -right-8 -bottom-8 w-24 h-24 bg-rose-500/5 rounded-full blur-2xl group-hover:bg-rose-500/10 transition" />
          <div className="relative z-10">
            <span className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider block">
              Tenaga Terbazir
            </span>
            <h3 className="text-2xl font-extrabold text-rose-400 mt-1 font-mono tracking-tight">
              {totalKwhWasted.toFixed(3)} <span className="text-xs text-slate-400 font-sans font-normal">kWh</span>
            </h3>
            <span className="text-[11px] text-rose-300 font-mono font-bold flex items-center gap-1 mt-0.5">
              <Flame className="w-3 h-3 inline text-rose-400" />
              {wastageOnly.length} insiden suis dibiar terpasang
            </span>
          </div>
          <div className="bg-rose-500/10 p-3 rounded-2xl text-rose-400 border border-rose-500/20 shrink-0 relative z-10 shadow-[0_0_15px_rgba(244,63,94,0.15)]">
            <TrendingDown className="h-6 w-6" />
          </div>
        </div>

        {/* KPI 4: Kos Terbazir */}
        <div className="glass-panel rounded-3xl p-5 flex items-center justify-between border-l-4 border-l-rose-500 border border-slate-800/80 shadow-card-slate relative overflow-hidden group hover:border-rose-500/40 transition">
          <div className="absolute -right-8 -bottom-8 w-24 h-24 bg-rose-500/5 rounded-full blur-2xl group-hover:bg-rose-500/10 transition" />
          <div className="relative z-10">
            <span className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider block">
              Kos Terbazir
            </span>
            <h3 className="text-2xl font-extrabold text-rose-400 mt-1 font-mono tracking-tight">
              RM {totalRmWasted.toFixed(2)}
            </h3>
            <span className="text-[11px] text-rose-300 font-mono font-bold flex items-center gap-1 mt-0.5">
              <Coins className="w-3 h-3 inline text-rose-400" />
              Kos Beban Lampu Terbiar
            </span>
          </div>
          <div className="bg-rose-500/10 p-3 rounded-2xl text-rose-400 border border-rose-500/20 shrink-0 relative z-10 shadow-[0_0_15px_rgba(244,63,94,0.15)]">
            <Coins className="h-6 w-6" />
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-rose-500/10 border border-rose-500/30 text-rose-400 px-6 py-4 rounded-3xl flex items-start gap-4 shadow-xl animate-pulse">
          <AlertTriangle className="h-6 w-6 text-rose-500 shrink-0 mt-0.5" />
          <div className="flex-1">
            <h4 className="font-bold text-base text-rose-400">Ralat Pangkalan Data</h4>
            <p className="text-xs text-slate-400 mt-1">{error}</p>
          </div>
        </div>
      )}

      {/* Filter & Search Bar */}
      <div className="glass-panel p-4 rounded-3xl border border-slate-800/80 shadow-card-slate flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        {/* Category Tabs */}
        <div className="flex items-center p-1 rounded-2xl bg-slate-950/80 border border-slate-800 text-xs font-bold font-mono">
          <button
            onClick={() => setCategoryFilter('ALL')}
            className={`px-3.5 py-1.5 rounded-xl transition ${
              categoryFilter === 'ALL'
                ? 'bg-sapphire-500 text-white shadow-sm font-extrabold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Semua ({sourceFilteredLogs.length})
          </button>
          <button
            onClick={() => setCategoryFilter('SAVINGS')}
            className={`px-3.5 py-1.5 rounded-xl transition ${
              categoryFilter === 'SAVINGS'
                ? 'bg-emerald-500 text-slate-950 shadow-sm font-extrabold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            🟢 Penjimatan ({savingsOnly.length})
          </button>
          <button
            onClick={() => setCategoryFilter('WASTAGE')}
            className={`px-3.5 py-1.5 rounded-xl transition ${
              categoryFilter === 'WASTAGE'
                ? 'bg-rose-500 text-white shadow-sm font-extrabold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            🔴 Pembaziran ({wastageOnly.length})
          </button>
        </div>

        {/* Room Filter Dropdown & Search Input */}
        <div className="flex items-center gap-3 flex-1 max-w-lg">
          <select
            value={selectedRoomFilter}
            onChange={(e) => setSelectedRoomFilter(e.target.value)}
            className="px-3.5 py-2 rounded-2xl bg-slate-950/80 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-sapphire-500 transition"
          >
            <option value="ALL">Semua Makmal ({rooms.length})</option>
            {rooms.map((r) => (
              <option key={r.id} value={r.id.toString()}>
                {r.name}
              </option>
            ))}
          </select>

          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari rekod log..."
              className="w-full pl-10 pr-4 py-2 rounded-2xl bg-slate-950/80 border border-slate-800 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-sapphire-500 transition"
            />
          </div>
        </div>
      </div>

      {/* Modern Audit Table */}
      <div className="glass-panel rounded-3xl overflow-hidden border border-slate-800/80 shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950/40 text-slate-400 font-bold uppercase tracking-wider">
                <th className="py-4 px-6">Nama Makmal</th>
                <th className="py-4 px-6">Kategori Log</th>
                <th className="py-4 px-6">Sumber Data</th>
                <th className="py-4 px-6">Tempoh Sesi</th>
                <th className="py-4 px-6 text-right">Tenaga (kWh)</th>
                <th className="py-4 px-6 text-right">Kesan Kos (RM)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-200">
              {tableLogs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-16 text-center text-slate-500">
                    <History className="h-10 w-10 mx-auto mb-3 opacity-30 text-slate-400" />
                    <p className="text-sm font-semibold text-slate-300">Tiada Rekod Audit Ditemui</p>
                    <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                      {dataSourceFilter === 'HARDWARE'
                        ? 'Menunggu sesi penjimatan / pembaziran dari perkakasan ESP32 fizikal.'
                        : 'Tiada rekod data simulasi ditemui.'}
                    </p>
                  </td>
                </tr>
              ) : (
                tableLogs.map((log) => {
                  const isWastage = log.log_type === 'WASTAGE';
                  const room = getRoom(log.room_id);

                  return (
                    <tr
                      key={log.id}
                      className="hover:bg-slate-900/50 transition duration-150 group"
                    >
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-2.5">
                          <div className={`p-2 rounded-xl border ${
                            isWastage
                              ? 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                              : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                          }`}>
                            <Zap className="h-4 w-4" />
                          </div>
                          <div>
                            <span className="font-bold text-slate-100 block group-hover:text-sapphire-300 transition">
                              {getRoomName(log.room_id)}
                            </span>
                            {room?.category && (
                              <span className="text-[10px] text-slate-500 font-mono">
                                {room.category}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      <td className="py-4 px-6">
                        <span
                          className={`px-3 py-1 rounded-full text-[10px] font-mono font-extrabold uppercase inline-flex items-center gap-1.5 border ${
                            isWastage
                              ? 'bg-rose-500/15 text-rose-400 border-rose-500/30 shadow-[0_0_10px_rgba(244,63,94,0.15)]'
                              : 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30 shadow-[0_0_10px_rgba(16,185,129,0.15)]'
                          }`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${isWastage ? 'bg-rose-400' : 'bg-emerald-400'}`} />
                          {isWastage ? '🔴 PEMBAZIRAN (TERBIAR)' : '🟢 PENJIMATAN (SCEAS)'}
                        </span>
                      </td>

                      <td className="py-4 px-6">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold border ${
                            log.is_simulation
                              ? 'bg-sapphire-500/15 text-sapphire-300 border-sapphire-500/30'
                              : 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                          }`}
                        >
                          {log.is_simulation ? '🧪 SIMULATED' : '⚡ REAL HARDWARE'}
                        </span>
                      </td>

                      <td className="py-4 px-6 font-mono text-slate-400 text-[11px]">
                        <div className="text-slate-300 font-medium">{formatDate(log.start_time)}</div>
                        <div
                          className={`text-[10px] font-bold mt-0.5 ${
                            isWastage ? 'text-rose-400' : 'text-emerald-400'
                          }`}
                        >
                          Tempoh: {formatDuration(log.start_time, log.end_time)}
                        </div>
                      </td>

                      <td
                        className={`py-4 px-6 text-right font-mono font-extrabold text-sm ${
                          isWastage ? 'text-rose-400' : 'text-emerald-400'
                        }`}
                      >
                        {isWastage ? '-' : '+'}{parseFloat(log.kwh_saved.toString()).toFixed(3)}
                        <span className="text-[10px] text-slate-500 font-normal ml-1">kWh</span>
                      </td>

                      <td
                        className={`py-4 px-6 text-right font-mono font-extrabold text-sm ${
                          isWastage ? 'text-rose-400' : 'text-emerald-400'
                        }`}
                      >
                        {isWastage ? '-(RM ' : '+(RM '}
                        {parseFloat(log.rm_saved.toString()).toFixed(2)})
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Table Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/40 flex flex-col sm:flex-row justify-between items-center text-xs text-slate-500 font-mono gap-2">
          <span>Memaparkan {tableLogs.length} daripada {sourceFilteredLogs.length} rekod log</span>
          <span className="text-[11px] text-slate-400">Sistem Automasi Tenaga Pintar POLISAS • Rekod Tidak Boleh Dipadam</span>
        </div>
      </div>
    </div>
  );
}
