import React, { useState, useEffect } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid
} from 'recharts';
import { Sparkles, TrendingUp } from 'lucide-react';

interface Room {
  id: string | number;
  name: string;
  status: 'OCCUPIED' | 'VACANT';
  manual_override: boolean;
  nominal_power: number;
  updated_at: string;
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

interface SavingsChartProps {
  rooms: Room[];
  savingsLogs: SavingsLog[];
}

export default function SavingsChart({ rooms, savingsLogs }: SavingsChartProps) {
  const [mounted, setMounted] = useState(false);
  const [metric, setMetric] = useState<'kwh' | 'rm' | 'co2'>('kwh');

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || !rooms || rooms.length === 0) {
    return (
      <div className="glass-panel rounded-2xl p-6 h-[380px] flex items-center justify-center">
        <div className="text-gray-400 font-mono text-sm animate-pulse">
          {!mounted ? 'Loading energy charts...' : 'Waiting for rooms data...'}
        </div>
      </div>
    );
  }

  // Process data for charting: Cumulative sum of savings chronologically
  const sortedLogs = [...savingsLogs].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );

  // Build a map of roomId to roomName for dynamic lookup
  const roomMap: { [id: string]: string } = {};
  rooms.forEach((r) => {
    roomMap[r.id.toString()] = r.name;
  });

  const getRoomName = (roomId: string | number) => {
    const idStr = roomId.toString();
    return roomMap[idStr] || `Room ${idStr}`;
  };

  const cumulativeSavings: { [roomName: string]: number } = {};
  rooms.forEach((r) => {
    cumulativeSavings[r.name] = 0;
  });

  // Optimize calculations for thousands of entries by computing cumulative
  // sums over all logs but only generating chart data points at downsampled steps.
  const chartData: any[] = [];
  const maxPoints = 150;
  const totalLogs = sortedLogs.length;

  if (totalLogs > 0) {
    const step = Math.max(1, Math.floor(totalLogs / maxPoints));
    
    for (let i = 0; i < totalLogs; i++) {
      const log = sortedLogs[i];
      const roomName = getRoomName(log.room_id);
      
      let value = 0;
      if (metric === 'kwh') {
        value = parseFloat(log.kwh_saved.toString()) || 0;
      } else if (metric === 'rm') {
        value = parseFloat(log.rm_saved.toString()) || 0;
      } else {
        value = parseFloat(log.co2_saved.toString()) || 0;
      }

      if (cumulativeSavings[roomName] === undefined) {
        cumulativeSavings[roomName] = 0;
      }
      cumulativeSavings[roomName] += value;

      // Only push a chart data point at downsampled steps or the last element
      if (i % step === 0 || i === totalLogs - 1) {
        const date = new Date(log.created_at);
        const label = date.toLocaleString('en-US', {
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          hour12: false
        });

        const dataPoint: { [key: string]: any } = {
          name: label
        };
        
        // Include all known room names' cumulative values at this point
        Object.keys(cumulativeSavings).forEach((name) => {
          dataPoint[name] = parseFloat(cumulativeSavings[name].toFixed(3));
        });

        chartData.push(dataPoint);
      }
    }
  }


  // Get active room names present in logs or rooms list
  const activeRoomNames = Array.from(new Set([
    ...rooms.map(r => r.name),
    ...sortedLogs.map(log => getRoomName(log.room_id))
  ]));

  const roomColors: { [name: string]: { stroke: string; fill: string } } = {
    'Fotogrametri': { stroke: '#3b82f6', fill: 'url(#colorFoto)' },
    'Kartografi': { stroke: '#10b981', fill: 'url(#colorKarto)' }
  };

  const defaultColors = [
    { stroke: '#3b82f6', fill: 'url(#colorFoto)' },
    { stroke: '#10b981', fill: 'url(#colorKarto)' },
    { stroke: '#a855f7', fill: 'url(#colorPurple)' },
    { stroke: '#f59e0b', fill: 'url(#colorAmber)' }
  ];

  const getMetricLabel = () => {
    switch (metric) {
      case 'kwh': return 'Energy Saved (kWh)';
      case 'rm': return 'Money Saved (RM)';
      case 'co2': return 'CO2 Reduced (kg)';
      default: return 'Savings';
    }
  };

  return (
    <div className="glass-panel rounded-2xl p-6 flex flex-col h-[380px]">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-gray-200 font-semibold text-lg">Cumulative Savings Progress</h3>
            <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
              <TrendingUp className="h-3 w-3" /> Live
            </span>
          </div>
          <p className="text-xs text-gray-400 mt-0.5">Historical accumulation from vacancy savings logs</p>
        </div>

        {/* Metric Selector Buttons */}
        <div className="flex bg-gray-950/60 p-1 rounded-xl border border-gray-850 self-end sm:self-auto">
          {(['kwh', 'rm', 'co2'] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMetric(m)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all duration-200 ${
                metric === m
                  ? 'bg-emerald-500 text-gray-950 font-bold shadow-[0_0_10px_rgba(16,185,129,0.3)]'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      {chartData.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center p-6 border border-dashed border-gray-800/60 rounded-xl bg-gray-900/10">
          <Sparkles className="h-8 w-8 text-gray-500 mb-2" />
          <p className="text-sm font-medium text-gray-400">No savings logs available yet</p>
          <p className="text-xs text-gray-500 max-w-xs mt-1">
            Savings logs will populate here once rooms enter vacancy under auto or manual modes.
          </p>
        </div>
      ) : (
        <div className="flex-1 w-full text-xs min-h-[240px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="colorFoto" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="colorKarto" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="colorPurple" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#a855f7" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#a855f7" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="colorAmber" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
              <XAxis
                dataKey="name"
                stroke="rgba(255,255,255,0.3)"
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                stroke="rgba(255,255,255,0.3)"
                tickLine={false}
                axisLine={false}
                label={{
                  value: getMetricLabel(),
                  angle: -90,
                  position: 'insideLeft',
                  style: { fill: 'rgba(255,255,255,0.4)', textAnchor: 'middle' },
                  offset: 0
                }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'rgba(10, 15, 30, 0.95)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '12px',
                  color: '#f3f4f6'
                }}
              />
              <Legend verticalAlign="top" height={36} iconType="circle" />
              {activeRoomNames.map((name, index) => {
                const color = roomColors[name] || defaultColors[index % defaultColors.length];
                return (
                  <Area
                    key={name}
                    type="monotone"
                    dataKey={name}
                    stroke={color.stroke}
                    strokeWidth={2}
                    fillOpacity={1}
                    fill={color.fill}
                  />
                );
              })}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
