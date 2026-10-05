import React, { useState, useMemo } from 'react';
import { SheetRow, EquipmentCondition } from '../types/sheet';
import { formatDateStamp, calculateDueDays } from '../utils/dateUtils';
import {
  MapPin,
  Calendar,
  AlertTriangle,
  Clock,
  Edit3,
  Copy,
  Trash2,
  Tag,
  ChevronDown,
  ChevronUp,
  ShieldAlert
} from 'lucide-react';

interface Props {
  rows: SheetRow[];
  activeSheetTab?: string;
  canEdit?: boolean;
  canDelete?: boolean;
  onUpdateRow: (row: SheetRow) => void;
  onDeleteRow: (id: string) => void;
  onDuplicateRow: (row: SheetRow) => void;
  onOpenEditModal: (row: SheetRow) => void;
}

export const MobileCardView: React.FC<Props> = ({
  rows,
  canEdit = true,
  canDelete = true,
  onUpdateRow,
  onDeleteRow,
  onDuplicateRow,
  onOpenEditModal,
}) => {
  // Track expanded card IDs
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Extract unique locations for the dropdown
  const uniqueLocations = useMemo(() => {
    const set = new Set<string>();
    rows.forEach((r) => {
      if (r.location && r.location.trim()) set.add(r.location.trim());
    });
    // Add common fallback locations if not present
    ['AD-12', 'Neelakandan', 'Saravanan', 'Arjun', 'Store', 'Substation'].forEach((l) => set.add(l));
    return Array.from(set).sort();
  }, [rows]);

  const getConditionBadge = (cond: string) => {
    cond = cond || 'Good';
    if (cond === 'Under Repair') {
      return 'bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300 border-amber-200';
    }
    if (cond.toLowerCase().includes('faulty')) {
      return 'bg-rose-100 text-rose-800 dark:bg-rose-950/70 dark:text-rose-300 border-rose-200 animate-pulse';
    }
    if (cond.indexOf('Emergency') !== -1) {
      return 'bg-purple-100 text-purple-800 dark:bg-purple-950/70 dark:text-purple-300 border-purple-200';
    }
    return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300 border-emerald-200';
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
      {rows.length === 0 ? (
        <div className="col-span-full p-8 text-center text-slate-400 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
          <p className="text-sm font-semibold">No equipment items found</p>
        </div>
      ) : (
        rows.map((row) => {
          const isExpanded = expandedIds.has(row.id);

          // Auto calculate due days dynamically from Calibration Due Date vs Current Date
          const dueDaysCalc = calculateDueDays(row.calibrationDueDate);
          const isOverdue = dueDaysCalc !== null && dueDaysCalc < 0;
          const formattedDueDate = formatDateStamp(row.calibrationDueDate);

          return (
            <div
              key={row.id}
              className={`bg-white dark:bg-slate-900 rounded-2xl p-3.5 border shadow-xs transition-all ${
                isOverdue
                  ? 'border-rose-200 dark:border-rose-900/60'
                  : 'border-slate-200 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-indigo-800'
              }`}
            >
              {/* TOP HEADER: Left: [Number] Description [Make Box] (Model) | Right: Location Dropdown */}
              <div className="flex items-start justify-between gap-2">
                <div
                  onClick={() => toggleExpand(row.id)}
                  className="flex-1 min-w-0 cursor-pointer select-none space-y-1"
                >
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {/* Clean Number without # */}
                    <span className="text-xs font-mono font-bold text-slate-700 dark:text-slate-300 px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800">
                      {row.sheetSlno ?? row.slno}
                    </span>

                    {/* Description */}
                    <span className="font-semibold text-sm text-slate-900 dark:text-white leading-tight">
                      {row.description}
                    </span>

                    {/* Make in a Small Box (like DataTables) */}
                    {row.make && (
                      <span className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded border border-slate-200 dark:border-slate-700 shadow-2xs shrink-0">
                        {row.make}
                      </span>
                    )}

                    {/* Model */}
                    {row.model && (
                      <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                        ({row.model})
                      </span>
                    )}
                  </div>
                </div>

                {/* Right: Location Dropdown (Swapped from Good/Condition) */}
                <div className="shrink-0 flex items-center gap-1">
                  {canEdit ? (
                    <div className="relative">
                      <select
                        value={row.location || ''}
                        onChange={(e) => {
                          onUpdateRow({
                            ...row,
                            location: e.target.value,
                            lastModified: new Date().toISOString(),
                            lastModifiedBy: 'You',
                            version: (row.version || 1) + 1,
                            syncStatus: 'pending',
                          });
                        }}
                        className="text-xs font-semibold px-2 py-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-200 cursor-pointer focus:ring-1 focus:ring-indigo-500 max-w-[125px] truncate"
                        title="Change location"
                      >
                        {uniqueLocations.map((loc) => (
                          <option key={loc} value={loc}>
                            {loc}
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : (
                    <span className="text-xs font-semibold px-2 py-0.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-700 dark:text-slate-300 max-w-[120px] truncate">
                      {row.location || '—'}
                    </span>
                  )}

                  {/* Expand / Collapse Icon */}
                  <button
                    onClick={() => toggleExpand(row.id)}
                    className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    title={isExpanded ? 'Collapse card' : 'Expand details'}
                  >
                    {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* SUMMARY ROW (Always visible): Due Date Stamp (DD.MMM.YYYY) & Due Days badge */}
              <div
                onClick={() => toggleExpand(row.id)}
                className="flex items-center justify-between text-xs pt-2 text-slate-500 dark:text-slate-400 cursor-pointer"
              >
                <div className="flex items-center gap-1.5 font-mono text-[11px]">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  <span>Due: {formattedDueDate}</span>
                </div>

                <div>
                  {dueDaysCalc !== null ? (
                    <span
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                        isOverdue
                          ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/70 dark:text-rose-300 border-rose-300'
                          : dueDaysCalc <= 30
                          ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300 border-amber-300'
                          : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300 border-emerald-300'
                      }`}
                    >
                      {isOverdue ? `${Math.abs(dueDaysCalc)}d Overdue` : `${dueDaysCalc}d left`}
                    </span>
                  ) : (
                    <span className="text-[10px] text-slate-400">No due date</span>
                  )}
                </div>
              </div>

              {/* EXPANDABLE CONTENT (Opens on Click): Serial No, Condition, Type, Remarks, Actions */}
              {isExpanded && (
                <div className="pt-3 mt-3 border-t border-slate-100 dark:border-slate-800 space-y-2.5 animate-in fade-in duration-150">
                  {/* Serial No & Condition Row */}
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                        Serial Number
                      </span>
                      <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">
                        {row.serialNo || '—'}
                      </span>
                    </div>

                    <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                        Condition
                      </span>
                      {canEdit ? (
                        <select
                          value={row.condition || 'Good'}
                          onChange={(e) => {
                            onUpdateRow({
                              ...row,
                              condition: e.target.value as EquipmentCondition,
                              lastModified: new Date().toISOString(),
                              lastModifiedBy: 'You',
                              version: (row.version || 1) + 1,
                              syncStatus: 'pending',
                            });
                          }}
                          className={`w-full px-2 py-0.5 rounded-full text-xs font-semibold border cursor-pointer ${getConditionBadge(
                            row.condition
                          )}`}
                        >
                          <option value="Good">Good</option>
                          <option value="Under Repair">Under Repair</option>
                          <option value="spare / Emergency">spare / Emergency</option>
                          <option value="Faulty">Faulty</option>
                        </select>
                      ) : (
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold border ${getConditionBadge(
                            row.condition
                          )}`}
                        >
                          {row.condition || 'Good'}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Type (Personal / common) */}
                  <div className="flex items-center justify-between text-xs px-1 text-slate-600 dark:text-slate-400">
                    <span className="text-[11px] text-slate-400">Type:</span>
                    <span className="font-medium bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md text-[11px]">
                      {row.type || 'common'}
                    </span>
                  </div>

                  {/* Remarks */}
                  {row.remarks && (
                    <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400 flex items-start gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                      <p className="line-clamp-3">{row.remarks}</p>
                    </div>
                  )}

                  {/* Action Buttons */}
                  {(canEdit || canDelete) && (
                    <div className="flex items-center justify-end gap-1.5 pt-1">
                      {canEdit && (
                        <button
                          onClick={() => onOpenEditModal(row)}
                          className="px-2.5 py-1 text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-indigo-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg flex items-center gap-1 transition-colors"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span>Edit</span>
                        </button>
                      )}

                      {canEdit && (
                        <button
                          onClick={() => onDuplicateRow(row)}
                          className="px-2.5 py-1 text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-blue-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg flex items-center gap-1 transition-colors"
                          title="Duplicate"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                      )}

                      {canDelete && (
                        <button
                          onClick={() => {
                            if (window.confirm(`Delete item ${row.sheetSlno ?? row.slno} (${row.description})?`)) {
                              onDeleteRow(row.id);
                            }
                          }}
                          className="px-2.5 py-1 text-xs font-medium text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg flex items-center gap-1 transition-colors"
                          title="Delete item"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
};
