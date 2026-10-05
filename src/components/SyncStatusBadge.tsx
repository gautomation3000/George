import React from 'react';
import { SyncState } from '../types/sheet';
import { RefreshCw, CheckCircle2, AlertCircle, WifiOff, Cloud, Clock } from 'lucide-react';

interface Props {
  syncState: SyncState;
  onSyncNow: () => void;
  onOpenAppsScriptModal: () => void;
}

export const SyncStatusBadge: React.FC<Props> = ({ syncState, onSyncNow, onOpenAppsScriptModal }) => {
  const getStatusDisplay = () => {
    switch (syncState.status) {
      case 'syncing':
        return {
          icon: <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-500" />,
          label: syncState.pendingCount > 0 ? `Syncing (${syncState.pendingCount})...` : 'Syncing...',
          bgColor: 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800/60',
          dotColor: 'bg-amber-500 animate-pulse',
        };
      case 'offline':
        return {
          icon: <WifiOff className="w-3.5 h-3.5 text-rose-500" />,
          label: syncState.pendingCount > 0 ? `Offline (${syncState.pendingCount} Queued)` : 'Offline Mode',
          bgColor: 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-800/60',
          dotColor: 'bg-rose-500',
        };
      case 'pending':
        return {
          icon: <Clock className="w-3.5 h-3.5 text-orange-500" />,
          label: `${syncState.pendingCount} Pending Sync`,
          bgColor: 'bg-orange-50 dark:bg-orange-950/40 text-orange-700 dark:text-orange-400 border-orange-200 dark:border-orange-800/60',
          dotColor: 'bg-orange-500 animate-ping',
        };
      case 'error':
        return {
          icon: <AlertCircle className="w-3.5 h-3.5 text-rose-600" />,
          label: 'Sync Error',
          bgColor: 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-800/60',
          dotColor: 'bg-rose-600',
        };
      case 'synced':
      default:
        return {
          icon: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />,
          label: 'Synced Real-Time',
          bgColor: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/60',
          dotColor: 'bg-emerald-500',
        };
    }
  };

  const status = getStatusDisplay();
  const formatTimeAgo = (isoString: string | null) => {
    if (!isoString) return 'Never';
    const diff = Math.floor((Date.now() - new Date(isoString).getTime()) / 1000);
    if (diff < 5) return 'Just now';
    if (diff < 60) return `${diff}s ago`;
    const mins = Math.floor(diff / 60);
    if (mins < 60) return `${mins}m ago`;
    return `${Math.floor(mins / 60)}h ago`;
  };

  return (
    <div className="flex items-center gap-2">
      {/* Clickable Badge */}
      <button
        onClick={onOpenAppsScriptModal}
        title={`Backend: ${syncState.backendType === 'apps_script' ? 'Google Apps Script Live Web App' : 'Real-Time Team Mesh'}\nLatency: ${syncState.latencyMs}ms\nLast Synced: ${formatTimeAgo(syncState.lastSyncedAt)}`}
        className={`group relative flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border transition-all duration-200 hover:shadow-xs ${status.bgColor}`}
      >
        <span className="relative flex h-2 w-2">
          <span className={`absolute inline-flex h-full w-full rounded-full opacity-75 ${status.dotColor}`} />
          <span className={`relative inline-flex rounded-full h-2 w-2 ${status.dotColor.split(' ')[0]}`} />
        </span>

        <span className="flex items-center gap-1.5 font-semibold">
          {status.icon}
          <span>{status.label}</span>
        </span>

        <span className="hidden sm:inline-block text-[11px] opacity-75 font-mono border-l border-current/20 pl-2">
          {syncState.latencyMs}ms
        </span>
      </button>

      {/* Quick Sync Now Button */}
      <button
        onClick={onSyncNow}
        disabled={syncState.status === 'syncing'}
        title="Trigger instant synchronization"
        className="p-1.5 rounded-lg text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-50"
      >
        <RefreshCw className={`w-4 h-4 ${syncState.status === 'syncing' ? 'animate-spin text-indigo-500' : ''}`} />
      </button>
    </div>
  );
};
