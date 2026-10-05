import React from 'react';
import { SheetRow, EquipmentCondition } from '../types/sheet';
import {
  Calendar,
  MapPin,
  Tag,
  Edit2,
  Trash2,
  Copy,
  AlertTriangle,
  Clock
} from 'lucide-react';

interface Props {
  rows: SheetRow[];
  onUpdateRow: (row: SheetRow) => void;
  onDeleteRow: (id: string) => void;
  onDuplicateRow: (row: SheetRow) => void;
  onOpenEditModal: (row: SheetRow) => void;
}

export const MobileCardView: React.FC<Props> = ({
  rows,
  onUpdateRow,
  onDeleteRow,
  onDuplicateRow,
  onOpenEditModal,
}) => {
  const getConditionBadge = (cond: string) => {
    cond = cond || 'Good';
    if (cond === 'Under Repair') {
      return 'bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300 border-amber-200';
    }
    if (cond === 'Faulty') {
      return 'bg-rose-100 text-rose-800 dark:bg-rose-950/70 dark:text-rose-300 border-rose-200 animate-pulse';
    }
    if (cond.indexOf('Emergency') !== -1) {
      return 'bg-purple-100 text-purple-800 dark:bg-purple-950/70 dark:text-purple-300 border-purple-200';
    }
    return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300 border-emerald-200';
  };

  return (
    <div className="space-y-3 md:hidden">
      {rows.length === 0 ? (
        <div className="p-8 text-center text-slate-400 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
          <p className="text-sm font-semibold">No equipment items found</p>
        </div>
      ) : (
        rows.map((row) => {
          const dueNum = Number(row.dueDays);
          const isOverdue = !isNaN(dueNum) && dueNum < 0;

          return (
            <div
              key={row.id}
              className={`bg-white dark:bg-slate-900 rounded-2xl p-4 border shadow-xs space-y-3 transition-colors ${
                isOverdue
                  ? 'border-rose-200 dark:border-rose-900/60'
                  : 'border-slate-200 dark:border-slate-800'
              }`}
            >
              {/* Header: SLNO, Make, Condition */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-mono text-slate-400 font-bold">#{row.slno}</span>
                  <span className="font-bold text-xs text-indigo-600 dark:text-indigo-400">{row.make}</span>
                  {row.model && (
                    <span className="text-xs text-slate-500 font-mono">({row.model})</span>
                  )}
                </div>

                <select
                  value={row.condition}
                  onChange={(e) => {
                    onUpdateRow({
                      ...row,
                      condition: e.target.value as EquipmentCondition,
                      lastModified: new Date().toISOString(),
                      lastModifiedBy: 'You (Mobile)',
                      version: (row.version || 1) + 1,
                      syncStatus: 'pending',
                    });
                  }}
                  className={`px-2 py-0.5 rounded-full text-xs font-semibold border cursor-pointer ${getConditionBadge(
                    row.condition
                  )}`}
                >
                  <option value="Good">Good</option>
                  <option value="Under Repair">Under Repair</option>
                  <option value="spare / Emergency">spare / Emergency</option>
                  <option value="Faulty">Faulty</option>
                </select>
              </div>

              {/* Description */}
              <h3 className="font-semibold text-sm text-slate-900 dark:text-white leading-snug">
                {row.description}
              </h3>

              {/* Details Grid */}
              <div className="grid grid-cols-2 gap-2 text-xs text-slate-600 dark:text-slate-400 pt-1">
                <div className="flex items-center gap-1.5">
                  <Tag className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span className="font-mono truncate">{row.serialNo || 'No S/N'}</span>
                </div>

                <div className="flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span className="truncate">{row.location}</span>
                </div>

                <div className="flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span className="truncate">{row.calibrationDueDate || 'N/A'}</span>
                </div>

                <div className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  {isOverdue ? (
                    <span className="font-bold text-rose-500 flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" /> {dueNum} days (Overdue)
                    </span>
                  ) : (
                    <span>Due: {row.dueDays !== undefined ? row.dueDays : '-'} days</span>
                  )}
                </div>
              </div>

              {/* Remarks */}
              {row.remarks && (
                <div className="text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/60 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800">
                  {row.remarks}
                </div>
              )}

              {/* Actions Footer */}
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <span className="text-[10px] text-slate-400 font-mono">
                  {row.syncStatus === 'pending' ? 'Queued in IndexedDB' : 'Synced'}
                </span>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => onOpenEditModal(row)}
                    className="p-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                    title="Edit item"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => onDuplicateRow(row)}
                    className="p-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                    title="Duplicate item"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => {
                      if (window.confirm(`Delete item #${row.slno}?`)) {
                        onDeleteRow(row.id);
                      }
                    }}
                    className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                    title="Delete item"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
};
