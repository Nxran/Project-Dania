import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix marker icons in Leaflet when compiled by Webpack/Next.js
useEffectFix();

function useEffectFix() {
  if (typeof window !== 'undefined') {
    delete (L.Icon.Default.prototype as any)._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
      iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
      shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
    });
  }
}

interface Room {
  id: string | number;
  name: string;
  status: 'OCCUPIED' | 'VACANT';
  manual_override: boolean;
  nominal_power: number;
  updated_at: string;
}

interface MapInnerProps {
  rooms: Room[];
  selectedRoomId: string | number | null;
  onSelectRoom: (roomId: string | number) => void;
}

// Center of the campus map
const centerCoordinate: [number, number] = [3.1209, 101.6538];

// Map panning handler to center on selected room
function MapRecenter({ coords }: { coords: [number, number] | null }) {
  const map = useMap();
  useEffect(() => {
    if (coords) {
      map.setView(coords, 18, { animate: true });
    }
  }, [coords, map]);
  return null;
}

export default function FloorPlanMapInner({ rooms, selectedRoomId, onSelectRoom }: MapInnerProps) {
  // Find room details from the array
  const fotogrametri = rooms.find(r => r.name.toLowerCase().includes('fotogrametri')) || {
    id: 1,
    name: 'Fotogrametri',
    status: 'VACANT' as const
  };

  const kartografi = rooms.find(r => r.name.toLowerCase().includes('kartografi')) || {
    id: 2,
    name: 'Kartografi',
    status: 'VACANT' as const
  };

  // Define location coordinates for the two labs
  const locations = [
    {
      id: fotogrametri.id,
      name: 'Fotogrametri Lab',
      room: fotogrametri,
      coords: [3.1209, 101.6538] as [number, number],
      color: fotogrametri.status === 'OCCUPIED' ? '#ef4444' : '#10b981'
    },
    {
      id: kartografi.id,
      name: 'Kartografi Lab',
      room: kartografi,
      coords: [3.1214, 101.6544] as [number, number],
      color: kartografi.status === 'OCCUPIED' ? '#ef4444' : '#10b981'
    }
  ];

  // Get selected location coordinate for map centering
  const selectedLocation = locations.find(l => l.id.toString() === selectedRoomId?.toString());
  const activeCoords = selectedLocation ? selectedLocation.coords : null;

  return (
    <div className="glass-panel rounded-2xl p-6 flex flex-col h-[400px]">
      <div className="w-full flex justify-between items-center mb-4">
        <h3 className="text-gray-200 font-semibold text-lg">Geospatial Campus Map</h3>
        <span className="text-xs text-gray-400 font-mono">CartoDB Dark Matter</span>
      </div>

      <div className="flex-1 w-full rounded-xl overflow-hidden border border-gray-800/60 relative z-10">
        <MapContainer
          center={centerCoordinate}
          zoom={17}
          scrollWheelZoom={true}
          style={{ height: '100%', width: '100%', background: '#0b0f19' }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          />

          {locations.map((loc) => {
            const isSelected = selectedRoomId?.toString() === loc.id.toString();
            // Create a custom div icon to represent room status and glowing rings
            const markerIcon = typeof window !== 'undefined' ? new L.DivIcon({
              className: 'custom-leaflet-marker',
              html: `
                <div style="position: relative; width: 20px; height: 20px; display: flex; align-items: center; justify-content: center;">
                  <span style="position: absolute; width: 100%; height: 100%; border-radius: 50%; background-color: ${loc.color}; opacity: 0.4; transform: scale(1.5);" class="${loc.room.status === 'OCCUPIED' ? 'animate-ping' : ''}"></span>
                  <span style="position: relative; width: 12px; height: 12px; border-radius: 50%; background-color: ${loc.color}; border: 2px solid #ffffff; box-shadow: 0 0 10px ${loc.color};"></span>
                </div>
              `,
              iconSize: [20, 20],
              iconAnchor: [10, 10],
              popupAnchor: [0, -10]
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
                <Popup className="custom-popup">
                  <div className="text-gray-900 font-sans p-1">
                    <h4 className="font-bold text-sm border-b pb-1 mb-1">{loc.name}</h4>
                    <p className="text-xs">
                      Status: <span className={`font-semibold ${loc.room.status === 'OCCUPIED' ? 'text-red-600' : 'text-green-600'}`}>{loc.room.status}</span>
                    </p>
                    <p className="text-[10px] text-gray-500 mt-1">Click to select in dashboard</p>
                  </div>
                </Popup>
              </Marker>
            );
          })}

          <MapRecenter coords={activeCoords} />
        </MapContainer>
      </div>
    </div>
  );
}
