import { SheetRow, BackupSnapshot, CriticalAlert, QueuedAction, SyncState, ConflictResolution } from '../types/sheet';
import { INITIAL_EQUIPMENT_DATA } from '../data/equipmentData';
import { soundManager } from './audio';
import { indexedDbService, ConflictItem } from './indexedDbService';

const STORAGE_KEYS = {
  ROWS: 'sheetsync_equipment_rows_v2',
  QUEUE: 'sheetsync_offline_queue_v2',
  BACKUPS: 'sheetsync_cloud_backups_v2',
  ALERTS: 'sheetsync_critical_alerts_v2',
  SETTINGS: 'sheetsync_app_settings_v2',
  SIMULATED_OFFLINE: 'sheetsync_simulated_offline',
  CONFLICTS: 'sheetsync_conflicts_v2',
};

class StorageService {
  private broadcastChannel: BroadcastChannel | null = null;
  private listeners: Set<(event: string, payload: any) => void> = new Set();
  private simulatedOffline: boolean = false;

  constructor() {
    if (typeof window !== 'undefined') {
      this.simulatedOffline = localStorage.getItem(STORAGE_KEYS.SIMULATED_OFFLINE) === 'true';

      if ('BroadcastChannel' in window) {
        try {
          this.broadcastChannel = new BroadcastChannel('sheetsync_equipment_mesh');
          this.broadcastChannel.onmessage = (event) => {
            const { type, data } = event.data || {};
            this.notifyListeners(type, data);
          };
        } catch (e) {
          console.warn('BroadcastChannel not supported', e);
        }
      }

      // Sync IndexedDB cache in background
      this.initIndexedDBCache();
    }
  }

  private async initIndexedDBCache() {
    try {
      const cached = await indexedDbService.getCachedRows<SheetRow>();
      if (!cached || cached.length === 0) {
        const rows = this.getRows();
        await indexedDbService.setCachedRows(rows);
      }
    } catch (e) {
      console.warn('IndexedDB initial sync error', e);
    }
  }

  // --- Network State ---
  public isOnline(): boolean {
    if (typeof window === 'undefined') return true;
    if (this.simulatedOffline) return false;
    return navigator.onLine;
  }

  public setSimulatedOffline(offline: boolean) {
    this.simulatedOffline = offline;
    localStorage.setItem(STORAGE_KEYS.SIMULATED_OFFLINE, String(offline));
    this.broadcast('NETWORK_STATUS_CHANGED', { isOnline: this.isOnline() });
  }

  public isSimulatedOffline(): boolean {
    return this.simulatedOffline;
  }

  // --- Rows Management (IndexedDB + LocalStorage) ---
  public getRows(): SheetRow[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.ROWS);
      if (data) {
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch (e) {
      console.error('Failed to parse rows from storage', e);
    }

    // Default to the user's 90 items equipment inventory
    this.saveRows(INITIAL_EQUIPMENT_DATA, false);
    return INITIAL_EQUIPMENT_DATA;
  }

  public saveRows(rows: SheetRow[], broadcastUpdate: boolean = true) {
    try {
      localStorage.setItem(STORAGE_KEYS.ROWS, JSON.stringify(rows));
      // Also update browser IndexedDB
      indexedDbService.setCachedRows(rows).catch(() => {});
      if (broadcastUpdate) {
        this.broadcast('ROWS_UPDATED', rows);
      }
    } catch (e) {
      console.error('Failed to save rows to storage', e);
    }
  }

  // --- Offline Queue (IndexedDB + LocalStorage) ---
  public getQueue(): QueuedAction[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.QUEUE);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  public enqueueAction(action: Omit<QueuedAction, 'id' | 'timestamp' | 'retryCount'>): QueuedAction {
    const queue = this.getQueue();
    const newAction: QueuedAction = {
      ...action,
      id: 'queue_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
      timestamp: new Date().toISOString(),
      retryCount: 0,
    };
    queue.push(newAction);
    localStorage.setItem(STORAGE_KEYS.QUEUE, JSON.stringify(queue));

    // Also persist in IndexedDB
    indexedDbService.enqueue({
      type: action.type === 'UPDATE_ROW' ? 'UPDATE' : action.type === 'ADD_ROW' ? 'ADD' : 'DELETE',
      rowId: action.payload?.id || '',
      payload: action.payload,
      baseVersion: action.baseVersion || 1,
    }).catch(() => {});

    this.broadcast('QUEUE_UPDATED', queue);
    return newAction;
  }

