import React from 'react';
import { SyncState } from '../types/sheet';

interface Props {
  syncState: SyncState;
  onSyncNow?: () => void;
  onOpenAppsScriptModal?: () => void;
}

export const SyncStatusBadge: React.FC<Props> = ({ syncState, onOpenAppsScriptModal }) => {
  const getDotDetails = () => {
    switch (syncState.status) {
      case 'syncing':
        return {
          color: 'bg-amber-500',
          ping: 'bg-amber-400 animate-ping',
          title: syncState.pendingCount > 0 ? `Syncing ${syncState.pendingCount} changes to Cloud...` : 'Syncing with Cloud...',
        };
      case 'pending':
        return {
          color: 'bg-orange-500',
          ping: 'bg-orange-400 animate-ping',
          title: `${syncState.pendingCount} offline changes pending Cloud sync`,
        };
      case 'offline':
        return {
          color: 'bg-rose-500',
          ping: '',
          title: 'Offline mode active (Changes cached locally)',
        };
      case 'error':
        return {
          color: 'bg-rose-600',
          ping: '',
          title: syncState.errorMessage || 'Sync error with Cloud',
        };
      case 'synced':
      default:
        return {
          color: 'bg-emerald-500',
          ping: '',
          title: `Real-time Synced with Cloud (${syncState.latencyMs}ms)`,
        };
    }
  };

  const details = getDotDetails();

  return (
    <div
      onClick={onOpenAppsScriptModal}
      title={details.title}
      className="flex items-center gap-1.5 px-2 py-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors"
    >
      <span className="relative flex h-2.5 w-2.5">
        {details.ping && (
          <span className={`absolute inline-flex h-full w-full rounded-full opacity-75 ${details.ping}`} />
        )}
        <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${details.color}`} />
      </span>
      <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 hidden xl:inline">
        {syncState.status === 'synced' ? 'Live' : syncState.status}
      </span>
    </div>
  );
};
