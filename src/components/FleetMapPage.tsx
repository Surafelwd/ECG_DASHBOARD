import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Tooltip, useMap } from 'react-leaflet';
import * as L from 'leaflet';
import { MapPin, Wifi, Battery } from 'lucide-react';

// Custom colored circle markers
function createDeviceIcon(isOnline: boolean, isSelected: boolean) {
  const color = isOnline ? '#1B7A6E' : '#C4453D';
  const glow = isOnline ? '#3ADB8F' : '#ff6b6b';
  const size = isSelected ? 18 : 14;
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${size + 8}" height="${size + 8}" viewBox="0 0 ${size + 8} ${size + 8}">
      <circle cx="${(size + 8) / 2}" cy="${(size + 8) / 2}" r="${size / 2 + 2}" fill="${color}22"/>
      <circle cx="${(size + 8) / 2}" cy="${(size + 8) / 2}" r="${size / 2}" fill="${color}" stroke="${glow}" stroke-width="1.5"/>
      ${isSelected ? `<circle cx="${(size + 8) / 2}" cy="${(size + 8) / 2}" r="${size / 2 - 3}" fill="white" opacity="0.3"/>` : ''}
    </svg>
  `;
  return L.divIcon({
    html: svg,
    className: '',
    iconSize: [size + 8, size + 8],
    iconAnchor: [(size + 8) / 2, (size + 8) / 2],
    popupAnchor: [0, -((size + 8) / 2)],
  });
}

// Auto-fit map to all markers
function FitBounds({ devices }: { devices: any[] }) {
  const map = useMap();
  useEffect(() => {
    const valid = devices.filter(d => d.location);
    if (valid.length === 0) return;
    const bounds = L.latLngBounds(valid.map((d: any) => [d.location.lat, d.location.lng]));
    map.fitBounds(bounds, { padding: [60, 60] });
  }, [map, devices]);
  return null;
}

interface Device {
  id: string;
  ownerName: string;
  connectivityStatus: string;
  batteryLevel: number;
  signalStrength: number;
  lastSync: string;
  location?: { city: string; country: string; lat: number; lng: number };
}

export default function FleetMapPage({ devices, onViewDevice }: { devices: Device[]; onViewDevice?: (id: string) => void }) {
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);
  const [filterStatus, setFilterStatus] = useState<'all' | 'online' | 'offline'>('all');

  // Inject dummy locations if real devices have none
  const DUMMY_LOCATIONS = [
    { city: 'Addis Ababa', country: 'Ethiopia', lat: 9.0054, lng: 38.7636 },
    { city: 'New York', country: 'USA', lat: 40.7128, lng: -74.0060 },
    { city: 'Mumbai', country: 'India', lat: 19.0760, lng: 72.8777 },
    { city: 'Shanghai', country: 'China', lat: 31.2304, lng: 121.4737 },
    { city: 'Bucharest', country: 'Romania', lat: 44.4268, lng: 26.1025 },
    { city: 'Lagos', country: 'Nigeria', lat: 6.5244, lng: 3.3792 },
    { city: 'Dubai', country: 'UAE', lat: 25.2048, lng: 55.2708 },
    { city: 'Seoul', country: 'South Korea', lat: 37.5665, lng: 126.9780 },
    { city: 'Dakar', country: 'Senegal', lat: 14.7167, lng: -17.4677 },
    { city: 'São Paulo', country: 'Brazil', lat: -23.5505, lng: -46.6333 },
  ];

  const devicesWithLoc = devices.map((d, i) => ({
    ...d,
    location: d.location || DUMMY_LOCATIONS[i % DUMMY_LOCATIONS.length]
  }));

  const mappable = devicesWithLoc.filter(d => d.location);
  const filtered = mappable.filter(d => {
    if (filterStatus === 'online') return d.connectivityStatus === 'Online';
    if (filterStatus === 'offline') return d.connectivityStatus !== 'Online';
    return true;
  });
  const online = mappable.filter(d => d.connectivityStatus === 'Online').length;
  const offline = mappable.length - online;

  return (
    <div className="h-full flex flex-col bg-white dark:bg-[#050505] text-light-text dark:text-dark-text overflow-hidden">

      {/* Header */}
      <div className="px-8 py-5 border-b border-gray-200 dark:border-[#1a1a1a] shrink-0">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight mb-1 flex items-center gap-3">
              <MapPin size={22} className="text-[#1B7A6E]" />
              Global Fleet Map
            </h1>
            <p className="text-sm text-light-text-secondary dark:text-[#9A9A9A]">
              Real-time device locations across {mappable.length} registered sites. Powered by OpenStreetMap.
            </p>
          </div>
          <div className="flex items-center gap-8">
            <div className="text-center">
              <div className="text-2xl font-bold text-[#1B7A6E]">{online}</div>
              <div className="text-[10px] font-bold uppercase tracking-widest text-light-text-secondary dark:text-[#9A9A9A]">Online</div>
            </div>
            <div className="w-px h-8 bg-gray-200 dark:bg-[#262626]" />
            <div className="text-center">
              <div className="text-2xl font-bold text-[#C4453D]">{offline}</div>
              <div className="text-[10px] font-bold uppercase tracking-widest text-light-text-secondary dark:text-[#9A9A9A]">Offline</div>
            </div>
            <div className="w-px h-8 bg-gray-200 dark:bg-[#262626]" />
            <div className="text-center">
              <div className="text-2xl font-bold">{mappable.length}</div>
              <div className="text-[10px] font-bold uppercase tracking-widest text-light-text-secondary dark:text-[#9A9A9A]">Total</div>
            </div>
          </div>
        </div>

        <div className="flex gap-6 mt-4">
          {(['all', 'online', 'offline'] as const).map(f => (
            <button key={f} onClick={() => setFilterStatus(f)}
              className={`text-[10px] font-bold uppercase tracking-widest pb-1 border-b-2 outline-none transition-colors ${
                filterStatus === f
                  ? 'border-[#1B7A6E] text-[#1B7A6E]'
                  : 'border-transparent text-light-text-secondary dark:text-[#9A9A9A] hover:text-[#1B7A6E]'
              }`}>
              {f === 'all' ? `All (${mappable.length})` : f === 'online' ? `Online (${online})` : `Offline (${offline})`}
            </button>
          ))}
        </div>
      </div>

      {/* Map Centered Layout */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 bg-gray-50 dark:bg-[#0a0a0a] overflow-hidden">
        
        {/* Constrained Map Container */}
        <div className="w-full max-w-6xl h-full relative z-0 rounded-lg overflow-hidden border border-gray-200 dark:border-[#262626] shadow-xl">
          <MapContainer
            center={[20, 10]}
            zoom={2}
            style={{ height: '100%', width: '100%' }}
            zoomControl={true}
          >
            {/* Standard OpenStreetMap tiles (100% free, no API key) */}
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              maxZoom={19}
            />

            <FitBounds devices={filtered} />

            {filtered.map(device => {
              if (!device.location) return null;
              const isOnline = device.connectivityStatus === 'Online';
              const isSelected = selectedDevice?.id === device.id;

              return (
                <Marker
                  key={device.id}
                  position={[device.location.lat, device.location.lng]}
                  icon={createDeviceIcon(isOnline, isSelected)}
                  eventHandlers={{
                    click: () => setSelectedDevice(isSelected ? null : device),
                  }}
                >
                  <Tooltip direction="top" offset={[0, -10]} opacity={1} className="custom-tooltip">
                    <div className="font-bold text-xs">{device.location.city}</div>
                    <div className="text-[10px] opacity-80">{device.id}</div>
                  </Tooltip>
                  
                  <Popup closeButton={false} className="leaflet-popup-custom">
                    <div style={{
                      background: '#121212',
                      border: '1px solid #262626',
                      borderRadius: '4px',
                      padding: '16px',
                      minWidth: '220px',
                      fontFamily: 'Inter, sans-serif',
                      color: '#F2F2F2'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                        <div>
                          <div style={{ fontWeight: 'bold', fontSize: '12px', fontFamily: 'monospace' }}>{device.id}</div>
                          <div style={{ fontSize: '10px', color: '#9A9A9A' }}>{device.ownerName || 'Unassigned'}</div>
                        </div>
                        <div style={{
                          padding: '2px 6px',
                          borderRadius: '2px',
                          fontSize: '9px',
                          fontWeight: 'bold',
                          textTransform: 'uppercase',
                          background: isOnline ? 'rgba(27,122,110,0.15)' : 'rgba(196,69,61,0.15)',
                          color: isOnline ? '#1B7A6E' : '#C4453D',
                        }}>
                          {device.connectivityStatus}
                        </div>
                      </div>

                      <div style={{ fontSize: '11px', color: '#9A9A9A', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
                        {device.location.city}, {device.location.country}
                      </div>

                      <div style={{ borderTop: '1px solid #262626', paddingTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
                          <span style={{ color: '#9A9A9A', textTransform: 'uppercase', fontSize: '9px', fontWeight: 'bold', letterSpacing: '0.05em' }}>Battery</span>
                          <span style={{ fontWeight: 'bold', color: device.batteryLevel < 20 ? '#C4453D' : device.batteryLevel < 50 ? '#D99B3F' : '#1B7A6E' }}>{device.batteryLevel}%</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
                          <span style={{ color: '#9A9A9A', textTransform: 'uppercase', fontSize: '9px', fontWeight: 'bold', letterSpacing: '0.05em' }}>Signal</span>
                          <span style={{ fontWeight: 'bold' }}>{device.signalStrength}/4</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
                          <span style={{ color: '#9A9A9A', textTransform: 'uppercase', fontSize: '9px', fontWeight: 'bold', letterSpacing: '0.05em' }}>Last Seen</span>
                          <span style={{ fontFamily: 'monospace' }}>{device.lastSync}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
                          <span style={{ color: '#C4453D', textTransform: 'uppercase', fontSize: '9px', fontWeight: 'bold', letterSpacing: '0.05em' }}>Recent Alarm</span>
                          <span style={{ fontFamily: 'monospace', color: '#C4453D' }}>{isOnline ? 'None' : 'Connection Lost'}</span>
                        </div>
                      </div>

                      {onViewDevice && (
                        <button
                          onClick={() => onViewDevice(device.id)}
                          style={{
                            marginTop: '16px',
                            width: '100%',
                            padding: '8px',
                            background: '#1B7A6E',
                            color: 'white',
                            border: 'none',
                            borderRadius: '2px',
                            fontSize: '10px',
                            fontWeight: 'bold',
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em',
                            cursor: 'pointer'
                          }}
                          onMouseOver={(e) => e.currentTarget.style.background = '#145F56'}
                          onMouseOut={(e) => e.currentTarget.style.background = '#1B7A6E'}
                        >
                          Open Command Center
                        </button>
                      )}
                    </div>
                  </Popup>
                </Marker>
              );
            })}
          </MapContainer>
        </div>
      </div>
    </div>
  );
}
