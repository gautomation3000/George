import { SheetRow, SyncState, QueuedAction } from '../types/sheet';
import { storageService } from './storageService';
import { soundManager } from './audio';

export const DEFAULT_APPS_SCRIPT_URL =
  'https://script.google.com/macros/s/AKfycbypwpU_aVPgOaUcR55QuzRwKVAilju61khy0udL21zA5_gomnpUuVtbsn2fuqnb_0CS/exec';

type SyncListener = (state: SyncState) => void;

class SyncEngine {
  private syncState: SyncState = {
    status: 'synced',
    lastSyncedAt: new Date().toISOString(),
    pendingCount: 0,
    latencyMs: 42,
    errorMessage: null,
    backendType: 'apps_script',
    appsScriptUrl: DEFAULT_APPS_SCRIPT_URL,
    autoSyncInterval: 10,
    storageMode: 'IndexedDB + LocalStorage',
  };

  private listeners: Set<SyncListener> = new Set();
  private autoSyncTimer: any = null;
  private isFlushing: boolean = false;
  private hasInitialSynced: boolean = false;

  constructor() {
    if (typeof window !== 'undefined') {
      const savedUrl = localStorage.getItem('sheetsync_appsscript_url') || DEFAULT_APPS_SCRIPT_URL;
      const savedInterval = Number(localStorage.getItem('sheetsync_auto_interval')) || 10;
      this.syncState.appsScriptUrl = savedUrl;
      this.syncState.autoSyncInterval = savedInterval;
      if (savedUrl) {
        this.syncState.backendType = 'apps_script';
        localStorage.setItem('sheetsync_appsscript_url', savedUrl);
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

      // Trigger initial background sync to fetch latest Google Sheet data
      setTimeout(() => {
        if (!this.hasInitialSynced && storageService.isOnline()) {
          this.syncNow(false);
          this.hasInitialSynced = true;
        }
      }, 500);
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
    this.listeners.forEach((fn) => fn(state));
  }

  public setAppsScriptUrl(url: string) {
    const trimmed = url.trim();
    this.syncState.appsScriptUrl = trimmed;
    if (trimmed) {
      this.syncState.backendType = 'apps_script';
      localStorage.setItem('sheetsync_appsscript_url', trimmed);
    } else {
      this.syncState.backendType = 'broadcast_live';
      localStorage.removeItem('sheetsync_appsscript_url');
    }
    this.notify();
    if (trimmed && storageService.isOnline()) {
      this.syncNow(false);
    }
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
      const appsScriptUrl = this.syncState.appsScriptUrl || DEFAULT_APPS_SCRIPT_URL;

      if (appsScriptUrl) {
        // Step 1: Flush any queued mutations to Google Sheet
        if (queue.length > 0) {
          await this.flushQueueToAppsScript(appsScriptUrl, queue);
        }

        // Step 2: Fetch latest rows from Google Sheet
        try {
          const fetchUrl =
            appsScriptUrl +
            (appsScriptUrl.includes('?') ? '&' : '?') +
            'action=getData&_t=' +
            Date.now();

          const res = await fetch(fetchUrl, {
            method: 'GET',
            headers: { Accept: 'application/json' },
          });

          if (res.ok) {
            const data = await res.json();
            if (data.success && Array.isArray(data.data) && data.data.length > 0) {
              this.mergeRemoteRows(data.data);
            }
          }
        } catch (fetchErr) {
          console.warn('Apps Script sync fallback to IndexedDB cache', fetchErr);
        }
      } else {
        await new Promise((res) => setTimeout(res, manual ? 350 : 120));
        const currentRows = storageService.getRows();
        const updated = currentRows.map((r) =>
          r.syncStatus === 'pending' || r.syncStatus === 'syncing'
            ? { ...r, syncStatus: 'synced' as const }
            : r
        );
        storageService.saveRows(updated, true);
        storageService.clearQueue();
      }

      const duration = Math.round(performance.now() - startTime);
      this.syncState.latencyMs = duration;
      this.syncState.status = 'synced';
      this.syncState.lastSyncedAt = new Date().toISOString();
      this.syncState.pendingCount = storageService.getQueue().length;
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
        const payload = item.payload;
        let body: any = {
          action: 'updateRowWithConflictCheck',
          row: payload,
          baseVersion: item.baseVersion || payload.version || 1,
          forceOverwrite: true, // User modifications take precedence
        };

        if (item.type === 'ADD_ROW') {
          body.action = 'addRow';
        } else if (item.type === 'DELETE_ROW') {
          body.action = 'deleteRow';
          body.rowId = payload.id;
          body.slno = payload.slno;
        }

        let updateSuccess = false;
        let respData: any = null;

        // Method A: POST with text/plain (no preflight, follows redirects)
        try {
          const res = await fetch(url, {
            method: 'POST',
            redirect: 'follow',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify(body),
          });

          if (res.ok) {
            respData = await res.json();
            if (respData && (respData.success || respData.message)) {
              updateSuccess = true;
            }
          }
        } catch (postErr) {
          console.warn('POST sync attempt failed, trying GET fallback', postErr);
        }

        // Method B: GET fallback with encoded payload (100% immune to POST CORS / Drive redirect issues)
        if (!updateSuccess) {
          try {
            const dataParam = encodeURIComponent(JSON.stringify(body.row || body));
            const getUrl = `${url}${url.includes('?') ? '&' : '?'}action=${body.action}&data=${dataParam}&baseVersion=${body.baseVersion}&forceOverwrite=true&_t=${Date.now()}`;
            const resGet = await fetch(getUrl, {
              method: 'GET',
            });
            if (resGet.ok) {
              respData = await resGet.json();
              if (respData && (respData.success || respData.message)) {
                updateSuccess = true;
              }
            }
          } catch (getErr) {
            console.warn('GET sync fallback failed', getErr);
          }
        }

        if (updateSuccess) {
          storageService.removeQueuedAction(item.id);
          if (respData && respData.newVersion) {
            const currentRows = storageService.getRows();
            const updated = currentRows.map((r) =>
              r.id === payload.id
                ? { ...r, version: respData.newVersion, syncStatus: 'synced' as const }
                : r
            );
            storageService.saveRows(updated, false);
          }
        } else if (respData && respData.conflict) {
          storageService.addConflict({
            rowId: payload.id,
            clientRow: payload,
            serverRow: respData.serverRow,
            conflictType: 'VERSION_MISMATCH',
          });
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
    const localMap = new Map(localRows.map((r) => [r.id, r]));
    const merged: SheetRow[] = [];

    remoteData.forEach((rem, idx) => {
      const slno = Number(rem.slno || rem.SLNO) || idx + 1;
      const id = rem.id || rem.ID || 'item_' + slno;
      const existing = localMap.get(id);

      const conditionVal = rem.condition || (existing ? existing.condition : 'Good');
      const descVal =
        rem.description !== undefined && rem.description !== ''
          ? rem.description
          : rem.Description || (existing ? existing.description : 'Equipment Item');
      const makeVal =
        rem.make !== undefined && rem.make !== ''
          ? rem.make
          : rem.Make || (existing ? existing.make : '');
      const modelVal =
        rem.model !== undefined && rem.model !== ''
          ? String(rem.model)
          : rem.Model !== undefined
          ? String(rem.Model)
          : existing
          ? existing.model
          : '';
      const serialVal =
        rem.serialNo !== undefined && rem.serialNo !== ''
          ? String(rem.serialNo)
          : rem['Serial No'] !== undefined
          ? String(rem['Serial No'])
          : existing
          ? existing.serialNo
          : '';
      const typeVal = rem.type || rem['Personal /Common'] || (existing ? existing.type : 'common');
      const locVal =
        rem.location !== undefined && rem.location !== ''
          ? rem.location
          : rem['Location/Individual'] || (existing ? existing.location : 'AD-12');
      const calibVal =
        rem.calibrationDueDate !== undefined && rem.calibrationDueDate !== ''
          ? rem.calibrationDueDate
          : rem['Calibration due date'] || (existing ? existing.calibrationDueDate : '');
      const remarksVal =
        rem.remarks !== undefined && rem.remarks !== ''
          ? rem.remarks
          : rem.Remarks !== undefined
          ? rem.Remarks
          : existing
          ? existing.remarks
          : '';
      const dueDaysVal =
        rem.dueDays !== undefined
          ? rem.dueDays
          : rem['Due days'] !== undefined
          ? rem['Due days']
          : existing
          ? existing.dueDays
          : '';
      const versionVal = Number(rem.version || rem.Version) || (existing ? existing.version : 1);
      const lastModVal = rem.lastModified || rem['Last Modified'] || new Date().toISOString();

      if (existing) {
        if (existing.syncStatus === 'pending') {
          merged.push(existing);
        } else {
          merged.push({
            ...existing,
            description: descVal,
            make: makeVal,
            model: modelVal,
            serialNo: serialVal,
            type: typeVal,
            condition: conditionVal,
            location: locVal,
            calibrationDueDate: calibVal,
            remarks: remarksVal,
            dueDays: dueDaysVal,
            version: versionVal,
            lastModified: lastModVal,
            syncStatus: 'synced',
          });
        }
        localMap.delete(id);
      } else {
        merged.push({
          id: id,
          slno: slno,
          description: descVal,
          make: makeVal,
          model: modelVal,
          serialNo: serialVal,
          type: typeVal,
          condition: conditionVal,
          location: locVal,
          calibrationDueDate: calibVal,
          remarks: remarksVal,
          dueDays: dueDaysVal,
          version: versionVal,
          lastModified: lastModVal,
          lastModifiedBy: 'Google Sheet Sync',
          syncStatus: 'synced',
        });
      }
    });

    localMap.forEach((row) => merged.push(row));
    storageService.saveRows(merged, true);
  }
}

export const syncEngine = new SyncEngine();
