import React from 'react';

interface Room {
  id: string | number;
  name: string;
  status: 'OCCUPIED' | 'VACANT';
  manual_override: boolean;
  nominal_power: number;
  updated_at: string;
}

interface FloorPlanProps {
  rooms: Room[];
  selectedRoomId: string | number | null;
  onSelectRoom: (roomId: string | number) => void;
}

export default function FloorPlan({ rooms, selectedRoomId, onSelectRoom }: FloorPlanProps) {
  // Find room details from the array or fallback to vacant defaults
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

  const renderRoom = (room: any, x: number, y: number, width: number, height: number) => {
    const isOccupied = room.status === 'OCCUPIED';
    const isSelected = selectedRoomId?.toString() === room.id.toString();

    // Determine colors
    const fill = isOccupied ? 'rgba(239, 68, 68, 0.15)' : 'rgba(31, 41, 55, 0.5)';
    const stroke = isOccupied ? '#ef4444' : '#22c55e';
    const glowClass = isOccupied ? 'glow-occupied' : 'glow-vacant';

    return (
      <g
        onClick={() => onSelectRoom(room.id)}
        className="cursor-pointer group"
      >
        {/* Room Outer Border (Selected State Highlight) */}
        {isSelected && (
          <rect
            x={x - 4}
            y={y - 4}
            width={width + 8}
            height={height + 8}
            fill="none"
            stroke="#60a5fa"
            strokeWidth="2"
            strokeDasharray="4,4"
            className="animate-[spin_10s_linear_infinite]"
            rx="8"
          />
        )}

        {/* Main Room Body */}
        <rect
          x={x}
          y={y}
          width={width}
          height={height}
          fill={fill}
          stroke={stroke}
          strokeWidth={isSelected ? "3" : "2"}
          rx="6"
          className={`${glowClass} transition-all duration-300 group-hover:brightness-125`}
        />

        {/* Room Label */}
        <text
          x={x + width / 2}
          y={y + height / 2 - 15}
          textAnchor="middle"
          className="fill-gray-100 font-semibold text-base select-none"
        >
          {room.name}
        </text>

        {/* Room Status Indicator Badge */}
        <g transform={`translate(${x + width / 2 - 45}, ${y + height / 2 + 10})`}>
          <rect
            width="90"
            height="24"
            rx="12"
            fill={isOccupied ? 'rgba(239, 68, 68, 0.2)' : 'rgba(34, 197, 94, 0.2)'}
            stroke={isOccupied ? 'rgba(239, 68, 68, 0.4)' : 'rgba(34, 197, 94, 0.4)'}
            strokeWidth="1"
          />
          <circle
            cx="15"
            cy="12"
            r="4"
            fill={isOccupied ? '#ef4444' : '#22c55e'}
            className={isOccupied ? 'animate-pulse' : ''}
          />
          <text
            x="50"
            y="16"
            textAnchor="middle"
            className={`font-mono font-bold text-xs uppercase select-none ${
              isOccupied ? 'fill-red-400' : 'fill-emerald-400'
            }`}
          >
            {room.status}
          </text>
        </g>

        {/* Decorative Grid Lines to make it look premium/architectural */}
        <line
          x1={x + 15}
          y1={y + height - 15}
          x2={x + 35}
          y2={y + height - 15}
          stroke={stroke}
          strokeWidth="1"
          opacity="0.3"
        />
        <line
          x1={x + 15}
          y1={y + height - 35}
          x2={x + 15}
          y2={y + height - 15}
          stroke={stroke}
          strokeWidth="1"
          opacity="0.3"
        />

        <line
          x1={x + width - 15}
          y1={y + 15}
          x2={x + width - 35}
          y2={y + 15}
          stroke={stroke}
          strokeWidth="1"
          opacity="0.3"
        />
        <line
          x1={x + width - 15}
          y1={y + 15}
          x2={x + width - 15}
          y2={y + 35}
          stroke={stroke}
          strokeWidth="1"
          opacity="0.3"
        />
      </g>
    );
  };

  return (
    <div className="glass-panel rounded-2xl p-6 flex flex-col items-center">
      <div className="w-full flex justify-between items-center mb-6">
        <h3 className="text-gray-200 font-semibold text-lg">Interactive Floor Plan</h3>
        <span className="text-xs text-gray-400 bg-gray-900/40 px-2.5 py-1 rounded-full border border-gray-800/60">
          Click room to view telemetry & overrides
        </span>
      </div>

      <div className="w-full overflow-x-auto flex justify-center py-4">
        <svg
          viewBox="0 0 600 400"
          className="w-full max-w-[550px] h-auto text-gray-300"
        >
          {/* Grid Background */}
          <defs>
            <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
              <path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(255, 255, 255, 0.02)" strokeWidth="1" />
            </pattern>
          </defs>
          <rect width="600" height="400" fill="url(#grid)" rx="12" />

          {/* Outer Boundary Wall of the Corridor / Department */}
          <rect
            x="20"
            y="20"
            width="560"
            height="360"
            fill="none"
            stroke="rgba(255, 255, 255, 0.1)"
            strokeWidth="1"
            rx="10"
          />

          {/* Center Corridor Walkway */}
          <rect
            x="270"
            y="40"
            width="60"
            height="320"
            fill="rgba(255, 255, 255, 0.02)"
            stroke="rgba(255, 255, 255, 0.05)"
            strokeWidth="1"
            strokeDasharray="5,5"
          />
          <text
            x="300"
            y="200"
            textAnchor="middle"
            transform="rotate(-90 300 200)"
            className="fill-gray-600 font-mono text-xs uppercase tracking-widest select-none"
          >
            Main Corridor
          </text>

          {/* Render Room 1: Fotogrametri */}
          {renderRoom(fotogrametri, 40, 40, 210, 320)}

          {/* Render Room 2: Kartografi */}
          {renderRoom(kartografi, 350, 40, 210, 320)}
        </svg>
      </div>

      {/* Legend */}
      <div className="flex gap-6 mt-4 text-xs font-medium text-gray-400">
        <div className="flex items-center gap-2">
          <span className="w-3.5 h-3.5 rounded bg-red-500/20 border border-red-500 inline-block"></span>
          <span>Occupied (Pulsing Glow)</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3.5 h-3.5 rounded bg-gray-800 border border-emerald-500 inline-block"></span>
          <span>Vacant (Green Border)</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3.5 h-3.5 rounded border border-dashed border-blue-400 inline-block"></span>
          <span>Selected room</span>
        </div>
      </div>
    </div>
  );
}
