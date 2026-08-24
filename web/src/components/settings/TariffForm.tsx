import React, { useState, useEffect } from 'react';
import { supabase } from '@/utils/supabase/client';
import { Settings as SettingsIcon, Lightbulb, CheckCircle2, AlertCircle, AlertTriangle } from 'lucide-react';
import { useConnectivity } from '@/components/layout/DashboardLayout';

interface Room {
  id: string | number;
  name: string;
  nominal_power: number;
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

  // Fetch initial data
  useEffect(() => {
    fetchSettings();
    fetchRooms();
  }, []);

  const fetchSettings = async () => {
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
      setDbError(err.message || 'Failed to fetch settings from database.');
    }
  };

  const fetchRooms = async () => {
    setRoomsLoading(true);
    try {
      const { data, error } = await supabase
        .from('rooms')
        .select('id, name, nominal_power');

      if (error) throw error;
      setOnline(true);
      setDbError(null);
      if (data) {
        setRooms(data);
        const powers: { [roomId: string]: string } = {};
        data.forEach((r) => {
          powers[r.id.toString()] = r.nominal_power.toString();
        });
        setRoomPowers(powers);
      }
    } catch (err: any) {
      console.error('Error fetching rooms for settings:', err);
      setOnline(false);
      setDbError(err.message || 'Failed to fetch rooms from database.');
    } finally {
      setRoomsLoading(false);
    }
  };

  const handleTariffSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTariffLoading(true);
    setTariffStatus(null);

    const numericTariff = parseFloat(tariff);
    if (isNaN(numericTariff) || numericTariff <= 0) {
      setTariffStatus({ type: 'error', message: 'Please enter a valid positive number for tariff.' });
      setTariffLoading(false);
      return;
    }
    if (numericTariff > 5.00) {
      setTariffStatus({ type: 'error', message: 'TNB tariff rate cannot exceed RM 5.00/kWh.' });
      setTariffLoading(false);
      return;
    }

    try {
      // Mock server settings patch works with eq('key', 'tnb_tariff')
      const { error } = await supabase
        .from('settings')
        .update({ value: numericTariff })
        .eq('key', 'tnb_tariff');

      if (error) throw error;

      setOnline(true);
      setDbError(null);
      setTariffStatus({ type: 'success', message: 'TNB tariff rate updated successfully.' });
      fetchSettings(); // Refresh
    } catch (err: any) {
      console.error('Error updating tariff:', err);
      setOnline(false);
      setTariffStatus({ type: 'error', message: err.message || 'Failed to update tariff.' });
    } finally {
      setTariffLoading(false);
    }
  };

  const handlePowerSubmit = async (roomId: string | number, e: React.FormEvent) => {
    e.preventDefault();
    setRoomsStatus(null);

    const val = roomPowers[roomId.toString()];
    const numericPower = parseFloat(val);

    if (isNaN(numericPower) || numericPower <= 0) {
      setRoomsStatus({ type: 'error', message: 'Please enter a valid positive number for nominal power.' });
      return;
    }
    if (numericPower > 10000) {
      setRoomsStatus({ type: 'error', message: 'Nominal power limit cannot exceed 10,000 W.' });
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
      setRoomsStatus({ type: 'success', message: `Nominal power for room updated successfully.` });
      fetchRooms(); // Refresh
    } catch (err: any) {
      console.error('Error updating room power:', err);
      setOnline(false);
      setRoomsStatus({ type: 'error', message: err.message || 'Failed to update nominal power.' });
    } finally {
      setRoomsUpdating((prev) => ({ ...prev, [roomId.toString()]: false }));
    }
  };

  const handlePowerChange = (roomId: string | number, value: string) => {
    setRoomPowers((prev) => ({
      ...prev,
      [roomId.toString()]: value
    }));
  };

  return (
    <div className="space-y-6">
      {dbError && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-200 px-6 py-4 rounded-2xl flex items-start gap-4 shadow-lg animate-pulse">
          <AlertTriangle className="h-6 w-6 text-red-500 shrink-0 mt-0.5" />
          <div className="flex-1">
            <h4 className="font-bold text-base text-red-400">Database Connection Failed</h4>
            <p className="text-sm text-gray-300 mt-1">
              Unable to reach the Supabase database. Settings could not be fully loaded or saved.
            </p>
            <p className="text-xs text-red-500/70 font-mono mt-2 bg-black/30 p-2 rounded-lg border border-red-500/10">
              Details: {dbError}
            </p>
          </div>
        </div>
      )}
      {/* TNB Tariff Form */}
      <div className="glass-panel rounded-2xl p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="bg-emerald-500/10 p-2.5 rounded-xl border border-emerald-500/20 text-emerald-400">
            <SettingsIcon className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-gray-200 font-semibold text-lg">TNB Electricity Tariff</h3>
            <p className="text-xs text-gray-400">Tariff rate used to compute financial energy savings (RM)</p>
          </div>
        </div>

        {tariffStatus && (
          <div
            className={`flex items-start gap-2.5 px-4 py-3 rounded-xl mb-4 text-sm border ${
              tariffStatus.type === 'success'
                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                : 'bg-red-500/10 border-red-500/20 text-red-400'
            }`}
          >
            {tariffStatus.type === 'success' ? (
              <CheckCircle2 className="h-5 w-5 mt-0.5 shrink-0" />
            ) : (
              <AlertCircle className="h-5 w-5 mt-0.5 shrink-0" />
            )}
            <span>{tariffStatus.message}</span>
          </div>
        )}

        <form onSubmit={handleTariffSubmit} className="space-y-4 max-w-md">
          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
              Tariff Rate (RM / kWh)
            </label>
            <div className="flex gap-3">
              <div className="relative flex-1">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-gray-400 font-semibold text-sm">
                  RM
                </span>
                <input
                  type="text"
                  value={tariff}
                  onChange={(e) => setTariff(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-gray-950/60 border border-gray-800 focus:border-emerald-500 text-gray-100 placeholder-gray-650 focus:outline-none transition font-mono text-sm"
                  placeholder="0.509"
                />
              </div>
              <button
                type="submit"
                disabled={tariffLoading}
                className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-600 disabled:bg-emerald-500/50 text-gray-950 font-bold rounded-xl transition text-sm shadow-[0_0_15px_rgba(16,185,129,0.2)]"
              >
                {tariffLoading ? 'Saving...' : 'Update'}
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* Room Nominal Power Form */}
      <div className="glass-panel rounded-2xl p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="bg-blue-500/10 p-2.5 rounded-xl border border-blue-500/20 text-blue-400">
            <Lightbulb className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-gray-200 font-semibold text-lg">Nominal Load Power Configuration</h3>
            <p className="text-xs text-gray-400">Estimated load wattage per room when status is OCCUPIED</p>
          </div>
        </div>

        {roomsStatus && (
          <div
            className={`flex items-start gap-2.5 px-4 py-3 rounded-xl mb-4 text-sm border ${
              roomsStatus.type === 'success'
                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                : 'bg-red-500/10 border-red-500/20 text-red-400'
            }`}
          >
            {roomsStatus.type === 'success' ? (
              <CheckCircle2 className="h-5 w-5 mt-0.5 shrink-0" />
            ) : (
              <AlertCircle className="h-5 w-5 mt-0.5 shrink-0" />
            )}
            <span>{roomsStatus.message}</span>
          </div>
        )}

        {roomsLoading ? (
          <div className="py-6 text-center text-sm text-gray-400 font-mono animate-pulse">
            Loading room power settings...
          </div>
        ) : (
          <div className="space-y-4">
            {rooms.map((room) => (
              <form
                key={room.id}
                onSubmit={(e) => handlePowerSubmit(room.id, e)}
                className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl bg-gray-900/30 border border-gray-800/60 gap-4"
              >
                <div className="flex-1">
                  <h4 className="font-semibold text-sm text-gray-200">{room.name}</h4>
                  <p className="text-xs text-gray-500 mt-0.5 font-mono">Room UUID: {room.id}</p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <div className="relative w-36">
                    <input
                      type="text"
                      disabled={roomsUpdating[room.id.toString()]}
                      value={roomPowers[room.id.toString()] || ''}
                      onChange={(e) => handlePowerChange(room.id, e.target.value)}
                      className="w-full pl-4 pr-8 py-2 rounded-lg bg-gray-950/60 disabled:opacity-50 border border-gray-800 focus:border-blue-500 text-gray-150 placeholder-gray-650 focus:outline-none transition font-mono text-sm text-right"
                    />
                    <span className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-500 text-xs font-bold font-mono">
                      W
                    </span>
                  </div>
                  <button
                    type="submit"
                    disabled={roomsUpdating[room.id.toString()]}
                    className="px-4 py-2 bg-blue-500 hover:bg-blue-600 disabled:bg-blue-500/50 text-white font-semibold rounded-lg transition text-xs shadow-[0_0_10px_rgba(59,130,246,0.2)] flex items-center gap-1.5"
                  >
                    {roomsUpdating[room.id.toString()] ? 'Saving...' : 'Save'}
                  </button>
                </div>
              </form>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
