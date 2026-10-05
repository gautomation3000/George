import React from 'react';
import { ConflictItem } from '../services/indexedDbService';
import { SheetRow } from '../types/sheet';
import { AlertTriangle, Check, ShieldAlert, ArrowRight, X } from 'lucide-react';

interface Props {
  conflicts: ConflictItem[];
  onResolve: (conflictId: string, strategy: 'CLIENT_WINS' | 'SERVER_WINS' | 'SMART_MERGE') => void;
  onClose: () => void;
}

export const ConflictModal: React.FC<Props> = ({ conflicts, onResolve, onClose }) => {
  if (conflicts.length === 0) return null;

  const current = conflicts[0];
  const client: SheetRow = current.clientRow;
  const server: any = current.serverRow;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 bg-amber-50/60 dark:bg-amber-950/30 flex items-center justify-between">
          <div className="flex items-center gap-3 text-amber-700 dark:text-amber-400">
            <div className="p-2 bg-amber-100 dark:bg-amber-900/50 rounded-xl">
              <ShieldAlert className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                Sync Conflict Detected ({conflicts.length} remaining)
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Item #{client.slno} was modified on Google Sheets while you were working offline.
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Comparison Body */}
        <div className="p-4 sm:p-6 space-y-4 overflow-y-auto max-h-[60vh] text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Local Offline Version */}
            <div className="p-4 rounded-2xl bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800/60 space-y-2">
              <div className="flex items-center justify-between pb-1 border-b border-indigo-200 dark:border-indigo-800/60">
                <span className="font-bold text-indigo-700 dark:text-indigo-300">Your Offline Changes</span>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-md bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300">
                  v{client.version || 1}
                </span>
              </div>
              <div className="space-y-1.5 text-slate-700 dark:text-slate-300">
                <p><strong>Description:</strong> {client.description}</p>
                <p><strong>Condition:</strong> <span className="font-semibold text-indigo-600 dark:text-indigo-400">{client.condition}</span></p>
                <p><strong>Location:</strong> {client.location}</p>
                <p><strong>Calibration Due:</strong> {client.calibrationDueDate}</p>
                <p><strong>Remarks:</strong> {client.remarks || 'None'}</p>
              </div>
            </div>

            {/* Remote Google Sheet Version */}
            <div className="p-4 rounded-2xl bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 space-y-2">
              <div className="flex items-center justify-between pb-1 border-b border-emerald-200 dark:border-emerald-800/60">
                <span className="font-bold text-emerald-700 dark:text-emerald-300">Google Sheet (Server)</span>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300">
                  v{server.Version || server.version || 2}
                </span>
              </div>
              <div className="space-y-1.5 text-slate-700 dark:text-slate-300">
                <p><strong>Description:</strong> {server.Description || server.description}</p>
                <p><strong>Condition:</strong> <span className="font-semibold text-emerald-600 dark:text-emerald-400">{server.condition}</span></p>
                <p><strong>Location:</strong> {server['Location/Individual'] || server.location}</p>
                <p><strong>Calibration Due:</strong> {server['Calibration due date'] || server.calibrationDueDate}</p>
                <p><strong>Remarks:</strong> {server.Remarks || server.remarks || 'None'}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Resolution Actions */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex flex-col sm:flex-row justify-end gap-2 text-xs">
          <button
            onClick={() => onResolve(current.id, 'SERVER_WINS')}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold rounded-xl transition-colors"
          >
            Server Wins (Discard Local)
          </button>
          <button
            onClick={() => onResolve(current.id, 'SMART_MERGE')}
            className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white font-semibold rounded-xl shadow-xs transition-colors"
          >
            Smart Merge
          </button>
          <button
            onClick={() => onResolve(current.id, 'CLIENT_WINS')}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl shadow-xs transition-colors"
          >
            Client Wins (Keep My Edits)
          </button>
        </div>
      </div>
    </div>
  );
};
