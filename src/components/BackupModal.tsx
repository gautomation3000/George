import React, { useState } from 'react';
import { BackupSnapshot, SheetRow } from '../types/sheet';
import { ExcelService } from '../services/excelService';
import {
  Database,
  Plus,
  RotateCcw,
  Download,
  Trash2,
  Calendar,
  FileSpreadsheet,
  AlertTriangle,
  CheckCircle2,
  X,
  ShieldCheck,
  Upload
} from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  backups: BackupSnapshot[];
  currentRows: SheetRow[];
  onCreateSnapshot: (title: string, note?: string) => void;
  onRestoreSnapshot: (snapshotId: string) => void;
  onDeleteSnapshot: (snapshotId: string) => void;
}

export const BackupModal: React.FC<Props> = ({
  isOpen,
  onClose,
  backups,
  currentRows,
  onCreateSnapshot,
  onRestoreSnapshot,
  onDeleteSnapshot,
}) => {
  const [snapshotTitle, setSnapshotTitle] = useState('');
  const [snapshotNote, setSnapshotNote] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [restoreConfirmId, setRestoreConfirmId] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!snapshotTitle.trim()) return;
    onCreateSnapshot(snapshotTitle.trim(), snapshotNote.trim());
    setSnapshotTitle('');
    setSnapshotNote('');
    setShowCreateForm(false);
  };

  const handleConfirmRestore = (snapshotId: string) => {
    onRestoreSnapshot(snapshotId);
    setRestoreConfirmId(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-4 sm:p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-indigo-500/10 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-400">
              <Database className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                  Secure Cloud Backups
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3" /> Protected
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Point-in-time spreadsheet snapshots with 1-click disaster recovery
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-4">
          {/* Quick Snapshot Action Bar */}
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Saved Snapshots ({backups.length})
            </span>

            <div className="flex gap-2">
              <button
                onClick={() => ExcelService.exportToJson(currentRows)}
                className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-medium rounded-xl border border-slate-200 dark:border-slate-700 flex items-center gap-1.5 transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                Export JSON
              </button>

              <button
                onClick={() => setShowCreateForm(!showCreateForm)}
                className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                New Snapshot
              </button>
            </div>
          </div>

          {/* Create Form Drawer */}
          {showCreateForm && (
            <form
              onSubmit={handleCreate}
              className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3 animate-in fade-in zoom-in-95 duration-150"
            >
              <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                Create Point-in-Time Snapshot
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input
                  type="text"
                  required
                  placeholder="Snapshot Title (e.g. Pre-Sprint Review)"
                  value={snapshotTitle}
                  onChange={(e) => setSnapshotTitle(e.target.value)}
                  className="px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-white"
                />
                <input
                  type="text"
                  placeholder="Optional notes or reason..."
                  value={snapshotNote}
                  onChange={(e) => setSnapshotNote(e.target.value)}
                  className="px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-white"
                />
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowCreateForm(false)}
                  className="px-3 py-1.5 text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl shadow-xs"
                >
                  Save Snapshot ({currentRows.length} rows)
                </button>
              </div>
            </form>
          )}

          {/* Restore Confirmation Dialog */}
          {restoreConfirmId && (
            <div className="p-4 bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 rounded-2xl space-y-2 text-xs text-amber-900 dark:text-amber-200 animate-in fade-in duration-150">
              <div className="flex items-center gap-2 font-bold">
                <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                <span>Confirm Snapshot Restoration</span>
              </div>
              <p>
                Restoring this backup will replace current spreadsheet contents. An automatic safety snapshot of your current state will be taken before restoring.
              </p>
              <div className="flex justify-end gap-2 pt-1">
                <button
                  onClick={() => setRestoreConfirmId(null)}
                  className="px-3 py-1 text-slate-600 dark:text-slate-400 hover:underline"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleConfirmRestore(restoreConfirmId)}
                  className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded-xl"
                >
                  Yes, Restore Snapshot
                </button>
              </div>
            </div>
          )}

          {/* Snapshot List */}
          <div className="divide-y divide-slate-100 dark:divide-slate-800 space-y-2">
            {backups.length === 0 ? (
              <div className="p-8 text-center text-slate-400">
                <Database className="w-8 h-8 mx-auto mb-2 opacity-40" />
                <p className="text-sm font-semibold">No backups recorded yet</p>
              </div>
            ) : (
              backups.map((snap) => (
                <div
                  key={snap.id}
                  className="p-3.5 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors border border-transparent hover:border-slate-200 dark:hover:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-xs text-slate-900 dark:text-white">
                        {snap.title}
                      </span>
                      {snap.isAutomatic && (
                        <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-500">
                          Autosave
                        </span>
                      )}
                      <span className="text-xs font-mono text-indigo-600 dark:text-indigo-400 font-medium">
                        {snap.rowCount} rows
                      </span>
                    </div>

                    <div className="flex items-center gap-3 text-[11px] text-slate-400">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {new Date(snap.timestamp).toLocaleString()}
                      </span>
                      <span>By {snap.createdBy}</span>
                      {snap.note && <span className="italic">"{snap.note}"</span>}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() =>
                        ExcelService.exportToExcel(
                          snap.data,
                          `SheetSync_Backup_${snap.title.replace(/\s+/g, '_')}.xlsx`
                        )
                      }
                      title="Download as Excel"
                      className="p-1.5 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                    >
                      <Download className="w-4 h-4" />
                    </button>

                    <button
                      onClick={() => setRestoreConfirmId(snap.id)}
                      className="px-3 py-1.5 bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 dark:hover:bg-emerald-900 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 rounded-xl text-xs font-semibold flex items-center gap-1 transition-colors"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      Restore
                    </button>

                    <button
                      onClick={() => {
                        if (window.confirm(`Delete snapshot "${snap.title}"?`)) {
                          onDeleteSnapshot(snap.id);
                        }
                      }}
                      className="p-1.5 text-slate-400 hover:text-rose-500 transition-colors"
                      title="Delete snapshot"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex justify-between items-center text-xs">
          <span className="text-slate-400">
            Snapshots stored securely in local encrypted storage &amp; Google Sheet tabs
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-900 dark:bg-slate-100 hover:bg-slate-800 dark:hover:bg-slate-200 text-white dark:text-slate-900 font-semibold rounded-xl transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
