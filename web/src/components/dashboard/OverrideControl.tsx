import React, { useState } from 'react';
import { supabase } from '@/utils/supabase/client';
import { ShieldAlert, Cpu, Power, PowerOff } from 'lucide-react';
import { useConnectivity } from '@/components/layout/DashboardLayout';

interface Room {
  id: string | number;
  name: string;
  status: 'OCCUPIED' | 'VACANT';
  manual_override: boolean;
  nominal_power: number;
  updated_at: string;
}

interface OverrideControlProps {
  room: Room | null;
  onRoomUpdated: (updatedRoom: Room) => void;
}

export default function OverrideControl({ room, onRoomUpdated }: OverrideControlProps) {
  const { setOnline } = useConnectivity();
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [lockedMode, setLockedMode] = useState<'AUTO' | 'FORCE_ON' | 'FORCE_OFF' | null>(null);

  if (!room) {
    return (
      <div className="glass-panel rounded-2xl p-6 flex flex-col justify-center items-center h-full text-center min-h-[200px]">
        <ShieldAlert className="h-8 w-8 text-gray-550 mb-2" />
        <p className="text-sm font-medium text-gray-400">No room selected</p>
        <p className="text-xs text-gray-500 mt-1">Select a room from the floor plan or map to control it.</p>
      </div>
    );
  }

  const handleModeChange = async (mode: 'AUTO' | 'FORCE_ON' | 'FORCE_OFF') => {
    setLoading(true);
    setErrorMsg(null);
    setLockedMode(mode);

    let payload: Partial<Room> = {};
    if (mode === 'AUTO') {
      payload = { manual_override: false };
    } else if (mode === 'FORCE_ON') {
      payload = { manual_override: true, status: 'OCCUPIED' };
    } else {
      payload = { manual_override: true, status: 'VACANT' };
    }

    // Optimistically update the parent component's state to set the polling lock timestamp immediately
    const expectedRoom = { ...room, ...payload } as Room;
    onRoomUpdated(expectedRoom);

    try {
      const { data, error } = await supabase
        .from('rooms')
        .update(payload)
        .eq('id', room.id)
        .select();

      if (error) throw error;

      setOnline(true);

      if (data && data.length > 0) {
        onRoomUpdated(data[0] as Room);
      } else {
        // Fallback for mock servers that return 200 without payload details
        onRoomUpdated(expectedRoom);
      }
    } catch (err: any) {
      setOnline(false);
      console.error('Error updating override control:', err);
      setErrorMsg(err.message || 'Failed to update override state');
      // Revert parent state on error
      onRoomUpdated(room);
    } finally {
      setLockedMode(null);
      setLoading(false);
    }
  };

  // Determine current mode for active styling, checking lockedMode first
  const currentMode = lockedMode || (!room.manual_override
    ? 'AUTO'
    : room.status === 'OCCUPIED'
    ? 'FORCE_ON'
    : 'FORCE_OFF');

  return (
    <div className="glass-panel rounded-2xl p-6 flex flex-col justify-between h-full min-h-[220px]">
      <div>
        <div className="flex justify-between items-start mb-4">
          <div>
            <h3 className="text-gray-200 font-semibold text-lg">Manual Override Control</h3>
            <p className="text-xs text-gray-400 mt-0.5">Control mode for room: <span className="text-emerald-400 font-bold">{room.name}</span></p>
          </div>
          <div className="bg-blue-500/10 text-blue-400 border border-blue-500/20 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
            <Cpu className="h-3.5 w-3.5" /> ID: {room.id}
          </div>
        </div>

        {errorMsg && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs px-3 py-2 rounded-lg mb-4">
            {errorMsg}
          </div>
        )}

        <div className="grid grid-cols-3 gap-3">
          {/* AUTO MODE */}
          <button
            onClick={() => handleModeChange('AUTO')}
            disabled={loading}
            className={`flex flex-col items-center justify-center p-3.5 rounded-xl border transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed ${
              currentMode === 'AUTO'
                ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.15)]'
                : 'bg-gray-950/40 border-gray-800 text-gray-400 hover:text-gray-200 hover:bg-gray-800/40'
            }`}
          >
            <Cpu className="h-5 w-5 mb-2" />
            <span className="text-xs font-bold tracking-wider">AUTO</span>
            <span className="text-[10px] text-gray-500 mt-0.5">Active Sensors</span>
          </button>

          {/* FORCE ON MODE */}
          <button
            onClick={() => handleModeChange('FORCE_ON')}
            disabled={loading}
            className={`flex flex-col items-center justify-center p-3.5 rounded-xl border transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed ${
              currentMode === 'FORCE_ON'
                ? 'bg-red-500/20 border-red-500 text-red-400 shadow-[0_0_15px_rgba(239,68,68,0.15)]'
                : 'bg-gray-950/40 border-gray-800 text-gray-400 hover:text-gray-200 hover:bg-gray-800/40'
            }`}
          >
            <Power className="h-5 w-5 mb-2" />
            <span className="text-xs font-bold tracking-wider text-center">FORCE ON</span>
            <span className="text-[10px] text-gray-500 mt-0.5">Lights Forced ON</span>
          </button>

          {/* FORCE OFF MODE */}
          <button
            onClick={() => handleModeChange('FORCE_OFF')}
            disabled={loading}
            className={`flex flex-col items-center justify-center p-3.5 rounded-xl border transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed ${
              currentMode === 'FORCE_OFF'
                ? 'bg-gray-700/30 border-gray-500 text-gray-300 shadow-[0_0_15px_rgba(255,255,255,0.05)]'
                : 'bg-gray-950/40 border-gray-800 text-gray-400 hover:text-gray-200 hover:bg-gray-800/40'
            }`}
          >
            <PowerOff className="h-5 w-5 mb-2" />
            <span className="text-xs font-bold tracking-wider text-center">FORCE OFF</span>
            <span className="text-[10px] text-gray-500 mt-0.5">Lights Forced OFF</span>
          </button>
        </div>
      </div>

      <div className="mt-4 pt-4 border-t border-gray-800/60 flex justify-between items-center text-xs text-gray-400">
        <span>Current Status:</span>
        <span className={`font-mono font-bold uppercase ${room.status === 'OCCUPIED' ? 'text-red-400' : 'text-emerald-400'}`}>
          {room.status}
        </span>
      </div>
    </div>
  );
}
