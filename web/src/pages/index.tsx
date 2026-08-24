import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '@/utils/supabase/client';
import { useConnectivity } from '@/components/layout/DashboardLayout';
import FloorPlan from '@/components/dashboard/FloorPlan';
import FloorPlanMap from '@/components/dashboard/FloorPlanMap';
import OverrideControl from '@/components/dashboard/OverrideControl';
import SavingsChart from '@/components/dashboard/SavingsChart';
import { Zap, Coins, Leaf, Bolt, AlertTriangle, ArrowUpRight } from 'lucide-react';

interface Room {
  id: string | number;
  name: string;
  status: 'OCCUPIED' | 'VACANT';
  manual_override: boolean;
  nominal_power: number;
  updated_at: string;
}

interface EnergyReading {
  id: string | number;
  room_id: string | number;
  voltage: number;
  current: number;
  power: number;
  energy: number;
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
  created_at: string;
}

export default function DashboardPage() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [readings, setReadings] = useState<EnergyReading[]>([]);
  const [logs, setLogs] = useState<SavingsLog[]>([]);
  const [selectedRoomId, setSelectedRoomId] = useState<string | number | null>(null);
  const [isClient, setIsClient] = useState(false);
  const { setOnline } = useConnectivity();
  const [dbError, setDbError] = useState<string | null>(null);
  const lastManualUpdatesRef = useRef<{ [roomId: string]: number }>({});

  const fetchData = async () => {
    try {
      const [roomsRes, readingsRes, logsRes] = await Promise.all([
        supabase.from('rooms').select('*'),
        supabase.from('energy_readings').select('*'),
        supabase.from('savings_log').select('*')
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
            if (now - lastUpdate < 4000) {
              const currentLocal = prevRooms.find(r => r.id.toString() === incomingRoom.id.toString());
              return currentLocal || incomingRoom;
            }
            return incomingRoom;
          });
        });
        // Default select Fotogrametri room on mount
        if (roomsList.length > 0 && selectedRoomId === null) {
          const fotoRoom = roomsList.find(r => r.name.toLowerCase().includes('fotogrametri'));
          setSelectedRoomId(fotoRoom ? fotoRoom.id : roomsList[0].id);
        }
      }

      if (readingsRes.data) {
        setReadings(readingsRes.data as EnergyReading[]);
      }

      if (logsRes.data) {
        setLogs(logsRes.data as SavingsLog[]);
      }
    } catch (err: any) {
      console.error('Error polling dashboard state:', err);
      setOnline(false);
      setDbError(err.message || 'Unknown database exception occurred.');
    }
  };

  useEffect(() => {
    setIsClient(true);
    fetchData();
    const timer = setInterval(fetchData, 3000);
    return () => clearInterval(timer);
  }, [selectedRoomId]);

  // Handle manual override changes locally to prevent 3s polling lag
  const handleRoomUpdated = (updatedRoom: Room) => {
    lastManualUpdatesRef.current[updatedRoom.id.toString()] = Date.now();
    setRooms(prevRooms => prevRooms.map(r => r.id.toString() === updatedRoom.id.toString() ? updatedRoom : r));
  };

  // Compute cumulative savings
  const totalKwhSaved = logs.reduce((acc, log) => acc + (parseFloat(log.kwh_saved.toString()) || 0), 0);
  const totalRmSaved = logs.reduce((acc, log) => acc + (parseFloat(log.rm_saved.toString()) || 0), 0);
  const totalCo2Saved = logs.reduce((acc, log) => acc + (parseFloat(log.co2_saved.toString()) || 0), 0);

  // Selected room details
  const selectedRoom = rooms.find(r => r.id.toString() === selectedRoomId?.toString()) || null;

  // Find latest telemetry reading for selected room
  const selectedRoomReadings = readings.filter(r => r.room_id.toString() === selectedRoomId?.toString());
  const latestReading = selectedRoomReadings.length > 0 
    ? [...selectedRoomReadings].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0]
    : null;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {dbError && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-200 px-6 py-4 rounded-2xl flex items-start gap-4 shadow-lg animate-pulse">
          <AlertTriangle className="h-6 w-6 text-red-500 shrink-0 mt-0.5" />
          <div className="flex-1">
            <h4 className="font-bold text-base text-red-400">Database Connection Failed</h4>
            <p className="text-sm text-gray-300 mt-1">
              Unable to reach the Supabase database. Please check your connection or contact system administration.
            </p>
            <p className="text-xs text-red-500/70 font-mono mt-2 bg-black/30 p-2 rounded-lg border border-red-500/10">
              Details: {dbError}
            </p>
          </div>
        </div>
      )}
      {/* Overview KPI Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="glass-panel rounded-2xl p-5 flex items-center justify-between border-l-4 border-l-emerald-500">
          <div>
            <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Cumulative Energy Saved</span>
            <h3 className="text-2xl font-bold text-emerald-400 mt-1 font-mono">
              {totalKwhSaved.toFixed(3)} <span className="text-sm text-gray-400 font-sans">kWh</span>
            </h3>
          </div>
          <div className="bg-emerald-500/10 p-3 rounded-xl text-emerald-400">
            <Zap className="h-5 w-5" />
          </div>
        </div>

        <div className="glass-panel rounded-2xl p-5 flex items-center justify-between border-l-4 border-l-blue-500">
          <div>
            <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Cumulative Cost Saved</span>
            <h3 className="text-2xl font-bold text-blue-400 mt-1 font-mono">
              RM {totalRmSaved.toFixed(2)}
            </h3>
          </div>
          <div className="bg-blue-500/10 p-3 rounded-xl text-blue-400">
            <Coins className="h-5 w-5" />
          </div>
        </div>

        <div className="glass-panel rounded-2xl p-5 flex items-center justify-between border-l-4 border-l-teal-500">
          <div>
            <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Cumulative CO₂ Avoided</span>
            <h3 className="text-2xl font-bold text-teal-400 mt-1 font-mono">
              {totalCo2Saved.toFixed(3)} <span className="text-sm text-gray-400 font-sans">kg</span>
            </h3>
          </div>
          <div className="bg-teal-500/10 p-3 rounded-xl text-teal-400">
            <Leaf className="h-5 w-5" />
          </div>
        </div>
      </div>

      {/* Main Grid: Left is Visualization, Right is Control Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Floorplan & Savings Chart */}
        <div className="lg:col-span-2 space-y-6">
          <FloorPlan
            rooms={rooms}
            selectedRoomId={selectedRoomId}
            onSelectRoom={setSelectedRoomId}
          />
          <SavingsChart rooms={rooms} savingsLogs={logs} />
        </div>

        {/* Right Column: Room Details, Telemetry, Map */}
        <div className="space-y-6">
          {/* Room Telemetry Panel */}
          <div className="glass-panel rounded-2xl p-6 flex flex-col justify-between border border-gray-800/60">
            <div>
              <div className="flex justify-between items-start mb-5">
                <div>
                  <h3 className="text-gray-200 font-semibold text-lg">Active Telemetry</h3>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Real-time PZEM-004T readings for:{' '}
                    <span className="text-emerald-400 font-bold">{selectedRoom ? selectedRoom.name : 'N/A'}</span>
                  </p>
                </div>
                {selectedRoom?.status === 'OCCUPIED' ? (
                  <span className="bg-red-500/15 text-red-400 border border-red-500/30 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 animate-pulse">
                    <Bolt className="h-3 w-3" /> ACTIVE
                  </span>
                ) : (
                  <span className="bg-gray-800 text-gray-400 text-[10px] font-bold px-2 py-0.5 rounded-full">
                    STANDBY
                  </span>
                )}
              </div>

              {latestReading ? (
                <div className="grid grid-cols-2 gap-4">
                  {/* Voltage */}
                  <div className="bg-gray-950/50 border border-gray-850 p-4 rounded-xl">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Voltage</span>
                    <span className="text-xl font-bold font-mono text-gray-150 block mt-1">
                      {latestReading.voltage.toFixed(1)} <span className="text-xs text-gray-500 font-sans">V</span>
                    </span>
                  </div>

                  {/* Current */}
                  <div className="bg-gray-950/50 border border-gray-850 p-4 rounded-xl">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Current</span>
                    <span className="text-xl font-bold font-mono text-gray-150 block mt-1">
                      {latestReading.current.toFixed(3)} <span className="text-xs text-gray-500 font-sans">A</span>
                    </span>
                  </div>

                  {/* Active Power */}
                  <div className="bg-gray-950/50 border border-gray-850 p-4 rounded-xl">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Active Power</span>
                    <span className="text-xl font-bold font-mono text-gray-150 block mt-1">
                      {latestReading.power.toFixed(1)} <span className="text-xs text-gray-500 font-sans">W</span>
                    </span>
                  </div>

                  {/* Energy Consumed */}
                  <div className="bg-gray-950/50 border border-gray-850 p-4 rounded-xl">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Energy Consumed</span>
                    <span className="text-xl font-bold font-mono text-gray-150 block mt-1">
                      {latestReading.energy.toFixed(3)} <span className="text-xs text-gray-500 font-sans">kWh</span>
                    </span>
                  </div>
                </div>
              ) : (
                <div className="py-8 text-center bg-gray-950/30 border border-dashed border-gray-800 rounded-xl flex flex-col items-center justify-center p-4">
                  <AlertTriangle className="h-6 w-6 text-gray-500 mb-1.5" />
                  <p className="text-xs font-semibold text-gray-400">No telemetry data posted yet</p>
                  <p className="text-[10px] text-gray-550 max-w-[200px] mt-0.5">
                    Waiting for ESP32 firmware to post PZEM-004T readings for this room.
                  </p>
                </div>
              )}
            </div>

            <div className="mt-4 pt-4 border-t border-gray-800/60 flex justify-between items-center text-xs text-gray-500 font-mono">
              <span>Last Reading:</span>
              <span>
                {latestReading ? new Date(latestReading.created_at).toLocaleTimeString() : 'Never'}
              </span>
            </div>
          </div>

          {/* Override Control */}
          <OverrideControl room={selectedRoom} onRoomUpdated={handleRoomUpdated} />

          {/* Map Section */}
          {isClient && (
            <FloorPlanMap
              rooms={rooms}
              selectedRoomId={selectedRoomId}
              onSelectRoom={setSelectedRoomId}
            />
          )}
        </div>
      </div>
    </div>
  );
}
