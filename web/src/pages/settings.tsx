import React, { useState } from 'react';
import TariffForm from '@/components/settings/TariffForm';
import BeaconManager from '@/components/settings/BeaconManager';
import {
  Settings as SettingsIcon,
  Coins,
  Bluetooth,
  Sliders,
  ShieldCheck,
  Cpu,
  Database,
  Building2,
  CheckCircle2,
  Server,
  Zap,
  Info
} from 'lucide-react';

type SettingsTab = 'TARIFF_LOAD' | 'BLE_GEOFENCING' | 'SYSTEM_INFO';

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<SettingsTab>('TARIFF_LOAD');

  const tabs = [
    {
      id: 'TARIFF_LOAD' as SettingsTab,
      label: 'Tarif TNB & Beban Kuasa',
      shortLabel: 'Tarif & Beban',
      icon: Coins,
      badge: 'Pengiraan Kos',
    },
    {
      id: 'BLE_GEOFENCING' as SettingsTab,
      label: 'Geofencing BLE & Suar',
      shortLabel: 'BLE Suar',
      icon: Bluetooth,
      badge: 'Kehadiran Pintar',
    },
    {
      id: 'SYSTEM_INFO' as SettingsTab,
      label: 'Spesifikasi & Integrasi',
      shortLabel: 'Spesifikasi',
      icon: Cpu,
      badge: 'ESP32 & Supabase',
    },
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-10">
      {/* Header Banner - Apple Slate Modern Style */}
      <div className="glass-panel p-6 rounded-3xl border border-slate-800/80 shadow-card-slate flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <div className="p-2.5 rounded-2xl bg-sapphire-500/10 text-sapphire-400 border border-sapphire-500/20 shadow-[0_0_15px_rgba(59,130,246,0.15)]">
              <SettingsIcon className="w-5 h-5" />
            </div>
            <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-slate-100">
              Tetapan Sistem &amp; Konfigurasi Pintar
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-mono uppercase">
              POLISAS Semambu
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-2 max-w-2xl leading-relaxed">
            Konfigurasi kadar tarif elektrik TNB, nilai watt beban nominal setiap makmal, peranti geofencing BLE yang sah, dan parameter integrasi perkakasan ESP32.
          </p>
        </div>

        <div className="flex items-center gap-2 px-3 py-1.5 rounded-2xl bg-slate-950/80 border border-slate-800 text-xs font-mono text-slate-400 shrink-0">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>Realtime Sync: Aktif</span>
        </div>
      </div>

      {/* Apple-Style Segmented Tab Navigation */}
      <div className="glass-panel p-1.5 sm:p-2 rounded-2xl sm:rounded-3xl border border-slate-800/80 shadow-card-slate">
        <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;

            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-3 sm:px-4 py-2.5 sm:py-3 rounded-xl sm:rounded-2xl text-xs font-bold transition-all duration-200 flex items-center justify-center gap-2 group relative ${
                  isActive
                    ? 'bg-gradient-to-r from-sapphire-600 to-blue-600 text-white shadow-glow-sapphire font-extrabold border border-sapphire-400/40'
                    : 'text-slate-400 hover:text-slate-100 hover:bg-slate-850/60 border border-transparent'
                }`}
              >
                <Icon
                  className={`w-4 h-4 transition-transform duration-200 ${
                    isActive ? 'text-white scale-110' : 'text-slate-400 group-hover:text-slate-200'
                  }`}
                />
                <span className="hidden sm:inline truncate">{tab.label}</span>
                <span className="sm:hidden truncate">{tab.shortLabel}</span>
                <span
                  className={`hidden md:inline-block text-[9px] font-mono px-2 py-0.5 rounded-full ${
                    isActive
                      ? 'bg-white/20 text-white border border-white/20'
                      : 'bg-slate-800 text-slate-400 border border-slate-700'
                  }`}
                >
                  {tab.badge}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab Contents */}
      <div className="space-y-6">
        {activeTab === 'TARIFF_LOAD' && (
          <div className="animate-fade-in space-y-6">
            <TariffForm />
          </div>
        )}

        {activeTab === 'BLE_GEOFENCING' && (
          <div className="animate-fade-in space-y-6">
            <BeaconManager />
          </div>
        )}

        {activeTab === 'SYSTEM_INFO' && (
          <div className="animate-fade-in space-y-6">
            <div className="glass-panel rounded-3xl p-6 sm:p-7 border border-slate-800/80 shadow-card-slate space-y-6">
              <div className="flex items-center gap-3">
                <div className="bg-teal-500/10 p-3 rounded-2xl border border-teal-500/20 text-teal-400 shadow-[0_0_15px_rgba(20,184,166,0.15)]">
                  <Cpu className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-slate-100 font-bold text-lg">Spesifikasi Sistem &amp; Integrasi Edge</h3>
                  <p className="text-xs text-slate-400">
                    Maklumat seni bina perkakasan IoT, pangkalan data Supabase, dan protokol kawalan pintar
                  </p>
                </div>
              </div>

              {/* Specs Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800/80 space-y-2">
                  <span className="text-[10px] font-mono font-bold text-slate-500 uppercase block">
                    MIKROPENGAWAL (EDGE)
                  </span>
                  <h4 className="text-sm font-bold text-slate-100 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    ESP32 NodeMCU Dual-Core
                  </h4>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Wi-Fi 802.11 b/g/n + BLE 4.2 Proximity Tracking &amp; UART Hardware Serial to PZEM-004T.
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800/80 space-y-2">
                  <span className="text-[10px] font-mono font-bold text-slate-500 uppercase block">
                    SENSOR KUASA
                  </span>
                  <h4 className="text-sm font-bold text-slate-100 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-teal-400 shrink-0" />
                    Peacefair PZEM-004T v3.0
                  </h4>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Mengukur Voltan (80-260V AC), Arus (0-100A), Kuasa Aktif (0-23kW), dan Tenaga Terkumpul.
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800/80 space-y-2">
                  <span className="text-[10px] font-mono font-bold text-slate-500 uppercase block">
                    PANGKALAN DATA &amp; REALTIME
                  </span>
                  <h4 className="text-sm font-bold text-slate-100 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-sapphire-400 shrink-0" />
                    Supabase PostgreSQL Realtime
                  </h4>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Penyegerakan acara melalui WebSocket postgres_changes dengan latency rendah &lt; 100ms.
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800/80 space-y-2">
                  <span className="text-[10px] font-mono font-bold text-slate-500 uppercase block">
                    LOKASI KAMPUS
                  </span>
                  <h4 className="text-sm font-bold text-slate-100 flex items-center gap-1.5">
                    <Building2 className="w-4 h-4 text-amber-400 shrink-0" />
                    Politeknik Sultan Haji Ahmad Shah
                  </h4>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Semambu, Kuantan, Pahang Darul Makmur • Jabatan Kejuruteraan Awam.
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800/80 space-y-2">
                  <span className="text-[10px] font-mono font-bold text-slate-500 uppercase block">
                    NOTIFIKASI PUSH
                  </span>
                  <h4 className="text-sm font-bold text-slate-100 flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-indigo-400 shrink-0" />
                    Web Push Notification API
                  </h4>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Amaran automatik dihantar ke peranti pensyarah apabila lampu dibiarkan terpasang tanpa kehadiran.
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800/80 space-y-2">
                  <span className="text-[10px] font-mono font-bold text-slate-500 uppercase block">
                    VERSI PERISIAN
                  </span>
                  <h4 className="text-sm font-bold text-slate-100 flex items-center gap-1.5">
                    <Zap className="w-4 h-4 text-emerald-400 shrink-0" />
                    SCEAS Core Engine v2.0 PRO
                  </h4>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Dibina dengan Next.js 14, Tailwind CSS, Leaflet Map, Recharts, &amp; Lucide Icons.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
