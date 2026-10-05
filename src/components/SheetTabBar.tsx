import React from 'react';
import { SheetTabName, SheetRow } from '../types/sheet';
import { ChevronDown, Layers, Wrench, AlertTriangle, ShieldCheck, Cpu } from 'lucide-react';

interface Props {
  activeTab: SheetTabName;
  onTabChange: (tab: SheetTabName) => void;
  allRows: SheetRow[];
}

export const SheetTabBar: React.FC<Props> = ({ activeTab, onTabChange, allRows }) => {
  const tabs: { name: SheetTabName; icon: React.ReactNode; filterFn: (r: SheetRow) => boolean }[] = [
    {
      name: 'Full list',
      icon: <Layers className="w-3.5 h-3.5" />,
      filterFn: () => true,
    },
    {
      name: 'Hand tools',
      icon: <Wrench className="w-3.5 h-3.5" />,
      filterFn: (r) => {
        const desc = (r.description || '').toLowerCase();
        return (
          desc.includes('clamp') ||
          desc.includes('meter') ||
          desc.includes('multimeter') ||
          desc.includes('multi meter') ||
          desc.includes('camera') ||
          desc.includes('thermo') ||
          desc.includes('tester') ||
          desc.includes('calibrator')
        );
      },
    },
    {
      name: 'Faulty Tools',
      icon: <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />,
      filterFn: (r) => {
        const cond = (r.condition || '').toLowerCase();
        const rem = (r.remarks || '').toLowerCase();
        return cond === 'faulty' || rem.includes('defective') || rem.includes('faulty');
      },
    },
    {
      name: 'Spare tools',
      icon: <ShieldCheck className="w-3.5 h-3.5 text-purple-500" />,
      filterFn: (r) => {
        const cond = (r.condition || '').toLowerCase();
        return cond.includes('spare') || cond.includes('emergency');
      },
    },
    {
      name: 'Regular Calibration tools',
      icon: <Cpu className="w-3.5 h-3.5 text-indigo-500" />,
      filterFn: (r) => {
        const desc = (r.description || '').toLowerCase();
        return (
          desc.includes('injection kit') ||
          desc.includes('high voltage') ||
          desc.includes('load bank') ||
          desc.includes('ohm meter') ||
          desc.includes('earth tester') ||
          desc.includes('power quality') ||
          desc.includes('partial discharge') ||
          desc.includes('battery')
        );
      },
    },
  ];

  return (
    <div className="bg-slate-200/80 dark:bg-slate-900 border-b border-slate-300 dark:border-slate-800 px-2 sm:px-4 flex items-center overflow-x-auto no-scrollbar shadow-xs">
      <div className="flex items-center gap-1 py-1">
        {tabs.map((tab) => {
          const count = allRows.filter(tab.filterFn).length;
          const isActive = activeTab === tab.name;

          return (
            <button
              key={tab.name}
              onClick={() => onTabChange(tab.name)}
              className={`group flex items-center gap-2 px-3.5 py-2 text-xs sm:text-sm font-semibold rounded-t-xl transition-all duration-150 border-t-2 select-none shrink-0 ${
                isActive
                  ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 border-blue-600 dark:border-blue-400 shadow-xs'
                  : 'bg-transparent text-slate-700 dark:text-slate-300 border-transparent hover:bg-slate-300/60 dark:hover:bg-slate-800/60'
              }`}
            >
              <span>{tab.name}</span>

              {/* Count Pill */}
              <span
                className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full ${
                  isActive
                    ? 'bg-blue-100 text-blue-800 dark:bg-blue-950/80 dark:text-blue-300'
                    : 'bg-slate-300/80 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                }`}
              >
                {count}
              </span>

              {/* Google Sheets Tab Dropdown Icon */}
              <span
                className={`w-4 h-4 rounded-full flex items-center justify-center transition-opacity ${
                  isActive
                    ? 'bg-blue-100 dark:bg-blue-900/60 text-blue-600 dark:text-blue-300 opacity-100'
                    : 'opacity-40 group-hover:opacity-75'
                }`}
              >
                <ChevronDown className="w-3 h-3" />
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
