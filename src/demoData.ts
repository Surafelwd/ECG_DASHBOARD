/**
 * demoData.ts
 *
 * Realistic demo fleet data used ONLY when the API returns no devices.
 * When real data flows from your backend, this is never used.
 * To add a real /api/metrics/trend endpoint later, just pass that data
 * as connectivityTrendData / alarmTrendData props to DeviceFleetDashboard.
 */

// ── Demo Devices ─────────────────────────────────────────────────────────────

export const DEMO_DEVICES = [
  { id: 'DEV-0101', serialNumber: 'SN-1122-3344', ownerName: 'Alice Johnson',    connectivityStatus: 'Online',  batteryLevel: 92, signalStrength: 4, lastSync: '1 min ago',  firmwareVersion: 'v4.2.1', firmwareUpdateAvailable: false, currentSchedule: 'Every 4 hours',  samplingRate: 250, onDeviceThresholds: { lossSensitivity: 5 }, location: { city: 'Addis Ababa',   country: 'Ethiopia',      lat: 9.0054,  lng: 38.7636 } },
  { id: 'DEV-0198', serialNumber: 'SN-9345-8201', ownerName: 'Marcus Williams',  connectivityStatus: 'Online',  batteryLevel: 85, signalStrength: 4, lastSync: '2 min ago',  firmwareVersion: 'v4.2.1', firmwareUpdateAvailable: false, currentSchedule: 'Every 4 hours',  samplingRate: 250, onDeviceThresholds: { lossSensitivity: 5 }, location: { city: 'New York',      country: 'USA',           lat: 40.7128, lng: -74.0060 } },
  { id: 'DEV-0204', serialNumber: 'SN-2233-4455', ownerName: 'Priya Sharma',     connectivityStatus: 'Online',  batteryLevel: 68, signalStrength: 3, lastSync: '5 min ago',  firmwareVersion: 'v4.2.1', firmwareUpdateAvailable: false, currentSchedule: 'Every 12 hours', samplingRate: 500, onDeviceThresholds: { lossSensitivity: 3 }, location: { city: 'Mumbai',        country: 'India',         lat: 19.0760, lng: 72.8777 } },
  { id: 'DEV-0312', serialNumber: 'SN-5566-7788', ownerName: 'Chen Wei',         connectivityStatus: 'Online',  batteryLevel: 41, signalStrength: 2, lastSync: '8 min ago',  firmwareVersion: 'v4.1.9', firmwareUpdateAvailable: true,  currentSchedule: 'Every 4 hours',  samplingRate: 250, onDeviceThresholds: { lossSensitivity: 5 }, location: { city: 'Shanghai',      country: 'China',         lat: 31.2304, lng: 121.4737 } },
  { id: 'DEV-0387', serialNumber: 'SN-6677-8899', ownerName: 'Sofia Andreescu', connectivityStatus: 'Online',  batteryLevel: 77, signalStrength: 4, lastSync: '3 min ago',  firmwareVersion: 'v4.2.1', firmwareUpdateAvailable: false, currentSchedule: 'Every 4 hours',  samplingRate: 250, onDeviceThresholds: { lossSensitivity: 5 }, location: { city: 'Bucharest',     country: 'Romania',       lat: 44.4268, lng: 26.1025 } },
  { id: 'DEV-0412', serialNumber: 'SN-7788-9900', ownerName: 'James Okafor',     connectivityStatus: 'Offline', batteryLevel: 15, signalStrength: 0, lastSync: '2 hrs ago',  firmwareVersion: 'v4.1.9', firmwareUpdateAvailable: true,  currentSchedule: 'Every 12 hours', samplingRate: 125, onDeviceThresholds: { lossSensitivity: 8 }, location: { city: 'Lagos',         country: 'Nigeria',       lat: 6.5244,  lng: 3.3792  } },
  { id: 'DEV-0501', serialNumber: 'SN-8899-0011', ownerName: 'Fatima Al-Rashid', connectivityStatus: 'Online',  batteryLevel: 55, signalStrength: 3, lastSync: '11 min ago', firmwareVersion: 'v4.2.1', firmwareUpdateAvailable: false, currentSchedule: 'Once daily',     samplingRate: 250, onDeviceThresholds: { lossSensitivity: 5 }, location: { city: 'Dubai',         country: 'UAE',           lat: 25.2048, lng: 55.2708  } },
  { id: 'DEV-0589', serialNumber: 'SN-9900-1122', ownerName: 'David Park',       connectivityStatus: 'Offline', batteryLevel: 8,  signalStrength: 0, lastSync: '5 hrs ago',  firmwareVersion: 'v4.1.9', firmwareUpdateAvailable: true,  currentSchedule: 'Every 4 hours',  samplingRate: 250, onDeviceThresholds: { lossSensitivity: 5 }, location: { city: 'Seoul',         country: 'South Korea',   lat: 37.5665, lng: 126.9780 } },
  { id: 'DEV-0633', serialNumber: 'SN-0011-2233', ownerName: 'Amina Diallo',     connectivityStatus: 'Online',  batteryLevel: 88, signalStrength: 4, lastSync: '4 min ago',  firmwareVersion: 'v4.2.1', firmwareUpdateAvailable: false, currentSchedule: 'Every 4 hours',  samplingRate: 250, onDeviceThresholds: { lossSensitivity: 5 }, location: { city: 'Dakar',         country: 'Senegal',       lat: 14.7167, lng: -17.4677 } },
  { id: 'DEV-0701', serialNumber: 'SN-1122-3345', ownerName: '',                  connectivityStatus: 'Online',  batteryLevel: 62, signalStrength: 3, lastSync: '18 min ago', firmwareVersion: 'v4.2.1', firmwareUpdateAvailable: false, currentSchedule: 'Every 12 hours', samplingRate: 500, onDeviceThresholds: { lossSensitivity: 5 }, location: { city: 'São Paulo',     country: 'Brazil',        lat: -23.5505, lng: -46.6333 } },
];

