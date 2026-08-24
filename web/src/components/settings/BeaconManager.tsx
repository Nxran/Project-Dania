import React, { useState, useEffect } from 'react';
import { supabase } from '@/utils/supabase/client';
import { Bluetooth, Smartphone, Plus, Trash2, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { useConnectivity } from '@/components/layout/DashboardLayout';

interface Room {
  id: string | number;
  name: string;
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

  // Form inputs
  const [deviceName, setDeviceName] = useState('');
  const [macAddress, setMacAddress] = useState('');

  // Status feedback
  const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const { setOnline } = useConnectivity();

  // Fetch rooms on mount
  useEffect(() => {
    fetchRooms();
  }, []);

  // Fetch beacons when selectedRoomId changes
  useEffect(() => {
    if (selectedRoomId) {
      fetchBeacons(selectedRoomId);
    } else {
      setBeacons([]);
    }
  }, [selectedRoomId]);

  const fetchRooms = async () => {
    setRoomsLoading(true);
    try {
      const { data, error } = await supabase
        .from('rooms')
        .select('id, name');

      if (error) throw error;
      setOnline(true);
      if (data && data.length > 0) {
        setRooms(data);
        setSelectedRoomId(data[0].id.toString());
      }
    } catch (err: any) {
      console.error('Error fetching rooms:', err);
      setOnline(false);
    } finally {
      setRoomsLoading(false);
    }
  };

  const fetchBeacons = async (roomId: string) => {
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
  };

  const handleAddBeacon = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus(null);

    if (!selectedRoomId) {
      setStatus({ type: 'error', message: 'Please select a room first.' });
      return;
    }

    if (!deviceName.trim()) {
      setStatus({ type: 'error', message: 'Please enter a device name.' });
      return;
    }

    // Format MAC Address: convert to uppercase, trim, and replace spaces
    const formattedMac = macAddress.trim().toUpperCase().replace(/\s+/g, '');
    const macRegex = /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/;

    if (!macRegex.test(formattedMac)) {
      setStatus({ type: 'error', message: 'Invalid MAC address. Must be in XX:XX:XX:XX:XX:XX or XX-XX-XX-XX-XX-XX format.' });
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase
        .from('authorized_beacons')
        .insert([
          {
            room_id: selectedRoomId,
            name: deviceName.trim(),
            mac_address: formattedMac
          }
        ]);

      if (error) throw error;

      setOnline(true);
      setStatus({ type: 'success', message: 'BLE device registered successfully.' });
      setDeviceName('');
      setMacAddress('');
      fetchBeacons(selectedRoomId);
    } catch (err: any) {
      console.error('Error adding beacon:', err);
      setOnline(false);
      setStatus({ type: 'error', message: err.message || 'Failed to register BLE device.' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteBeacon = async (id: string) => {
    if (!confirm('Are you sure you want to remove this authorized BLE device?')) return;
    
    setStatus(null);
    setDeletingId(id);
    try {
      const { error } = await supabase
        .from('authorized_beacons')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setOnline(true);
      setStatus({ type: 'success', message: 'BLE device removed successfully.' });
      fetchBeacons(selectedRoomId);
    } catch (err: any) {
      console.error('Error deleting beacon:', err);
      setOnline(false);
      setStatus({ type: 'error', message: err.message || 'Failed to remove BLE device.' });
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="glass-panel rounded-2xl p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="bg-indigo-500/10 p-2.5 rounded-xl border border-indigo-500/20 text-indigo-400">
          <Bluetooth className="h-5 w-5" />
        </div>
        <div>
          <h3 className="text-gray-200 font-semibold text-lg">BLE Geofencing Configuration</h3>
          <p className="text-xs text-gray-400">Register authorized smartphones or BLE beacons to maintain room power via proximity</p>
        </div>
      </div>

      {status && (
        <div
          className={`flex items-start gap-2.5 px-4 py-3 rounded-xl mb-6 text-sm border ${
            status.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
              : 'bg-red-500/10 border-red-500/20 text-red-400'
          }`}
        >
          {status.type === 'success' ? (
            <CheckCircle2 className="h-5 w-5 mt-0.5 shrink-0" />
          ) : (
            <AlertCircle className="h-5 w-5 mt-0.5 shrink-0" />
          )}
          <span>{status.message}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Left Column: Form & Selection */}
        <div className="space-y-5">
          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
              Select Lab / Room
            </label>
            {roomsLoading ? (
              <div className="h-10 rounded-xl bg-gray-950/40 border border-gray-800 animate-pulse flex items-center px-4">
                <Loader2 className="h-4 w-4 animate-spin text-gray-500" />
              </div>
            ) : (
              <select
                value={selectedRoomId}
                onChange={(e) => setSelectedRoomId(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl bg-gray-950/65 border border-gray-800 focus:border-indigo-500 text-gray-200 focus:outline-none transition text-sm cursor-pointer"
              >
                {rooms.map((room) => (
                  <option key={room.id} value={room.id}>
                    {room.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          <form onSubmit={handleAddBeacon} className="space-y-4 border-t border-gray-850 pt-5">
            <h4 className="text-sm font-semibold text-gray-300 flex items-center gap-1.5">
              <Smartphone className="h-4 w-4 text-indigo-400" /> Add Authorized Device
            </h4>

            <div>
              <label className="block text-xs font-semibold text-gray-400 mb-1.5">
                Device Owner Name
              </label>
              <input
                type="text"
                value={deviceName}
                onChange={(e) => setDeviceName(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl bg-gray-950/60 border border-gray-800 focus:border-indigo-500 text-gray-150 placeholder-gray-650 focus:outline-none transition text-sm"
                placeholder="e.g. Dr. Dania's iPhone"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-400 mb-1.5">
                Bluetooth MAC Address
              </label>
              <input
                type="text"
                value={macAddress}
                onChange={(e) => setMacAddress(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl bg-gray-950/60 border border-gray-800 focus:border-indigo-500 text-gray-150 placeholder-gray-650 focus:outline-none transition font-mono text-sm"
                placeholder="e.g. AA:BB:CC:11:22:33"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2.5 bg-indigo-500 hover:bg-indigo-600 disabled:bg-indigo-500/50 text-white font-bold rounded-xl transition text-sm shadow-[0_0_15px_rgba(99,102,241,0.25)] flex items-center justify-center gap-2"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4" />
                  Register Device
                </>
              )}
            </button>
          </form>
        </div>

        {/* Right Column: Registered Devices list */}
        <div className="space-y-4">
          <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider">
            Registered BLE Beacons
          </label>

          {beaconsLoading ? (
            <div className="py-12 text-center text-sm text-gray-450 font-mono animate-pulse">
              Loading registered beacons...
            </div>
          ) : beacons.length === 0 ? (
            <div className="py-12 border border-dashed border-gray-850 rounded-2xl flex flex-col items-center justify-center text-center px-6">
              <Bluetooth className="h-8 w-8 text-gray-650 mb-3" />
              <p className="text-gray-400 text-sm font-medium">No registered devices</p>
              <p className="text-gray-600 text-xs mt-1">Add a device on the left to get started</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1">
              {beacons.map((beacon) => (
                <div
                  key={beacon.id}
                  className="flex items-center justify-between p-4 rounded-xl bg-gray-900/30 border border-gray-800/60 hover:border-indigo-500/20 transition gap-4"
                >
                  <div className="flex-1 min-w-0">
                    <h5 className="font-semibold text-sm text-gray-255 truncate">{beacon.name}</h5>
                    <p className="text-xs text-gray-500 font-mono mt-1 select-all">{beacon.mac_address}</p>
                  </div>
                  <button
                    onClick={() => handleDeleteBeacon(beacon.id)}
                    disabled={deletingId === beacon.id}
                    className="p-2 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition shrink-0"
                    title="Remove device"
                  >
                    {deletingId === beacon.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4.5 w-4.5" />
                    )}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
