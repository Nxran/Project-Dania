import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/utils/supabase/client';
import {
  Bluetooth,
  Smartphone,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Copy,
  Check,
  Radio,
  ShieldCheck,
  Building2,
  HelpCircle
} from 'lucide-react';
import { useConnectivity } from '@/components/layout/DashboardLayout';

interface Room {
  id: string | number;
  name: string;
  category?: string;
}

interface Beacon {
  id: string;
  room_id: string;
  name: string;
  mac_address: string;
  created_at: string;
}

export default function BeaconManager() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [selectedRoomId, setSelectedRoomId] = useState<string>('');
  const [beacons, setBeacons] = useState<Beacon[]>([]);

  const [roomsLoading, setRoomsLoading] = useState(false);
  const [beaconsLoading, setBeaconsLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [copiedMac, setCopiedMac] = useState<string | null>(null);

  // Form inputs
  const [deviceName, setDeviceName] = useState('');
  const [macAddress, setMacAddress] = useState('');

  // Status feedback
  const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const { setOnline } = useConnectivity();

  const fetchRooms = useCallback(async () => {
    setRoomsLoading(true);
    try {
      const { data, error } = await supabase
        .from('rooms')
        .select('id, name, category')
        .order('name', { ascending: true });

      if (error) throw error;
      setOnline(true);
      if (data && data.length > 0) {
        setRooms(data as Room[]);
        if (!selectedRoomId) {
          setSelectedRoomId(data[0].id.toString());
        }
      }
    } catch (err: any) {
      console.error('Error fetching rooms:', err);
      setOnline(false);
    } finally {
      setRoomsLoading(false);
    }
  }, [selectedRoomId, setOnline]);

  const fetchBeacons = useCallback(async (roomId: string) => {
    if (!roomId) {
      setBeacons([]);
      return;
    }
    setBeaconsLoading(true);
    try {
      const { data, error } = await supabase
        .from('authorized_beacons')
        .select('*')
        .eq('room_id', roomId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setOnline(true);
      setBeacons(data || []);
    } catch (err: any) {
      console.error('Error fetching beacons:', err);
      setOnline(false);
    } finally {
      setBeaconsLoading(false);
    }
  }, [setOnline]);

  // Fetch rooms on mount
  useEffect(() => {
    fetchRooms();
  }, [fetchRooms]);

  // Fetch beacons when selectedRoomId changes
  useEffect(() => {
    if (selectedRoomId) {
      fetchBeacons(selectedRoomId);
    }
  }, [selectedRoomId, fetchBeacons]);

  const handleCopyMac = (mac: string) => {
    navigator.clipboard.writeText(mac);
    setCopiedMac(mac);
    setTimeout(() => setCopiedMac(null), 2500);
  };

  const handleAddBeacon = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus(null);

    if (!selectedRoomId) {
      setStatus({ type: 'error', message: 'Sila pilih makmal terlebih dahulu.' });
      return;
    }

    if (!deviceName.trim()) {
      setStatus({ type: 'error', message: 'Sila masukkan nama pemilik / nama peranti.' });
      return;
    }

    // Format MAC Address: convert to uppercase, trim, and replace spaces
    const formattedMac = macAddress.trim().toUpperCase().replace(/\s+/g, '');
    const macRegex = /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/;

    if (!macRegex.test(formattedMac)) {
      setStatus({
        type: 'error',
        message: 'Format MAC Address tidak sah. Format mestilah mengikut format XX:XX:XX:XX:XX:XX (cth: AA:BB:CC:11:22:33).',
      });
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase.from('authorized_beacons').insert([
        {
          room_id: selectedRoomId,
          name: deviceName.trim(),
          mac_address: formattedMac,
        },
      ]);

      if (error) throw error;

      setOnline(true);
      setStatus({ type: 'success', message: `Peranti BLE ${deviceName.trim()} berjaya didaftarkan!` });
      setDeviceName('');
      setMacAddress('');
      fetchBeacons(selectedRoomId);
    } catch (err: any) {
      console.error('Error adding beacon:', err);
      setOnline(false);
      setStatus({ type: 'error', message: err.message || 'Gagal mendaftar peranti BLE.' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteBeacon = async (id: string, name: string) => {
    if (!confirm(`Adakah anda pasti mahu memadam peranti '${name}' daripada senarai sah?`)) return;

    setStatus(null);
    setDeletingId(id);
    try {
      const { error } = await supabase.from('authorized_beacons').delete().eq('id', id);

      if (error) throw error;

      setOnline(true);
      setStatus({ type: 'success', message: 'Peranti BLE berjaya dipadamkan.' });
      fetchBeacons(selectedRoomId);
    } catch (err: any) {
      console.error('Error deleting beacon:', err);
      setOnline(false);
      setStatus({ type: 'error', message: err.message || 'Gagal memadam peranti BLE.' });
    } finally {
      setDeletingId(null);
    }
  };

  const selectedRoom = rooms.find((r) => r.id.toString() === selectedRoomId);

  return (
    <div className="glass-panel rounded-3xl p-6 sm:p-7 border border-slate-800/80 shadow-card-slate relative overflow-hidden">
      {/* Card Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="bg-indigo-500/10 p-3 rounded-2xl border border-indigo-500/20 text-indigo-400 shadow-[0_0_15px_rgba(99,102,241,0.15)]">
            <Bluetooth className="h-6 w-6" />
          </div>
          <div>
            <h3 className="text-slate-100 font-bold text-lg">Konfigurasi Geofencing BLE &amp; Suar Sah</h3>
            <p className="text-xs text-slate-400">
              Daftar telefon pintar atau suar BLE pensyarah untuk mengekalkan kuasa makmal secara automatik melalui jarak kehadiran (RSSI proximity)
            </p>
          </div>
        </div>

        <span className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-slate-950/80 text-indigo-400 border border-slate-800">
          Proximity Automation
        </span>
      </div>

      {status && (
        <div
          className={`flex items-start gap-3 px-4 py-3 rounded-2xl mb-6 text-xs font-medium border ${
            status.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
              : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
          }`}
        >
          {status.type === 'success' ? (
            <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0 text-emerald-400" />
          ) : (
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0 text-rose-400" />
          )}
          <span>{status.message}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column (5 cols): Selection & Registration Form */}
        <div className="lg:col-span-5 space-y-5">
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
              Pilih Bilik Makmal
            </label>
            {roomsLoading ? (
              <div className="h-11 rounded-2xl bg-slate-950/60 border border-slate-800 animate-pulse flex items-center px-4">
                <Loader2 className="h-4 w-4 animate-spin text-slate-500" />
              </div>
            ) : (
              <select
                value={selectedRoomId}
                onChange={(e) => setSelectedRoomId(e.target.value)}
                className="w-full px-4 py-3 rounded-2xl bg-slate-950/80 border border-slate-800 focus:border-indigo-500 text-slate-100 focus:outline-none transition text-xs font-semibold cursor-pointer shadow-inner"
              >
                {rooms.map((room) => (
                  <option key={room.id} value={room.id}>
                    {room.name} {room.category ? `(${room.category})` : ''}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Registration Form */}
          <form
            onSubmit={handleAddBeacon}
            className="p-5 rounded-2xl bg-slate-950/60 border border-slate-800/80 space-y-4 shadow-inner"
          >
            <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
              <Smartphone className="h-4 w-4 text-indigo-400" />
              <span>Daftar Peranti Pensyarah Baharu</span>
            </h4>

            <div>
              <label className="block text-[11px] font-bold text-slate-400 mb-1.5">
                Nama Pemilik / Peranti
              </label>
              <input
                type="text"
                value={deviceName}
                onChange={(e) => setDeviceName(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl bg-slate-900/90 border border-slate-800 focus:border-indigo-500 text-slate-100 placeholder-slate-600 focus:outline-none transition text-xs"
                placeholder="contoh: Dr. Dania (iPhone 15) / Pn. Aisyah"
              />
            </div>

            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="block text-[11px] font-bold text-slate-400">
                  Bluetooth MAC Address
                </label>
                <span className="text-[10px] font-mono text-slate-500">Format: XX:XX:XX:XX:XX:XX</span>
              </div>
              <input
                type="text"
                value={macAddress}
                onChange={(e) => setMacAddress(e.target.value.toUpperCase())}
                className="w-full px-4 py-2.5 rounded-xl bg-slate-900/90 border border-slate-800 focus:border-indigo-500 text-slate-100 placeholder-slate-600 focus:outline-none transition font-mono text-xs"
                placeholder="cth: 24:6F:28:AB:CD:EF"
              />
            </div>

            {/* Quick Sample MAC Buttons */}
            <div className="flex items-center gap-1.5 pt-1">
              <span className="text-[10px] text-slate-500">Contoh:</span>
              {['24:6F:28:AB:CD:11', '3C:71:BF:99:88:22'].map((mac) => (
                <button
                  key={mac}
                  type="button"
                  onClick={() => setMacAddress(mac)}
                  className="px-2 py-0.5 rounded-lg text-[9px] font-mono bg-slate-900 text-slate-400 border border-slate-800 hover:text-slate-200"
                >
                  {mac.slice(0, 8)}...
                </button>
              ))}
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 bg-indigo-500 hover:bg-indigo-400 disabled:bg-indigo-500/50 text-white font-bold rounded-xl transition text-xs shadow-[0_0_20px_rgba(99,102,241,0.25)] flex items-center justify-center gap-2"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Mendaftarkan...</span>
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4" />
                  <span>Daftar Suar Ke Bilik Ini</span>
                </>
              )}
            </button>
          </form>

          {/* Proximity Logic Info Callout */}
          <div className="p-4 rounded-2xl bg-indigo-500/5 border border-indigo-500/20 text-xs text-slate-400 space-y-1.5">
            <div className="flex items-center gap-1.5 text-indigo-400 font-bold">
              <Radio className="w-4 h-4" />
              <span>Bagaimana Geofencing BLE Berfungsi?</span>
            </div>
            <p className="text-[11px] leading-relaxed text-slate-400">
              Mikropengawal ESP32 di setiap makmal sentiasa mengimbas isyarat BLE. Apabila peranti yang didaftarkan berada dalam lingkungan &lt; 5 meter, sistem akan mengekalkan lampu menyala walaupun sensor PIR tidak mengesan pergerakan kasar.
            </p>
          </div>
        </div>

        {/* Right Column (7 cols): Registered Devices list */}
        <div className="lg:col-span-7 space-y-4">
          <div className="flex justify-between items-center">
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">
              Senarai Suar Sah ({selectedRoom ? selectedRoom.name : ''})
            </label>
            <span className="text-xs font-mono font-bold text-slate-400 bg-slate-950/80 px-2.5 py-1 rounded-full border border-slate-800">
              {beacons.length} Peranti Didaftarkan
            </span>
          </div>

          {beaconsLoading ? (
            <div className="py-16 text-center text-xs text-slate-400 font-mono flex flex-col items-center justify-center">
              <Loader2 className="w-6 h-6 animate-spin text-indigo-400 mb-2" />
              <span>Memuatkan suar berdaftar...</span>
            </div>
          ) : beacons.length === 0 ? (
            <div className="py-16 border border-dashed border-slate-800 rounded-3xl flex flex-col items-center justify-center text-center p-6 bg-slate-950/30">
              <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 text-slate-500 mb-3">
                <Bluetooth className="h-8 w-8 text-indigo-400 opacity-60" />
              </div>
              <p className="text-slate-300 text-sm font-bold">Tiada Peranti Didaftarkan</p>
              <p className="text-slate-500 text-xs mt-1 max-w-xs">
                Daftar peranti pensyarah pada borang di sebelah kiri untuk mengaktifkan fungsi kehadiran automatik.
              </p>
            </div>
          ) : (
            <div className="space-y-3 max-h-[460px] overflow-y-auto pr-1">
              {beacons.map((beacon) => {
                const isCopied = copiedMac === beacon.mac_address;
                const isDeleting = deletingId === beacon.id;

                return (
                  <div
                    key={beacon.id}
                    className="flex items-center justify-between p-4 rounded-2xl bg-slate-950/60 border border-slate-800/80 hover:border-indigo-500/30 transition group gap-4 shadow-sm"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 shrink-0">
                        <Smartphone className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <h5 className="font-bold text-sm text-slate-100 truncate group-hover:text-indigo-300 transition">
                          {beacon.name}
                        </h5>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[11px] font-mono text-slate-400 select-all">
                            {beacon.mac_address}
                          </span>
                          <button
                            onClick={() => handleCopyMac(beacon.mac_address)}
                            className="p-1 text-slate-500 hover:text-indigo-400 rounded transition"
                            title="Salin MAC Address"
                          >
                            {isCopied ? (
                              <Check className="w-3 h-3 text-emerald-400" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="hidden sm:inline-block text-[10px] font-mono text-slate-500 bg-slate-900 px-2 py-1 rounded-lg border border-slate-800">
                        {new Date(beacon.created_at).toLocaleDateString('ms-MY', {
                          day: '2-digit',
                          month: 'short',
                        })}
                      </span>

                      <button
                        onClick={() => handleDeleteBeacon(beacon.id, beacon.name)}
                        disabled={isDeleting}
                        className="p-2 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-xl transition border border-transparent hover:border-rose-500/20"
                        title="Padam peranti suar ini"
                      >
                        {isDeleting ? (
                          <Loader2 className="h-4 w-4 animate-spin text-rose-400" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
