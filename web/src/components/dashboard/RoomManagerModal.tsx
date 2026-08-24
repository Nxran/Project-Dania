import React, { useState } from 'react';
import {
  Plus,
  Trash2,
  Edit2,
  X,
  Copy,
  CheckCheck,
  Loader2,
  Home,
  Cpu,
  Lightbulb,
  Sparkles,
  QrCode,
  Building2,
  ShieldCheck,
  ExternalLink,
  Zap,
  Info
} from 'lucide-react';
import { supabase } from '@/utils/supabase/client';
import Link from 'next/link';

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

interface RoomManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  rooms: Room[];
  onRoomsChanged: () => void;
}

const ROOM_CATEGORIES = [
  { value: 'LAB', label: 'Makmal Komputer / Makmal Sains (LAB)' },
  { value: 'LECTURE_HALL', label: 'Dewan Kuliah Utama (DK)' },
  { value: 'CLASSROOM', label: 'Bilik Kuliah / Bilik Teori (BK)' },
  { value: 'WORKSHOP', label: 'Bengkel Kejuruteraan Elektrik / Awam' },
  { value: 'OFFICE', label: 'Pejabat Pensyarah / Pentadbiran' },
  { value: 'SERVER_ROOM', label: 'Bilik Server / Hab IoT Pintar' },
  { value: 'CORRIDOR', label: 'Laluan / Koridor Bangunan' },
];

