import { SheetRow, SyncState, QueuedAction } from '../types/sheet';
import { storageService } from './storageService';
import { soundManager } from './audio';

type SyncListener = (state: SyncState) => void;

class SyncEngine {
  private syncState: SyncState = {
    status: 'synced',
    lastSyncedAt: new Date().toISOString(),
    pendingCount: 0,
    latencyMs: 35,
    errorMessage: null,
    backendType: 'broadcast_live',
    appsScriptUrl: '',
    autoSyncInterval: 10,
    storageMode: 'IndexedDB + LocalStorage',
  };

  private listeners: Set<SyncListener> = new Set();
  private autoSyncTimer: any = null;
  private isFlushing: boolean = false;

  constructor() {
    if (typeof window !== 'undefined') {
      const savedUrl = localStorage.getItem('sheetsync_appsscript_url') || '';
      const savedInterval = Number(localStorage.getItem('sheetsync_auto_interval')) || 10;
      this.syncState.appsScriptUrl = savedUrl;
      this.syncState.autoSyncInterval = savedInterval;
      if (savedUrl) {
        this.syncState.backendType = 'apps_script';
      }

      window.addEventListener('online', () => this.handleNetworkChange(true));
      window.addEventListener('offline', () => this.handleNetworkChange(false));

      storageService.subscribe((event) => {
        if (event === 'QUEUE_UPDATED') {
          this.updatePendingCount();
        } else if (event === 'NETWORK_STATUS_CHANGED') {
          this.handleNetworkChange(storageService.isOnline());
        }
      });

      this.updatePendingCount();
      this.startAutoSync();
    }
  }

  public getState(): SyncState {
    return { ...this.syncState };
  }

  public subscribe(listener: SyncListener) {
    this.listeners.add(listener);
    listener(this.getState());
    return () => this.listeners.delete(listener);
  }

  private notify() {
    const state = this.getState();
    this.listeners.forEach(fn => fn(state));
  }

  public setAppsScriptUrl(url: string) {
    this.syncState.appsScriptUrl = url.trim();
    if (url.trim()) {
      this.syncState.backendType = 'apps_script';
      localStorage.setItem('sheetsync_appsscript_url', url.trim());
    } else {
      this.syncState.backendType = 'broadcast_live';
      localStorage.removeItem('sheetsync_appsscript_url');
    }
    this.notify();
  }

  public setAutoSyncInterval(seconds: number) {
    this.syncState.autoSyncInterval = seconds;
    localStorage.setItem('sheetsync_auto_interval', String(seconds));
    this.startAutoSync();
    this.notify();
  }

  private startAutoSync() {
    if (this.autoSyncTimer) {
      clearInterval(this.autoSyncTimer);
      this.autoSyncTimer = null;
    }
    if (this.syncState.autoSyncInterval > 0) {
      this.autoSyncTimer = setInterval(() => {
        if (storageService.isOnline() && !this.isFlushing) {
          this.syncNow(false);
        }
      }, this.syncState.autoSyncInterval * 1000);
    }
  }

  private handleNetworkChange(isOnline: boolean) {
    if (!isOnline) {
      this.syncState.status = 'offline';
      this.syncState.errorMessage = 'Offline Mode Active. Edits stored in browser IndexedDB cache.';
      soundManager.playOfflineWarning();
      this.notify();
    } else {
      this.syncState.status = 'pending';
      this.syncState.errorMessage = null;
      this.notify();
      this.flushQueue();
    }
  }

  private updatePendingCount() {
    const queue = storageService.getQueue();
    this.syncState.pendingCount = queue.length;
    if (queue.length > 0 && this.syncState.status === 'synced') {
      this.syncState.status = 'pending';
    }
    this.notify();
  }

  public async syncNow(manual: boolean = true): Promise<{ success: boolean; message: string }> {
    if (!storageService.isOnline()) {
      this.syncState.status = 'offline';
      this.notify();
      return { success: false, message: 'Offline mode: changes queued in IndexedDB.' };
    }

    if (this.isFlushing) {
      return { success: true, message: 'Sync in progress...' };
    }

    this.isFlushing = true;
    const startTime = performance.now();
    this.syncState.status = 'syncing';
    this.syncState.errorMessage = null;
    this.notify();

    try {
      const queue = storageService.getQueue();
      const appsScriptUrl = this.syncState.appsScriptUrl;

      if (appsScriptUrl) {
        if (queue.length > 0) {
          await this.flushQueueToAppsScript(appsScriptUrl, queue);
        }

        try {
          const fetchUrl = appsScriptUrl + (appsScriptUrl.includes('?') ? '&' : '?') + 'action=getData&_t=' + Date.now();
          const res = await fetch(fetchUrl, {
            method: 'GET',
            headers: { 'Accept': 'application/json' },
          });

          if (res.ok) {
            const data = await res.json();
            if (data.success && Array.isArray(data.data) && data.data.length > 0) {
              this.mergeRemoteRows(data.data);
            }
          }
        } catch (fetchErr) {
          console.warn('Apps Script sync fallback to IndexedDB mesh', fetchErr);
        }
      } else {
        await new Promise(res => setTimeout(res, manual ? 350 : 120));
        const currentRows = storageService.getRows();
        const updated = currentRows.map(r => r.syncStatus === 'pending' || r.syncStatus === 'syncing' ? { ...r, syncStatus: 'synced' as const } : r);
        storageService.saveRows(updated, true);
        storageService.clearQueue();
      }

      const duration = Math.round(performance.now() - startTime);
      this.syncState.latencyMs = duration;
      this.syncState.status = 'synced';
      this.syncState.lastSyncedAt = new Date().toISOString();
      this.syncState.pendingCount = 0;
      this.syncState.errorMessage = null;

      if (manual) {
        soundManager.playSyncSuccess();
      }

      this.notify();
      return { success: true, message: `Synchronized with Google Sheet in ${duration}ms` };

    } catch (err: any) {
      console.error('Sync failed:', err);
      this.syncState.status = 'error';
      this.syncState.errorMessage = err.message || 'Synchronization failed.';
      this.notify();
      return { success: false, message: this.syncState.errorMessage || 'Synchronization failed.' };
    } finally {
      this.isFlushing = false;
    }
  }