  public removeQueuedAction(id: string) {
    let queue = this.getQueue();
    queue = queue.filter(q => q.id !== id);
    localStorage.setItem(STORAGE_KEYS.QUEUE, JSON.stringify(queue));
    indexedDbService.dequeue(id).catch(() => {});
    this.broadcast('QUEUE_UPDATED', queue);
  }

  public clearQueue() {
    localStorage.setItem(STORAGE_KEYS.QUEUE, JSON.stringify([]));
    indexedDbService.clearQueue().catch(() => {});
    this.broadcast('QUEUE_UPDATED', []);
  }

  // --- Conflicts Management ---
  public getConflicts(): ConflictItem[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.CONFLICTS);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  public saveConflicts(conflicts: ConflictItem[]) {
    localStorage.setItem(STORAGE_KEYS.CONFLICTS, JSON.stringify(conflicts));
    this.broadcast('CONFLICTS_UPDATED', conflicts);
  }

  public addConflict(conflict: Omit<ConflictItem, 'id' | 'timestamp' | 'status'>) {
    const item: ConflictItem = {
      ...conflict,
      id: 'conf_' + Date.now(),
      timestamp: new Date().toISOString(),
      status: 'pending',
    };
    const conflicts = [item, ...this.getConflicts()];
    this.saveConflicts(conflicts);

    this.createAlert({
      level: 'critical',
      type: 'collision',
      title: 'Sync Conflict Detected',
      message: `Conflict on equipment item #${item.clientRow?.slno || item.rowId}. Server has newer edits.`,
      rowId: item.rowId,
      rowName: item.clientRow?.description,
    });

    return item;
  }

  public resolveConflict(conflictId: string, strategy: 'CLIENT_WINS' | 'SERVER_WINS' | 'SMART_MERGE') {
    let conflicts = this.getConflicts();
    const target = conflicts.find(c => c.id === conflictId);
    if (!target) return;

    const currentRows = this.getRows();
    let updatedRows = currentRows;

    if (strategy === 'CLIENT_WINS') {
      // Force user's version
      updatedRows = currentRows.map(r => r.id === target.rowId ? { ...target.clientRow, version: (target.serverRow?.version || 1) + 1 } : r);
      this.saveRows(updatedRows);
      this.enqueueAction({
        type: 'UPDATE_ROW',
        payload: { ...target.clientRow, forceOverwrite: true },
        baseVersion: target.serverRow?.version || 1,
      });
    } else if (strategy === 'SERVER_WINS') {
      // Accept server's version
      updatedRows = currentRows.map(r => r.id === target.rowId ? { ...target.serverRow, syncStatus: 'synced' } : r);
      this.saveRows(updatedRows);
    } else if (strategy === 'SMART_MERGE') {
      // Merge: Keep client's edits for non-empty fields, keep server's version number
      const merged: SheetRow = {
        ...target.serverRow,
        ...target.clientRow,
        version: (target.serverRow?.version || 1) + 1,
        lastModified: new Date().toISOString(),
        lastModifiedBy: 'Smart Merge',
        syncStatus: 'pending',
      };
      updatedRows = currentRows.map(r => r.id === target.rowId ? merged : r);
      this.saveRows(updatedRows);
      this.enqueueAction({
        type: 'UPDATE_ROW',
        payload: merged,
        baseVersion: target.serverRow?.version || 1,
      });
    }

    conflicts = conflicts.filter(c => c.id !== conflictId);
    this.saveConflicts(conflicts);

    this.createAlert({
      level: 'info',
      type: 'sync',
      title: 'Conflict Resolved',
      message: `Conflict on ${target.clientRow?.description} resolved via ${strategy.replace('_', ' ')}.`,
      rowId: target.rowId,
    });
  }

