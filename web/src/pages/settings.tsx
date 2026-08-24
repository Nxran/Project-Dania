import React from 'react';
import TariffForm from '@/components/settings/TariffForm';
import BeaconManager from '@/components/settings/BeaconManager';

export default function SettingsPage() {
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="border-b border-gray-800 pb-4">
        <h1 className="text-2xl font-bold text-gray-100">System Settings</h1>
        <p className="text-sm text-gray-400 mt-1">
          Configure campus electricity tariff rates, baseline nominal load power metrics, and authorized BLE proximity devices per room
        </p>
      </div>
      <TariffForm />
      <BeaconManager />
    </div>
  );
}
