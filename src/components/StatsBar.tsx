import React from 'react';
import { SheetRow } from '../types/sheet';
import { calculateDueDays } from '../utils/dateUtils';
import {
  CheckCircle2,
  Wrench,
  Layers,
  LayoutGrid,
  Table as TableIcon,
  Clock
} from 'lucide-react';

interface Props {
  rows: SheetRow[];
  activeView: 'table' | 'cards';
  onChangeView: (view: 'table' | 'cards') => void;
}

export const StatsBar: React.FC<Props> = ({ rows, activeView, onChangeView }) => {
  const totalCount = rows.length;
  const goodCount = rows.filter((r) => (r.condition || 'Good') === 'Good').length;
  const repairCount = rows.filter((r) => r.condition === 'Under Repair').length;
  const faultyCount = rows.filter((r) => (r.condition || '').toLowerCase().includes('faulty')).length;

  // Auto calculated dynamically from Calibration Due Date vs Current Date
  const overdueCount = rows.filter((r) => {
    const days = calculateDueDays(r.calibrationDueDate);
    const isRemarkDue = r.remarks && r.remarks.toLowerCase().includes('due for calibration');
    return (days !== null && days < 0) || isRemarkDue;
  }).length;

  const operationalPercentage = totalCount > 0 ? Math.round((goodCount / totalCount) * 100) : 0;

  return (
    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 py-1">
      {/* 4 KPI Metrics - Spacious, clean typography, overflow-proof */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 flex-1 min-w-0">
        {/* Total Equipment */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-3 border border-slate-200 dark:border-slate-800 shadow-xs flex items-center gap-2.5 min-w-0">
          <div className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 shrink-0">
            <Layers className="w-4 h-4" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider truncate">Total Units</p>
            <p className="text-base sm:text-lg font-bold text-slate-900 dark:text-white font-mono leading-tight">{totalCount}</p>
          </div>
        </div>

        {/* Operational (Good) */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-3 border border-slate-200 dark:border-slate-800 shadow-xs flex items-center gap-2.5 min-w-0">
          <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 shrink-0">
            <CheckCircle2 className="w-4 h-4" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider truncate">Operational</p>
            <p className="text-base sm:text-lg font-bold text-slate-900 dark:text-white font-mono leading-tight flex items-baseline gap-1 truncate">
              <span>{goodCount}</span>
              <span className="text-[11px] font-normal text-slate-400 font-sans">({operationalPercentage}%)</span>
            </p>
          </div>
        </div>

        {/* Calibration Overdue */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-3 border border-slate-200 dark:border-slate-800 shadow-xs flex items-center gap-2.5 min-w-0">
          <div className="p-2 rounded-xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 shrink-0">
            <Clock className="w-4 h-4" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider truncate">Calib. Overdue</p>
            <p className="text-base sm:text-lg font-bold text-rose-600 dark:text-rose-400 font-mono leading-tight flex items-baseline gap-1 truncate">
              <span>{overdueCount}</span>
              <span className="text-[11px] font-normal text-slate-400 font-sans">units</span>
            </p>
          </div>
        </div>

        {/* In Repair / Faulty */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-3 border border-slate-200 dark:border-slate-800 shadow-xs flex items-center gap-2.5 min-w-0">
          <div className="p-2 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 shrink-0">
            <Wrench className="w-4 h-4" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider truncate">Repair / Faulty</p>
            <p className="text-base sm:text-lg font-bold text-amber-600 dark:text-amber-400 font-mono leading-tight flex items-baseline gap-1 truncate">
              <span>{repairCount + faultyCount}</span>
              <span className="text-[11px] font-normal text-slate-400 font-sans">units</span>
            </p>
          </div>
        </div>
      </div>

      {/* View Switcher: Table vs Cards (Shrink-proof) */}
      <div className="flex items-center self-end lg:self-center bg-slate-100 dark:bg-slate-800 rounded-xl p-1 border border-slate-200 dark:border-slate-700 shrink-0">
        <button
          onClick={() => onChangeView('table')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
            activeView === 'table'
              ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
              : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <TableIcon className="w-3.5 h-3.5" />
          <span>DataTables Grid</span>
        </button>

        <button
          onClick={() => onChangeView('cards')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
            activeView === 'cards'
              ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
              : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <LayoutGrid className="w-3.5 h-3.5" />
          <span>Cards View</span>
        </button>
      </div>
    </div>
  );
};