  // --- Cloud Backups Snapshots ---
  public getBackups(): BackupSnapshot[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.BACKUPS);
      if (data) return JSON.parse(data);
    } catch {}

    const initialSnapshot: BackupSnapshot = {
      id: 'snap_initial_seed',
      timestamp: new Date(Date.now() - 3600000).toISOString(),
      title: 'Baseline Equipment Inventory & Calibration Backup',
      rowCount: INITIAL_EQUIPMENT_DATA.length,
      data: INITIAL_EQUIPMENT_DATA,
      createdBy: 'System Autosave',
      note: 'Master snapshot of 90 calibrated equipment items',
      isAutomatic: true,
    };
    this.saveBackups([initialSnapshot]);
    return [initialSnapshot];
  }

  public saveBackups(backups: BackupSnapshot[]) {
    try {
      const trimmed = backups.slice(0, 30);
      localStorage.setItem(STORAGE_KEYS.BACKUPS, JSON.stringify(trimmed));
      this.broadcast('BACKUPS_UPDATED', trimmed);
    } catch (e) {
      console.error('Error saving backups', e);
    }
  }

  public createSnapshot(title: string, note: string = '', rows?: SheetRow[], author: string = 'Current User'): BackupSnapshot {
    const currentRows = rows || this.getRows();
    const newSnapshot: BackupSnapshot = {
      id: 'snap_' + Date.now(),
      timestamp: new Date().toISOString(),
      title: title || 'Equipment Snapshot ' + new Date().toLocaleTimeString(),
      rowCount: currentRows.length,
      data: JSON.parse(JSON.stringify(currentRows)),
      createdBy: author,
      note: note,
    };

    const backups = [newSnapshot, ...this.getBackups()];
    this.saveBackups(backups);

    this.createAlert({
      level: 'info',
      type: 'backup',
      title: 'Cloud Backup Created',
      message: `Snapshot "${newSnapshot.title}" with ${newSnapshot.rowCount} equipment items saved securely.`,
    });

    return newSnapshot;
  }

  public restoreSnapshot(snapshotId: string): SheetRow[] | null {
    const backups = this.getBackups();
    const target = backups.find(b => b.id === snapshotId);
    if (!target) return null;

    this.createSnapshot('Autosave Before Restore', 'Safeguard backup taken prior to restoring snapshot ' + target.title);
    this.saveRows(target.data, true);

    this.createAlert({
      level: 'warning',
      type: 'backup',
      title: 'Spreadsheet Restored',
      message: `Restored to snapshot "${target.title}" (${target.rowCount} items).`,
    });

    return target.data;
  }

  // --- Critical Alerts & Notification System ---
  public getAlerts(): CriticalAlert[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.ALERTS);
      if (data) return JSON.parse(data);
    } catch {}

    const seedAlerts: CriticalAlert[] = [
      {
        id: 'alert_seed_1',
        timestamp: new Date(Date.now() - 25 * 60000).toISOString(),
        level: 'critical',
        type: 'calibration_overdue',
        title: 'Calibration Overdue Alert',
        message: 'Battery impendence tester (SLNO 1) is overdue by 105 days (Due: 21-Jun-2026).',
        rowId: 'item_1',
        rowName: 'Battery impendence tester',
        isRead: false,
      },
      {
        id: 'alert_seed_2',
        timestamp: new Date(Date.now() - 50 * 60000).toISOString(),
        level: 'warning',
        type: 'status_change',
        title: 'Equipment Faulty / Under Repair',
        message: 'Battery Load Bank Programa (SLNO 3) has voltage difference -15V and is under repair.',
        rowId: 'item_3',
        rowName: 'Battery Load Bank',
        isRead: false,
      },
    ];
    this.saveAlerts(seedAlerts);
    return seedAlerts;
  }

  public saveAlerts(alerts: CriticalAlert[]) {
    try {
      const trimmed = alerts.slice(0, 50);
      localStorage.setItem(STORAGE_KEYS.ALERTS, JSON.stringify(trimmed));
      this.broadcast('ALERTS_UPDATED', trimmed);
    } catch (e) {
      console.error('Error saving alerts', e);
    }
  }

  public createAlert(alert: Omit<CriticalAlert, 'id' | 'timestamp' | 'isRead'>): CriticalAlert {
    const newAlert: CriticalAlert = {
      ...alert,
      id: 'alert_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      timestamp: new Date().toISOString(),
      isRead: false,
    };

    const current = [newAlert, ...this.getAlerts()];
    this.saveAlerts(current);

    if (newAlert.level === 'critical' || newAlert.level === 'warning') {
      soundManager.playAlert();
    }

    return newAlert;
  }

  public markAlertRead(id: string) {
    const alerts = this.getAlerts().map(a => (a.id === id ? { ...a, isRead: true } : a));
    this.saveAlerts(alerts);
  }

  public markAllAlertsRead() {
    const alerts = this.getAlerts().map(a => ({ ...a, isRead: true }));
    this.saveAlerts(alerts);
  }

  public clearAllAlerts() {
    this.saveAlerts([]);
  }

  // --- Real-Time Pub/Sub & Mesh ---
  public subscribe(callback: (event: string, payload: any) => void) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  private notifyListeners(event: string, payload: any) {
    this.listeners.forEach((cb) => {
      try {
        cb(event, payload);
      } catch (err) {
        console.error('Listener callback error', err);
      }
    });
  }

  public broadcast(event: string, payload: any) {
    this.notifyListeners(event, payload);
    if (this.broadcastChannel) {
      try {
        this.broadcastChannel.postMessage({ type: event, data: payload });
      } catch (e) {}
    }
  }
}

export const storageService = new StorageService();
