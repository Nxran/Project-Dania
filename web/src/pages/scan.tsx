import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '@/utils/supabase/client';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import {
  Building2,
  Search,
  CheckCircle2,
  Clock,
  UserCheck,
  Zap,
  ArrowRight,
  ShieldCheck,
  Loader2,
  ArrowLeft,
  Sparkles,
  QrCode,
  Power,
  PowerOff,
  LogOut,
  X,
  Plus,
  AlertTriangle,
  Lightbulb,
  Cpu,
  BookOpen,
  Activity,
  Calendar,
  Layers
} from 'lucide-react';
import Link from 'next/link';

interface Room {
  id: string | number;
  name: string;
  status: 'OCCUPIED' | 'VACANT';
  manual_override: boolean;
  nominal_power: number;
  category?: string;
  last_heartbeat?: string;
  wiring_type?: string;
}

interface RoomBooking {
  id: string;
  room_id: string | number;
  lecturer_name: string;
  subject_code: string;
  start_time: string;
  end_time: string;
  status: 'ACTIVE' | 'COMPLETED';
}

const COURSE_PRESETS = [
  'DCC30123 Geomatics 2',
  'DCC20063 Engineering Mechanics',
  'DCC50232 Structural Analysis',
  'DCC10022 Civil Engineering Materials',
  'DCC40152 Highway Engineering Lab',
  'DCC30093 Fluid Mechanics Lab',
];

