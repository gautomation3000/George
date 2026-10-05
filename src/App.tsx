import React, { useState, useEffect, useMemo } from 'react';
import { SheetRow, SyncState, CriticalAlert, BackupSnapshot, TeamMember, EquipmentCondition, SheetTabName } from './types/sheet';
import { AuthState } from './types/auth';
import { INITIAL_TEAM_MEMBERS } from './data/initialData';
import { storageService } from './services/storageService';
import { syncEngine } from './services/syncEngine';
import { authService } from './services/authService';
import { ConflictItem } from './services/indexedDbService';
import { Header } from './components/Header';
import { SheetTabBar } from './components/SheetTabBar';
import { StatsBar } from './components/StatsBar';
import { DataTableView } from './components/DataTableView';
import { MobileCardView } from './components/MobileCardView';
import { AppsScriptModal } from './components/AppsScriptModal';
import { BackupModal } from './components/BackupModal';
import { ImportExportModal } from './components/ImportExportModal';
import { EditRowModal } from './components/EditRowModal';
import { ConflictModal } from './components/ConflictModal';
import { AuthModal } from './components/AuthModal';
import { WifiOff } from 'lucide-react';

export default function App() {
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const savedTheme = localStorage.getItem('sheetsync_theme');
      if (savedTheme) return savedTheme === 'dark';
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return false;
  });

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('sheetsync_theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('sheetsync_theme', 'light');
    }
  }, [isDarkMode]);

  const [rows, setRows] = useState<SheetRow[]>(() => storageService.getRows());
  const [syncState, setSyncState] = useState<SyncState>(() => syncEngine.getState());
  const [authState, setAuthState] = useState<AuthState>(() => authService.getState());
  const [alerts, setAlerts] = useState<CriticalAlert[]>(() => storageService.getAlerts());
  const [backups, setBackups] = useState<BackupSnapshot[]>(() => storageService.getBackups());
  const [conflicts, setConflicts] = useState<ConflictItem[]>(() => storageService.getConflicts());
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>(INITIAL_TEAM_MEMBERS);
  const [isSimulatedOffline, setIsSimulatedOffline] = useState<boolean>(() => storageService.isSimulatedOffline());

  // Sheet Tabs switcher state ('Full list' | 'Hand tools' | 'Faulty Tools' | 'Spare tools' | 'Regular Calibration tools')
  const [activeSheetTab, setActiveSheetTab] = useState<SheetTabName>('Full list');
  const [activeView, setActiveView] = useState<'table' | 'cards'>('table');

  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [appsScriptModalOpen, setAppsScriptModalOpen] = useState(false);
  const [backupModalOpen, setBackupModalOpen] = useState(false);
  const [importExportModalOpen, setImportExportModalOpen] = useState(false);
  const [editRowModalOpen, setEditRowModalOpen] = useState(false);
  const [rowToEdit, setRowToEdit] = useState<SheetRow | null>(null);
  const [highlightedRowId, setHighlightedRowId] = useState<string | null>(null);

  useEffect(() => {
    const unsubSync = syncEngine.subscribe((state) => {
      setSyncState(state);
    });

    const unsubAuth = authService.subscribe((state) => {
      setAuthState(state);
    });

    const unsubStorage = storageService.subscribe((event, data) => {
      if (event === 'ROWS_UPDATED') {
        setRows(data);
      } else if (event === 'ALERTS_UPDATED') {
        setAlerts(data);
      } else if (event === 'BACKUPS_UPDATED') {
        setBackups(data);
      } else if (event === 'CONFLICTS_UPDATED') {
        setConflicts(data);
      } else if (event === 'NETWORK_STATUS_CHANGED') {
        setIsSimulatedOffline(storageService.isSimulatedOffline());
      }
    });

    return () => {
      unsubSync();
      unsubAuth();
      unsubStorage();
    };
  }, []);

  const canEdit =
    authState.isUnlocked &&
    (authState.role === 'developer' ||
      authState.role === 'admin' ||
      !!authState.currentUser?.permissions.canEditTools);

  const canDelete =
    authState.isUnlocked &&
    (authState.role === 'developer' ||
      authState.role === 'admin' ||
      !!authState.currentUser?.permissions.canDeleteTools);

  // Filter rows based on active Google Sheet tab with sequential sheet numbering
  const tabFilteredRows = useMemo(() => {
    let result: SheetRow[] = [];
    if (activeSheetTab === 'Full list') {
      result = rows;
    } else if (activeSheetTab === 'Hand tools') {
      result = rows.filter((r) => {
        const desc = (r.description || '').toLowerCase();
        const make = (r.make || '').toLowerCase();
        return (
          desc.includes('clamp') ||
          desc.includes('multimeter') ||
          desc.includes('multi meter') ||
          desc.includes('meter') ||
          desc.includes('camera') ||
          desc.includes('thermo') ||
          desc.includes('detector') ||
          (desc.includes('tester') &&
            !desc.includes('battery') &&
            !desc.includes('load bank') &&
            !desc.includes('injection')) ||
          make === 'fluke'
        );
      });
    } else if (activeSheetTab === 'Faulty Tools') {
      result = rows.filter((r) => {
        const cond = (r.condition || '').toLowerCase();
        const rem = (r.remarks || '').toLowerCase();
        return cond.includes('faulty') || rem.includes('defective') || rem.includes('faulty');
      });
    } else if (activeSheetTab === 'Spare tools') {
      result = rows.filter((r) => {
        const cond = (r.condition || '').toLowerCase();
        const rem = (r.remarks || '').toLowerCase();
        return cond.includes('spare') || cond.includes('emergency') || rem.includes('emergency');
      });
    } else if (activeSheetTab === 'Regular Calibration tools') {
      result = rows.filter((r) => {
        const desc = (r.description || '').toLowerCase();
        return (
          desc.includes('injection') ||
          desc.includes('high voltage') ||
          desc.includes('load bank') ||
          desc.includes('ohm meter') ||
          desc.includes('micro ohm') ||
          desc.includes('earth tester') ||
          desc.includes('power quality') ||
          desc.includes('partial discharge') ||
          desc.includes('battery') ||
          desc.includes('calibrat')
        );
      });
    } else {
      result = rows;
    }

    // Assign sequential sheetSlno (1, 2, 3...) for accurate sheet indexing while preserving original SLNO and Serial No
    return result.map((r, index) => ({
      ...r,
      sheetSlno: index + 1,
    }));
  }, [rows, activeSheetTab]);

  // Mutations
  const handleUpdateRow = (updatedRow: SheetRow) => {
    const existing = rows.find((r) => r.id === updatedRow.id);
    const rowToSave: SheetRow = {
      ...(existing || {}),
      ...updatedRow,
      // Protect Model, Serial No, Description, and Make from ever becoming empty
      model:
        updatedRow.model !== undefined && updatedRow.model !== ''
          ? updatedRow.model
          : existing?.model || '',
      serialNo:
        updatedRow.serialNo !== undefined && updatedRow.serialNo !== ''
          ? updatedRow.serialNo
          : existing?.serialNo || '',
      description: updatedRow.description || existing?.description || 'Equipment Item',
      make: updatedRow.make || existing?.make || '',
      lastModified: new Date().toISOString(),
      lastModifiedBy: 'You',
      syncStatus: 'pending',
    };
    const newRows = rows.map((r) => (r.id === updatedRow.id ? rowToSave : r));
    setRows(newRows);
    storageService.saveRows(newRows);

    storageService.enqueueAction({
      type: 'UPDATE_ROW',
      payload: {
        ...rowToSave,
        sheetName: activeSheetTab,
      },
      baseVersion: rowToSave.version || 1,
    });

    if (rowToSave.condition === 'Faulty') {
      storageService.createAlert({
        level: 'critical',
        type: 'status_change',
        title: 'Equipment Faulty Alert',
        message: `${rowToSave.description} (${rowToSave.make} ${rowToSave.model}) was marked as FAULTY.`,
        rowId: rowToSave.id,
        rowName: rowToSave.description,
      });
    }

    syncEngine.syncNow(false);
  };

  const handleAddRow = (newRow: SheetRow, isNew: boolean) => {
    if (isNew) {
      const rowToSave: SheetRow = {
        ...newRow,
        lastModified: new Date().toISOString(),
        lastModifiedBy: 'You',
        syncStatus: 'pending',
      };
      const newRows = [rowToSave, ...rows];
      setRows(newRows);
      storageService.saveRows(newRows);

      storageService.enqueueAction({
        type: 'ADD_ROW',
        payload: rowToSave,
        baseVersion: 1,
      });

      storageService.createAlert({
        level: 'info',
        type: 'sync',
        title: 'New Equipment Added',
        message: `Added ${rowToSave.description} (${rowToSave.make} ${rowToSave.model}) to inventory.`,
        rowId: rowToSave.id,
        rowName: rowToSave.description,
      });
    } else {
      handleUpdateRow(newRow);
    }

    syncEngine.syncNow(false);
  };

  const handleDeleteRow = (id: string) => {
    const target = rows.find((r) => r.id === id);
    const newRows = rows.filter((r) => r.id !== id);
    setRows(newRows);
    storageService.saveRows(newRows);

    storageService.enqueueAction({
      type: 'DELETE_ROW',
      payload: { id, slno: target?.slno },
    });

    if (target) {
      storageService.createAlert({
        level: 'warning',
        type: 'deletion',
        title: 'Equipment Removed',
        message: `Removed ${target.description} (S/N: ${target.serialNo}) from tracker.`,
      });
    }

    syncEngine.syncNow(false);
  };

  const handleDuplicateRow = (row: SheetRow) => {
    const copy: SheetRow = {
      ...row,
      id: 'item_' + Date.now(),
      slno: rows.length + 1,
      description: `${row.description} (Copy)`,
      lastModified: new Date().toISOString(),
      lastModifiedBy: 'You',
      version: 1,
      syncStatus: 'pending',
    };

    const newRows = [copy, ...rows];
    setRows(newRows);
    storageService.saveRows(newRows);

    storageService.enqueueAction({
      type: 'ADD_ROW',
      payload: copy,
      baseVersion: 1,
    });

    syncEngine.syncNow(false);
  };

  const handleBulkDelete = (ids: string[]) => {
    storageService.createSnapshot('Autosave Before Bulk Delete', `Safeguard before removing ${ids.length} items`);

    const idSet = new Set(ids);
    const newRows = rows.filter((r) => !idSet.has(r.id));
    setRows(newRows);
    storageService.saveRows(newRows);

    ids.forEach((id) => {
      storageService.enqueueAction({
        type: 'DELETE_ROW',
        payload: { id },
      });
    });

    storageService.createAlert({
      level: 'warning',
      type: 'deletion',
      title: 'Bulk Equipment Deletion',
      message: `${ids.length} units removed from tracker. Backup snapshot created.`,
    });

    syncEngine.syncNow(false);
  };

  const handleBulkConditionChange = (ids: string[], newCondition: EquipmentCondition) => {
    const idSet = new Set(ids);
    const newRows = rows.map((r) =>
      idSet.has(r.id)
        ? {
            ...r,
            condition: newCondition,
            lastModified: new Date().toISOString(),
            lastModifiedBy: 'You',
            version: (r.version || 1) + 1,
            syncStatus: 'pending' as const,
          }
        : r
    );

    setRows(newRows);
    storageService.saveRows(newRows);

    storageService.enqueueAction({
      type: 'BATCH_UPDATE',
      payload: { rows: newRows.filter((r) => idSet.has(r.id)) },
    });

    syncEngine.syncNow(false);
  };

  const handleImportRows = (importedRows: SheetRow[], mode: 'replace' | 'append') => {
    storageService.createSnapshot('Autosave Before Import', 'Safeguard prior to importing external file');

    let nextRows: SheetRow[];
    if (mode === 'replace') {
      nextRows = importedRows;
    } else {
      nextRows = [...importedRows, ...rows];
    }

    setRows(nextRows);
    storageService.saveRows(nextRows);

    storageService.enqueueAction({
      type: 'BATCH_UPDATE',
      payload: { rows: nextRows },
    });

    syncEngine.syncNow(false);
  };

  const handleRestoreSnapshot = (snapshotId: string) => {
    const restored = storageService.restoreSnapshot(snapshotId);
    if (restored) {
      setRows(restored);
      syncEngine.syncNow(false);
    }
  };

  const handleToggleSimulatedOffline = () => {
    const next = !isSimulatedOffline;
    setIsSimulatedOffline(next);
    storageService.setSimulatedOffline(next);
  };

  const handleSelectRowFromAlert = (rowId: string) => {
    setHighlightedRowId(rowId);
    setTimeout(() => {
      setHighlightedRowId(null);
    }, 4000);
  };

  return (
    <div className="min-h-screen bg-slate-100/70 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans selection:bg-blue-600 selection:text-white transition-colors duration-200">
      {/* Offline Alert Banner */}
      {isSimulatedOffline && (
        <div className="bg-rose-500 text-white px-4 py-2 text-xs font-semibold flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2 max-w-7xl mx-auto w-full">
            <WifiOff className="w-4 h-4 shrink-0" />
            <span>
              <strong>Simulated Offline Mode Active:</strong> Edits are saved in browser <strong>IndexedDB</strong> cache. They will automatically queue and sync to Google Sheets when you reconnect.
            </span>
            <button
              onClick={handleToggleSimulatedOffline}
              className="ml-auto underline text-xs font-bold hover:text-rose-100 shrink-0"
            >
              Reconnect Now
            </button>
          </div>
        </div>
      )}

      {/* Clean Simple Header */}
      <Header
        syncState={syncState}
        authState={authState}
        onOpenAuthModal={() => setAuthModalOpen(true)}
        onSyncNow={() => syncEngine.syncNow(true)}
        onOpenAppsScriptModal={() => setAppsScriptModalOpen(true)}
        onOpenBackupModal={() => setBackupModalOpen(true)}
        onOpenImportExportModal={() => setImportExportModalOpen(true)}
        onOpenAddRowModal={() => {
          setRowToEdit(null);
          setEditRowModalOpen(true);
        }}
        alerts={alerts}
        onMarkRead={(id) => storageService.markAlertRead(id)}
        onMarkAllRead={() => storageService.markAllAlertsRead()}
        onClearAllAlerts={() => storageService.clearAllAlerts()}
        onSelectRow={handleSelectRowFromAlert}
        teamMembers={teamMembers}
        isDarkMode={isDarkMode}
        onToggleDarkMode={() => setIsDarkMode(!isDarkMode)}
        isSimulatedOffline={isSimulatedOffline}
        onToggleSimulatedOffline={handleToggleSimulatedOffline}
      />

      {/* Google Sheets Tab Bar Switcher (Full list, Hand tools, Faulty Tools, Spare tools, Regular Calibration tools) */}
      <SheetTabBar
        activeTab={activeSheetTab}
        onTabChange={(tab) => setActiveSheetTab(tab)}
        allRows={rows}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 lg:px-8 py-5 space-y-4">
        {/* KPI Stats & View Switcher */}
        <StatsBar
          rows={tabFilteredRows}
          activeView={activeView}
          onChangeView={(v) => setActiveView(v)}
        />

        {/* View Component: DataTables Grid or Mobile Cards */}
        {activeView === 'table' ? (
          <DataTableView
            rows={tabFilteredRows}
            activeSheetTab={activeSheetTab}
            canEdit={canEdit}
            canDelete={canDelete}
            onUpdateRow={handleUpdateRow}
            onDeleteRow={handleDeleteRow}
            onDuplicateRow={handleDuplicateRow}
            onOpenEditModal={(row) => {
              setRowToEdit(row);
              setEditRowModalOpen(true);
            }}
            onBulkDelete={handleBulkDelete}
            onBulkConditionChange={handleBulkConditionChange}
            teamMembers={teamMembers}
            highlightedRowId={highlightedRowId}
          />
        ) : (
          <MobileCardView
            rows={tabFilteredRows}
            activeSheetTab={activeSheetTab}
            canEdit={canEdit}
            canDelete={canDelete}
            onUpdateRow={handleUpdateRow}
            onDeleteRow={handleDeleteRow}
            onDuplicateRow={handleDuplicateRow}
            onOpenEditModal={(row) => {
              setRowToEdit(row);
              setEditRowModalOpen(true);
            }}
          />
        )}
      </main>

      {/* Clean Footer */}
      <footer className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 py-3.5 px-4 sm:px-6 text-xs text-slate-500 dark:text-slate-400 mt-auto">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2.5 text-center sm:text-left">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span className="font-semibold text-slate-700 dark:text-slate-300">Electrical Team Tools List</span>
            <span>— Active Cloud Sheet: <strong>{activeSheetTab}</strong> ({tabFilteredRows.length} items)</span>
          </div>

          <div className="flex items-center gap-3 text-[11px]">
            <span>Mode: <strong>{authState.isUnlocked ? authState.role : 'Normal Viewer (Read-Only)'}</strong></span>
            <span>•</span>
            <button
              onClick={() => setAuthModalOpen(true)}
              className="text-indigo-600 dark:text-indigo-400 hover:underline font-semibold"
            >
              {authState.isUnlocked ? 'User & Permissions Control' : 'Admin Login'}
            </button>
            {authState.isUnlocked && (
              <>
                <span>•</span>
                <button
                  onClick={() => setAppsScriptModalOpen(true)}
                  className="text-blue-600 dark:text-blue-400 hover:underline font-semibold"
                >
                  Apps Script Code.gs
                </button>
              </>
            )}
          </div>
        </div>
      </footer>

      {/* Modals */}
      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        authState={authState}
      />
      <ConflictModal
        conflicts={conflicts}
        onResolve={(conflictId, strategy) => storageService.resolveConflict(conflictId, strategy)}
        onClose={() => setConflicts([])}
      />

      <AppsScriptModal
        isOpen={appsScriptModalOpen}
        onClose={() => setAppsScriptModalOpen(false)}
        syncState={syncState}
        onSaveUrl={(url) => syncEngine.setAppsScriptUrl(url)}
        onSetInterval={(sec) => syncEngine.setAutoSyncInterval(sec)}
        onTestSync={() => syncEngine.syncNow(true)}
      />

      <BackupModal
        isOpen={backupModalOpen}
        onClose={() => setBackupModalOpen(false)}
        backups={backups}
        currentRows={rows}
        onCreateSnapshot={(title, note) => storageService.createSnapshot(title, note, rows)}
        onRestoreSnapshot={handleRestoreSnapshot}
        onDeleteSnapshot={(id) => {
          const next = backups.filter((b) => b.id !== id);
          storageService.saveBackups(next);
        }}
      />

      <ImportExportModal
        isOpen={importExportModalOpen}
        onClose={() => setImportExportModalOpen(false)}
        currentRows={rows}
        onImportRows={handleImportRows}
      />

      <EditRowModal
        isOpen={editRowModalOpen}
        onClose={() => {
          setEditRowModalOpen(false);
          setRowToEdit(null);
        }}
        rowToEdit={rowToEdit}
        onSave={handleAddRow}
        nextSlno={rows.length + 1}
      />
    </div>
  );
}
