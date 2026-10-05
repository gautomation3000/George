import React from 'react';
import { SyncState, CriticalAlert, TeamMember } from '../types/sheet';
import { SyncStatusBadge } from './SyncStatusBadge';
import { NotificationCenter } from './NotificationCenter';
import {
  Wrench,
  Code2,
  Database,
  Download,
  Plus,
  Sun,
  Moon,
  Wifi,
  WifiOff
} from 'lucide-react';

interface Props {
  syncState: SyncState;
  onSyncNow: () => void;
  onOpenAppsScriptModal: () => void;
  onOpenBackupModal: () => void;
  onOpenImportExportModal: () => void;
  onOpenAddRowModal: () => void;
  alerts: CriticalAlert[];
  onMarkRead: (id: string) => void;
  onMarkAllRead: () => void;
  onClearAllAlerts: () => void;
  onSelectRow: (rowId: string) => void;
  teamMembers: TeamMember[];
  isDarkMode: boolean;
  onToggleDarkMode: () => void;
  isSimulatedOffline: boolean;
  onToggleSimulatedOffline: () => void;
}

export const Header: React.FC<Props> = ({
  syncState,
  onSyncNow,
  onOpenAppsScriptModal,
  onOpenBackupModal,
  onOpenImportExportModal,
  onOpenAddRowModal,
  alerts,
  onMarkRead,
  onMarkAllRead,
  onClearAllAlerts,
  onSelectRow,
  isDarkMode,
  onToggleDarkMode,
  isSimulatedOffline,
  onToggleSimulatedOffline,
}) => {
  return (
    <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 transition-colors">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 sm:h-18 gap-2 sm:gap-4">
          {/* Left: Clean Simple Title */}
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs shrink-0">
              <Wrench className="w-5 h-5" />
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-xl font-bold text-slate-900 dark:text-white tracking-tight truncate">
                  Electrical Team Tools List
                </h1>
                <span className="hidden lg:inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                  Google Sheet Connected
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate hidden sm:block">
                Master Calibration &amp; Equipment Inventory • Real-Time Offline Sync
              </p>
            </div>
          </div>

          {/* Center / Right: Sync Status & Simplified Action Controls */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* Live Sync Status Badge */}
            <SyncStatusBadge
              syncState={syncState}
              onSyncNow={onSyncNow}
              onOpenAppsScriptModal={onOpenAppsScriptModal}
            />

            {/* Offline Test Mode Switch */}
            <button
              onClick={onToggleSimulatedOffline}
              title={isSimulatedOffline ? 'Offline Mode Active. Click to connect.' : 'Click to test Offline Mode'}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                isSimulatedOffline
                  ? 'bg-rose-500 text-white border-rose-600 shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-200'
              }`}
            >
              {isSimulatedOffline ? (
                <>
                  <WifiOff className="w-3.5 h-3.5" />
                  <span className="hidden md:inline">Offline</span>
                </>
              ) : (
                <>
                  <Wifi className="w-3.5 h-3.5 text-emerald-500" />
                  <span className="hidden md:inline">Online</span>
                </>
              )}
            </button>

            {/* Notification Bell */}
            <NotificationCenter
              alerts={alerts}
              onMarkRead={onMarkRead}
              onMarkAllRead={onMarkAllRead}
              onClearAll={onClearAllAlerts}
              onSelectRow={onSelectRow}
            />

            {/* Cloud Backups */}
            <button
              onClick={onOpenBackupModal}
              title="Cloud Backups & Revision History"
              className="p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <Database className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>

            {/* Apps Script Backend & index.html */}
            <button
              onClick={onOpenAppsScriptModal}
              title="Google Apps Script Code.gs & index.html"
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold border border-slate-200 dark:border-slate-700"
            >
              <Code2 className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              <span>Apps Script</span>
            </button>

            {/* Import / Export */}
            <button
              onClick={onOpenImportExportModal}
              title="Import or Export Excel / CSV"
              className="p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <Download className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>

            {/* Dark Mode Toggle */}
            <button
              onClick={onToggleDarkMode}
              title={isDarkMode ? 'Switch to Light' : 'Switch to Dark'}
              className="p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              {isDarkMode ? <Sun className="w-4 h-4 sm:w-5 sm:h-5 text-amber-400" /> : <Moon className="w-4 h-4 sm:w-5 sm:h-5 text-slate-600" />}
            </button>

            {/* Add Tool CTA */}
            <button
              onClick={onOpenAddRowModal}
              className="flex items-center gap-1 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-semibold rounded-xl shadow-xs transition-all shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Add Tool</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
