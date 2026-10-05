import React from 'react';
import { SheetRow } from '../types/sheet';
import {
  CheckCircle2,
  AlertOctagon,
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
  const goodCount = rows.filter(r => r.condition === 'Good').length;
  const repairCount = rows.filter(r => r.condition === 'Under Repair').length;
  const faultyCount = rows.filter(r => r.condition === 'Faulty').length;

  const overdueCount = rows.filter(r => {
    const num = Number(r.dueDays);
    const isNeg = !isNaN(num) && num < 0;
    const isRemarkDue = r.remarks && r.remarks.toLowerCase().includes('due for calibration');
    return isNeg || isRemarkDue;
  }).length;

  const operationalPercentage = totalCount > 0 ? Math.round((goodCount / totalCount) * 100) : 0;

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 py-2">
      {/* Metrics Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-4 flex-1">
        {/* Total Equipment */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-3 sm:p-4 border border-slate-200 dark:border-slate-800 shadow-xs flex items-center gap-3">
          <div className="p-2 sm:p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
            <Layers className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <div>
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Total Units</p>
            <p className="text-base sm:text-lg font-bold text-slate-900 dark:text-white font-mono">{totalCount}</p>
          </div>
        </div>

        {/* Operational (Good) */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-3 sm:p-4 border border-slate-200 dark:border-slate-800 shadow-xs flex items-center gap-3">
          <div className="p-2 sm:p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <div>
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Operational</p>
            <p className="text-base sm:text-lg font-bold text-slate-900 dark:text-white font-mono">
              {goodCount} <span className="text-xs font-normal text-slate-400">({operationalPercentage}%)</span>
            </p>
          </div>
        </div>

        {/* Calibration Overdue */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-3 sm:p-4 border border-slate-200 dark:border-slate-800 shadow-xs flex items-center gap-3">
          <div className="p-2 sm:p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400">
            <Clock className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <div>
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Calib. Overdue</p>
            <p className="text-base sm:text-lg font-bold text-rose-600 dark:text-rose-400 font-mono">
              {overdueCount} <span className="text-xs font-normal text-slate-400">units</span>
            </p>
          </div>
        </div>

        {/* In Repair / Faulty */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-3 sm:p-4 border border-slate-200 dark:border-slate-800 shadow-xs flex items-center gap-3">
          <div className="p-2 sm:p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400">
            <Wrench className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <div>
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Repair / Faulty</p>
            <p className="text-base sm:text-lg font-bold text-amber-600 dark:text-amber-400 font-mono">
              {repairCount + faultyCount} <span className="text-xs font-normal text-slate-400">units</span>
            </p>
          </div>
        </div>
      </div>

      {/* View Switcher: Table vs Cards */}
      <div className="flex items-center self-end sm:self-center bg-slate-100 dark:bg-slate-800 rounded-xl p-1 border border-slate-200 dark:border-slate-700">
        <button
          onClick={() => onChangeView('table')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
            activeView === 'table'
              ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
              : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <TableIcon className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">DataTables Grid</span>
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
          <span className="hidden sm:inline">Cards View</span>
        </button>
      </div>
    </div>
  );
};
