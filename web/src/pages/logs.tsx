import React, { useState, useEffect } from 'react';
import { supabase } from '@/utils/supabase/client';
import { History, Leaf, Coins, Zap, RefreshCw, AlertTriangle } from 'lucide-react';
import { useConnectivity } from '@/components/layout/DashboardLayout';

interface Room {
  id: string | number;
  name: string;
}

interface SavingsLog {
  id: string | number;
  room_id: string | number;
  start_time: string;
  end_time: string;
  kwh_saved: number | string;
  rm_saved: number | string;
  co2_saved: number | string;
  created_at: string;
}

export default function SavingsLogsPage() {
  const [logs, setLogs] = useState<SavingsLog[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { setOnline } = useConnectivity();

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [roomsRes, logsRes] = await Promise.all([
        supabase.from('rooms').select('id, name'),
        supabase.from('savings_log').select('*')
      ]);

      if (roomsRes.error) throw roomsRes.error;
      if (logsRes.error) throw logsRes.error;

      setOnline(true);

      if (roomsRes.data) {
        setRooms(roomsRes.data);
      }

      if (logsRes.data) {
        // Sort chronologically descending (newest first)
        const sorted = [...logsRes.data].sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
        setLogs(sorted);
      }
    } catch (err: any) {
      console.error('Error fetching savings logs:', err);
      setError(err.message || 'Failed to fetch savings logs.');
      setOnline(false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const formatDuration = (start: string, end: string) => {
    const diffMs = new Date(end).getTime() - new Date(start).getTime();
    if (isNaN(diffMs) || diffMs < 0) return '0s';
    const totalSeconds = Math.floor(diffMs / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    const parts = [];
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    if (seconds > 0 || parts.length === 0) parts.push(`${seconds}s`);
    return parts.join(' ');
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
  };

  // Compute totals
  const totalKwh = logs.reduce((acc, log) => acc + (parseFloat(log.kwh_saved.toString()) || 0), 0);
  const totalRm = logs.reduce((acc, log) => acc + (parseFloat(log.rm_saved.toString()) || 0), 0);
  const totalCo2 = logs.reduce((acc, log) => acc + (parseFloat(log.co2_saved.toString()) || 0), 0);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-gray-800 pb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-100">Savings Log History</h1>
          <p className="text-sm text-gray-400 mt-1">Audit log of energy, money, and CO₂ savings achieved during vacancy</p>
        </div>
        <button
          onClick={fetchData}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-gray-900 border border-gray-850 hover:bg-gray-800 text-gray-350 hover:text-gray-150 transition rounded-xl text-sm"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh Logs
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="glass-panel rounded-2xl p-6 flex items-center justify-between border-l-4 border-l-blue-500">
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Total Energy Saved</p>
            <h3 className="text-2xl font-bold text-blue-400 mt-1.5 font-mono">
              {totalKwh.toFixed(3)} <span className="text-xs text-gray-400 font-sans">kWh</span>
            </h3>
          </div>
          <div className="bg-blue-500/10 p-3.5 rounded-2xl text-blue-400">
            <Zap className="h-6 w-6" />
          </div>
        </div>

        <div className="glass-panel rounded-2xl p-6 flex items-center justify-between border-l-4 border-l-emerald-500">
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Total Money Saved</p>
            <h3 className="text-2xl font-bold text-emerald-400 mt-1.5 font-mono">
              RM {totalRm.toFixed(2)}
            </h3>
          </div>
          <div className="bg-emerald-500/10 p-3.5 rounded-2xl text-emerald-400">
            <Coins className="h-6 w-6" />
          </div>
        </div>

        <div className="glass-panel rounded-2xl p-6 flex items-center justify-between border-l-4 border-l-teal-500">
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Total CO₂ Saved</p>
            <h3 className="text-2xl font-bold text-teal-400 mt-1.5 font-mono">
              {totalCo2.toFixed(3)} <span className="text-xs text-gray-400 font-sans">kg</span>
            </h3>
          </div>
          <div className="bg-teal-500/10 p-3.5 rounded-2xl text-teal-400">
            <Leaf className="h-6 w-6" />
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-200 px-6 py-4 rounded-2xl flex items-start gap-4 shadow-lg animate-pulse">
          <AlertTriangle className="h-6 w-6 text-red-500 shrink-0 mt-0.5" />
          <div className="flex-1">
            <h4 className="font-bold text-base text-red-400">Database Connection Failed</h4>
            <p className="text-sm text-gray-300 mt-1">
              Unable to fetch the savings logs from Supabase.
            </p>
            <p className="text-xs text-red-500/70 font-mono mt-2 bg-black/30 p-2 rounded-lg border border-red-500/10">
              Details: {error}
            </p>
          </div>
        </div>
      )}

      {/* Table Section */}
      <div className="glass-panel rounded-2xl overflow-hidden border border-gray-800/60">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-gray-850 bg-gray-900/40 text-gray-400 font-medium">
                <th className="p-4">Room</th>
                <th className="p-4">Start Time</th>
                <th className="p-4">End Time</th>
                <th className="p-4">Duration</th>
                <th className="p-4 text-right">Energy (kWh)</th>
                <th className="p-4 text-right">Savings (RM)</th>
                <th className="p-4 text-right">CO₂ (kg)</th>
              </tr>
            </thead>
            <tbody>
              {loading && logs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-gray-500 font-mono animate-pulse">
                    Loading historical savings records...
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-gray-500">
                    No savings logs found. Empty database or no vacancy events recorded.
                  </td>
                </tr>
              ) : (
                logs.map((log) => {
                  const room = rooms.find((r) => r.id.toString() === log.room_id.toString());
                  return (
                    <tr
                      key={log.id}
                      className="border-b border-gray-850/65 hover:bg-gray-850/20 transition-colors duration-150"
                    >
                      <td className="p-4 font-semibold text-gray-300">
                        {room ? room.name : `Room ${log.room_id}`}
                      </td>
                      <td className="p-4 font-mono text-xs text-gray-450">{formatDate(log.start_time)}</td>
                      <td className="p-4 font-mono text-xs text-gray-450">{formatDate(log.end_time)}</td>
                      <td className="p-4 text-gray-350">{formatDuration(log.start_time, log.end_time)}</td>
                      <td className="p-4 font-mono text-right text-blue-400 font-medium">
                        {parseFloat(log.kwh_saved.toString()).toFixed(3)}
                      </td>
                      <td className="p-4 font-mono text-right text-emerald-400 font-medium">
                        RM {parseFloat(log.rm_saved.toString()).toFixed(2)}
                      </td>
                      <td className="p-4 font-mono text-right text-teal-400 font-medium">
                        {parseFloat(log.co2_saved.toString()).toFixed(3)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
