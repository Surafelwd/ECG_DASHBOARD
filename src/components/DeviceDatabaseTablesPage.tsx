import React from 'react';
import DeviceDatabaseTables from './DeviceDatabaseTables';

interface DeviceDatabaseTablesPageProps {
  devices: any[];
  selectedDeviceId?: string | null;
  onSelectDevice?: (deviceId: string) => void;
  onViewDevice?: (deviceId: string) => void;
}

export default function DeviceDatabaseTablesPage({
  devices,
  selectedDeviceId,
  onSelectDevice,
  onViewDevice
}: DeviceDatabaseTablesPageProps) {
  return (
    <div className="h-full w-full p-3 md:p-6 bg-[#0a0a0a] overflow-hidden flex flex-col">
      <div className="flex-1 w-full max-w-7xl mx-auto h-full flex flex-col">
        <DeviceDatabaseTables
          devices={devices}
          selectedDeviceId={selectedDeviceId || undefined}
          onSelectDevice={onSelectDevice}
        />
      </div>
    </div>
  );
}
