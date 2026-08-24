import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '@/utils/supabase/client';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import {
  Building2,
  Clock,
  UserCheck,
  Power,
  PowerOff,
  LogOut,
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Bell,
  ArrowLeft,
  Lightbulb,
  Zap,
  BookOpen,
  Calendar,
  Radio
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
}

interface RoomBooking {
  id: string;
  room_id: string | number;
  lecturer_name: string;
  subject_code: string;
  start_time: string;
  end_time: string;
  status: 'ACTIVE' | 'COMPLETED' | 'EXPIRED';
  push_endpoint?: string;
  created_at: string;
}

const COURSE_PRESETS = [
  'DCC30123 Geomatics 2',
  'DCC20063 Engineering Mechanics',
  'DCC50232 Structural Analysis',
  'DCC10022 Civil Engineering Materials',
];

export default function LecturerBookingPage() {
  const router = useRouter();
  const { id } = router.query;

  const [room, setRoom] = useState<Room | null>(null);
  const [activeBooking, setActiveBooking] = useState<RoomBooking | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [lecturerName, setLecturerName] = useState('');
  const [subjectCode, setSubjectCode] = useState('DCC30123 Geomatics 2');
  const [durationHours, setDurationHours] = useState('2');

  const { isSupported, permission, requestPermission } = usePushNotifications();

  const fetchRoomAndBooking = useCallback(async (roomId: string) => {
    try {
      setLoading(true);
      const [roomRes, bookingRes] = await Promise.all([
        supabase.from('rooms').select('*').eq('id', roomId).single(),
        supabase
          .from('room_bookings')
          .select('*')
          .eq('room_id', roomId)
          .eq('status', 'ACTIVE')
          .order('created_at', { ascending: false })
          .limit(1),
      ]);

      if (roomRes.error) throw roomRes.error;
      if (roomRes.data) setRoom(roomRes.data as Room);

      if (bookingRes.data && bookingRes.data.length > 0) {
        setActiveBooking(bookingRes.data[0] as RoomBooking);
      } else {
        setActiveBooking(null);
      }
    } catch (err: any) {
      console.error('Error fetching room booking details:', err);
      setErrorMsg(err.message || 'Gagal memuatkan maklumat bilik.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (id && typeof id === 'string') {
      fetchRoomAndBooking(id);

      const channel = supabase
        .channel(`room-booking-${id}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'rooms', filter: `id=eq.${id}` },
          () => {
            fetchRoomAndBooking(id);
          }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'room_bookings', filter: `room_id=eq.${id}` },
          () => {
            fetchRoomAndBooking(id);
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [id, fetchRoomAndBooking]);

  const handleCheckIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!room) return;
    if (!lecturerName.trim()) {
      setErrorMsg('Sila masukkan nama pensyarah.');
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);

    try {
      if (isSupported && permission === 'default') {
        await requestPermission();
      }

      const hours = parseFloat(durationHours) || 2;
      const startTime = new Date();
      const endTime = new Date(startTime.getTime() + hours * 60 * 60 * 1000);

      const { data: newBooking, error: bookingErr } = await supabase
        .from('room_bookings')
        .insert([
          {
            room_id: room.id,
            lecturer_name: lecturerName.trim(),
            subject_code: subjectCode.trim(),
            start_time: startTime.toISOString(),
            end_time: endTime.toISOString(),
            status: 'ACTIVE',
          },
        ])
        .select()
        .single();

      if (bookingErr) throw bookingErr;

      await supabase
        .from('rooms')
        .update({ status: 'OCCUPIED', manual_override: false })
        .eq('id', room.id);

      await supabase.from('notifications').insert([
        {
          user_id: 'admin',
          title: `Sesi Makmal Dimulakan: ${room.name}`,
          message: `${lecturerName.trim()} memulakan sesi untuk kursus ${subjectCode.trim()} sehingga ${endTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.`,
          type: 'INFO',
          module: 'ENERGY',
          link: `/book/${room.id}`,
        },
      ]);

      setFeedback(
        `✅ Sesi berjaya didaftarkan! Lampu diaktifkan sehingga ${endTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.`
      );
      setActiveBooking(newBooking as RoomBooking);
    } catch (err: any) {
      console.error('Check-in error:', err);
      setErrorMsg(err.message || 'Gagal mendaftar masuk sesi.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCheckOut = async () => {
    if (!room || !activeBooking) return;
    if (!confirm('Adakah anda pasti mahu menamatkan sesi makmal ini dan menutup suis lampu?')) return;

    setSubmitting(true);
    try {
      await supabase
        .from('room_bookings')
        .update({ status: 'COMPLETED' })
        .eq('id', activeBooking.id);

      await supabase
        .from('rooms')
        .update({ status: 'VACANT', manual_override: false })
        .eq('id', room.id);

      await supabase.from('notifications').insert([
        {
          user_id: 'admin',
          title: `Sesi Makmal Ditamatkan: ${room.name}`,
          message: `${activeBooking.lecturer_name} telah mendaftar keluar sesi bagi kursus ${activeBooking.subject_code}. Suis dipadamkan.`,
          type: 'SAVINGS',
          module: 'ENERGY',
          link: `/logs`,
        },
      ]);

      setActiveBooking(null);
      setFeedback('✅ Sesi makmal tamat dengan jayanya. Lampu dipadamkan dan penjimatan tenaga direkodkan.');
    } catch (err: any) {
      console.error('Check-out error:', err);
      setErrorMsg(err.message || 'Gagal mendaftar keluar.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleLight = async (turnOn: boolean) => {
    if (!room) return;
    setSubmitting(true);
    try {
      await supabase
        .from('rooms')
        .update({ status: turnOn ? 'OCCUPIED' : 'VACANT', manual_override: true })
        .eq('id', room.id);

      setFeedback(turnOn ? '💡 Lampu dihidupkan (Force ON)' : '🌙 Lampu dipadamkan (Force OFF)');
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal menukar suis lampu.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="py-20 flex flex-col items-center justify-center p-4">
        <Loader2 className="w-8 h-8 text-sapphire-400 animate-spin mb-3" />
        <p className="text-xs font-mono text-slate-400">Memuatkan maklumat pintu makmal POLISAS...</p>
      </div>
    );
  }

  if (!room) {
    return (
      <div className="py-20 flex flex-col items-center justify-center p-6 text-center max-w-md mx-auto">
        <div className="p-4 rounded-3xl bg-rose-500/10 text-rose-400 border border-rose-500/20 mb-4">
          <AlertTriangle className="w-10 h-10" />
        </div>
        <h2 className="text-xl font-extrabold text-slate-100 mb-1">Makmal Tidak Ditemui</h2>
        <p className="text-xs text-slate-400 mb-6">
          Kod QR ini mungkin tidak sah atau rekod bilik telah dipadamkan daripada pangkalan data.
        </p>
        <Link
          href="/scan"
          className="px-5 py-2.5 rounded-2xl bg-sapphire-500 text-white font-bold text-xs shadow-glow-sapphire"
        >
          Lihat Direktori Makmal Lain
        </Link>
      </div>
    );
  }

  const isHardwareOnline = room.last_heartbeat
    ? Date.now() - new Date(room.last_heartbeat).getTime() < 15000
    : false;

  return (
    <div className="max-w-xl mx-auto space-y-6 pb-12">
      {/* Top Header & Breadcrumb */}
      <div className="flex items-center justify-between">
        <Link
          href="/scan"
          className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-sapphire-300 transition"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Direktori Makmal</span>
        </Link>

        <span className="text-[10px] font-extrabold uppercase font-mono px-3 py-1 rounded-full bg-sapphire-500/15 text-sapphire-300 border border-sapphire-500/30">
          POLISAS SEMAMBU • KOD QR PINTU
        </span>
      </div>

      {/* Room Header Card - Slate Modern Style */}
      <div className="glass-panel p-6 rounded-3xl border border-slate-800/80 shadow-card-slate space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-bold text-sapphire-400 uppercase tracking-wider">
            <Building2 className="w-4 h-4" />
            <span>{room.category || 'MAKMAL JABATAN'}</span>
          </div>

          <span
            className={`px-3 py-1 rounded-full text-[10px] font-mono font-bold border ${
              isHardwareOnline
                ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                : 'bg-slate-900 text-slate-500 border-slate-800'
            }`}
          >
            {isHardwareOnline ? '⚡ ESP32 AKTIF' : '⚪ ESP32 OFFLINE'}
          </span>
        </div>

        <div>
          <h2 className="text-2xl font-extrabold text-slate-100 tracking-tight">{room.name}</h2>
          <p className="text-xs text-slate-400 mt-1 flex items-center gap-2">
            <span>Beban Nominal: <strong className="text-slate-200 font-mono">{room.nominal_power} W</strong></span>
            <span>•</span>
            <span className="font-mono text-slate-500">ID: {room.id}</span>
          </p>
        </div>

        <div className="flex items-center justify-between text-xs pt-3 border-t border-slate-800/80">
          <span className="text-slate-400">Status Semasa:</span>
          <span
            className={`font-mono font-extrabold uppercase px-3 py-1 rounded-full text-[10px] border ${
              room.status === 'OCCUPIED'
                ? 'bg-rose-500/15 text-rose-400 border-rose-500/30 shadow-[0_0_10px_rgba(244,63,94,0.2)]'
                : 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
            }`}
          >
            {room.status === 'OCCUPIED' ? '🔴 LAMPU MENYALA (OCCUPIED)' : '🟢 LAMPU PADAM (STANDBY)'}
          </span>
        </div>
      </div>

      {/* Feedback / Error Alerts */}
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

      {/* If Active Booking Exists */}
      {activeBooking ? (
        <div className="glass-panel p-6 sm:p-7 rounded-3xl border border-emerald-500/30 shadow-[0_0_30px_rgba(16,185,129,0.1)] space-y-5 animate-fade-in">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3.5">
            <div className="flex items-center gap-2.5 text-emerald-400">
              <Sparkles className="w-5 h-5" />
              <h3 className="text-sm font-extrabold">Sesi Makmal Sedang Berlangsung</h3>
            </div>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              SESI AKTIF
            </span>
          </div>

          <div className="space-y-3 text-xs">
            <div className="flex justify-between items-center py-1.5 border-b border-slate-800/60">
              <span className="text-slate-400">Pensyarah Bertanggungjawab:</span>
              <span className="font-extrabold text-slate-100 text-sm">{activeBooking.lecturer_name}</span>
            </div>
            <div className="flex justify-between items-center py-1.5 border-b border-slate-800/60">
              <span className="text-slate-400">Kursus / Subjek:</span>
              <span className="font-bold text-emerald-400 font-mono">{activeBooking.subject_code}</span>
            </div>
            <div className="flex justify-between items-center py-1.5">
              <span className="text-slate-400">Masa Tamat Sesi:</span>
              <span className="font-mono font-bold text-slate-100">
                {new Date(activeBooking.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          </div>

          {/* Quick Actions for Lecturer */}
          <div className="space-y-3 pt-2">
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => handleToggleLight(true)}
                disabled={submitting}
                className="px-4 py-2.5 rounded-2xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-300 font-bold text-xs flex items-center justify-center gap-2 transition disabled:opacity-50"
              >
                <Power className="w-4 h-4 text-rose-400" />
                <span>Buka Lampu</span>
              </button>

              <button
                onClick={() => handleToggleLight(false)}
                disabled={submitting}
                className="px-4 py-2.5 rounded-2xl bg-slate-900 hover:bg-slate-800 border border-slate-750 text-slate-300 font-bold text-xs flex items-center justify-center gap-2 transition disabled:opacity-50"
              >
                <PowerOff className="w-4 h-4 text-slate-400" />
                <span>Tutup Lampu</span>
              </button>
            </div>

            <button
              onClick={handleCheckOut}
              disabled={submitting}
              className="w-full px-4 py-3.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-xs transition shadow-[0_0_20px_rgba(16,185,129,0.3)] flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {submitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <LogOut className="w-4 h-4" />
              )}
              <span>🛑 Tamat Sesi &amp; Serah Makmal (Check-Out)</span>
            </button>
          </div>
        </div>
      ) : (
        /* Check-In Form for Lecturer */
        <form
          onSubmit={handleCheckIn}
          className="glass-panel p-6 sm:p-7 rounded-3xl border border-slate-800/80 shadow-card-slate space-y-4 animate-fade-in"
        >
          <div className="flex items-center gap-2.5 text-sapphire-400 mb-1">
            <UserCheck className="w-5 h-5" />
            <h3 className="text-base font-extrabold text-slate-100">Daftar Masuk Sesi Pensyarah</h3>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            Imbasan kod QR pintu selesai. Sila masukkan nama dan tempoh sesi untuk mengaktifkan suis lampu makmal secara automatik.
          </p>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
              Nama Pensyarah Bertanggungjawab
            </label>
            <input
              type="text"
              value={lecturerName}
              onChange={(e) => setLecturerName(e.target.value)}
              placeholder="contoh: Dr. Dania / Pn. Aisyah"
              required
              className="w-full px-4 py-2.5 rounded-xl bg-slate-950/80 border border-slate-800 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-sapphire-500 transition shadow-inner"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
              Kod Kursus / Nama Amali
            </label>
            <input
              type="text"
              value={subjectCode}
              onChange={(e) => setSubjectCode(e.target.value)}
              placeholder="contoh: DCC30123 Geomatics 2"
              required
              className="w-full px-4 py-2.5 rounded-xl bg-slate-950/80 border border-slate-800 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-sapphire-500 transition shadow-inner"
            />

            {/* Quick Presets */}
            <div className="flex flex-wrap gap-1.5 pt-2">
              {COURSE_PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setSubjectCode(preset)}
                  className={`px-2 py-0.5 rounded-lg text-[10px] font-mono border transition ${
                    subjectCode === preset
                      ? 'bg-sapphire-500/20 text-sapphire-300 border-sapphire-500/40 font-bold'
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
              Tempoh Masa Sesi
            </label>
            <div className="grid grid-cols-4 gap-2">
              {['1', '2', '3', '4'].map((h) => (
                <button
                  key={h}
                  type="button"
                  onClick={() => setDurationHours(h)}
                  className={`py-2.5 rounded-xl text-xs font-bold border transition ${
                    durationHours === h
                      ? 'bg-sapphire-500/20 border-sapphire-500 text-sapphire-300 shadow-sm font-extrabold'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  {h} Jam
                </button>
              ))}
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full mt-2 px-5 py-3.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-xs transition shadow-[0_0_25px_rgba(16,185,129,0.3)] flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {submitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Power className="w-4 h-4" />
            )}
            <span>🚀 Daftar Masuk Sesi &amp; Buka Lampu</span>
          </button>
        </form>
      )}

      {/* Footer */}
      <div className="text-center text-[10px] text-slate-500 font-mono">
        SCEAS POLISAS SMART AUTOMATION • SEMAMBU KUANTAN
      </div>
    </div>
  );
}
