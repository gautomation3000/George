export type EquipmentCondition = 'Good' | 'Under Repair' | 'spare / Emergency' | 'Faulty';
export type EquipmentType = 'Personal' | 'common' | string;
export type SheetTabName = 'Full list' | 'Hand tools' | 'Faulty Tools' | 'Spare tools' | 'Regular Calibration tools';

export interface SheetRow {
  id: string;
  slno: number;
  sheetSlno?: number; // Sequential index within active sheet tab (1, 2, 3...)
  description: string;
  make: string;
  model: string;
  serialNo: string;
  type: EquipmentType;
  condition: EquipmentCondition | string;
  location: string;
  calibrationDueDate: string;
  remarks: string;
  dueDays: number | string;
  lastModified: string;
  lastModifiedBy: string;
  version: number;
  syncStatus: 'synced' | 'pending' | 'syncing' | 'conflict' | 'error';
  // Legacy / display compatibility
  taskName?: string;
  status?: string;
}

export interface SyncState {
  status: 'synced' | 'syncing' | 'offline' | 'pending' | 'error';
  lastSyncedAt: string | null;
  pendingCount: number;
  latencyMs: number;
  errorMessage: string | null;
  backendType: 'apps_script' | 'broadcast_live' | 'local_demo';
  appsScriptUrl: string;
  autoSyncInterval: number; // in seconds, 0 = manual
  storageMode: 'IndexedDB + LocalStorage' | 'IndexedDB';
}

export interface QueuedAction {
  id: string;
  type: 'UPDATE_ROW' | 'ADD_ROW' | 'DELETE_ROW' | 'BATCH_UPDATE';
  timestamp: string;
  payload: any;
  retryCount: number;
  baseVersion?: number;
}

export interface BackupSnapshot {
  id: string;
  timestamp: string;
  title: string;
  rowCount: number;
  data: SheetRow[];
  createdBy: string;
  note: string;
  isAutomatic?: boolean;
}

export type AlertLevel = 'critical' | 'warning' | 'info';
export type AlertType = 'threshold' | 'status_change' | 'collision' | 'deletion' | 'backup' | 'sync' | 'calibration_overdue';

export interface CriticalAlert {
  id: string;
  timestamp: string;
  level: AlertLevel;
  type: AlertType;
  title: string;
  message: string;
  rowId?: string;
  rowName?: string;
  isRead: boolean;
  metadata?: Record<string, any>;
}

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  color: string;
  activeRowId?: string;
  status: 'online' | 'editing' | 'idle';
  lastActive: string;
}

export interface SortConfig {
  field: keyof SheetRow;
  direction: 'asc' | 'desc';
}

export interface ConflictResolution {
  conflictId: string;
  rowId: string;
  strategy: 'CLIENT_WINS' | 'SERVER_WINS' | 'SMART_MERGE';
  resolvedRow: SheetRow;
}
