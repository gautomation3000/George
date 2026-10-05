import React, { useState } from 'react';
import { CriticalAlert } from '../types/sheet';
import { soundManager } from '../services/audio';
import {
  Bell,
  AlertTriangle,
  AlertOctagon,
  Info,
  CheckCheck,
  Trash2,
  Volume2,
  VolumeX,
  ExternalLink,
  X
} from 'lucide-react';

interface Props {
  alerts: CriticalAlert[];
  onMarkRead: (id: string) => void;
  onMarkAllRead: () => void;
  onClearAll: () => void;
  onSelectRow?: (rowId: string) => void;
}

export const NotificationCenter: React.FC<Props> = ({
  alerts,
  onMarkRead,
  onMarkAllRead,
  onClearAll,
  onSelectRow,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [filter, setFilter] = useState<'all' | 'critical' | 'unread'>('all');
  const [soundEnabled, setSoundEnabled] = useState(soundManager.isEnabled());

  const unreadCount = alerts.filter(a => !a.isRead).length;
  const criticalCount = alerts.filter(a => a.level === 'critical').length;

  const toggleSound = () => {
    const next = !soundEnabled;
    soundManager.setEnabled(next);
    setSoundEnabled(next);
    if (next) soundManager.playAlert();
  };

  const filteredAlerts = alerts.filter(alert => {
    if (filter === 'critical') return alert.level === 'critical';
    if (filter === 'unread') return !alert.isRead;
    return true;
  });

  const getAlertIcon = (level: string) => {
    switch (level) {
      case 'critical':
        return <AlertOctagon className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />;
      case 'warning':
        return <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />;
      default:
        return <Info className="w-4 h-4 text-sky-500 shrink-0 mt-0.5" />;
    }
  };

  const formatTimestamp = (iso: string) => {
    try {
      const d = new Date(iso);
      const diffSec = Math.floor((Date.now() - d.getTime()) / 1000);
      if (diffSec < 60) return 'Just now';
      if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
      if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
      return d.toLocaleDateString();
    } catch {
      return '';
    }
  };

  return (
    <div className="relative">
      {/* Bell Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        title="Notifications & Critical Alerts"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 flex h-4 min-w-4 px-1 items-center justify-center rounded-full bg-rose-500 text-[10px] font-bold text-white shadow-xs animate-pulse">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Popover / Drawer */}
      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 z-50 overflow-hidden flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50">
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-lg bg-rose-500/10 text-rose-500 dark:bg-rose-500/20">
                  <AlertOctagon className="w-4 h-4" />
                </span>
                <div>
                  <h3 className="font-semibold text-sm text-slate-900 dark:text-white">Critical Updates</h3>
                  <p className="text-xs text-slate-500">Automated team notifications</p>
                </div>
              </div>

              <div className="flex items-center gap-1">
                <button
                  onClick={toggleSound}
                  title={soundEnabled ? 'Mute alert sounds' : 'Enable alert sounds'}
                  className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
                >
                  {soundEnabled ? <Volume2 className="w-4 h-4 text-emerald-500" /> : <VolumeX className="w-4 h-4" />}
                </button>
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Filter Tabs & Quick Actions */}
            <div className="px-4 py-2 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs bg-white dark:bg-slate-900">
              <div className="flex gap-1">
                <button
                  onClick={() => setFilter('all')}
                  className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
                    filter === 'all'
                      ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  All ({alerts.length})
                </button>
                <button
                  onClick={() => setFilter('critical')}
                  className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
                    filter === 'critical'
                      ? 'bg-rose-500 text-white'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  Critical ({criticalCount})
                </button>
                <button
                  onClick={() => setFilter('unread')}
                  className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
                    filter === 'unread'
                      ? 'bg-indigo-600 text-white'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  Unread ({unreadCount})
                </button>
              </div>

              {unreadCount > 0 && (
                <button
                  onClick={onMarkAllRead}
                  className="text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 font-medium flex items-center gap-1"
                  title="Mark all as read"
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                  Read All
                </button>
              )}
            </div>

            {/* Alert Items List */}
            <div className="divide-y divide-slate-100 dark:divide-slate-800 overflow-y-auto max-h-[380px] p-2 space-y-1">
              {filteredAlerts.length === 0 ? (
                <div className="p-8 text-center text-slate-400 dark:text-slate-500">
                  <CheckCheck className="w-8 h-8 mx-auto mb-2 text-slate-300 dark:text-slate-600" />
                  <p className="text-sm font-medium">No alerts at this moment</p>
                  <p className="text-xs mt-1">Changes meeting critical thresholds will show here.</p>
                </div>
              ) : (
                filteredAlerts.map(alert => (
                  <div
                    key={alert.id}
                    onClick={() => {
                      if (!alert.isRead) onMarkRead(alert.id);
                      if (alert.rowId && onSelectRow) {
                        onSelectRow(alert.rowId);
                        setIsOpen(false);
                      }
                    }}
                    className={`group p-3 rounded-xl cursor-pointer transition-all duration-150 flex items-start gap-3 ${
                      alert.isRead
                        ? 'opacity-70 hover:opacity-100 hover:bg-slate-50 dark:hover:bg-slate-800/40'
                        : alert.level === 'critical'
                        ? 'bg-rose-500/10 hover:bg-rose-500/15 border border-rose-500/20'
                        : 'bg-indigo-500/10 hover:bg-indigo-500/15 border border-indigo-500/20'
                    }`}
                  >
                    {getAlertIcon(alert.level)}

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-semibold text-xs text-slate-900 dark:text-white truncate">
                          {alert.title}
                        </span>
                        <span className="text-[10px] text-slate-400 shrink-0 font-mono">
                          {formatTimestamp(alert.timestamp)}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">
                        {alert.message}
                      </p>
                      {alert.rowName && (
                        <div className="mt-1.5 flex items-center gap-1 text-[11px] text-indigo-600 dark:text-indigo-400 font-medium">
                          <span>Row: {alert.rowName}</span>
                          <ExternalLink className="w-3 h-3" />
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Footer */}
            {alerts.length > 0 && (
              <div className="p-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex justify-between items-center text-xs">
                <span className="text-slate-400 text-[11px]">
                  Critical threshold: Amount &gt; $50k or Blocked
                </span>
                <button
                  onClick={onClearAll}
                  className="text-rose-500 hover:text-rose-600 dark:text-rose-400 flex items-center gap-1 font-medium"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Clear History
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};
