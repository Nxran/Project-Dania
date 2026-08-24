import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/utils/supabase/client';
import {
  Coins,
  Lightbulb,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Zap,
  HelpCircle,
  ArrowRight,
  Sliders,
  Calculator,
  Save,
  Loader2
} from 'lucide-react';
import { useConnectivity } from '@/components/layout/DashboardLayout';

interface Room {
  id: string | number;
  name: string;
  nominal_power: number;
  category?: string;
}

export default function TariffForm() {
  const [tariff, setTariff] = useState<string>('0.509');
  const [rooms, setRooms] = useState<Room[]>([]);
  const [roomPowers, setRoomPowers] = useState<{ [roomId: string]: string }>({});

  const [tariffLoading, setTariffLoading] = useState(false);
  const [roomsLoading, setRoomsLoading] = useState(false);
  const [roomsUpdating, setRoomsUpdating] = useState<{ [roomId: string]: boolean }>({});

  const [tariffStatus, setTariffStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [roomsStatus, setRoomsStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const { setOnline } = useConnectivity();
  const [dbError, setDbError] = useState<string | null>(null);

  const fetchSettings = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('settings')
        .select('key, value')
        .eq('key', 'tnb_tariff');

      if (error) throw error;
      setOnline(true);
      setDbError(null);
      if (data && data.length > 0) {
        setTariff(data[0].value.toString());
      }
    } catch (err: any) {
      console.error('Error fetching settings:', err);
      setOnline(false);
      setDbError(err.message || 'Gagal memuatkan tetapan tarif.');
    }
  }, [setOnline]);

  const fetchRooms = useCallback(async () => {
    setRoomsLoading(true);
    try {
      const { data, error } = await supabase
        .from('rooms')
        .select('id, name, nominal_power, category')
        .order('name', { ascending: true });

      if (error) throw error;
      setOnline(true);
      setDbError(null);
      if (data) {
        setRooms(data as Room[]);
        const powers: { [roomId: string]: string } = {};
        data.forEach((r) => {
          powers[r.id.toString()] = r.nominal_power.toString();
        });
        setRoomPowers(powers);
      }
    } catch (err: any) {
      console.error('Error fetching rooms for settings:', err);
      setOnline(false);
      setDbError(err.message || 'Gagal memuatkan data bilik.');
    } finally {
      setRoomsLoading(false);
    }
  }, [setOnline]);

  // Fetch initial data on mount
  useEffect(() => {
    fetchSettings();
    fetchRooms();
  }, [fetchSettings, fetchRooms]);

  const handleTariffSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTariffLoading(true);
    setTariffStatus(null);

    const numericTariff = parseFloat(tariff);
    if (isNaN(numericTariff) || numericTariff <= 0) {
      setTariffStatus({ type: 'error', message: 'Sila masukkan angka tarif positif yang sah.' });
      setTariffLoading(false);
      return;
    }
    if (numericTariff > 5.0) {
      setTariffStatus({ type: 'error', message: 'Kadar tarif TNB tidak boleh melebihi RM 5.00/kWh.' });
      setTariffLoading(false);
      return;
    }

    try {
      const { error } = await supabase
        .from('settings')
        .update({ value: numericTariff })
        .eq('key', 'tnb_tariff');

      if (error) throw error;

      setOnline(true);
      setDbError(null);
      setTariffStatus({ type: 'success', message: 'Kadar tarif TNB berjaya dikemaskini.' });
      fetchSettings();
    } catch (err: any) {
      console.error('Error updating tariff:', err);
      setOnline(false);
      setTariffStatus({ type: 'error', message: err.message || 'Gagal mengemaskini tarif TNB.' });
    } finally {
      setTariffLoading(false);
    }
  };

  const handlePowerSubmit = async (roomId: string | number, e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setRoomsStatus(null);

    const val = roomPowers[roomId.toString()];
    const numericPower = parseFloat(val);

    if (isNaN(numericPower) || numericPower <= 0) {
      setRoomsStatus({ type: 'error', message: 'Sila masukkan nilai beban kuasa positif yang sah.' });
      return;
    }
    if (numericPower > 15000) {
      setRoomsStatus({ type: 'error', message: 'Had beban kuasa nominal tidak boleh melebihi 15,000 W.' });
      return;
    }

    setRoomsUpdating((prev) => ({ ...prev, [roomId.toString()]: true }));

    try {
      const { error } = await supabase
        .from('rooms')
        .update({ nominal_power: numericPower })
        .eq('id', roomId);

      if (error) throw error;

      setOnline(true);
      setDbError(null);
      setRoomsStatus({ type: 'success', message: `Beban kuasa bagi makmal berjaya dikemaskini.` });
      fetchRooms();
    } catch (err: any) {
      console.error('Error updating room power:', err);
      setOnline(false);
      setRoomsStatus({ type: 'error', message: err.message || 'Gagal mengemaskini beban kuasa makmal.' });
    } finally {
      setRoomsUpdating((prev) => ({ ...prev, [roomId.toString()]: false }));
    }
  };

  const handlePowerChange = (roomId: string | number, value: string) => {
    setRoomPowers((prev) => ({
      ...prev,
      [roomId.toString()]: value,
    }));
  };

  const setPresetPower = (roomId: string | number, watts: number) => {
    setRoomPowers((prev) => ({
      ...prev,
      [roomId.toString()]: watts.toString(),
    }));
  };

  const parsedTariff = parseFloat(tariff) || 0.509;

  return (
    <div className="space-y-6">
      {dbError && (
        <div className="bg-rose-500/10 border border-rose-500/30 text-rose-400 px-6 py-4 rounded-3xl flex items-start gap-4 shadow-xl animate-pulse">
          <AlertTriangle className="h-6 w-6 text-rose-500 shrink-0 mt-0.5" />
          <div className="flex-1">
            <h4 className="font-bold text-base text-rose-400">Sambungan Pangkalan Data Terputus</h4>
            <p className="text-xs text-slate-300 mt-1">
              Gagal menghubungi pangkalan data Supabase untuk memuatkan tetapan.
            </p>
            <p className="text-xs text-rose-400 font-mono mt-2 bg-black/40 p-2 rounded-xl border border-rose-500/20">
              {dbError}
            </p>
          </div>
        </div>
      )}

      {/* TNB Electricity Tariff Card - Apple Slate Modern Style */}
      <div className="glass-panel rounded-3xl p-6 sm:p-7 border border-slate-800/80 shadow-card-slate relative overflow-hidden">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="bg-emerald-500/10 p-3 rounded-2xl border border-emerald-500/20 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.15)]">
              <Coins className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-slate-100 font-bold text-lg">Kadar Tarif Elektrik TNB</h3>
              <p className="text-xs text-slate-400">
                Kadar tarif komersial/institusi untuk mengira nilai ringgit penjimatan &amp; pembaziran tenaga (RM)
              </p>
            </div>
          </div>

          <span className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-slate-950/80 text-emerald-400 border border-slate-800">
            Kadar Semasa: RM {parsedTariff.toFixed(3)} / kWh
          </span>
        </div>

        {tariffStatus && (
          <div
            className={`flex items-start gap-3 px-4 py-3 rounded-2xl mb-5 text-xs font-medium border ${
              tariffStatus.type === 'success'
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
            }`}
          >
            {tariffStatus.type === 'success' ? (
              <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0 text-emerald-400" />
            ) : (
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0 text-rose-400" />
            )}
            <span>{tariffStatus.message}</span>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Form Column */}
          <form onSubmit={handleTariffSubmit} className="lg:col-span-6 space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                Nilai Tarif (RM / kWh)
              </label>
              <div className="flex gap-3">
                <div className="relative flex-1">
                  <span className="absolute inset-y-0 left-0 pl-4 flex items-center text-slate-400 font-bold font-mono text-sm">
                    RM
                  </span>
                  <input
                    type="text"
                    value={tariff}
                    onChange={(e) => setTariff(e.target.value)}
                    className="w-full pl-12 pr-4 py-3 rounded-2xl bg-slate-950/80 border border-slate-800 focus:border-emerald-500 text-slate-100 placeholder-slate-600 focus:outline-none transition font-mono text-sm shadow-inner"
                    placeholder="0.509"
                  />
                </div>
                <button
                  type="submit"
                  disabled={tariffLoading}
                  className="px-6 py-3 bg-emerald-500 hover:bg-emerald-400 disabled:bg-emerald-500/50 text-slate-950 font-black rounded-2xl transition text-xs shadow-[0_0_20px_rgba(16,185,129,0.3)] flex items-center gap-1.5 shrink-0"
                >
                  {tariffLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  <span>Simpan Tarif</span>
                </button>
              </div>
            </div>

            {/* Quick Tariff Presets */}
            <div className="flex items-center gap-2 pt-1">
              <span className="text-[11px] text-slate-400 font-medium">Pilihan Pantas:</span>
              {[
                { label: 'TNB Komersial C1 (0.509)', val: '0.509' },
                { label: 'Domestik Rendah (0.395)', val: '0.395' },
                { label: 'Puncak Industri (0.575)', val: '0.575' },
              ].map((p) => (
                <button
                  key={p.val}
                  type="button"
                  onClick={() => setTariff(p.val)}
                  className={`px-2.5 py-1 rounded-xl text-[10px] font-mono font-bold border transition ${
                    tariff === p.val
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                      : 'bg-slate-950/60 text-slate-400 border-slate-800 hover:text-slate-200'
                  }`}
                >
                  {p.val}
                </button>
              ))}
            </div>
          </form>

          {/* Interactive Calculator Preview Card */}
          <div className="lg:col-span-6 p-4 rounded-2xl bg-slate-950/60 border border-slate-800/80 flex flex-col justify-between space-y-3">
            <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold">
              <Calculator className="w-4 h-4" />
              <span>Simulasi Anggaran Penjimatan SCEAS</span>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800">
                <span className="text-[10px] text-slate-400 block font-mono">1 Jam (1 kW)</span>
                <span className="text-xs font-bold font-mono text-emerald-400 mt-0.5 block">
                  RM {(parsedTariff * 1).toFixed(2)}
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800">
                <span className="text-[10px] text-slate-400 block font-mono">4 Jam (1 kW)</span>
                <span className="text-xs font-bold font-mono text-emerald-400 mt-0.5 block">
                  RM {(parsedTariff * 4).toFixed(2)}
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800">
                <span className="text-[10px] text-slate-400 block font-mono">100 Jam (1 kW)</span>
                <span className="text-xs font-bold font-mono text-emerald-400 mt-0.5 block">
                  RM {(parsedTariff * 100).toFixed(2)}
                </span>
              </div>
            </div>

            <p className="text-[10px] text-slate-500 leading-relaxed font-mono">
              Formula: Tenaga (kWh) = (Beban Watt × Jam) / 1000 • Kos (RM) = Tenaga × Kadar Tarif
            </p>
          </div>
        </div>
      </div>

      {/* Room Nominal Power Form Card - Apple Slate Modern Style */}
      <div className="glass-panel rounded-3xl p-6 sm:p-7 border border-slate-800/80 shadow-card-slate">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="bg-sapphire-500/10 p-3 rounded-2xl border border-sapphire-500/20 text-sapphire-400 shadow-[0_0_15px_rgba(59,130,246,0.15)]">
              <Lightbulb className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-slate-100 font-bold text-lg">Konfigurasi Beban Kuasa Nominal Makmal</h3>
              <p className="text-xs text-slate-400">
                Kadar penggunaan watt asas per makmal semasa status bilik aktif/diduduki (OCCUPIED)
              </p>
            </div>
          </div>

          <span className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-slate-950/80 text-sapphire-400 border border-slate-800">
            {rooms.length} Makmal Dikonfigurasikan
          </span>
        </div>

        {roomsStatus && (
          <div
            className={`flex items-start gap-3 px-4 py-3 rounded-2xl mb-5 text-xs font-medium border ${
              roomsStatus.type === 'success'
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
            }`}
          >
            {roomsStatus.type === 'success' ? (
              <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0 text-emerald-400" />
            ) : (
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0 text-rose-400" />
            )}
            <span>{roomsStatus.message}</span>
          </div>
        )}

        {roomsLoading ? (
          <div className="py-12 text-center text-xs text-slate-400 font-mono flex flex-col items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-sapphire-400 mb-2" />
            <span>Memuatkan tetapan kuasa makmal...</span>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {rooms.map((room) => {
              const isUpdating = !!roomsUpdating[room.id.toString()];
              const currentVal = roomPowers[room.id.toString()] || '';

              return (
                <div
                  key={room.id}
                  className="p-5 rounded-2xl bg-slate-950/60 border border-slate-800/80 hover:border-slate-700 transition flex flex-col justify-between gap-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <span className="text-[10px] font-mono font-bold text-slate-500 uppercase">
                        {room.category || 'MAKMAL JABATAN'}
                      </span>
                      <h4 className="font-bold text-sm text-slate-100 mt-0.5">{room.name}</h4>
                    </div>

                    <span className="text-xs font-mono font-extrabold text-teal-400 bg-teal-500/10 px-2.5 py-1 rounded-xl border border-teal-500/20">
                      {room.nominal_power} W
                    </span>
                  </div>

                  {/* Preset Buttons */}
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-slate-500">Preset:</span>
                    {[600, 1200, 1800, 2400].map((watts) => (
                      <button
                        key={watts}
                        type="button"
                        onClick={() => setPresetPower(room.id, watts)}
                        className={`px-2 py-0.5 rounded-lg text-[10px] font-mono border transition ${
                          currentVal === watts.toString()
                            ? 'bg-sapphire-500/20 text-sapphire-300 border-sapphire-500/40 font-bold'
                            : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
                        }`}
                      >
                        {watts}W
                      </button>
                    ))}
                  </div>

                  <form
                    onSubmit={(e) => handlePowerSubmit(room.id, e)}
                    className="flex items-center gap-2 pt-2 border-t border-slate-800/60"
                  >
                    <div className="relative flex-1">
                      <input
                        type="text"
                        disabled={isUpdating}
                        value={currentVal}
                        onChange={(e) => handlePowerChange(room.id, e.target.value)}
                        className="w-full pl-3 pr-8 py-2 rounded-xl bg-slate-900/80 disabled:opacity-50 border border-slate-800 focus:border-sapphire-500 text-slate-100 placeholder-slate-600 focus:outline-none transition font-mono text-xs text-right"
                        placeholder="1200"
                      />
                      <span className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-500 text-[11px] font-bold font-mono">
                        W
                      </span>
                    </div>

                    <button
                      type="submit"
                      disabled={isUpdating}
                      className="px-4 py-2 bg-sapphire-500 hover:bg-sapphire-400 disabled:bg-sapphire-500/50 text-white font-bold rounded-xl transition text-xs shadow-[0_0_15px_rgba(59,130,246,0.2)] flex items-center gap-1.5 shrink-0"
                    >
                      {isUpdating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                      <span>Simpan</span>
                    </button>
                  </form>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