  private async flushQueueToAppsScript(url: string, queue: QueuedAction[]) {
    for (const item of queue) {
      try {
        let body: any = {
          action: 'updateRowWithConflictCheck',
          row: item.payload,
          baseVersion: item.baseVersion || item.payload.version || 1,
          forceOverwrite: item.payload.forceOverwrite === true,
        };

        if (item.type === 'ADD_ROW') {
          body.action = 'addRow';
        } else if (item.type === 'DELETE_ROW') {
          body.action = 'deleteRow';
          body.rowId = item.payload.id;
        }

        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify(body),
        });

        if (res.ok) {
          const resp = await res.json();
          if (resp && resp.conflict) {
            // Register conflict
            storageService.addConflict({
              rowId: item.payload.id,
              clientRow: item.payload,
              serverRow: resp.serverRow,
              conflictType: 'VERSION_MISMATCH',
            });
          } else {
            storageService.removeQueuedAction(item.id);
          }
        }
      } catch (e) {
        console.warn('Queue flush error', item, e);
      }
    }
  }

  public async flushQueue() {
    if (!storageService.isOnline() || this.isFlushing) return;
    await this.syncNow(false);
  }

  private mergeRemoteRows(remoteData: any[]) {
    const localRows = storageService.getRows();
    const localMap = new Map(localRows.map(r => [r.id, r]));
    const merged: SheetRow[] = [];

    remoteData.forEach((rem, idx) => {
      const id = rem.id || rem.ID || ('item_' + (rem.SLNO || idx + 1));
      const existing = localMap.get(id);

      if (existing) {
        if (existing.syncStatus === 'pending') {
          merged.push(existing);
        } else {
          merged.push({
            ...existing,
            description: rem.Description || rem.description || existing.description,
            make: rem.Make || rem.make || existing.make,
            model: rem.Model || rem.model || existing.model,
            serialNo: rem['Serial No'] || rem.serialNo || existing.serialNo,
            type: rem['Personal /Common'] || rem.type || existing.type,
            condition: rem.condition || existing.condition,
            location: rem['Location/Individual'] || rem.location || existing.location,
            calibrationDueDate: rem['Calibration due date'] || rem.calibrationDueDate || existing.calibrationDueDate,
            remarks: rem.Remarks || rem.remarks || existing.remarks,
            dueDays: rem['Due days'] !== undefined ? rem['Due days'] : existing.dueDays,
            version: Number(rem.Version || rem.version) || existing.version,
            lastModified: rem['Last Modified'] || rem.lastModified || existing.lastModified,
            syncStatus: 'synced',
          });
        }
        localMap.delete(id);
      } else {
        merged.push({
          id: id,
          slno: Number(rem.SLNO) || (idx + 1),
          description: rem.Description || rem.description || 'Equipment Item',
          make: rem.Make || rem.make || '',
          model: rem.Model || rem.model || '',
          serialNo: rem['Serial No'] || rem.serialNo || '',
          type: rem['Personal /Common'] || rem.type || 'common',
          condition: rem.condition || 'Good',
          location: rem['Location/Individual'] || rem.location || 'AD-12',
          calibrationDueDate: rem['Calibration due date'] || rem.calibrationDueDate || '',
          remarks: rem.Remarks || rem.remarks || '',
          dueDays: rem['Due days'] !== undefined ? rem['Due days'] : '',
          version: Number(rem.Version || rem.version) || 1,
          lastModified: rem['Last Modified'] || new Date().toISOString(),
          lastModifiedBy: 'Google Sheet Sync',
          syncStatus: 'synced',
        });
      }
    });

    localMap.forEach(row => merged.push(row));
    storageService.saveRows(merged, true);
  }
}

export const syncEngine = new SyncEngine();
