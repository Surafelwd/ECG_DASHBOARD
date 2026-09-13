export interface DeviceSummary {
  id: string;
  serialNumber: string;
  ownerName: string;
  lastUploadAt: string | null;
  uploadStatus: 'Recent' | 'Delayed' | 'Stale' | 'No uploads';
  uploadStatusKey: 'recent' | 'delayed' | 'stale' | 'never';
  sessionCount: number;
  totalSamples: number;
  batteryVoltageMv: number | null;
}