export default function LabAvailabilityDirectoryPage() {
  const router = useRouter();
  const { room: initialRoomId } = router.query;

  const [rooms, setRooms] = useState<Room[]>([]);
  const [bookings, setBookings] = useState<RoomBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTab, setFilterTab] = useState<'ALL' | 'AVAILABLE' | 'OCCUPIED'>('ALL');

  // Interactive Booking Modal States
  const [selectedRoomToBook, setSelectedRoomToBook] = useState<Room | null>(null);
  const [lecturerName, setLecturerName] = useState('');
  const [subjectCode, setSubjectCode] = useState('DCC30123 Geomatics 2');
  const [durationHours, setDurationHours] = useState('2');
  const [bookingSubmitting, setBookingSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const { isSupported, permission, requestPermission } = usePushNotifications();

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [roomsRes, bookingsRes] = await Promise.all([
        supabase.from('rooms').select('*').order('name', { ascending: true }),
        supabase.from('room_bookings').select('*').eq('status', 'ACTIVE'),
      ]);

      if (roomsRes.error) throw roomsRes.error;
      if (roomsRes.data) {
        setRooms(roomsRes.data as Room[]);
      }
      if (bookingsRes.data) setBookings(bookingsRes.data as RoomBooking[]);
    } catch (err) {
      console.error('Error loading lab directory:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();

    const channel = supabase
      .channel('scan-directory-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rooms' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'room_bookings' }, () => fetchData())
      .subscribe();

    const timer = setInterval(fetchData, 4000);
    return () => {
      clearInterval(timer);
      supabase.removeChannel(channel);
    };
  }, [fetchData]);

  // Auto-open modal if ?room= query param is passed
  useEffect(() => {
    if (initialRoomId && rooms.length > 0) {
      const matched = rooms.find((r) => r.id.toString() === initialRoomId.toString());
      if (matched) {
        setSelectedRoomToBook(matched);
      }
    }
  }, [initialRoomId, rooms]);

  const showToast = (msg: string, isError = false) => {
    if (isError) {
      setErrorMsg(msg);
      setTimeout(() => setErrorMsg(null), 5000);
    } else {
      setFeedback(msg);
      setTimeout(() => setFeedback(null), 4500);
    }
  };

  const availableRooms = useMemo(() => rooms.filter((r) => r.status === 'VACANT'), [rooms]);
  const occupiedRooms = useMemo(() => rooms.filter((r) => r.status === 'OCCUPIED'), [rooms]);

  const filteredRooms = useMemo(() => {
    return rooms.filter((r) => {
      const matchesSearch =
        r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (r.category && r.category.toLowerCase().includes(searchQuery.toLowerCase()));

      if (filterTab === 'AVAILABLE') return matchesSearch && r.status === 'VACANT';
      if (filterTab === 'OCCUPIED') return matchesSearch && r.status === 'OCCUPIED';
      return matchesSearch;
    });
  }, [rooms, searchQuery, filterTab]);

  const getBookingForRoom = (roomId: string | number) => {
    return bookings.find((b) => b.room_id.toString() === roomId.toString());
  };

  // Submit Booking & Activate Room
  const handleConfirmBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRoomToBook) return;
    if (!lecturerName.trim()) {
      showToast('Sila masukkan nama pensyarah.', true);
      return;
    }

    setBookingSubmitting(true);
    try {
      if (isSupported && permission === 'default') {
        await requestPermission();
      }

      const hours = parseFloat(durationHours) || 2;
      const startTime = new Date();
      const endTime = new Date(startTime.getTime() + hours * 60 * 60 * 1000);

      // 1. Insert active booking record
      const { error: bookingErr } = await supabase.from('room_bookings').insert([
        {
          room_id: selectedRoomToBook.id,
          lecturer_name: lecturerName.trim(),
          subject_code: subjectCode.trim(),
          start_time: startTime.toISOString(),
          end_time: endTime.toISOString(),
          status: 'ACTIVE',
        },
      ]);
      if (bookingErr) throw bookingErr;

      // 2. Turn on lights (status = OCCUPIED)
      await supabase
        .from('rooms')
        .update({ status: 'OCCUPIED', manual_override: false })
        .eq('id', selectedRoomToBook.id);

      // 3. Create In-App Notification
      await supabase.from('notifications').insert([
        {
          user_id: 'admin',
          title: `Sesi Makmal Ditempah: ${selectedRoomToBook.name}`,
          message: `${lecturerName.trim()} telah menempah makmal untuk kursus ${subjectCode.trim()} sehingga ${endTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}. Lampu diaktifkan secara automatik.`,
          type: 'INFO',
          module: 'ENERGY',
          link: `/book/${selectedRoomToBook.id}`,
        },
      ]);

      showToast(
        `🎉 Tempahan Berjaya! ${selectedRoomToBook.name} telah diaktifkan untuk ${lecturerName.trim()} sehingga ${endTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.`
      );
      setSelectedRoomToBook(null);
      setLecturerName('');
      fetchData();
    } catch (err: any) {
      showToast(`❌ Ralat: ${err.message}`, true);
    } finally {
      setBookingSubmitting(false);
    }
  };

  // Check out / End session directly from directory
  const handleCheckOutSession = async (roomId: string | number, bookingId: string, roomName: string) => {
    if (!confirm(`Adakah anda pasti mahu menamatkan sesi bagi ${roomName} dan memadamkan lampu?`)) return;
    try {
      await supabase.from('room_bookings').update({ status: 'COMPLETED' }).eq('id', bookingId);
      await supabase.from('rooms').update({ status: 'VACANT', manual_override: false }).eq('id', roomId);

      await supabase.from('notifications').insert([
        {
          user_id: 'admin',
          title: `Sesi Makmal Tamat: ${roomName}`,
          message: `Sesi makmal telah ditamatkan. Suis lampu dipadamkan secara automatik & penjimatan tenaga direkodkan.`,
          type: 'SAVINGS',
          module: 'ENERGY',
          link: `/logs`,
        },
      ]);

      showToast(`✅ Sesi ${roomName} ditamatkan. Lampu dipadamkan & penjimatan tenaga direkodkan.`);
      fetchData();
    } catch (err: any) {
      showToast(`❌ Ralat: ${err.message}`, true);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-10">
      {/* Top Hero Banner - Slate Modern & Deep Blue Style */}
      <div className="glass-panel p-6 sm:p-7 rounded-3xl border border-slate-800/80 shadow-card-slate relative overflow-hidden space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div className="flex items-center gap-2.5 text-sapphire-400 text-xs font-bold uppercase tracking-wider">
            <div className="p-2 rounded-xl bg-sapphire-500/10 border border-sapphire-500/20 text-sapphire-400">
              <Building2 className="w-4 h-4" />
            </div>
            <span>Direktori Makmal &amp; Hab Tempahan Sesi Pensyarah</span>
          </div>

          <span className="text-[10px] font-extrabold uppercase font-mono px-3 py-1 rounded-full bg-sapphire-500/15 text-sapphire-300 border border-sapphire-500/30">
            POLISAS SEMAMBU • KAWALAN PINTAR
          </span>
        </div>

        <div className="max-w-3xl">
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-100">
            Ketersediaan Makmal &amp; Tempahan Sesi Pantas
          </h1>
          <p className="text-xs text-slate-400 mt-2 leading-relaxed">
            Semak makmal yang sedang kosong atau diduduki secara langsung. Pensyarah boleh memilih makmal dan mengaktifkan bekalan kuasa lampu terus dari hab ini tanpa perlu suis fizikal manual.
          </p>
        </div>

        {/* Quick KPI Summary Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5 pt-2">
          <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800/80 hover:border-emerald-500/30 transition">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
              Makmal Kosong (Sedia)
            </span>
            <div className="text-2xl font-black text-emerald-400 font-mono mt-1">
              {availableRooms.length}{' '}
              <span className="text-xs text-slate-400 font-sans font-normal">Makmal</span>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800/80 hover:border-rose-500/30 transition">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
              Sedang Digunakan
            </span>
            <div className="text-2xl font-black text-rose-400 font-mono mt-1">
              {occupiedRooms.length}{' '}
              <span className="text-xs text-slate-400 font-sans font-normal">Sesi</span>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800/80 col-span-2 sm:col-span-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
              Jumlah Makmal Berdaftar
            </span>
            <div className="text-2xl font-black text-slate-200 font-mono mt-1">
              {rooms.length}{' '}
              <span className="text-xs text-slate-400 font-sans font-normal">Bilik</span>
            </div>
          </div>
        </div>
      </div>

      {/* Toast Alerts */}
      {feedback && (
        <div className="p-4 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-semibold flex items-center gap-3 animate-fade-in shadow-lg">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <span>{feedback}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-4 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs font-semibold flex items-center gap-3 animate-fade-in shadow-lg">
          <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Filter Tabs & Search Bar */}
      <div className="glass-panel p-4 rounded-3xl border border-slate-800/80 shadow-card-slate flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        <div className="flex items-center p-1 rounded-2xl bg-slate-950/80 border border-slate-800 text-xs font-bold font-mono">
          <button
            onClick={() => setFilterTab('ALL')}
            className={`px-3.5 py-1.5 rounded-xl transition ${
              filterTab === 'ALL'
                ? 'bg-sapphire-500 text-white shadow-sm font-extrabold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Semua ({rooms.length})
          </button>
          <button
            onClick={() => setFilterTab('AVAILABLE')}
            className={`px-3.5 py-1.5 rounded-xl transition ${
              filterTab === 'AVAILABLE'
                ? 'bg-emerald-500 text-slate-950 shadow-sm font-extrabold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            🟢 Kosong ({availableRooms.length})
          </button>
          <button
            onClick={() => setFilterTab('OCCUPIED')}
            className={`px-3.5 py-1.5 rounded-xl transition ${
              filterTab === 'OCCUPIED'
                ? 'bg-rose-500 text-white shadow-sm font-extrabold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            🔴 Digunakan ({occupiedRooms.length})
          </button>
        </div>

        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari makmal... (cth: Fotogrametri, Kartografi, CAD)"
            className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-slate-950/80 border border-slate-800 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-sapphire-500 transition"
          />
        </div>
      </div>

      {/* Loading Spinner */}
      {loading && (
        <div className="py-16 text-center text-slate-400 flex flex-col items-center justify-center">
          <Loader2 className="w-8 h-8 text-sapphire-400 animate-spin mb-3" />
          <p className="text-xs font-mono">Mengemaskini direktori makmal POLISAS...</p>
        </div>
      )}

      {/* Lab Directory Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredRooms.map((room) => {
          const isOccupied = room.status === 'OCCUPIED';
          const booking = getBookingForRoom(room.id);
          const isHardwareOnline = room.last_heartbeat
            ? Date.now() - new Date(room.last_heartbeat).getTime() < 15000
            : false;

          return (
            <div
              key={room.id}
              className={`p-6 rounded-3xl border transition-all duration-200 flex flex-col justify-between space-y-5 shadow-card-slate group relative overflow-hidden ${
                isOccupied
                  ? 'bg-slate-950/70 border-rose-500/30 hover:border-rose-500/50'
                  : 'bg-slate-950/50 border-slate-800/80 hover:border-emerald-500/50 hover:bg-slate-900/60'
              }`}
            >
              <div className="space-y-3">
                {/* Header tags */}
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={`text-[10px] font-extrabold uppercase font-mono px-3 py-1 rounded-full border inline-flex items-center gap-1.5 ${
                      isOccupied
                        ? 'bg-rose-500/15 text-rose-400 border-rose-500/30'
                        : 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                    }`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${isOccupied ? 'bg-rose-400 animate-pulse' : 'bg-emerald-400'}`} />
                    {isOccupied ? '🔴 SEDANG DIGUNAKAN' : '🟢 KOSONG & SEDIA'}
                  </span>

                  <span
                    className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-lg border ${
                      isHardwareOnline
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                        : 'bg-slate-900 text-slate-500 border-slate-800'
                    }`}
                  >
                    {isHardwareOnline ? '⚡ ESP32 AKTIF' : '⚪ OFFLINE'}
                  </span>
                </div>

                {/* Lab Title */}
                <div>
                  <span className="text-[10px] uppercase font-mono text-slate-500 font-bold block tracking-wider">
                    {room.category || 'MAKMAL JABATAN'}
                  </span>
                  <h3 className="text-lg font-extrabold text-slate-100 mt-0.5 tracking-tight group-hover:text-sapphire-300 transition">
                    {room.name}
                  </h3>
                </div>

                <div className="flex items-center gap-3 text-xs text-slate-400 pt-1">
                  <span className="flex items-center gap-1 font-mono">
                    <Lightbulb className="w-3.5 h-3.5 text-amber-400" />
                    {room.nominal_power} W
                  </span>
                  <span>•</span>
                  <span className="text-[11px] text-slate-400 font-mono">
                    ID: #{room.id.toString().slice(0, 6)}
                  </span>
                </div>

                {/* If Occupied: Show Current Lecturer & Session Details */}
                {isOccupied && (
                  <div className="p-3.5 rounded-2xl bg-rose-950/25 border border-rose-500/20 text-xs space-y-1.5 text-slate-300">
                    {booking ? (
                      <>
                        <div className="flex items-center justify-between">
                          <span className="text-rose-400 font-bold flex items-center gap-1.5">
                            <UserCheck className="w-4 h-4" />
                            {booking.lecturer_name}
                          </span>
                          <span className="font-mono text-[10px] text-slate-400">
                            Sehingga {new Date(booking.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 font-mono">Kursus: {booking.subject_code}</p>
                      </>
                    ) : (
                      <p className="text-[11px] text-slate-400 flex items-center gap-1">
                        <Zap className="w-3.5 h-3.5 text-rose-400" />
                        Lampu dihidupkan melalui suis kawalan override.
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Card Action Buttons */}
              <div className="pt-2">
                {!isOccupied ? (
                  <button
                    onClick={() => setSelectedRoomToBook(room)}
                    className="w-full px-4 py-3 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-xs transition shadow-[0_0_20px_rgba(16,185,129,0.25)] flex items-center justify-center gap-2 group/btn"
                  >
                    <Sparkles className="w-4 h-4 transition-transform group-hover/btn:rotate-12" />
                    <span>Pilih Bilik Ini &amp; Tempah Sesi</span>
                    <ArrowRight className="w-4 h-4 transition-transform group-hover/btn:translate-x-1" />
                  </button>
                ) : (
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/book/${room.id}`}
                      className="flex-1 px-3.5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 hover:text-white font-bold text-xs transition flex items-center justify-center gap-1.5"
                    >
                      <BookOpen className="w-3.5 h-3.5 text-sapphire-400" />
                      <span>Halaman Sesi</span>
                    </Link>

                    {booking && (
                      <button
                        onClick={() => handleCheckOutSession(room.id, booking.id, room.name)}
                        className="px-3.5 py-2.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-300 font-bold text-xs transition flex items-center gap-1.5"
                        title="Tamat Sesi & Padamkan Lampu"
                      >
                        <LogOut className="w-3.5 h-3.5" />
                        <span>Tamat Sesi</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* INTERACTIVE BOOKING MODAL */}
      {selectedRoomToBook && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
          <div className="relative w-full max-w-lg overflow-hidden rounded-3xl bg-slate-900 border border-emerald-500/40 shadow-2xl text-slate-100 p-6 sm:p-7 space-y-5">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.2)]">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-100">Tempah Sesi Makmal Pintar</h3>
                  <p className="text-xs text-emerald-400 font-bold font-mono">{selectedRoomToBook.name}</p>
                </div>
              </div>

              <button
                onClick={() => setSelectedRoomToBook(null)}
                className="p-2 text-slate-400 hover:text-slate-100 rounded-full hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Booking Form */}
            <form onSubmit={handleConfirmBooking} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                  Nama Pensyarah Bertanggungjawab
                </label>
                <input
                  type="text"
                  value={lecturerName}
                  onChange={(e) => setLecturerName(e.target.value)}
                  placeholder="contoh: Dr. Dania / Pn. Aisyah / En. Razak"
                  required
                  autoFocus
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-750 text-xs text-slate-100 focus:outline-none focus:border-emerald-500 transition shadow-inner"
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">
                    Kod Kursus / Nama Amali
                  </label>
                  <span className="text-[10px] text-slate-500 font-mono">Pilih preset atau taip kod</span>
                </div>
                <input
                  type="text"
                  value={subjectCode}
                  onChange={(e) => setSubjectCode(e.target.value)}
                  placeholder="contoh: DCC30123 Geomatics 2"
                  required
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-750 text-xs text-slate-100 focus:outline-none focus:border-emerald-500 transition shadow-inner"
                />

                {/* Preset Subject Buttons */}
                <div className="flex flex-wrap gap-1.5 pt-2">
                  {COURSE_PRESETS.slice(0, 4).map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setSubjectCode(preset)}
                      className={`px-2 py-0.5 rounded-lg text-[10px] font-mono border transition ${
                        subjectCode === preset
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 font-bold'
                          : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200'
                      }`}
                    >
                      {preset.split(' ')[0]}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                  Pilih Tempoh Masa Penggunaan
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {['1', '2', '3', '4'].map((h) => (
                    <button
                      key={h}
                      type="button"
                      onClick={() => setDurationHours(h)}
                      className={`py-2.5 rounded-xl text-xs font-bold border transition ${
                        durationHours === h
                          ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400 shadow-sm font-extrabold'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      {h} Jam
                    </button>
                  ))}
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 text-[11px] text-slate-400 space-y-1.5">
                <p className="flex items-center gap-1.5 text-emerald-400 font-bold">
                  <ShieldCheck className="w-4 h-4" />
                  Automasi Dwi-Kawalan SCEAS:
                </p>
                <p className="leading-relaxed">
                  Lampu makmal akan <strong>dihidupkan serta-merta</strong> dan amaran notifikasi push akan dihantar ke telefon anda sekiranya lampu dibiarkan menyala selepas sesi tamat.
                </p>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedRoomToBook(null)}
                  className="flex-1 py-3 rounded-2xl bg-slate-800 hover:bg-slate-750 text-slate-300 font-bold text-xs transition"
                >
                  Batal
                </button>

                <button
                  type="submit"
                  disabled={bookingSubmitting}
                  className="flex-1 py-3 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-xs transition shadow-[0_0_20px_rgba(16,185,129,0.3)] flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {bookingSubmitting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Power className="w-4 h-4" />
                  )}
                  <span>Sahkan Tempahan &amp; Buka Suis</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="text-center text-[10px] text-slate-500 font-mono pt-4">
        SCEAS POLISAS SMART CAMPUS AUTOMATION • JABATAN KEJURUTERAAN AWAM SEMAMBU
      </div>
    </div>
  );
}
