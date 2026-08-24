import React from 'react';
import { Home, Layers, Zap, Building2, ShieldAlert, Cpu } from 'lucide-react';

export interface Room {
  id: string | number;
  name: string;
  status: 'OCCUPIED' | 'VACANT';
  manual_override: boolean;
  nominal_power: number;
  category?: string;
  icon?: string;
  wiring_type?: string;
  latitude?: number;
  longitude?: number;
  last_heartbeat?: string;
  updated_at: string;
}

interface FloorPlanProps {
  rooms: Room[];
  selectedRoomId: string | number | null;
  onSelectRoom: (roomId: string | number) => void;
}

export default function FloorPlan({ rooms, selectedRoomId, onSelectRoom }: FloorPlanProps) {
  if (!rooms || rooms.length === 0) {
    return (
      <div className="glass-panel rounded-3xl p-8 flex flex-col items-center justify-center text-center min-h-[380px] border border-slate-800/80 shadow-card-slate">
        <div className="p-4 rounded-2xl bg-slate-800/60 border border-slate-700/60 text-slate-400 mb-3 animate-pulse">
          <Building2 className="w-8 h-8" />
        </div>
        <h4 className="text-sm font-bold text-slate-300">Tiada Bilik Didaftarkan</h4>
        <p className="text-xs text-slate-500 mt-1 max-w-sm">
          Gunakan butang <strong>Urus Bilik</strong> di bahagian atas untuk mendaftar bilik atau zon makmal POLISAS pertama anda.
        </p>
      </div>
    );
  }

  const totalRooms = rooms.length;
  const occupiedCount = rooms.filter((r) => r.status === 'OCCUPIED').length;
  const vacantCount = totalRooms - occupiedCount;
  const totalNominalPower = rooms.reduce((acc, r) => acc + (Number(r.nominal_power) || 0), 0);

  // Dynamic grid column calculation
  const cols = totalRooms <= 2 ? 2 : totalRooms <= 4 ? 2 : 3;
  const rows = Math.ceil(totalRooms / cols);

  const svgWidth = 720;
  const padding = 24;
  const gap = 18;

  const usableWidth = svgWidth - padding * 2;
  const roomWidth = (usableWidth - (cols - 1) * gap) / cols;
  const roomHeight = 175;
  const svgHeight = padding * 2 + rows * roomHeight + (rows - 1) * gap + 10;

  return (
    <div className="glass-panel rounded-3xl p-5 sm:p-6 flex flex-col shadow-card-slate border border-slate-800/80 relative overflow-hidden bg-slate-900/60 backdrop-blur-xl">
      {/* Header Bar */}
      <div className="w-full flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-5">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-sapphire-500/10 border border-sapphire-500/25 text-sapphire-400 rounded-2xl shadow-sm">
            <Layers className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-slate-100 font-bold text-base tracking-tight flex items-center gap-2">
              Pelan Lantai Interaktif Makmal
              <span className="text-[10px] font-mono font-bold text-sapphire-400 bg-sapphire-500/10 px-2 py-0.5 rounded-full border border-sapphire-500/20">
                CAD SVG
              </span>
            </h3>
            <p className="text-xs text-slate-400">
              Seni bina zon pintar POLISAS • Pilih nod untuk telemetri &amp; suis kawalan
            </p>
          </div>
        </div>

        {/* Status Mini Badges */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[11px] font-mono font-bold text-rose-400 bg-rose-500/10 px-2.5 py-1 rounded-xl border border-rose-500/20 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-rose-500 shadow-[0_0_6px_#f43f5e] animate-pulse" />
            {occupiedCount} ON
          </span>
          <span className="text-[11px] font-mono font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-xl border border-emerald-500/20 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_6px_#10b981]" />
            {vacantCount} JIMAT
          </span>
          <span className="text-[11px] font-mono font-semibold text-slate-400 bg-slate-800/80 px-2.5 py-1 rounded-xl border border-slate-700">
            {totalRooms} Zon
          </span>
        </div>
      </div>

      {/* SVG Canvas Container */}
      <div className="w-full overflow-x-auto flex justify-center py-1">
        <svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          className="w-full max-w-[720px] h-auto select-none transition-all duration-300 drop-shadow-xl"
        >
          <defs>
            {/* High-Precision Blueprint Fine Grid Pattern */}
            <pattern id="floor-blueprint-grid" width="20" height="20" patternUnits="userSpaceOnUse">
              <path
                d="M 20 0 L 0 0 0 20"
                fill="none"
                stroke="rgba(51, 65, 85, 0.28)"
                strokeWidth="0.8"
              />
              <circle cx="20" cy="0" r="0.8" fill="rgba(96, 165, 250, 0.3)" />
              <circle cx="0" cy="20" r="0.8" fill="rgba(96, 165, 250, 0.3)" />
            </pattern>

            {/* Micro Dot Matrix Pattern */}
            <pattern id="blueprint-dots" width="40" height="40" patternUnits="userSpaceOnUse">
              <circle cx="20" cy="20" r="1" fill="rgba(148, 163, 184, 0.15)" />
              <path
                d="M 40 0 L 0 0 0 40"
                fill="none"
                stroke="rgba(30, 41, 59, 0.4)"
                strokeWidth="1.2"
              />
            </pattern>

            {/* Linear Gradients for Rooms */}
            <linearGradient id="occupied-gradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="rgba(244, 63, 94, 0.18)" />
              <stop offset="60%" stopColor="rgba(244, 63, 94, 0.06)" />
              <stop offset="100%" stopColor="rgba(15, 23, 42, 0.9)" />
            </linearGradient>

            <linearGradient id="vacant-gradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="rgba(16, 185, 129, 0.14)" />
              <stop offset="60%" stopColor="rgba(16, 185, 129, 0.04)" />
              <stop offset="100%" stopColor="rgba(15, 23, 42, 0.9)" />
            </linearGradient>

            <linearGradient id="selected-halo-grad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#38bdf8" />
              <stop offset="50%" stopColor="#818cf8" />
              <stop offset="100%" stopColor="#38bdf8" />
            </linearGradient>

            {/* Glowing Drop-Shadow Filters */}
            <filter id="glow-rose-filter" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="4" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>

            <filter id="glow-emerald-filter" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>

            <filter id="glow-cyan-filter" x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="6" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* Blueprint Deep Blue/Slate Base Background */}
          <rect
            width={svgWidth}
            height={svgHeight}
            fill="#020617"
            rx="20"
          />
          <rect
            width={svgWidth}
            height={svgHeight}
            fill="url(#floor-blueprint-grid)"
            rx="20"
          />
          <rect
            width={svgWidth}
            height={svgHeight}
            fill="url(#blueprint-dots)"
            rx="20"
            opacity="0.7"
          />

          {/* Outer Blueprint Architectural Perimeter Wall */}
          <rect
            x={padding - 12}
            y={padding - 12}
            width={svgWidth - (padding - 12) * 2}
            height={svgHeight - (padding - 12) * 2}
            fill="none"
            stroke="rgba(51, 65, 85, 0.85)"
            strokeWidth="1.5"
            rx="18"
          />

          {/* Architectural Technical Inner Perimeter Frame */}
          <rect
            x={padding - 7}
            y={padding - 7}
            width={svgWidth - (padding - 7) * 2}
            height={svgHeight - (padding - 7) * 2}
            fill="none"
            stroke="rgba(30, 41, 59, 0.8)"
            strokeWidth="1"
            strokeDasharray="4 4"
            rx="14"
          />

          {/* Blueprint Corner Crosshairs & Labels */}
          <g className="font-mono text-[8px] fill-slate-500 select-none">
            {/* Top-Left CAD Info */}
            <text x={padding - 6} y={padding - 16} className="tracking-widest">
              POLISAS • GRID REF: SEC-A • SCALE 1:100
            </text>
            <text x={padding} y={padding - 1} textAnchor="start" className="fill-slate-600 font-bold">
              +
            </text>

            {/* Top-Right CAD Info */}
            <text x={svgWidth - padding + 6} y={padding - 16} textAnchor="end" className="tracking-widest fill-sapphire-400/80">
              SMART ENERGY SCHEMATIC
            </text>
            <text x={svgWidth - padding} y={padding - 1} textAnchor="end" className="fill-slate-600 font-bold">
              +
            </text>

            {/* Bottom-Left CAD Info */}
            <text x={padding} y={svgHeight - padding + 10} textAnchor="start" className="fill-slate-600 font-bold">
              +
            </text>
            <text x={padding + 8} y={svgHeight - padding + 6} className="fill-slate-600">
              FASILITI ELEKTRIK &amp; ELEKTRONIK
            </text>

            {/* Bottom-Right CAD Info */}
            <text x={svgWidth - padding} y={svgHeight - padding + 10} textAnchor="end" className="fill-slate-600 font-bold">
              +
            </text>
            <text x={svgWidth - padding - 8} y={svgHeight - padding + 6} textAnchor="end" className="fill-slate-600">
              ESP32 + PZEM-004T IOT
            </text>
          </g>

          {/* Render Each Dynamic Room Node */}
          {rooms.map((room, index) => {
            const col = index % cols;
            const row = Math.floor(index / cols);
            const x = padding + col * (roomWidth + gap);
            const y = padding + row * (roomHeight + gap);

            const isOccupied = room.status === 'OCCUPIED';
            const isSelected = selectedRoomId?.toString() === room.id.toString();
            const isOverridden = room.manual_override;

            const strokeColor = isOccupied ? '#f43f5e' : '#10b981';
            const fillColor = isOccupied ? 'url(#occupied-gradient)' : 'url(#vacant-gradient)';
            const glowClass = isOccupied ? 'glow-occupied' : 'glow-vacant';

            return (
              <g
                key={room.id}
                onClick={() => onSelectRoom(room.id)}
                className="cursor-pointer group"
                role="button"
                tabIndex={0}
              >
                {/* 1. Selected Glowing Ring Highlight */}
                {isSelected && (
                  <>
                    {/* Outer Cyan Glow Ring */}
                    <rect
                      x={x - 6}
                      y={y - 6}
                      width={roomWidth + 12}
                      height={roomHeight + 12}
                      fill="none"
                      stroke="url(#selected-halo-grad)"
                      strokeWidth="2.5"
                      strokeDasharray="8 5"
                      rx="18"
                      className="animate-pulse"
                      filter="url(#glow-cyan-filter)"
                    />

                    {/* CAD Target Reticles at Corners */}
                    <path
                      d={`M ${x - 9} ${y + 6} L ${x - 9} ${y - 9} L ${x + 6} ${y - 9}`}
                      fill="none"
                      stroke="#38bdf8"
                      strokeWidth="2"
                    />
                    <path
                      d={`M ${x + roomWidth - 6} ${y - 9} L ${x + roomWidth + 9} ${y - 9} L ${x + roomWidth + 9} ${y + 6}`}
                      fill="none"
                      stroke="#38bdf8"
                      strokeWidth="2"
                    />
                    <path
                      d={`M ${x - 9} ${y + roomHeight - 6} L ${x - 9} ${y + roomHeight + 9} L ${x + 6} ${y + roomHeight + 9}`}
                      fill="none"
                      stroke="#38bdf8"
                      strokeWidth="2"
                    />
                    <path
                      d={`M ${x + roomWidth - 6} ${y + roomHeight + 9} L ${x + roomWidth + 9} ${y + roomHeight + 9} L ${x + roomWidth + 9} ${y + roomHeight - 6}`}
                      fill="none"
                      stroke="#38bdf8"
                      strokeWidth="2"
                    />
                  </>
                )}

                {/* 2. Main Architectural Room Body */}
                <rect
                  x={x}
                  y={y}
                  width={roomWidth}
                  height={roomHeight}
                  fill={fillColor}
                  stroke={strokeColor}
                  strokeWidth={isSelected ? '2.2' : '1.4'}
                  rx="14"
                  className={`${glowClass} transition-all duration-300 group-hover:brightness-125`}
                />

                {/* Inner Blueprint Framing Line */}
                <rect
                  x={x + 4}
                  y={y + 4}
                  width={roomWidth - 8}
                  height={roomHeight - 8}
                  fill="none"
                  stroke={isOccupied ? 'rgba(244, 63, 94, 0.25)' : 'rgba(16, 185, 129, 0.2)'}
                  strokeWidth="0.8"
                  strokeDasharray="2 3"
                  rx="10"
                />

                {/* 3. Top Header: Category Tag & Zone ID */}
                <g transform={`translate(${x + 12}, ${y + 16})`}>
                  {/* Category Pill */}
                  <rect
                    width="78"
                    height="20"
                    rx="10"
                    fill="rgba(2, 6, 23, 0.85)"
                    stroke="rgba(51, 65, 85, 0.9)"
                    strokeWidth="0.8"
                  />
                  <text
                    x="39"
                    y="13"
                    textAnchor="middle"
                    className="fill-slate-300 font-mono text-[9px] uppercase tracking-wider font-extrabold select-none"
                  >
                    {room.category || 'MAKMAL'}
                  </text>

                  {/* Small Zone Code Badge */}
                  <text
                    x="86"
                    y="13"
                    className="fill-slate-500 font-mono text-[8px] font-bold select-none"
                  >
                    ZON-0{index + 1}
                  </text>
                </g>

                {/* 4. Manual Override Badge if Active */}
                {isOverridden && (
                  <g transform={`translate(${x + roomWidth - 92}, ${y + 16})`}>
                    <rect
                      width="80"
                      height="20"
                      rx="10"
                      fill="rgba(30, 58, 138, 0.5)"
                      stroke="#3b82f6"
                      strokeWidth="1"
                    />
                    <circle cx="12" cy="10" r="3" fill="#60a5fa" className="animate-pulse" />
                    <text
                      x="46"
                      y="13.5"
                      textAnchor="middle"
                      className="fill-sky-300 font-mono text-[9px] uppercase font-black select-none tracking-wider"
                    >
                      PINTAS
                    </text>
                  </g>
                )}

                {/* 5. Room Title */}
                <text
                  x={x + roomWidth / 2}
                  y={y + 70}
                  textAnchor="middle"
                  className="fill-slate-100 font-sans font-extrabold text-[13px] sm:text-sm select-none tracking-tight group-hover:fill-sky-300 transition-colors"
                >
                  {room.name.length > 22 ? room.name.slice(0, 20) + '…' : room.name}
                </text>

                {/* 6. Nominal Power Display (JetBrains Mono) */}
                <g transform={`translate(${x + roomWidth / 2}, ${y + 92})`}>
                  <rect
                    x="-65"
                    y="-12"
                    width="130"
                    height="20"
                    rx="10"
                    fill="rgba(15, 23, 42, 0.7)"
                    stroke="rgba(51, 65, 85, 0.6)"
                    strokeWidth="0.8"
                  />
                  <text
                    x="0"
                    y="2.5"
                    textAnchor="middle"
                    className="fill-amber-300 font-mono font-bold text-[11px] select-none tracking-tight"
                  >
                    ⚡ {Number(room.nominal_power || 0).toLocaleString()} W Nominal
                  </text>
                </g>

                {/* 7. Status Indicator Pill */}
                <g transform={`translate(${x + roomWidth / 2 - 58}, ${y + 118})`}>
                  <rect
                    width="116"
                    height="28"
                    rx="14"
                    fill={isOccupied ? 'rgba(244, 63, 94, 0.22)' : 'rgba(16, 185, 129, 0.2)'}
                    stroke={isOccupied ? 'rgba(244, 63, 94, 0.8)' : 'rgba(16, 185, 129, 0.8)'}
                    strokeWidth="1.2"
                  />
                  {/* Status Pulse Dot */}
                  <circle
                    cx="18"
                    cy="14"
                    r="4.5"
                    fill={isOccupied ? '#f43f5e' : '#10b981'}
                    className={isOccupied ? 'animate-ping' : ''}
                  />
                  <circle
                    cx="18"
                    cy="14"
                    r="3.5"
                    fill={isOccupied ? '#f43f5e' : '#10b981'}
                  />
                  <text
                    x="64"
                    y="18"
                    textAnchor="middle"
                    className={`font-mono font-black text-[10.5px] uppercase select-none tracking-wide ${
                      isOccupied ? 'fill-rose-300' : 'fill-emerald-300'
                    }`}
                  >
                    {isOccupied ? 'OCCUPIED (ON)' : 'VACANT (JIMAT)'}
                  </text>
                </g>

                {/* 8. Architectural CAD Corner Accents on Room Nodes */}
                <path
                  d={`M ${x + 9} ${y + 17} L ${x + 9} ${y + 9} L ${x + 17} ${y + 9}`}
                  fill="none"
                  stroke={strokeColor}
                  strokeWidth="1.2"
                  opacity="0.6"
                />
                <path
                  d={`M ${x + roomWidth - 17} ${y + 9} L ${x + roomWidth - 9} ${y + 9} L ${x + roomWidth - 9} ${y + 17}`}
                  fill="none"
                  stroke={strokeColor}
                  strokeWidth="1.2"
                  opacity="0.6"
                />
                <path
                  d={`M ${x + 9} ${y + roomHeight - 17} L ${x + 9} ${y + roomHeight - 9} L ${x + 17} ${y + roomHeight - 9}`}
                  fill="none"
                  stroke={strokeColor}
                  strokeWidth="1.2"
                  opacity="0.6"
                />
                <path
                  d={`M ${x + roomWidth - 17} ${y + roomHeight - 9} L ${x + roomWidth - 9} ${y + roomHeight - 9} L ${x + roomWidth - 9} ${y + roomHeight - 17}`}
                  fill="none"
                  stroke={strokeColor}
                  strokeWidth="1.2"
                  opacity="0.6"
                />
              </g>
            );
          })}
        </svg>
      </div>

      {/* Blueprint Legend Footer */}
      <div className="flex flex-wrap items-center justify-between gap-4 mt-4 pt-4 border-t border-slate-800/80 text-xs font-medium text-slate-400">
        <div className="flex flex-wrap items-center gap-5">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-rose-500 shadow-[0_0_8px_#f43f5e]" />
            <span className="text-slate-300">Occupied (Lampu Menyala / Berpenghuni)</span>
          </div>

          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-emerald-500 shadow-[0_0_8px_#10b981]" />
            <span className="text-slate-300">Vacant (Mod Penjimatan / Standby)</span>
          </div>

          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full border-2 border-dashed border-sky-400 shadow-[0_0_6px_#38bdf8]" />
            <span className="text-sky-300 font-semibold">Bilik Terpilih</span>
          </div>

          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded bg-blue-600 border border-blue-400" />
            <span className="text-blue-300">Suis Pintas Manual (Override)</span>
          </div>
        </div>

        <div className="text-[11px] font-mono text-slate-500">
          Jumlah Kuasa Terpasang:{' '}
          <strong className="text-amber-400 font-bold">{totalNominalPower.toLocaleString()} W</strong>
        </div>
      </div>
    </div>
  );
}
