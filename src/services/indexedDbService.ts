/**
 * IndexedDB Service for SheetSync Pro
 * Browser-based persistent storage for offline caching, mutation queuing, and conflict tracking
 */

const DB_NAME = 'SheetSync_Equipment_DB';
const DB_VERSION = 1;
const STORES = {
  ROWS: 'equipment_rows',
  QUEUE: 'sync_queue',
  CONFLICTS: 'sync_conflicts',
  META: 'sync_metadata',
};

export interface OfflineQueueItem {
  id: string;
  type: 'UPDATE' | 'ADD' | 'DELETE' | 'BULK_UPDATE';
  rowId: string;
  payload: any;
  timestamp: string;
  baseVersion: number;
  retryCount: number;
}

export interface ConflictItem {
  id: string;
  rowId: string;
  clientRow: any;
  serverRow: any;
  conflictType: 'VERSION_MISMATCH' | 'REMOTE_MODIFIED';
  timestamp: string;
  status: 'pending' | 'resolved';
}

class IndexedDbService {
  private dbPromise: Promise<IDBDatabase> | null = null;

  private getDB(): Promise<IDBDatabase> {
    if (this.dbPromise) return this.dbPromise;

    this.dbPromise = new Promise((resolve, reject) => {
      if (typeof window === 'undefined' || !window.indexedDB) {
        reject(new Error('IndexedDB not supported in this environment'));
        return;
      }

      const request = window.indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORES.ROWS)) {
          db.createObjectStore(STORES.ROWS, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(STORES.QUEUE)) {
          const queueStore = db.createObjectStore(STORES.QUEUE, { keyPath: 'id' });
          queueStore.createIndex('timestamp', 'timestamp', { unique: false });
        }
        if (!db.objectStoreNames.contains(STORES.CONFLICTS)) {
          db.createObjectStore(STORES.CONFLICTS, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(STORES.META)) {
          db.createObjectStore(STORES.META, { keyPath: 'key' });
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    return this.dbPromise;
  }

  // --- Rows Caching in IndexedDB ---
  public async getCachedRows<T>(): Promise<T[]> {
    try {
      const db = await this.getDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORES.ROWS, 'readonly');
        const store = tx.objectStore(STORES.ROWS);
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => reject(req.error);
      });
    } catch (e) {
      console.warn('IndexedDB getCachedRows fallback', e);
      return [];
    }
  }

  public async setCachedRows<T extends { id: string }>(rows: T[]): Promise<void> {
    try {
      const db = await this.getDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORES.ROWS, 'readwrite');
        const store = tx.objectStore(STORES.ROWS);
        store.clear();
        rows.forEach((row) => store.put(row));
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } catch (e) {
      console.warn('IndexedDB setCachedRows error', e);
    }
  }

  public async putRow<T extends { id: string }>(row: T): Promise<void> {
    try {
      const db = await this.getDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORES.ROWS, 'readwrite');
        const store = tx.objectStore(STORES.ROWS);
        store.put(row);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } catch (e) {
      console.warn('IndexedDB putRow error', e);
    }
  }

  public async deleteRow(id: string): Promise<void> {
    try {
      const db = await this.getDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORES.ROWS, 'readwrite');
        const store = tx.objectStore(STORES.ROWS);
        store.delete(id);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } catch (e) {
      console.warn('IndexedDB deleteRow error', e);
    }
  }

  // --- Offline Mutation Queue in IndexedDB ---
  public async getQueue(): Promise<OfflineQueueItem[]> {
    try {
      const db = await this.getDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORES.QUEUE, 'readonly');
        const store = tx.objectStore(STORES.QUEUE);
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => reject(req.error);
      });
    } catch (e) {
      return [];
    }
  }

  public async enqueue(item: Omit<OfflineQueueItem, 'id' | 'timestamp' | 'retryCount'>): Promise<OfflineQueueItem> {
    const queueItem: OfflineQueueItem = {
      ...item,
      id: 'q_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
      timestamp: new Date().toISOString(),
      retryCount: 0,
    };

    try {
      const db = await this.getDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORES.QUEUE, 'readwrite');
        const store = tx.objectStore(STORES.QUEUE);
        store.put(queueItem);
        tx.oncomplete = () => resolve(queueItem);
        tx.onerror = () => reject(tx.error);
      });
    } catch (e) {
      return queueItem;
    }
  }

  public async dequeue(id: string): Promise<void> {
    try {
      const db = await this.getDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORES.QUEUE, 'readwrite');
        const store = tx.objectStore(STORES.QUEUE);
        store.delete(id);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } catch (e) {
      // ignore
    }
  }

  public async clearQueue(): Promise<void> {
    try {
      const db = await this.getDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORES.QUEUE, 'readwrite');
        const store = tx.objectStore(STORES.QUEUE);
        store.clear();
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } catch (e) {
      // ignore
    }
  }

  // --- Conflict Resolution Store ---
  public async getConflicts(): Promise<ConflictItem[]> {
    try {
      const db = await this.getDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORES.CONFLICTS, 'readonly');
        const store = tx.objectStore(STORES.CONFLICTS);
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => reject(req.error);
      });
    } catch (e) {
      return [];
    }
  }

  public async addConflict(conflict: Omit<ConflictItem, 'id' | 'timestamp' | 'status'>): Promise<ConflictItem> {
    const item: ConflictItem = {
      ...conflict,
      id: 'conf_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      timestamp: new Date().toISOString(),
      status: 'pending',
    };
    try {
      const db = await this.getDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORES.CONFLICTS, 'readwrite');
        const store = tx.objectStore(STORES.CONFLICTS);
        store.put(item);
        tx.oncomplete = () => resolve(item);
        tx.onerror = () => reject(tx.error);
      });
    } catch (e) {
      return item;
    }
  }

  public async removeConflict(id: string): Promise<void> {
    try {
      const db = await this.getDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORES.CONFLICTS, 'readwrite');
        const store = tx.objectStore(STORES.CONFLICTS);
        store.delete(id);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } catch (e) {}
  }
}

export const indexedDbService = new IndexedDbService();
