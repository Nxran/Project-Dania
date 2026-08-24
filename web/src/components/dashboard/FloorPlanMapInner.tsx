import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapPin, Building2, Zap, ShieldCheck, Cpu, Navigation, Activity, CheckCircle2 } from 'lucide-react';

fixLeafletIcons();

function fixLeafletIcons() {
  if (typeof window !== 'undefined') {
    delete (L.Icon.Default.prototype as any)._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
      iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
      shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
    });
  }
}

export interface Room {
  id: string | number;
  name: string;
  status: 'OCCUPIED' | 'VACANT';
  manual_override: boolean;
  nominal_power: number;
  category?: string;
  latitude?: number;
  longitude?: number;
  last_heartbeat?: string;
  updated_at: string;
}

interface MapInnerProps {
  rooms: Room[];
  selectedRoomId: string | number | null;
  onSelectRoom: (roomId: string | number) => void;
}

// Exact GPS coordinates of Politeknik Sultan Haji Ahmad Shah (POLISAS), Semambu, Kuantan
const POLISAS_COORDINATES: [number, number] = [3.8615, 103.3156];

function MapRecenter({ coords }: { coords: [number, number] | null }) {
  const map = useMap();
  useEffect(() => {
    if (coords && coords[0] && coords[1]) {
      map.flyTo(coords, 18, {
        duration: 1.0,
        easeLinearity: 0.25,
      });
    }
  }, [coords, map]);
  return null;
}

function MapResetButton({ onReset }: { onReset: () => void }) {
  return (
    <button
      onClick={onReset}
      className="absolute bottom-4 right-4 z-[1000] px-3 py-1.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-slate-200 border border-slate-700/80 shadow-lg text-[11px] font-bold font-sans flex items-center gap-1.5 backdrop-blur-md transition-all hover:border-sapphire-500/50"
      title="Pusatkan Peta ke Kampus POLISAS"
    >
      <Navigation className="w-3.5 h-3.5 text-sapphire-400" />
      <span>Pusat POLISAS</span>
    </button>
  );
}

