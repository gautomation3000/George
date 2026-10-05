import React, { useState, useRef } from 'react';
import { SheetRow } from '../types/sheet';
import { ExcelService } from '../services/excelService';
import {
  Upload,
  Download,
  FileSpreadsheet,
  FileText,
  FileCode,
  CheckCircle2,
  AlertCircle,
  X,
  ArrowRight
} from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  currentRows: SheetRow[];
  onImportRows: (rows: SheetRow[], mode: 'replace' | 'append') => void;
}

export const ImportExportModal: React.FC<Props> = ({
  isOpen,
  onClose,
  currentRows,
  onImportRows,
}) => {
  const [dragOver, setDragOver] = useState(false);
  const [parsedPreview, setParsedPreview] = useState<SheetRow[] | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [importMode, setImportMode] = useState<'replace' | 'append'>('replace');
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFile = async (file: File) => {
    setErrorMsg(null);
    try {
      const parsed = await ExcelService.parseExcelFile(file);
      setParsedPreview(parsed);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to parse Excel file. Ensure valid .xlsx or .csv format.');
      setParsedPreview(null);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleConfirmImport = () => {
    if (!parsedPreview) return;
    onImportRows(parsedPreview, importMode);
    setParsedPreview(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-4 sm:p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                Import &amp; Export Excel Spreadsheet
              </h2>
              <p className="text-xs text-slate-500">
                Seamlessly upload existing team spreadsheets or download in multiple formats
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

        {/* Content */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-6">
          {/* Export Options Section */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
              Export Current Sheet ({currentRows.length} rows)
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <button
                onClick={() => ExcelService.exportToExcel(currentRows)}
                className="p-3.5 rounded-2xl border border-slate-200 dark:border-slate-700 hover:border-emerald-500 bg-slate-50 dark:bg-slate-800/60 hover:bg-emerald-50/50 dark:hover:bg-emerald-950/20 text-left transition-all group"
              >
                <FileSpreadsheet className="w-5 h-5 text-emerald-600 mb-2 group-hover:scale-110 transition-transform" />
                <span className="block font-semibold text-xs text-slate-900 dark:text-white">Excel (.xlsx)</span>
                <span className="text-[11px] text-slate-500">Auto-formatted columns</span>
              </button>

              <button
                onClick={() => ExcelService.exportToCsv(currentRows)}
                className="p-3.5 rounded-2xl border border-slate-200 dark:border-slate-700 hover:border-blue-500 bg-slate-50 dark:bg-slate-800/60 hover:bg-blue-50/50 dark:hover:bg-blue-950/20 text-left transition-all group"
              >
                <FileText className="w-5 h-5 text-blue-600 mb-2 group-hover:scale-110 transition-transform" />
                <span className="block font-semibold text-xs text-slate-900 dark:text-white">CSV (.csv)</span>
                <span className="text-[11px] text-slate-500">Universal comma-separated</span>
              </button>

              <button
                onClick={() => ExcelService.exportToJson(currentRows)}
                className="p-3.5 rounded-2xl border border-slate-200 dark:border-slate-700 hover:border-purple-500 bg-slate-50 dark:bg-slate-800/60 hover:bg-purple-50/50 dark:hover:bg-purple-950/20 text-left transition-all group"
              >
                <FileCode className="w-5 h-5 text-purple-600 mb-2 group-hover:scale-110 transition-transform" />
                <span className="block font-semibold text-xs text-slate-900 dark:text-white">JSON Backup</span>
                <span className="text-[11px] text-slate-500">Structured data payload</span>
              </button>
            </div>
          </div>

          <hr className="border-slate-100 dark:border-slate-800" />

          {/* Import Upload Section */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
              Upload New Excel File (.xlsx / .csv)
            </h3>

            <input
              type="file"
              ref={fileInputRef}
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  handleFile(e.target.files[0]);
                }
              }}
            />

            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all ${
                dragOver
                  ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20'
                  : 'border-slate-200 dark:border-slate-700 hover:border-slate-400 bg-slate-50/50 dark:bg-slate-800/40'
              }`}
            >
              <Upload className="w-8 h-8 mx-auto mb-2 text-slate-400" />
              <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                Click to browse or drag and drop your Excel spreadsheet
              </p>
              <p className="text-[11px] text-slate-400 mt-1">
                Supports Microsoft Excel (.xlsx, .xls) and Comma-Separated Values (.csv)
              </p>
            </div>

            {errorMsg && (
              <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl flex items-center gap-2 text-xs text-rose-700 dark:text-rose-300">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Parsed Preview Confirmation */}
            {parsedPreview && (
              <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-2xl space-y-3 animate-in fade-in duration-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300 font-semibold text-xs">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    <span>File Parsed: {parsedPreview.length} rows detected!</span>
                  </div>

                  {/* Mode select */}
                  <div className="flex items-center gap-2 text-xs">
                    <label className="flex items-center gap-1 cursor-pointer">
                      <input
                        type="radio"
                        name="importMode"
                        checked={importMode === 'replace'}
                        onChange={() => setImportMode('replace')}
                        className="text-emerald-600 focus:ring-emerald-500"
                      />
                      <span>Replace All</span>
                    </label>
                    <label className="flex items-center gap-1 cursor-pointer ml-2">
                      <input
                        type="radio"
                        name="importMode"
                        checked={importMode === 'append'}
                        onChange={() => setImportMode('append')}
                        className="text-emerald-600 focus:ring-emerald-500"
                      />
                      <span>Append</span>
                    </label>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    onClick={() => setParsedPreview(null)}
                    className="px-3 py-1.5 text-xs text-slate-600 dark:text-slate-400 hover:underline"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleConfirmImport}
                    className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors flex items-center gap-1.5"
                  >
                    Import {parsedPreview.length} Rows <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex justify-end text-xs">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-900 dark:bg-slate-100 hover:bg-slate-800 dark:hover:bg-slate-200 text-white dark:text-slate-900 font-semibold rounded-xl transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
