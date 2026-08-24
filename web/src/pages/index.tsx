import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { supabase } from '@/utils/supabase/client';
import { useConnectivity } from '@/components/layout/DashboardLayout';
import FloorPlan from '@/components/dashboard/FloorPlan';
import FloorPlanMap from '@/components/dashboard/FloorPlanMap';
import OverrideControl from '@/components/dashboard/OverrideControl';
import SavingsChart from '@/components/dashboard/SavingsChart';
import SimulatorPanel from '@/components/dashboard/SimulatorPanel';
import RoomManagerModal from '@/components/dashboard/RoomManagerModal';
import QRCodeModal from '@/components/dashboard/QRCodeModal';
import {
  Zap,
  Leaf,
  Bolt,
  AlertTriangle,
  Home,
  Sliders,
  QrCode,
  Wifi,
  WifiOff,
  UserCheck,
  Building2,
  ExternalLink,
  TrendingDown,
  TrendingUp,
  Percent,
  Cpu,
  BarChart3,
  Map,
  Activity,
  Sparkles,
  Radio,
  CheckCircle2,
  Clock,
  Layers,
  ArrowUpRight,
  ShieldCheck,
  Gauge,
  Flame,
  Award
} from 'lucide-react';
import Link from 'next/link';

interface Room {
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

interface EnergyReading {
  id: string | number;
  room_id: string | number;
  voltage: number;
  current: number;
  power: number;
  energy: number;
  is_simulation?: boolean;
  created_at: string;
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

interface RoomBooking {
  id: string;
  room_id: string;
  lecturer_name: string;
  subject_code: string;
  start_time: string;
  end_time: string;
  status: 'ACTIVE' | 'COMPLETED';
}

type CockpitTab = 'OVERVIEW' | 'FLOORPLAN_MAP' | 'ANALYTICS' | 'SIMULATOR_CONTROL';

export default function DashboardPage() {
  const [activeTab, setActiveTab] = useState<CockpitTab>('OVERVIEW');
  const [rooms, setRooms] = useState<Room[]>([]);
  const [readings, setReadings] = useState<EnergyReading[]>([]);
  const [logs, setLogs] = useState<SavingsLog[]>([]);
  const [bookings, setBookings] = useState<RoomBooking[]>([]);
  const [selectedRoomId, setSelectedRoomId] = useState<string | number | null>(null);
  const [isClient, setIsClient] = useState(false);
  const [roomManagerOpen, setRoomManagerOpen] = useState(false);
  const [qrModalOpen, setQrModalOpen] = useState(false);

  // Live Hardware vs Simulated Data Switcher
  const [dataSourceFilter, setDataSourceFilter] = useState<'HARDWARE' | 'SIMULATION'>('HARDWARE');

  const { setOnline } = useConnectivity();
  const [dbError, setDbError] = useState<string | null>(null);
  const lastManualUpdatesRef = useRef<{ [roomId: string]: number }>({});

  const fetchData = useCallback(async () => {
    try {
      const [roomsRes, readingsRes, logsRes, bookingsRes] = await Promise.all([
        supabase.from('rooms').select('*').order('name', { ascending: true }),
        supabase.from('energy_readings').select('*').order('created_at', { ascending: false }).limit(80),
        supabase.from('savings_log').select('*').order('created_at', { ascending: false }).limit(120),
        supabase.from('room_bookings').select('*').eq('status', 'ACTIVE'),
      ]);

      if (roomsRes.error) throw roomsRes.error;
      if (readingsRes.error) throw readingsRes.error;
      if (logsRes.error) throw logsRes.error;

      setOnline(true);
      setDbError(null);

      if (roomsRes.data) {
        const roomsList = roomsRes.data as Room[];
        const now = Date.now();
        setRooms(prevRooms => {
          return roomsList.map(incomingRoom => {
            const lastUpdate = lastManualUpdatesRef.current[incomingRoom.id.toString()] || 0;
            if (now - lastUpdate < 3000) {
              const currentLocal = prevRooms.find(r => r.id.toString() === incomingRoom.id.toString());
              return currentLocal || incomingRoom;
            }
            return incomingRoom;
          });
        });

        if (roomsList.length > 0 && (selectedRoomId === null || !roomsList.some(r => r.id.toString() === selectedRoomId?.toString()))) {
          setSelectedRoomId(roomsList[0].id);
        }
      }

      if (readingsRes.data) setReadings(readingsRes.data as EnergyReading[]);
      if (logsRes.data) setLogs(logsRes.data as SavingsLog[]);
      if (bookingsRes.data) setBookings(bookingsRes.data as RoomBooking[]);
    } catch (err: any) {
      console.error('Error polling dashboard state:', err);
      setOnline(false);
      setDbError(err.message || 'Ralat menyambung ke pangkalan data Supabase.');
    }
  }, [selectedRoomId, setOnline]);

  useEffect(() => {
    setIsClient(true);
    fetchData();

    const channel = supabase
      .channel('schema-db-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rooms' }, () => fetchData())
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'energy_readings' }, () => fetchData())
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'savings_log' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'room_bookings' }, () => fetchData())
      .subscribe();

    const timer = setInterval(fetchData, 3000);
    return () => {
      clearInterval(timer);
      supabase.removeChannel(channel);
    };
  }, [fetchData]);

  const handleRoomUpdated = (updatedRoom: Room) => {
    lastManualUpdatesRef.current[updatedRoom.id.toString()] = Date.now();
    setRooms(prevRooms => prevRooms.map(r => r.id.toString() === updatedRoom.id.toString() ? updatedRoom : r));
  };

  // Filter logs strictly by selected data source (Hardware vs Simulation)
  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      if (dataSourceFilter === 'HARDWARE') return !log.is_simulation;
      if (dataSourceFilter === 'SIMULATION') return !!log.is_simulation;
      return true;
    });
  }, [logs, dataSourceFilter]);

  // Calculate Savings vs Wastage metrics
  const savingsEntries = useMemo(() => filteredLogs.filter(l => l.log_type !== 'WASTAGE'), [filteredLogs]);
  const wastageEntries = useMemo(() => filteredLogs.filter(l => l.log_type === 'WASTAGE'), [filteredLogs]);

  const totalKwhSaved = useMemo(() => {
    return savingsEntries.reduce((acc, log) => acc + (parseFloat(log.kwh_saved.toString()) || 0), 0);
  }, [savingsEntries]);

  const totalRmSaved = useMemo(() => {
    return savingsEntries.reduce((acc, log) => acc + (parseFloat(log.rm_saved.toString()) || 0), 0);
  }, [savingsEntries]);

  const totalCo2Saved = useMemo(() => {
    return savingsEntries.reduce((acc, log) => acc + (parseFloat(log.co2_saved.toString()) || 0), 0);
  }, [savingsEntries]);

  const totalKwhWasted = useMemo(() => {
    return wastageEntries.reduce((acc, log) => acc + (parseFloat(log.kwh_saved.toString()) || 0), 0);
  }, [wastageEntries]);

  const totalRmWasted = useMemo(() => {
    return wastageEntries.reduce((acc, log) => acc + (parseFloat(log.rm_saved.toString()) || 0), 0);
  }, [wastageEntries]);

  const totalEvaluatedEnergy = totalKwhSaved + totalKwhWasted;
  const efficiencyIndex = totalEvaluatedEnergy > 0
    ? ((totalKwhSaved / totalEvaluatedEnergy) * 100).toFixed(1)
    : '100.0';

  const selectedRoom = useMemo(() => {
    return rooms.find(r => r.id.toString() === selectedRoomId?.toString()) || null;
  }, [rooms, selectedRoomId]);

  const activeBookingForSelectedRoom = useMemo(() => {
    return selectedRoom ? bookings.find(b => b.room_id.toString() === selectedRoom.id.toString()) : null;
  }, [selectedRoom, bookings]);

  const isHardwareOnline = selectedRoom?.last_heartbeat
    ? (Date.now() - new Date(selectedRoom.last_heartbeat).getTime() < 15000)
    : false;

  const heartbeatSecondsAgo = selectedRoom?.last_heartbeat
    ? Math.max(0, Math.floor((Date.now() - new Date(selectedRoom.last_heartbeat).getTime()) / 1000))
    : null;

  const selectedRoomReadings = useMemo(() => {
    return readings
      .filter(r => r.room_id.toString() === selectedRoomId?.toString())
      .filter(r => {
        if (dataSourceFilter === 'HARDWARE') return !r.is_simulation;
        if (dataSourceFilter === 'SIMULATION') return !!r.is_simulation;
        return true;
      });
  }, [readings, selectedRoomId, dataSourceFilter]);

  const latestReading = useMemo(() => {
    return selectedRoomReadings.length > 0
      ? [...selectedRoomReadings].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0]
      : null;
  }, [selectedRoomReadings]);

  // Analytics Room Breakdown
  const roomSavingsBreakdown = useMemo(() => {
    return rooms.map(room => {
      const roomLogs = filteredLogs.filter(l => l.room_id.toString() === room.id.toString());
      const rSavings = roomLogs.filter(l => l.log_type !== 'WASTAGE');
      const rWastage = roomLogs.filter(l => l.log_type === 'WASTAGE');

      const kwhSaved = rSavings.reduce((acc, l) => acc + (parseFloat(l.kwh_saved.toString()) || 0), 0);
      const rmSaved = rSavings.reduce((acc, l) => acc + (parseFloat(l.rm_saved.toString()) || 0), 0);
      const kwhWasted = rWastage.reduce((acc, l) => acc + (parseFloat(l.kwh_saved.toString()) || 0), 0);

      const totalE = kwhSaved + kwhWasted;
      const eff = totalE > 0 ? ((kwhSaved / totalE) * 100).toFixed(1) : '100.0';

      return {
        room,
        kwhSaved,
        rmSaved,
        kwhWasted,
        logCount: roomLogs.length,
        efficiency: eff,
      };
    });
  }, [rooms, filteredLogs]);

  // Tab definitions for Segmented Bar
  const cockpitTabs = [
    {
      id: 'OVERVIEW' as CockpitTab,
      label: 'Pusat Pemantauan',
      shortLabel: 'Pemantauan',
      icon: BarChart3,
      badge: `${rooms.length} Bilik`,
    },
    {
      id: 'FLOORPLAN_MAP' as CockpitTab,
      label: 'Pelan Lantai & Peta',
      shortLabel: 'Pelan & Peta',
      icon: Map,
      badge: 'Semambu',
    },
    {
      id: 'ANALYTICS' as CockpitTab,
      label: 'Graf Analisis & Penjimatan',
      shortLabel: 'Analisis',
      icon: TrendingUp,
      badge: `${filteredLogs.length} Log`,
    },
    {
      id: 'SIMULATOR_CONTROL' as CockpitTab,
      label: 'Makmal Simulasi & Kawalan',
      shortLabel: 'Simulasi',
      icon: Sliders,
      badge: 'FYP Proof',
    },
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-10">
      {/* Room Manager Modal */}
      <RoomManagerModal
        isOpen={roomManagerOpen}
        onClose={() => setRoomManagerOpen(false)}
        rooms={rooms}
        onRoomsChanged={fetchData}
      />

      {/* QR Code Printable Modal */}
      <QRCodeModal
        isOpen={qrModalOpen}
        onClose={() => setQrModalOpen(false)}
        room={selectedRoom}
      />

      {/* Database Connection Alert */}
      {dbError && (
        <div className="bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-200 px-6 py-4 rounded-3xl flex items-start gap-4 shadow-xl animate-pulse">
          <AlertTriangle className="h-6 w-6 text-rose-500 shrink-0 mt-0.5" />
          <div className="flex-1">
            <h4 className="font-bold text-base text-rose-500">Sambungan Pangkalan Data Terputus</h4>
            <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">
              Tidak dapat menyambung ke Supabase. Sila pastikan sambungan internet aktif.
            </p>
            <p className="text-xs text-rose-500 font-mono mt-2 bg-black/10 dark:bg-black/40 p-2 rounded-xl border border-rose-500/20">
              {dbError}
            </p>
          </div>
        </div>
      )}

      {/* Cockpit Top Banner / Header Bar */}
      <div className="glass-panel p-5 sm:p-6 rounded-3xl border border-slate-800/70 shadow-2xl flex flex-col xl:flex-row justify-between items-start xl:items-center gap-5">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight bg-gradient-to-r from-slate-100 via-sky-100 to-teal-200 bg-clip-text text-transparent">
              Pusat Kawalan Tenaga Pintar (SCEAS Cockpit)
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-sapphire-500/15 text-sapphire-400 border border-sapphire-500/30 font-mono uppercase tracking-wider">
              POLISAS Semambu
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-mono">
              v2.0 PRO
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1 flex items-center gap-2 flex-wrap">
            <span>Automasi Pencahayaan &amp; Pemantauan Kuasa Kampus</span>
            <span className="text-slate-600">•</span>
            <span className="font-mono text-teal-400 font-semibold">PZEM-004T + ESP32 Live Telemetry</span>
          </p>
        </div>

        {/* Global Action Bar & Data Filter Switcher */}
        <div className="flex items-center gap-2.5 flex-wrap w-full xl:w-auto justify-start xl:justify-end">
          {/* Data Source Filter Switch */}
          <div className="flex items-center p-1 rounded-2xl bg-slate-950/80 border border-slate-800 text-xs font-bold font-mono shadow-inner">
            <button
              onClick={() => setDataSourceFilter('HARDWARE')}
              className={`px-3.5 py-1.5 rounded-xl transition-all duration-200 ${
                dataSourceFilter === 'HARDWARE'
                  ? 'bg-emerald-500 text-slate-950 shadow-md font-extrabold shadow-emerald-500/20'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              🟢 Data Perkakasan
            </button>
            <button
              onClick={() => setDataSourceFilter('SIMULATION')}
              className={`px-3.5 py-1.5 rounded-xl transition-all duration-200 ${
                dataSourceFilter === 'SIMULATION'
                  ? 'bg-sapphire-500 text-white shadow-md font-extrabold shadow-sapphire-500/20'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              🧪 Mod Simulasi
            </button>
          </div>

          <Link
            href="/scan"
            className="px-3.5 py-2 rounded-2xl bg-sapphire-500/10 hover:bg-sapphire-500/20 border border-sapphire-500/30 text-sapphire-300 text-xs font-bold transition flex items-center gap-1.5 shadow-sm"
          >
            <Building2 className="w-3.5 h-3.5 text-sapphire-400" />
            <span>Direktori Makmal</span>
          </Link>

          {selectedRoom && (
            <button
              onClick={() => setQrModalOpen(true)}
              className="px-3.5 py-2 rounded-2xl glass-panel hover:border-sapphire-500/40 text-xs font-bold transition flex items-center gap-1.5 shadow-sm text-slate-200"
              title="Kad QR Pintu Makmal"
            >
              <QrCode className="w-3.5 h-3.5 text-teal-400" />
              <span>Kad QR</span>
            </button>
          )}

          <button
            onClick={() => setRoomManagerOpen(true)}
            className="px-3.5 py-2 rounded-2xl glass-panel hover:border-sapphire-500/40 text-xs font-bold transition flex items-center gap-1.5 shadow-sm text-slate-200"
          >
            <Home className="w-3.5 h-3.5 text-sapphire-400" />
            <span>Urus Bilik ({rooms.length})</span>
          </button>
        </div>
      </div>

      {/* 4-Tab Modular Segmented Navigation Bar */}
      <div className="glass-panel p-1.5 sm:p-2 rounded-2xl sm:rounded-3xl border border-slate-800/80 shadow-card-slate">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-1.5 sm:gap-2">
          {cockpitTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-3 sm:px-4 py-2.5 sm:py-3 rounded-xl sm:rounded-2xl text-xs font-bold transition-all duration-200 flex items-center justify-center gap-2 group relative ${
                  isActive
                    ? 'bg-gradient-to-r from-sapphire-600 via-sapphire-500 to-blue-600 text-white shadow-glow-sapphire font-extrabold border border-sapphire-400/40'
                    : 'text-slate-400 hover:text-slate-100 hover:bg-slate-850/60 border border-transparent'
                }`}
              >
                <Icon
                  className={`w-4 h-4 transition-transform duration-200 ${
                    isActive ? 'text-white scale-110' : 'text-slate-400 group-hover:text-slate-200'
                  }`}
                />
                <span className="hidden sm:inline truncate">{tab.label}</span>
                <span className="sm:hidden truncate">{tab.shortLabel}</span>
                {tab.badge && (
                  <span
                    className={`hidden xl:inline-block text-[9px] font-mono px-2 py-0.5 rounded-full ${
                      isActive
                        ? 'bg-white/20 text-white border border-white/20'
                        : 'bg-slate-800 text-slate-400 border border-slate-700'
                    }`}
                  >
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Top Bento Matrix (4 Dual-Metric Cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
        {/* Metric 1: Energy Saved by SCEAS */}
        <div className="glass-panel rounded-3xl p-5 flex items-center justify-between border-l-4 border-l-emerald-500 border border-slate-800/70 shadow-card-slate relative overflow-hidden group hover:border-emerald-500/40 transition">
          <div className="absolute -right-8 -bottom-8 w-24 h-24 bg-emerald-500/5 rounded-full blur-2xl group-hover:bg-emerald-500/10 transition" />
          <div className="relative z-10">
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider">
                Tenaga Dijimatkan
              </span>
            </div>
            <h3 className="text-2xl font-extrabold text-emerald-400 mt-1 font-mono tracking-tight">
              {totalKwhSaved.toFixed(3)} <span className="text-xs text-slate-400 font-sans font-normal">kWh</span>
            </h3>
            <span className="text-[11px] text-emerald-300 font-mono font-bold flex items-center gap-1 mt-0.5">
              <TrendingUp className="w-3 h-3 inline text-emerald-400" />
              RM {totalRmSaved.toFixed(2)} diselamatkan
            </span>
          </div>
          <div className="bg-emerald-500/10 p-3 rounded-2xl text-emerald-400 border border-emerald-500/20 shrink-0 relative z-10 shadow-[0_0_15px_rgba(16,185,129,0.15)]">
            <Zap className="h-6 w-6" />
          </div>
        </div>

        {/* Metric 2: Energy Wasted (Traditional / Idle Lights) */}
        <div className="glass-panel rounded-3xl p-5 flex items-center justify-between border-l-4 border-l-rose-500 border border-slate-800/70 shadow-card-slate relative overflow-hidden group hover:border-rose-500/40 transition">
          <div className="absolute -right-8 -bottom-8 w-24 h-24 bg-rose-500/5 rounded-full blur-2xl group-hover:bg-rose-500/10 transition" />
          <div className="relative z-10">
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider">
                Tenaga Dibazirkan
              </span>
            </div>
            <h3 className="text-2xl font-extrabold text-rose-400 mt-1 font-mono tracking-tight">
              {totalKwhWasted.toFixed(3)} <span className="text-xs text-slate-400 font-sans font-normal">kWh</span>
            </h3>
            <span className="text-[11px] text-rose-300 font-mono font-bold flex items-center gap-1 mt-0.5">
              <TrendingDown className="w-3 h-3 inline text-rose-400" />
              RM {totalRmWasted.toFixed(2)} terbuang
            </span>
          </div>
          <div className="bg-rose-500/10 p-3 rounded-2xl text-rose-400 border border-rose-500/20 shrink-0 relative z-10 shadow-[0_0_15px_rgba(244,63,94,0.15)]">
            <Flame className="h-6 w-6" />
          </div>
        </div>

        {/* Metric 3: Carbon Footprint Avoided */}
        <div className="glass-panel rounded-3xl p-5 flex items-center justify-between border-l-4 border-l-teal-500 border border-slate-800/70 shadow-card-slate relative overflow-hidden group hover:border-teal-500/40 transition">
          <div className="absolute -right-8 -bottom-8 w-24 h-24 bg-teal-500/5 rounded-full blur-2xl group-hover:bg-teal-500/10 transition" />
          <div className="relative z-10">
            <span className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider">
              Karbon Dielakkan
            </span>
            <h3 className="text-2xl font-extrabold text-teal-400 mt-1 font-mono tracking-tight">
              {totalCo2Saved.toFixed(3)} <span className="text-xs text-slate-400 font-sans font-normal">kg CO₂</span>
            </h3>
            <span className="text-[11px] text-teal-300 font-mono font-bold flex items-center gap-1 mt-0.5">
              <Leaf className="w-3 h-3 inline text-teal-400" />
              Jejak Hijau Kampus
            </span>
          </div>
          <div className="bg-teal-500/10 p-3 rounded-2xl text-teal-400 border border-teal-500/20 shrink-0 relative z-10 shadow-[0_0_15px_rgba(20,184,166,0.15)]">
            <Leaf className="h-6 w-6" />
          </div>
        </div>

        {/* Metric 4: Campus Energy Efficiency Index */}
        <div className="glass-panel rounded-3xl p-5 flex items-center justify-between border-l-4 border-l-sapphire-500 border border-slate-800/70 shadow-card-slate relative overflow-hidden group hover:border-sapphire-500/40 transition">
          <div className="absolute -right-8 -bottom-8 w-24 h-24 bg-sapphire-500/5 rounded-full blur-2xl group-hover:bg-sapphire-500/10 transition" />
          <div className="relative z-10">
            <span className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider">
              Indeks Kecekapan
            </span>
            <h3 className="text-2xl font-extrabold text-sapphire-400 mt-1 font-mono tracking-tight">
              {efficiencyIndex} <span className="text-xs text-slate-400 font-sans font-normal">%</span>
            </h3>
            <span className="text-[11px] text-sapphire-300 font-mono font-bold flex items-center gap-1 mt-0.5">
              <Award className="w-3 h-3 inline text-sapphire-400" />
              Tahap Keberkesanan SCEAS
            </span>
          </div>
          <div className="bg-sapphire-500/10 p-3 rounded-2xl text-sapphire-400 border border-sapphire-500/20 shrink-0 relative z-10 shadow-[0_0_15px_rgba(59,130,246,0.15)]">
            <Percent className="h-6 w-6" />
          </div>
        </div>
      </div>

      {/* Active Lecturer Session Banner */}
      {activeBookingForSelectedRoom && (
        <div className="p-4 rounded-3xl bg-gradient-to-r from-emerald-950/40 via-emerald-900/20 to-transparent border border-emerald-500/40 shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 animate-fade-in">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shrink-0">
              <UserCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-bold text-slate-100">
                  Sesi Makmal Aktif: <span className="text-emerald-300 font-extrabold">{activeBookingForSelectedRoom.lecturer_name}</span>
                </h4>
                <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-500/20 text-emerald-400 font-mono">
                  {activeBookingForSelectedRoom.subject_code}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Masa Berakhir: {new Date(activeBookingForSelectedRoom.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • Notifikasi amaran disasarkan terus ke pensyarah.
              </p>
            </div>
          </div>

          <Link
            href={`/book/${activeBookingForSelectedRoom.room_id}`}
            target="_blank"
            className="px-3.5 py-1.5 rounded-xl bg-emerald-500 text-slate-950 text-xs font-bold hover:bg-emerald-400 transition flex items-center gap-1.5 shrink-0 shadow-md"
          >
            <span>Halaman Sesi</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </Link>
        </div>
      )}

      {/* TAB 1: PUSAT PEMANTAUAN & TELEMETRI (OVERVIEW) */}
      {activeTab === 'OVERVIEW' && (
        <div className="space-y-6 animate-fade-in">
          {/* Main 2-Column Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column (2/3): PZEM-004T Live Telemetry & Quick Room Switcher */}
            <div className="lg:col-span-2 space-y-6">
              {/* PZEM-004T Live Telemetry Bento Panel */}
              <div className="glass-panel rounded-3xl p-6 border border-slate-800/80 shadow-2xl relative overflow-hidden">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                  <div>
                    <div className="flex items-center gap-2">
                      <div className="p-2 rounded-xl bg-sapphire-500/10 text-sapphire-400 border border-sapphire-500/20">
                        <Gauge className="w-4 h-4" />
                      </div>
                      <h3 className="font-bold text-base text-slate-100">
                        Telemetri Sensor PZEM-004T Semasa
                      </h3>
                    </div>
                    <p className="text-xs text-slate-400 mt-1">
                      Bilik Terpilih:{' '}
                      <span className="text-emerald-400 font-extrabold">{selectedRoom ? selectedRoom.name : 'Tiada'}</span>
                      {selectedRoom?.category && (
                        <span className="ml-2 px-2 py-0.5 rounded-md text-[10px] font-mono bg-slate-800 text-slate-300">
                          {selectedRoom.category}
                        </span>
                      )}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    {latestReading && (
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-mono font-bold ${
                        latestReading.is_simulation
                          ? 'bg-sapphire-500/20 text-sapphire-300 border border-sapphire-500/30'
                          : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      }`}>
                        {latestReading.is_simulation ? '🧪 SIMULATED' : '⚡ REAL PZEM'}
                      </span>
                    )}

                    {selectedRoom?.status === 'OCCUPIED' ? (
                      <span className="bg-rose-500/20 text-rose-400 border border-rose-500/40 text-[10px] font-extrabold px-3 py-1 rounded-full flex items-center gap-1.5 animate-pulse shadow-[0_0_15px_rgba(244,63,94,0.2)]">
                        <Bolt className="h-3.5 w-3.5" /> AKTIF (ON)
                      </span>
                    ) : (
                      <span className="glass-panel text-slate-400 text-[10px] font-bold px-3 py-1 rounded-full border border-slate-700">
                        STANDBY (OFF)
                      </span>
                    )}
                  </div>
                </div>

                {latestReading ? (
                  <div className="space-y-4">
                    {/* 4 Telemetry Metrics Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
                      <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800/80 hover:border-slate-700 transition">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Voltan (V)</span>
                        <span className="text-2xl font-black font-mono block mt-1 text-slate-100">
                          {latestReading.voltage.toFixed(1)} <span className="text-xs text-slate-400 font-sans font-normal">V</span>
                        </span>
                        <span className="text-[10px] text-slate-500 mt-1 block">Standard 230V AC</span>
                      </div>

                      <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800/80 hover:border-slate-700 transition">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Arus (A)</span>
                        <span className="text-2xl font-black font-mono block mt-1 text-sky-400">
                          {latestReading.current.toFixed(3)} <span className="text-xs text-slate-400 font-sans font-normal">A</span>
                        </span>
                        <span className="text-[10px] text-slate-500 mt-1 block">Arus Beban Semasa</span>
                      </div>

                      <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800/80 hover:border-slate-700 transition">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Kuasa Aktif (W)</span>
                        <span className="text-2xl font-black font-mono text-emerald-400 block mt-1">
                          {latestReading.power.toFixed(1)} <span className="text-xs text-slate-400 font-sans font-normal">W</span>
                        </span>
                        <span className="text-[10px] text-slate-500 mt-1 block">Penggunaan Semasa</span>
                      </div>

                      <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800/80 hover:border-slate-700 transition">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Tenaga Terkumpul</span>
                        <span className="text-2xl font-black font-mono text-sapphire-400 block mt-1">
                          {latestReading.energy.toFixed(3)} <span className="text-xs text-slate-400 font-sans font-normal">kWh</span>
                        </span>
                        <span className="text-[10px] text-slate-500 mt-1 block">Jumlah Kumulatif</span>
                      </div>
                    </div>

                    {/* Instantaneous Load Consumption Bar */}
                    {selectedRoom && (
                      <div className="p-3.5 rounded-2xl bg-slate-950/40 border border-slate-800 text-xs">
                        <div className="flex justify-between items-center mb-1.5">
                          <span className="text-slate-400 font-medium">Beban Kuasa Nominal Bilik:</span>
                          <span className="font-mono text-slate-200 font-bold">{selectedRoom.nominal_power} Watt</span>
                        </div>
                        <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden">
                          <div
                            className={`h-full transition-all duration-500 ${
                              selectedRoom.status === 'OCCUPIED'
                                ? 'bg-gradient-to-r from-emerald-500 to-teal-400'
                                : 'bg-slate-700'
                            }`}
                            style={{
                              width: selectedRoom.status === 'OCCUPIED'
                                ? `${Math.min(100, Math.max(15, (latestReading.power / Math.max(1, selectedRoom.nominal_power)) * 100))}%`
                                : '0%',
                            }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="py-8 text-center glass-panel border border-dashed border-slate-800 rounded-2xl flex flex-col items-center justify-center p-6">
                    <Bolt className="h-8 w-8 text-slate-500 mb-2 animate-pulse" />
                    <p className="text-xs font-semibold text-slate-300">Menunggu bacaan perkakasan PZEM-004T</p>
                    <p className="text-[11px] text-slate-500 mt-1 max-w-sm">
                      Bilik ini belum menerima bacaan telemetri masa nyata. Gunakan Makmal Simulasi untuk menguji suntikan data atau hidupkan mikropengawal ESP32.
                    </p>
                  </div>
                )}

                <div className="mt-4 pt-4 border-t border-slate-800/80 flex justify-between items-center text-xs text-slate-500 font-mono">
                  <span className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    <span>Kemaskini Terakhir:</span>
                  </span>
                  <span className="text-slate-300 font-bold">
                    {latestReading ? new Date(latestReading.created_at).toLocaleTimeString() : 'Tiada'}
                  </span>
                </div>
              </div>

              {/* Quick Room Switcher Grid */}
              <div className="glass-panel rounded-3xl p-6 border border-slate-800/80 shadow-2xl space-y-4">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-xl bg-teal-500/10 text-teal-400 border border-teal-500/20">
                      <Home className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="font-bold text-base text-slate-100">Pemilih Bilik Pantas (Quick Room Grid)</h4>
                      <p className="text-xs text-slate-400">Pilih bilik untuk menyegerakkan telemetri, pelan lantai, dan suis pintas</p>
                    </div>
                  </div>
                  <span className="text-xs text-slate-400 font-mono bg-slate-900 px-3 py-1 rounded-full border border-slate-800">
                    {rooms.length} Bilik Aktif
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3.5">
                  {rooms.map(room => {
                    const isSelected = selectedRoomId?.toString() === room.id.toString();
                    const isOccupied = room.status === 'OCCUPIED';
                    const isOverridden = room.manual_override;

                    return (
                      <button
                        key={room.id}
                        onClick={() => setSelectedRoomId(room.id)}
                        className={`p-4 rounded-2xl border text-left transition-all duration-200 flex flex-col justify-between gap-3 group relative ${
                          isSelected
                            ? 'bg-sapphire-500/15 border-sapphire-400 shadow-glow-sapphire'
                            : 'bg-slate-950/50 border-slate-800/80 hover:border-slate-700 hover:bg-slate-900/60'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <span className="text-[10px] font-bold uppercase font-mono text-slate-400 tracking-wider block">
                              {room.category || 'LAB'}
                            </span>
                            <h5 className="font-bold text-sm text-slate-100 truncate group-hover:text-sapphire-300 transition">
                              {room.name}
                            </h5>
                          </div>

                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold font-mono shrink-0 ${
                            isOccupied
                              ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                              : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          }`}>
                            {isOccupied ? 'ON' : 'OFF'}
                          </span>
                        </div>

                        <div className="flex items-center justify-between text-xs text-slate-400 pt-2 border-t border-slate-800/60 font-mono">
                          <span className="flex items-center gap-1">
                            <Bolt className="w-3 h-3 text-amber-400" />
                            {room.nominal_power}W
                          </span>

                          {isOverridden && (
                            <span className="text-[9px] text-blue-400 font-bold bg-blue-500/15 px-1.5 py-0.5 rounded border border-blue-500/30">
                              OVERRIDE
                            </span>
                          )}

                          {isSelected && (
                            <span className="text-[10px] text-sapphire-300 font-extrabold flex items-center gap-0.5">
                              Dipilih <CheckCircle2 className="w-3 h-3 inline" />
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Right Column (1/3): ESP32 Heartbeat Status & Override Control */}
            <div className="space-y-6">
              {/* ESP32 Real Hardware Connection Status Card */}
              <div className={`glass-panel rounded-3xl p-5 border shadow-2xl transition-all duration-300 ${
                isHardwareOnline
                  ? 'border-emerald-500/40 bg-emerald-950/10 shadow-[0_0_25px_rgba(16,185,129,0.1)]'
                  : 'border-slate-800'
              }`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className={`p-2.5 rounded-xl border ${
                      isHardwareOnline
                        ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30 animate-pulse'
                        : 'bg-slate-900 text-slate-500 border-slate-800'
                    }`}>
                      {isHardwareOnline ? <Wifi className="w-4 h-4" /> : <WifiOff className="w-4 h-4" />}
                    </div>
                    <div>
                      <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-200">
                        Status ESP32 Fizikal
                      </h4>
                      <p className="text-[11px] text-slate-400">
                        Bilik: <span className="font-bold text-slate-200">{selectedRoom?.name || 'N/A'}</span>
                      </p>
                    </div>
                  </div>

                  <span className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase font-mono ${
                    isHardwareOnline
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 shadow-sm'
                      : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                  }`}>
                    {isHardwareOnline ? '🟢 PERKAKASAN AKTIF' : '⚪ ESP32 STANDBY'}
                  </span>
                </div>

                <p className="text-xs text-slate-400 mt-3.5 leading-relaxed">
                  {isHardwareOnline
                    ? `Mikropengawal ESP32 sedang beroperasi & menghantar denyutan nadi (${heartbeatSecondsAgo}s lalu).`
                    : `Perkakasan mikropengawal ESP32 belum dihidupkan / belum bersambung ke Wi-Fi. Anda masih boleh menggunakan Makmal Simulasi.`}
                </p>
              </div>

              {/* Manual Override Control */}
              <OverrideControl room={selectedRoom} onRoomUpdated={handleRoomUpdated} />

              {/* Fast Quick Links Panel */}
              <div className="glass-panel rounded-3xl p-5 border border-slate-800/80 shadow-2xl space-y-3">
                <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                  <Activity className="w-3.5 h-3.5 text-sapphire-400" />
                  Tindakan Pantas Sistem
                </h4>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setActiveTab('FLOORPLAN_MAP')}
                    className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 hover:border-sapphire-500/40 text-xs font-bold text-slate-300 hover:text-white transition flex flex-col items-center justify-center gap-1.5"
                  >
                    <Map className="w-4 h-4 text-sapphire-400" />
                    <span>Buka Peta Pelan</span>
                  </button>

                  <button
                    onClick={() => setActiveTab('ANALYTICS')}
                    className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 hover:border-emerald-500/40 text-xs font-bold text-slate-300 hover:text-white transition flex flex-col items-center justify-center gap-1.5"
                  >
                    <TrendingUp className="w-4 h-4 text-emerald-400" />
                    <span>Lihat Graf Audit</span>
                  </button>

                  <button
                    onClick={() => setActiveTab('SIMULATOR_CONTROL')}
                    className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 hover:border-teal-500/40 text-xs font-bold text-slate-300 hover:text-white transition flex flex-col items-center justify-center gap-1.5"
                  >
                    <Sliders className="w-4 h-4 text-teal-400" />
                    <span>Enjin FYP Simulasi</span>
                  </button>

                  <Link
                    href="/logs"
                    className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 hover:border-purple-500/40 text-xs font-bold text-slate-300 hover:text-white transition flex flex-col items-center justify-center gap-1.5"
                  >
                    <Clock className="w-4 h-4 text-purple-400" />
                    <span>Arkib Rekod</span>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: PELAN LANTAI & PETA KAMPUS (FLOORPLAN_MAP) */}
      {activeTab === 'FLOORPLAN_MAP' && (
        <div className="space-y-6 animate-fade-in">
          {/* Header Info */}
          <div className="glass-panel p-5 rounded-3xl border border-slate-800/80 shadow-xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-sapphire-500/10 text-sapphire-400 border border-sapphire-500/20">
                <Map className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-100">
                  Visualisasi Ruang: Pelan Lantai SVG &amp; Peta Geospatial Kampus POLISAS
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Klik mana-mana zon pada pelan lantai atau penanda peta untuk memilih bilik secara langsung
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold text-emerald-400 bg-emerald-500/10 px-3 py-1.5 rounded-xl border border-emerald-500/20">
                Semambu, Kuantan (3.8615° N, 103.3156° E)
              </span>
            </div>
          </div>

          {/* Grid: Interactive Floor Plan + Leaflet Map */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <FloorPlan
              rooms={rooms}
              selectedRoomId={selectedRoomId}
              onSelectRoom={setSelectedRoomId}
            />

            {isClient && (
              <FloorPlanMap
                rooms={rooms}
                selectedRoomId={selectedRoomId}
                onSelectRoom={setSelectedRoomId}
              />
            )}
          </div>
        </div>
      )}

      {/* TAB 3: GRAF ANALISIS & PENJIMATAN (ANALYTICS) */}
      {activeTab === 'ANALYTICS' && (
        <div className="space-y-6 animate-fade-in">
          {/* Recharts Area Chart Component */}
          <SavingsChart rooms={rooms} savingsLogs={filteredLogs} />

          {/* Room-by-Room Savings Breakdown Table / Cards */}
          <div className="glass-panel rounded-3xl p-6 border border-slate-800/80 shadow-2xl space-y-5">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-800 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <Layers className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-base font-bold text-slate-100">
                    Pecahan Penjimatan &amp; Audit Mengikut Bilik
                  </h4>
                  <p className="text-xs text-slate-400">
                    Ringkasan data tenaga dijimatkan dan indeks kecekapan bagi setiap zon makmal
                  </p>
                </div>
              </div>

              <span className="text-xs font-mono text-slate-400 bg-slate-900 px-3 py-1 rounded-full border border-slate-800">
                {filteredLogs.length} Jumlah Entri Log
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {roomSavingsBreakdown.map(item => (
                <div
                  key={item.room.id}
                  onClick={() => setSelectedRoomId(item.room.id)}
                  className={`p-5 rounded-2xl border transition-all cursor-pointer ${
                    selectedRoomId?.toString() === item.room.id.toString()
                      ? 'bg-sapphire-500/10 border-sapphire-400 shadow-glow-sapphire'
                      : 'bg-slate-950/40 border-slate-800/80 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <span className="text-[10px] font-bold uppercase font-mono text-slate-400">
                        {item.room.category || 'LAB'}
                      </span>
                      <h5 className="font-bold text-sm text-slate-100 truncate">{item.room.name}</h5>
                    </div>
                    <span className="text-[10px] font-mono font-extrabold text-emerald-400 bg-emerald-500/15 px-2 py-0.5 rounded-full border border-emerald-500/30">
                      {item.efficiency}% Kecekapan
                    </span>
                  </div>

                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between text-slate-400">
                      <span>Tenaga Dijimatkan:</span>
                      <span className="font-mono text-emerald-400 font-bold">{item.kwhSaved.toFixed(3)} kWh</span>
                    </div>
                    <div className="flex justify-between text-slate-400">
                      <span>Wang Diselamatkan:</span>
                      <span className="font-mono text-emerald-300 font-bold">RM {item.rmSaved.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-slate-400">
                      <span>Tenaga Terbazir:</span>
                      <span className="font-mono text-rose-400 font-bold">{item.kwhWasted.toFixed(3)} kWh</span>
                    </div>
                    <div className="flex justify-between text-slate-400 pt-2 border-t border-slate-800/60 text-[11px]">
                      <span>Bilangan Sesi Audit:</span>
                      <span className="font-mono text-slate-200">{item.logCount} rekod</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: MAKMAL SIMULASI & KAWALAN (SIMULATOR_CONTROL) */}
      {activeTab === 'SIMULATOR_CONTROL' && (
        <div className="space-y-6 animate-fade-in">
          {/* Simulator Panel (Side-by-side Live Race & FYP Proof Engine) */}
          <SimulatorPanel
            rooms={rooms}
            selectedRoomId={selectedRoomId}
            onActionComplete={fetchData}
          />

          {/* Control Center Extra Grid: Switch Override & Hardware Management */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1">
              <OverrideControl room={selectedRoom} onRoomUpdated={handleRoomUpdated} />
            </div>

            <div className="lg:col-span-2 glass-panel rounded-3xl p-6 border border-slate-800/80 shadow-2xl space-y-5">
              <div className="flex items-center gap-3 border-b border-slate-800 pb-4">
                <div className="p-2.5 rounded-xl bg-sapphire-500/10 text-sapphire-400 border border-sapphire-500/20">
                  <Cpu className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-base font-bold text-slate-100">
                    Pusat Pengurusan Perkakasan &amp; Kad QR Makmal
                  </h4>
                  <p className="text-xs text-slate-400">
                    Akses pantas untuk mendaftar perkakasan fizikal baharu atau mencetak kod QR pintu
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <button
                  onClick={() => setRoomManagerOpen(true)}
                  className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 hover:border-sapphire-500/50 transition flex items-start gap-3.5 group text-left"
                >
                  <div className="p-3 rounded-xl bg-sapphire-500/10 text-sapphire-400 border border-sapphire-500/20 group-hover:scale-110 transition">
                    <Home className="w-5 h-5" />
                  </div>
                  <div>
                    <h5 className="font-bold text-sm text-slate-100 group-hover:text-sapphire-300 transition">
                      Pengurusan Bilik &amp; ESP32
                    </h5>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Tambah makmal baharu, tetapkan beban nominal watt, dan salin UUID firmware ESP32.
                    </p>
                  </div>
                </button>

                <button
                  onClick={() => setQrModalOpen(true)}
                  disabled={!selectedRoom}
                  className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 hover:border-teal-500/50 transition flex items-start gap-3.5 group text-left disabled:opacity-50"
                >
                  <div className="p-3 rounded-xl bg-teal-500/10 text-teal-400 border border-teal-500/20 group-hover:scale-110 transition">
                    <QrCode className="w-5 h-5" />
                  </div>
                  <div>
                    <h5 className="font-bold text-sm text-slate-100 group-hover:text-teal-300 transition">
                      Cetak Kad QR Pintu Makmal
                    </h5>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Jana kad pintu rasmi POLISAS beresolusi tinggi untuk imbasan telefon pensyarah.
                    </p>
                  </div>
                </button>
              </div>

              {/* Hardware Guide Note */}
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 text-xs text-slate-400 space-y-1">
                <p className="font-bold text-slate-300 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  Gandingan Mikropengawal ESP32:
                </p>
                <p className="leading-relaxed">
                  Bilik terpilih (<span className="text-emerald-400 font-bold">{selectedRoom?.name || 'Tiada'}</span>) mempunyai ID <code>{selectedRoom?.id}</code>. Masukkan UUID ini ke firmware <code>sceas_esp32.ino</code> untuk memulakan telemetri perkakasan sebenar.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