// ── Demo Alarms ───────────────────────────────────────────────────────────────

const now = new Date();
const minsAgo = (m: number) => new Date(now.getTime() - m * 60000).toISOString();

export const DEMO_ALARMS = [
  {
    id: 'ALM-001', deviceId: 'DEV-0412', severity: 'Critical', alarmType: 'Device Disconnected',
    status: 'Active', triggeredAt: minsAgo(22),
    triggerData: { 'Last Signal': '2 hours ago', 'Battery Level': '15%', 'Last Known Location': 'Ward 3B' },
    signalSnapshot: Array.from({ length: 20 }, (_, i) => ({ value: i < 15 ? Math.sin(i) * 200 + 800 : 0 })),
    history: [{ action: 'Alarm Triggered', user: 'System', timestamp: minsAgo(22) }],
    assignedTo: null,
  },
  {
    id: 'ALM-002', deviceId: 'DEV-0312', severity: 'Warning', alarmType: 'Low Battery',
    status: 'Active', triggeredAt: minsAgo(45),
    triggerData: { 'Battery Level': '41%', 'Estimated Runtime': '~6 hours', 'Charging Status': 'Not Charging' },
    signalSnapshot: null, history: [{ action: 'Alarm Triggered', user: 'System', timestamp: minsAgo(45) }],
    assignedTo: null,
  },
  {
    id: 'ALM-003', deviceId: 'DEV-0589', severity: 'Critical', alarmType: 'Signal Lost',
    status: 'Acknowledged', triggeredAt: minsAgo(300),
    triggerData: { 'Last Signal': '5 hours ago', 'Battery Level': '8%', 'Expected Sync': 'Every 4 hours' },
    signalSnapshot: null,
    history: [
      { action: 'Alarm Triggered', user: 'System', timestamp: minsAgo(300) },
      { action: 'Acknowledged', user: 'Admin', timestamp: minsAgo(280), note: 'Checking with patient ward' },
    ],
    assignedTo: null,
  },
  {
    id: 'ALM-004', deviceId: 'DEV-0501', severity: 'Warning', alarmType: 'Missed Transmission',
    status: 'Active', triggeredAt: minsAgo(65),
    triggerData: { 'Expected At': '11:00 AM', 'Schedule': 'Once daily', 'Missed Count': '1' },
    signalSnapshot: null, history: [{ action: 'Alarm Triggered', user: 'System', timestamp: minsAgo(65) }],
    assignedTo: null,
  },
  {
    id: 'ALM-005', deviceId: 'DEV-0198', severity: 'Info', alarmType: 'Firmware Update Available',
    status: 'Resolved', triggeredAt: minsAgo(1440),
    triggerData: { 'Current Version': 'v4.1.9', 'Available Version': 'v4.2.1', 'Release Notes': 'Bug fixes and stability improvements' },
    signalSnapshot: null,
    history: [
      { action: 'Alarm Triggered', user: 'System', timestamp: minsAgo(1440) },
      { action: 'Resolved', user: 'Admin', timestamp: minsAgo(60), note: 'Firmware updated successfully' },
    ],
    assignedTo: null,
  },
];