export default function FloorPlanMapInner({ rooms, selectedRoomId, onSelectRoom }: MapInnerProps) {
  const [mapCenter, setMapCenter] = useState<[number, number]>(POLISAS_COORDINATES);

  // Realistic layout distribution for POLISAS Semambu engineering & IT buildings
  const campusOffsets = [
    { dLat: 0.00018, dLng: -0.00022 }, // Blok A Makmal Komputer
    { dLat: 0.00025, dLng: 0.00015 },  // Blok B Kejuruteraan Elektrik
    { dLat: -0.00015, dLng: -0.00028 }, // Dewan Kuliah Utama
    { dLat: -0.00022, dLng: 0.00018 },  // Bengkel Mekatronik
    { dLat: 0.00005, dLng: 0.00035 },   // Pusat Sumber & Data
    { dLat: -0.00030, dLng: -0.00005 }, // Makmal IoT & Sistem Terbenam
  ];

  const locations = rooms.map((room, idx) => {
    const offset = campusOffsets[idx % campusOffsets.length];
    const lat = room.latitude && !isNaN(Number(room.latitude))
      ? parseFloat(room.latitude.toString())
      : POLISAS_COORDINATES[0] + offset.dLat;
    const lng = room.longitude && !isNaN(Number(room.longitude))
      ? parseFloat(room.longitude.toString())
      : POLISAS_COORDINATES[1] + offset.dLng;

    const isHardwareOnline = room.last_heartbeat
      ? Date.now() - new Date(room.last_heartbeat).getTime() < 20000
      : false;

    return {
      id: room.id,
      name: room.name,
      room,
      isHardwareOnline,
      coords: [lat, lng] as [number, number],
      isOccupied: room.status === 'OCCUPIED',
      color: room.status === 'OCCUPIED' ? '#f43f5e' : '#10b981',
    };
  });

  const selectedLocation = locations.find((l) => l.id.toString() === selectedRoomId?.toString());
  const activeCoords = selectedLocation ? selectedLocation.coords : locations.length > 0 ? locations[0].coords : POLISAS_COORDINATES;

  useEffect(() => {
    if (selectedLocation) {
      setMapCenter(selectedLocation.coords);
    }
  }, [selectedLocation]);

  return (
    <div className="glass-panel rounded-3xl p-5 sm:p-6 flex flex-col h-[520px] shadow-card-slate border border-slate-800/80 relative overflow-hidden bg-slate-900/60 backdrop-blur-xl">
      {/* Header Bar */}
      <div className="w-full flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 rounded-2xl shadow-sm">
            <MapPin className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-slate-100 font-bold text-base tracking-tight flex items-center gap-2">
              Peta Geospatial Kampus POLISAS
              <span className="text-[10px] font-mono font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                CartoDB Dark
              </span>
            </h3>
            <p className="text-xs text-slate-400 font-sans">
              Lokasi: <span className="text-emerald-300 font-mono font-semibold">Semambu, Kuantan (3.8615° N, 103.3156° E)</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[11px] font-mono font-bold text-sapphire-300 bg-sapphire-500/10 px-3 py-1 rounded-xl border border-sapphire-500/20">
            {locations.length} Penanda Makmal
          </span>
        </div>
      </div>

      {/* Leaflet Dark Matter Canvas */}
      <div className="flex-1 w-full rounded-2xl overflow-hidden border border-slate-800/90 relative z-10 shadow-inner">
        <MapContainer
          center={activeCoords}
          zoom={17}
          scrollWheelZoom={true}
          style={{ height: '100%', width: '100%', backgroundColor: '#020617' }}
        >
          {/* CartoDB Dark Matter High-Contrast Tiles */}
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions" target="_blank">CARTO</a>'
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            maxZoom={20}
          />

          {/* Dynamic Interactive Markers */}
          {locations.map((loc) => {
            const isSelected = selectedRoomId?.toString() === loc.id.toString();
            const isOccupied = loc.isOccupied;

            const markerHtml = `
              <div style="position: relative; width: 34px; height: 34px; display: flex; align-items: center; justify-content: center; cursor: pointer;">
                ${
                  isOccupied
                    ? `<span style="position: absolute; width: 100%; height: 100%; border-radius: 50%; background-color: #f43f5e; opacity: 0.45; transform: scale(1.7);" class="animate-ping"></span>`
                    : `<span style="position: absolute; width: 85%; height: 85%; border-radius: 50%; background-color: #10b981; opacity: 0.25;"></span>`
                }
                ${
                  isSelected
                    ? `<span style="position: absolute; width: 38px; height: 38px; border-radius: 50%; border: 2.5px dashed #38bdf8; box-shadow: 0 0 16px rgba(56, 189, 248, 0.7);" class="animate-spin" style="animation-duration: 8s;"></span>`
                    : ''
                }
                <div style="
                  position: relative;
                  width: 22px;
                  height: 22px;
                  border-radius: 50%;
                  background: ${isOccupied ? 'linear-gradient(135deg, #f43f5e, #be123c)' : 'linear-gradient(135deg, #10b981, #047857)'};
                  border: 2px solid ${isSelected ? '#38bdf8' : '#ffffff'};
                  box-shadow: 0 0 16px ${isOccupied ? 'rgba(244, 63, 94, 0.9)' : 'rgba(16, 185, 129, 0.8)'};
                  display: flex;
                  align-items: center;
                  justify-content: center;
                ">
                  <span style="width: 6px; height: 6px; border-radius: 50%; background: #ffffff;"></span>
                </div>
              </div>
            `;

            const markerIcon = typeof window !== 'undefined' ? new L.DivIcon({
              className: 'custom-leaflet-marker',
              html: markerHtml,
              iconSize: [34, 34],
              iconAnchor: [17, 17],
              popupAnchor: [0, -17],
            }) : undefined;

            return (
              <Marker
                key={loc.id}
                position={loc.coords}
                icon={markerIcon}
                eventHandlers={{
                  click: () => onSelectRoom(loc.id),
                }}
              >
                {/* Modern Slate Dark Popup */}
                <Popup className="custom-popup">
                  <div className="p-3.5 bg-slate-900/95 text-slate-100 rounded-2xl min-w-[210px] space-y-2.5 font-sans border border-slate-800/80">
                    {/* Header */}
                    <div className="flex items-start justify-between gap-2 border-b border-slate-800 pb-2">
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 rounded-lg bg-sapphire-500/15 text-sapphire-400 border border-sapphire-500/30">
                          <Building2 className="w-3.5 h-3.5" />
                        </div>
                        <div>
                          <h4 className="font-bold text-xs text-slate-100 tracking-tight leading-snug">
                            {loc.name}
                          </h4>
                          <span className="text-[9px] font-mono font-bold text-slate-400 uppercase">
                            {loc.room.category || 'MAKMAL POLISAS'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Status & Telemetry Grid */}
                    <div className="space-y-1.5 text-[11px]">
                      {/* Room Lamp Status */}
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">Status Beban:</span>
                        <span
                          className={`font-mono font-black text-[10px] px-2 py-0.5 rounded-md ${
                            loc.isOccupied
                              ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 shadow-[0_0_8px_rgba(244,63,94,0.3)]'
                              : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                          }`}
                        >
                          {loc.isOccupied ? 'OCCUPIED (ON)' : 'VACANT (JIMAT)'}
                        </span>
                      </div>

                      {/* ESP32 Hardware Status */}
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">Mikropengawal:</span>
                        <span
                          className={`font-mono font-bold text-[10px] flex items-center gap-1 ${
                            loc.isHardwareOnline ? 'text-emerald-400' : 'text-slate-400'
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              loc.isHardwareOnline ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'
                            }`}
                          />
                          {loc.isHardwareOnline ? 'ESP32 AKTIF' : 'STANDBY'}
                        </span>
                      </div>

                      {/* Nominal Power Load */}
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">Beban Nominal:</span>
                        <span className="font-mono font-bold text-amber-300 text-[11px]">
                          ⚡ {Number(loc.room.nominal_power || 0).toLocaleString()} W
                        </span>
                      </div>

                      {/* GPS Reference */}
                      <div className="pt-1.5 border-t border-slate-800/80 flex items-center justify-between text-[9px] font-mono text-slate-500">
                        <span>POLISAS Semambu</span>
                        <span>{loc.coords[0].toFixed(4)}° N, {loc.coords[1].toFixed(4)}° E</span>
                      </div>
                    </div>

                    {/* Action Button */}
                    <button
                      onClick={() => onSelectRoom(loc.id)}
                      className={`w-full py-1.5 px-2.5 rounded-xl text-[11px] font-bold font-sans transition flex items-center justify-center gap-1.5 shadow-sm ${
                        isSelected
                          ? 'bg-sapphire-500 text-white shadow-glow-sapphire'
                          : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
                      }`}
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>{isSelected ? 'Bilik Ini Dipilih' : 'Pilih Makmal Ini'}</span>
                    </button>
                  </div>
                </Popup>
              </Marker>
            );
          })}

          <MapRecenter coords={mapCenter} />
        </MapContainer>

        {/* Map View Recenter to Campus Button */}
        <MapResetButton onReset={() => setMapCenter(POLISAS_COORDINATES)} />
      </div>

      {/* Geospatial Map Legend Footer */}
      <div className="flex flex-wrap items-center justify-between gap-3 mt-3 pt-3 border-t border-slate-800/80 text-xs font-medium text-slate-400">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shadow-[0_0_6px_#f43f5e]" />
            <span className="text-slate-300 text-[11px]">Occupied / Beban Aktif</span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_6px_#10b981]" />
            <span className="text-slate-300 text-[11px]">Vacant / Siap Sedia</span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full border border-sky-400" />
            <span className="text-sky-300 text-[11px]">Fokus Dipilih</span>
          </div>
        </div>

        <div className="text-[10.5px] font-mono text-slate-500 flex items-center gap-1">
          <Activity className="w-3 h-3 text-emerald-400" />
          <span>Sistem Telemetri Kampus POLISAS</span>
        </div>
      </div>
    </div>
  );
}