export default function RoomManagerModal({ isOpen, onClose, rooms, onRoomsChanged }: RoomManagerModalProps) {
  const [editingRoomId, setEditingRoomId] = useState<string | number | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [nominalPower, setNominalPower] = useState('1200');
  const [category, setCategory] = useState('LAB');

  if (!isOpen) return null;

  const handleStartAdd = () => {
    setEditingRoomId('NEW');
    setName('');
    setNominalPower('1200');
    setCategory('LAB');
    setErrorMsg(null);
  };

  const handleStartEdit = (room: Room) => {
    setEditingRoomId(room.id);
    setName(room.name);
    setNominalPower(room.nominal_power.toString());
    setCategory(room.category || 'LAB');
    setErrorMsg(null);
  };

  const handleCancelForm = () => {
    setEditingRoomId(null);
    setErrorMsg(null);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMsg('Sila masukkan nama bilik / makmal.');
      return;
    }
    const powerNum = parseFloat(nominalPower);
    if (isNaN(powerNum) || powerNum <= 0) {
      setErrorMsg('Sila masukkan nilai beban kuasa (Watt) yang sah.');
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    try {
      if (editingRoomId === 'NEW') {
        const { error } = await supabase.from('rooms').insert([
          {
            name: name.trim(),
            nominal_power: powerNum,
            category: category,
            status: 'VACANT',
            manual_override: false,
          },
        ]);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('rooms')
          .update({
            name: name.trim(),
            nominal_power: powerNum,
            category: category,
          })
          .eq('id', editingRoomId);
        if (error) throw error;
      }

      onRoomsChanged();
      setEditingRoomId(null);
    } catch (err: any) {
      console.error('Error saving room:', err);
      setErrorMsg(err.message || 'Gagal menyimpan rekod bilik.');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string | number, roomName: string) => {
    if (!confirm(`Adakah anda pasti mahu memadam makmal/bilik "${roomName}"? Rekod yang dipadam tidak boleh dikembalikan.`)) return;
    setLoading(true);
    try {
      const { error } = await supabase.from('rooms').delete().eq('id', id);
      if (error) throw error;
      onRoomsChanged();
    } catch (err: any) {
      console.error('Error deleting room:', err);
      alert('Gagal memadam bilik: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const copyRoomId = (id: string | number) => {
    navigator.clipboard.writeText(id.toString());
    setCopiedId(id.toString());
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl animate-fade-in">
      <div className="relative w-full max-w-3xl max-h-[90vh] flex flex-col rounded-3xl bg-slate-900 border border-slate-800/90 shadow-2xl text-slate-100 overflow-hidden">
        {/* Header with POLISAS branding */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-800/80 bg-slate-950/80">
          <div className="flex items-center gap-3.5">
            <div className="p-2.5 rounded-2xl bg-sapphire-500/10 border border-sapphire-500/25 text-sapphire-400">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-extrabold uppercase tracking-widest text-emerald-400 font-mono">
                  POLISAS • SCEAS v2.0
                </span>
                <span className="bg-sapphire-500/20 text-sapphire-300 text-[10px] font-bold px-2 py-0.5 rounded-full font-mono">
                  {rooms.length} Bilik
                </span>
              </div>
              <h3 className="text-lg font-bold text-slate-100 mt-0.5">
                Pengurusan Bilik &amp; Gandingan ESP32
              </h3>
              <p className="text-xs text-slate-400">
                Urus profil makmal kampus, beban kuasa nominal, dan kunci UUID mikropengawal.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-100 rounded-2xl hover:bg-slate-800/80 transition"
            title="Tutup Modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Add / Edit Form Modal Segment */}
          {editingRoomId ? (
            <form onSubmit={handleSave} className="p-5 sm:p-6 rounded-2xl bg-slate-950/70 border border-sapphire-500/30 space-y-4 shadow-xl">
              <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
                <h4 className="text-sm font-bold text-sapphire-300 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-sapphire-400" />
                  {editingRoomId === 'NEW' ? 'Tambah Bilik / Makmal Baharu' : 'Kemaskini Maklumat Bilik'}
                </h4>
                <span className="text-xs text-slate-400 font-mono">
                  {editingRoomId === 'NEW' ? 'ID akan dijana secara automatik (UUID)' : `ID: ${editingRoomId.toString().slice(0, 8)}...`}
                </span>
              </div>

              {errorMsg && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-semibold">
                  {errorMsg}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                    Nama Makmal / Bilik Kuliah
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="cth: Makmal Fotogrametri (BK-01), Bengkel Elektrik B"
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-sm text-slate-100 placeholder-slate-500 focus:border-sapphire-500 focus:outline-none transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                    Beban Kuasa Nominal (Watt)
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      value={nominalPower}
                      onChange={(e) => setNominalPower(e.target.value)}
                      placeholder="1200"
                      className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-sm font-mono text-slate-100 focus:border-sapphire-500 focus:outline-none transition"
                    />
                    <span className="absolute right-3.5 top-2.5 text-xs text-slate-400 font-mono">W</span>
                  </div>
                  <p className="text-[10px] text-slate-500 mt-1">Digunakan untuk anggaran penjimatan kWj &amp; kos RM.</p>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                    Kategori / Jenis Zon
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-sm text-slate-100 focus:border-sapphire-500 focus:outline-none transition"
                  >
                    {ROOM_CATEGORIES.map(c => (
                      <option key={c.value} value={c.value} className="bg-slate-900 text-slate-200">{c.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-800/80">
                <button
                  type="button"
                  onClick={handleCancelForm}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-slate-100 bg-slate-850 hover:bg-slate-800 transition"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-sapphire-500 hover:bg-sapphire-400 text-white transition shadow-glow-sapphire disabled:opacity-50 flex items-center gap-1.5"
                >
                  {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>{editingRoomId === 'NEW' ? 'Daftar Bilik' : 'Kemaskini'}</span>
                </button>
              </div>
            </form>
          ) : (
            <div className="flex justify-between items-center">
              <span className="text-xs text-slate-400">
                Senarai Profil Makmal &amp; Bilik ({rooms.length})
              </span>
              <button
                onClick={handleStartAdd}
                className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-extrabold transition shadow-glow-emerald flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                <span>Tambah Bilik Baharu</span>
              </button>
            </div>
          )}

          {/* Rooms List Grid */}
          <div className="space-y-3">
            {rooms.length === 0 ? (
              <div className="p-8 text-center bg-slate-950/40 rounded-2xl border border-dashed border-slate-800 text-slate-400 text-xs">
                Tiada bilik berdaftar lagi. Klik butang &quot;Tambah Bilik Baharu&quot; di atas untuk mendaftar bilik pertama.
              </div>
            ) : (
              rooms.map(room => (
                <div
                  key={room.id}
                  className="p-4 rounded-2xl bg-slate-950/50 border border-slate-800 hover:border-slate-700/80 transition-all duration-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
                >
                  <div className="flex items-start gap-3.5 min-w-0 flex-1">
                    <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-emerald-400 shrink-0 mt-0.5">
                      <Cpu className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="text-sm font-bold text-slate-100 truncate">{room.name}</h4>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold font-mono ${
                          room.status === 'OCCUPIED'
                            ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                            : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                        }`}>
                          {room.status}
                        </span>
                        {room.manual_override && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-sapphire-500/20 text-sapphire-300 border border-sapphire-500/30 font-mono">
                            OVERRIDE
                          </span>
                        )}
                        <span className="text-[10px] text-slate-500 font-mono bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                          {room.category || 'LAB'}
                        </span>
                      </div>

                      <div className="flex items-center gap-3 text-xs text-slate-400 mt-1.5 flex-wrap">
                        <span className="flex items-center gap-1 font-mono text-amber-400 font-semibold">
                          <Lightbulb className="w-3.5 h-3.5" />
                          {room.nominal_power} W
                        </span>
                        <span className="text-slate-700">•</span>
                        <span className="text-slate-400 font-mono text-[11px] flex items-center gap-1.5">
                          <span className="text-slate-500">UUID:</span>
                          <span className="select-all bg-slate-900 px-1.5 py-0.5 rounded text-slate-300">
                            {room.id.toString()}
                          </span>
                          <button
                            onClick={() => copyRoomId(room.id)}
                            className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-emerald-400 transition"
                            title="Salin UUID Penuh Bilik untuk ESP32"
                          >
                            {copiedId === room.id.toString() ? (
                              <span className="text-[10px] text-emerald-400 font-bold flex items-center gap-1">
                                <CheckCheck className="w-3.5 h-3.5" /> Disalin!
                              </span>
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                    <Link
                      href={`/book/${room.id}`}
                      target="_blank"
                      className="p-2 rounded-xl text-slate-400 hover:text-teal-300 bg-slate-900 hover:bg-slate-800 border border-slate-800 transition"
                      title="Buka Halaman Tempahan / QR Imbasan Bilik"
                    >
                      <QrCode className="w-4 h-4" />
                    </Link>
                    <button
                      onClick={() => handleStartEdit(room)}
                      className="p-2 rounded-xl text-slate-400 hover:text-white bg-slate-900 hover:bg-slate-800 border border-slate-800 transition"
                      title="Edit Maklumat Bilik"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(room.id, room.name)}
                      className="p-2 rounded-xl text-slate-400 hover:text-rose-400 bg-slate-900 hover:bg-rose-500/10 border border-slate-800 transition"
                      title="Padam Bilik"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* ESP32 Microcontroller Pairing Guide */}
          <div className="p-4 sm:p-5 rounded-2xl bg-sapphire-950/30 border border-sapphire-500/25 text-slate-300 text-xs leading-relaxed space-y-2">
            <div className="flex items-center gap-2 text-sapphire-300 font-bold">
              <Cpu className="w-4 h-4 text-sapphire-400 shrink-0" />
              <span>Panduan Gandingan Mikropengawal ESP32:</span>
            </div>
            <p className="text-slate-400">
              Untuk menyambungkan perkakasan ESP32 ke mana-mana zon di atas, salin <strong>ID Bilik (UUID)</strong> dan masukkan ke dalam konfigurasi pembolehubah <code>ROOM_ID</code> pada fail <code>sceas_esp32.ino</code> atau simpan terus ke memori NVS melalui Captive Portal Wi-Fi.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