// ── Demo Trend Data ───────────────────────────────────────────────────────────

const last7Days = Array.from({ length: 7 }, (_, i) => {
  const d = new Date(now);
  d.setDate(d.getDate() - (6 - i));
  return d.toLocaleDateString([], { weekday: 'short' });
});

export const DEMO_CONNECTIVITY_TREND = last7Days.map((day, i) => ({
  time: day,
  online: [7, 8, 8, 7, 9, 8, 8][i],
  offline: [3, 2, 2, 3, 1, 2, 2][i],
}));

export const DEMO_ALARM_TREND = last7Days.map((day, i) => ({
  time: day,
  critical: [1, 0, 2, 1, 0, 1, 2][i],
  warning:  [2, 3, 1, 2, 1, 2, 2][i],
  info:     [1, 1, 0, 1, 2, 1, 1][i],
}));

export const DEMO_FIRMWARE_BREAKDOWN = [
  { name: 'v4.2.1', value: 7 },
  { name: 'v4.1.9', value: 3 },
];

// ── Demo Activity Feed ────────────────────────────────────────────────────────

export const DEMO_ACTIVITY = [
  { id: 'ACT-1', type: 'alarm',        severity: 'critical', text: 'DEV-0412 went offline — Critical disconnect alarm triggered.', timestamp: '22m ago', alarmId: 'ALM-001' },
  { id: 'ACT-2', type: 'alarm',        severity: 'warning',  text: 'DEV-0312 battery dropped to 41% — Low battery warning.', timestamp: '45m ago', alarmId: 'ALM-002' },
  { id: 'ACT-3', type: 'connectivity', text: 'DEV-0633 came online.', timestamp: '1h ago', deviceId: 'DEV-0633' },
  { id: 'ACT-4', type: 'command',      text: 'Firmware update pushed to DEV-0198 — completed successfully.', timestamp: '1h ago', deviceId: 'DEV-0198' },
  { id: 'ACT-5', type: 'connectivity', text: 'DEV-0589 went offline.', timestamp: '5h ago', deviceId: 'DEV-0589' },
];

// ── Metric Sparklines (7-day history per metric) ──────────────────────────────

export const DEMO_SPARKLINES = {
  totalDevices:    [8, 9, 9, 10, 10, 10, 10],
  online:          [7, 8, 8, 7,  9,  8,  8],
  offline:         [3, 2, 2, 3,  1,  2,  2],
  activeAlarms:    [2, 3, 3, 3,  1,  3,  4],
  commandsToday:   [5, 8, 6, 7,  9,  4,  6],
  firmwarePending: [4, 4, 4, 3,  3,  3,  3],
};
