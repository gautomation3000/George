import React, { useState } from 'react';
import { APPS_SCRIPT_BACKEND_CODE, APPS_SCRIPT_INDEX_HTML } from '../services/appsScriptTemplate';
import { SyncState } from '../types/sheet';
import {
  Code2,
  FileCode,
  Globe,
  Copy,
  Check,
  ExternalLink,
  Zap,
  Play,
  CheckCircle2,
  AlertTriangle,
  X,
  HelpCircle,
  Clock
} from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  syncState: SyncState;
  onSaveUrl: (url: string) => void;
  onSetInterval: (sec: number) => void;
  onTestSync: () => Promise<{ success: boolean; message: string }>;
}

export const AppsScriptModal: React.FC<Props> = ({
  isOpen,
  onClose,
  syncState,
  onSaveUrl,
  onSetInterval,
  onTestSync,
}) => {
  const [activeTab, setActiveTab] = useState<'guide' | 'code' | 'frontend' | 'settings'>('guide');
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedHtml, setCopiedHtml] = useState(false);
  const [urlInput, setUrlInput] = useState(syncState.appsScriptUrl || '');
  const [testResult, setTestResult] = useState<{ status: 'idle' | 'loading' | 'success' | 'error'; message?: string }>({
    status: 'idle',
  });

  if (!isOpen) return null;

  const handleCopyCode = () => {
    navigator.clipboard.writeText(APPS_SCRIPT_BACKEND_CODE);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleCopyHtml = () => {
    navigator.clipboard.writeText(APPS_SCRIPT_INDEX_HTML);
    setCopiedHtml(true);
    setTimeout(() => setCopiedHtml(false), 2000);
  };

  const handleSaveAndTest = async () => {
    onSaveUrl(urlInput);
    setTestResult({ status: 'loading' });
    try {
      const res = await onTestSync();
      if (res.success) {
        setTestResult({ status: 'success', message: res.message || 'Connected successfully to Google Sheet!' });
      } else {
        setTestResult({ status: 'error', message: res.message || 'Could not reach endpoint. Verify Web App URL.' });
      }
    } catch (err: any) {
      setTestResult({ status: 'error', message: err.message || 'Connection test failed.' });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-4 sm:p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400">
              <Code2 className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                Google Apps Script Backend &amp; Synchronization
              </h2>
              <p className="text-xs text-slate-500">
                Connect your Google Sheet for automated real-time two-way sync
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="px-4 sm:px-6 border-b border-slate-200 dark:border-slate-800 flex gap-2 sm:gap-4 overflow-x-auto text-xs font-semibold">
          <button
            onClick={() => setActiveTab('guide')}
            className={`py-3 px-2 border-b-2 transition-colors flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'guide'
                ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
            }`}
          >
            <HelpCircle className="w-4 h-4" />
            1. Setup Guide
          </button>

          <button
            onClick={() => setActiveTab('code')}
            className={`py-3 px-2 border-b-2 transition-colors flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'code'
                ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
            }`}
          >
            <FileCode className="w-4 h-4" />
            2. Code.gs (Backend)
          </button>

          <button
            onClick={() => setActiveTab('frontend')}
            className={`py-3 px-2 border-b-2 transition-colors flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'frontend'
                ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
            }`}
          >
            <Globe className="w-4 h-4" />
            3. index.html (Standalone DataTables)
          </button>

          <button
            onClick={() => setActiveTab('settings')}
            className={`py-3 px-2 border-b-2 transition-colors flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'settings'
                ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
            }`}
          >
            <Zap className="w-4 h-4" />
            4. Live Sync Connection
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-6">
          {/* TAB 1: GUIDE */}
          {activeTab === 'guide' && (
            <div className="space-y-6">
              <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-2xl p-4 sm:p-5 flex items-start gap-4">
                <div className="p-2 bg-emerald-500 text-white rounded-xl shrink-0 mt-0.5">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-emerald-900 dark:text-emerald-200">
                    How Google Apps Script Sync Works
                  </h3>
                  <p className="text-xs text-emerald-700 dark:text-emerald-400 mt-1 leading-relaxed">
                    You uploaded your Excel file to Google Sheets. Google Apps Script acts as your personal cloud backend API. It reads the sheet, secures edits with concurrency locks (<code className="font-mono bg-emerald-100 dark:bg-emerald-900/60 px-1 py-0.5 rounded">LockService</code>), creates automated cloud snapshot tabs, and synchronizes real-time changes directly with this web application!
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Step 1 */}
                <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-850 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs font-bold">1</span>
                    <h4 className="font-semibold text-sm text-slate-900 dark:text-white">Open Apps Script in Google Sheets</h4>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                    In your Google Sheet containing the uploaded Excel data, click menu <strong>Extensions &gt; Apps Script</strong>. A new tab will open with the code editor.
                  </p>
                </div>

                {/* Step 2 */}
                <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-850 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs font-bold">2</span>
                    <h4 className="font-semibold text-sm text-slate-900 dark:text-white">Paste Code.gs</h4>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                    Switch to the <strong>"Code.gs (Backend)"</strong> tab above, click <strong>Copy Code</strong>, delete any default placeholder code in the Apps Script editor, and paste this script.
                  </p>
                </div>

                {/* Step 3 */}
                <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-850 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs font-bold">3</span>
                    <h4 className="font-semibold text-sm text-slate-900 dark:text-white">Deploy as Web App</h4>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                    In the Apps Script editor, click <strong>Deploy &gt; New deployment</strong>. Select type <strong>Web app</strong>. Execute as: <strong>Me</strong>. Who has access: <strong>Anyone</strong>. Click Deploy!
                  </p>
                </div>

                {/* Step 4 */}
                <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-850 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs font-bold">4</span>
                    <h4 className="font-semibold text-sm text-slate-900 dark:text-white">Connect &amp; Sync</h4>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                    Copy the generated Web App URL (<code className="font-mono text-[11px] bg-slate-100 dark:bg-slate-800 px-1">.../exec</code>), switch to the <strong>"Live Sync Connection"</strong> tab, paste it, and click <strong>Test Connection &amp; Sync</strong>!
                  </p>
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  onClick={() => setActiveTab('code')}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl shadow-xs transition-all flex items-center gap-1.5"
                >
                  Proceed to Code.gs <CheckCircle2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: CODE.GS */}
          {activeTab === 'code' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-sm text-slate-900 dark:text-white">
                    Google Apps Script Backend Script (<code className="text-emerald-500">Code.gs</code>)
                  </h3>
                  <p className="text-xs text-slate-500">
                    Handles GET, POST, LockService concurrency locks, row mutations, and cloud backups
                  </p>
                </div>

                <button
                  onClick={handleCopyCode}
                  className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl shadow-xs transition-all flex items-center gap-1.5 shrink-0"
                >
                  {copiedCode ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  {copiedCode ? 'Copied to Clipboard!' : 'Copy Code.gs'}
                </button>
              </div>

              <div className="relative rounded-2xl bg-slate-950 p-4 border border-slate-800 font-mono text-xs text-slate-300 max-h-[420px] overflow-y-auto">
                <pre className="whitespace-pre">{APPS_SCRIPT_BACKEND_CODE}</pre>
              </div>
            </div>
          )}

          {/* TAB 3: INDEX.HTML */}
          {activeTab === 'frontend' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-sm text-slate-900 dark:text-white">
                    Google Apps Script Web App Template (<code className="text-indigo-500">index.html</code>)
                  </h3>
                  <p className="text-xs text-slate-500">
                    Standalone DataTables frontend for Google Apps Script HtmlService with responsive styling
                  </p>
                </div>

                <button
                  onClick={handleCopyHtml}
                  className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl shadow-xs transition-all flex items-center gap-1.5 shrink-0"
                >
                  {copiedHtml ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  {copiedHtml ? 'Copied HTML!' : 'Copy index.html'}
                </button>
              </div>

              <div className="relative rounded-2xl bg-slate-950 p-4 border border-slate-800 font-mono text-xs text-slate-300 max-h-[420px] overflow-y-auto">
                <pre className="whitespace-pre">{APPS_SCRIPT_INDEX_HTML}</pre>
              </div>
            </div>
          )}

          {/* TAB 4: LIVE SETTINGS & CONNECTION */}
          {activeTab === 'settings' && (
            <div className="space-y-6">
              <div className="space-y-3">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                  Google Apps Script Web App Deployment URL
                </label>
                <div className="flex gap-2">
                  <input
                    type="url"
                    value={urlInput}
                    onChange={(e) => setUrlInput(e.target.value)}
                    placeholder="https://script.google.com/macros/s/AKfycb.../exec"
                    className="flex-1 px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 font-mono text-slate-900 dark:text-white"
                  />
                  <button
                    onClick={handleSaveAndTest}
                    disabled={testResult.status === 'loading'}
                    className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-xs font-semibold rounded-xl shadow-xs transition-all flex items-center gap-1.5 shrink-0 disabled:opacity-50"
                  >
                    {testResult.status === 'loading' ? (
                      <>Testing...</>
                    ) : (
                      <>
                        <Play className="w-4 h-4" /> Save &amp; Test Connection
                      </>
                    )}
                  </button>
                </div>
                <p className="text-[11px] text-slate-400">
                  Leave blank to use the built-in High-Fidelity Real-Time Team Mesh (BroadcastChannel + Local Sync).
                </p>
              </div>

              {/* Test Result Callout */}
              {testResult.status === 'success' && (
                <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 flex items-center gap-3 text-xs text-emerald-800 dark:text-emerald-300">
                  <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                  <div>
                    <p className="font-semibold">{testResult.message}</p>
                    <p className="text-[11px] opacity-75">
                      Spreadsheet is live. All changes sync bidirectionally in real-time.
                    </p>
                  </div>
                </div>
              )}

              {testResult.status === 'error' && (
                <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 flex items-center gap-3 text-xs text-rose-800 dark:text-rose-300">
                  <AlertTriangle className="w-5 h-5 text-rose-500 shrink-0" />
                  <div>
                    <p className="font-semibold">{testResult.message}</p>
                    <p className="text-[11px] opacity-75">
                      Ensure your Web App deployment is set to "Who has access: Anyone".
                    </p>
                  </div>
                </div>
              )}

              {/* Sync Interval Configuration */}
              <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-semibold text-xs text-slate-900 dark:text-white">
                      Automated Polling &amp; Sync Frequency
                    </h4>
                    <p className="text-[11px] text-slate-500">
                      How frequently SheetSync Pro checks Google Sheets for external updates
                    </p>
                  </div>

                  <select
                    value={syncState.autoSyncInterval}
                    onChange={(e) => onSetInterval(Number(e.target.value))}
                    className="px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 focus:outline-hidden"
                  >
                    <option value={5}>Every 5 Seconds (Ultra fast)</option>
                    <option value={10}>Every 10 Seconds (Recommended)</option>
                    <option value={30}>Every 30 Seconds</option>
                    <option value={60}>Every 1 Minute</option>
                    <option value={0}>Manual Only</option>
                  </select>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex justify-between items-center text-xs">
          <span className="text-slate-400">
            Active Mode:{' '}
            <strong className="text-slate-700 dark:text-slate-300">
              {syncState.backendType === 'apps_script'
                ? 'Google Apps Script Web App'
                : 'Real-Time Team Mesh (BroadcastChannel)'}
            </strong>
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-900 dark:bg-slate-100 hover:bg-slate-800 dark:hover:bg-slate-200 text-white dark:text-slate-900 font-semibold rounded-xl transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
