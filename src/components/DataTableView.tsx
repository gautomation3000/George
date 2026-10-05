import React, { useState, useMemo } from 'react';
import {
  SheetRow,
  EquipmentCondition,
  TeamMember,
  SortConfig
} from '../types/sheet';
import { formatDateStamp, calculateDueDays } from '../utils/dateUtils';
import {
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Filter,
  Eye,
  Trash2,
  Edit2,
  Copy,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Download,
  AlertCircle,
  X,
  AlertTriangle,
  Clock
} from 'lucide-react';
import { ExcelService } from '../services/excelService';

interface Props {
  rows: SheetRow[];
  activeSheetTab?: string;
  canEdit?: boolean;
  canDelete?: boolean;
  onUpdateRow: (row: SheetRow) => void;
  onDeleteRow: (id: string) => void;
  onDuplicateRow: (row: SheetRow) => void;
  onOpenEditModal: (row: SheetRow) => void;
  onBulkDelete: (ids: string[]) => void;
  onBulkConditionChange: (ids: string[], condition: EquipmentCondition) => void;
  teamMembers: TeamMember[];
  highlightedRowId?: string | null;
}

export const DataTableView: React.FC<Props> = ({
  rows,
  activeSheetTab = 'Full list',
  canEdit = true,
  canDelete = true,
  onUpdateRow,
  onDeleteRow,
  onDuplicateRow,
  onOpenEditModal,
  onBulkDelete,
  onBulkConditionChange,
  teamMembers,
  highlightedRowId,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [conditionFilter, setConditionFilter] = useState<string>('all');
  const [makeFilter, setMakeFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [onlyOverdue, setOnlyOverdue] = useState<boolean>(false);
  const [sortConfig, setSortConfig] = useState<SortConfig>({ field: 'slno', direction: 'asc' });

  // Pagination & Density
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(25);
  const [density, setDensity] = useState<'compact' | 'normal' | 'spacious'>('normal');

  // Column Visibility: By default, ONLY Serial no., Description, Location, and Calibration Due Date are shown!
  const [visibleColumns, setVisibleColumns] = useState({
    slno: true,
    description: true,
    make: false,
    model: false,
    serialNo: false,
    type: false,
    condition: false,
    location: true,
    calibrationDueDate: true,
    dueDays: false,
    remarks: false,
    actions: true,
  });

  const [showColMenu, setShowColMenu] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [editingCell, setEditingCell] = useState<{ id: string; field: keyof SheetRow } | null>(null);
  const [inlineValue, setInlineValue] = useState<string>('');

  // Extract unique makes for filter dropdown
  const uniqueMakes = useMemo(() => {
    const set = new Set<string>();
    rows.forEach(r => { if (r.make) set.add(r.make.trim()); });
    return Array.from(set).sort();
  }, [rows]);

  // Filtering & Sorting
  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matches =
          String(row.slno).includes(query) ||
          (row.description && row.description.toLowerCase().includes(query)) ||
          (row.make && row.make.toLowerCase().includes(query)) ||
          (row.model && row.model.toLowerCase().includes(query)) ||
          (row.serialNo && row.serialNo.toLowerCase().includes(query)) ||
          (row.condition && row.condition.toLowerCase().includes(query)) ||
          (row.location && row.location.toLowerCase().includes(query)) ||
          (row.remarks && row.remarks.toLowerCase().includes(query)) ||
          (row.calibrationDueDate && row.calibrationDueDate.toLowerCase().includes(query));
        if (!matches) return false;
      }

      if (conditionFilter !== 'all' && row.condition !== conditionFilter) return false;
      if (makeFilter !== 'all' && row.make !== makeFilter) return false;
      if (typeFilter !== 'all' && row.type?.trim().toLowerCase() !== typeFilter.toLowerCase()) return false;

      if (onlyOverdue) {
        const days = calculateDueDays(row.calibrationDueDate);
        const isNeg = days !== null && days < 0;
        const isRemarkDue = row.remarks && row.remarks.toLowerCase().includes('due for calibration');
        if (!isNeg && !isRemarkDue) return false;
      }

      return true;
    });
  }, [rows, searchQuery, conditionFilter, makeFilter, typeFilter, onlyOverdue]);

  const sortedRows = useMemo(() => {
    const list = [...filteredRows];
    list.sort((a, b) => {
      let aVal = a[sortConfig.field];
      let bVal = b[sortConfig.field];

      if (aVal === undefined || aVal === null) return 1;
      if (bVal === undefined || bVal === null) return -1;

      if (sortConfig.field === 'slno' || sortConfig.field === 'dueDays') {
        const numA = Number(aVal) || 0;
        const numB = Number(bVal) || 0;
        return sortConfig.direction === 'asc' ? numA - numB : numB - numA;
      }

      const strA = String(aVal).toLowerCase();
      const strB = String(bVal).toLowerCase();

      if (strA < strB) return sortConfig.direction === 'asc' ? -1 : 1;
      if (strA > strB) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
    return list;
  }, [filteredRows, sortConfig]);

  const totalPages = Math.ceil(sortedRows.length / pageSize) || 1;
  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedRows.slice(start, start + pageSize);
  }, [sortedRows, currentPage, pageSize]);

  const handleSort = (field: keyof SheetRow) => {
    if (sortConfig.field === field) {
      if (sortConfig.direction === 'asc') {
        setSortConfig({ field, direction: 'desc' });
      } else {
        setSortConfig({ field: 'slno', direction: 'asc' });
      }
    } else {
      setSortConfig({ field, direction: 'asc' });
    }
  };

  const getSortIcon = (field: keyof SheetRow) => {
    if (sortConfig.field !== field) {
      return <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />;
    }
    return sortConfig.direction === 'asc' ? (
      <ArrowUp className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
    ) : (
      <ArrowDown className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
    );
  };

  const handleSelectAll = () => {
    if (selectedIds.size === paginatedRows.length && paginatedRows.length > 0) {
      setSelectedIds(new Set());
    } else {
      const next = new Set<string>();
      paginatedRows.forEach(r => next.add(r.id));
      setSelectedIds(next);
    }
  };

  const toggleSelectRow = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const startEditing = (row: SheetRow, field: keyof SheetRow) => {
    setEditingCell({ id: row.id, field });
    setInlineValue(String(row[field] ?? ''));
  };

  const saveInlineEdit = (row: SheetRow) => {
    if (!editingCell) return;
    const { field } = editingCell;
    let val: any = inlineValue;

    if (row[field] !== val) {
      onUpdateRow({
        ...row,
        [field]: val,
        lastModified: new Date().toISOString(),
        lastModifiedBy: 'You',
        version: (row.version || 1) + 1,
        syncStatus: 'pending',
      });
    }
    setEditingCell(null);
  };

  const getConditionBadge = (cond: string) => {
    cond = cond || 'Good';
    if (cond === 'Under Repair') {
      return 'bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300 border-amber-200 dark:border-amber-800';
    }
    if (cond === 'Faulty') {
      return 'bg-rose-100 text-rose-800 dark:bg-rose-950/70 dark:text-rose-300 border-rose-200 dark:border-rose-800 animate-pulse';
    }
    if (cond.indexOf('Emergency') !== -1) {
      return 'bg-purple-100 text-purple-800 dark:bg-purple-950/70 dark:text-purple-300 border-purple-200 dark:border-purple-800';
    }
    return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800';
  };

  const thPadding =
    density === 'compact'
      ? 'py-1.5 px-2.5 text-[10px]'
      : density === 'spacious'
      ? 'py-3.5 px-4 text-xs'
      : 'py-2.5 px-3 text-[11px]';

  const cellPadding =
    density === 'compact'
      ? 'py-1 px-2.5 text-xs'
      : density === 'spacious'
      ? 'py-3.5 px-4 text-sm'
      : 'py-2 px-3 text-xs sm:text-sm';

  return (
    <div className="space-y-4">
      {/* ================= DATATABLES CONTROLS ================= */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Global Search */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Search equipment, make, serial no, location, remarks..."
              className="w-full pl-10 pr-9 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-white"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Quick Filter Selectors */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Make Filter */}
            <select
              value={makeFilter}
              onChange={(e) => {
                setMakeFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 focus:outline-hidden"
            >
              <option value="all">All Makes</option>
              {uniqueMakes.map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>

            {/* Condition Filter */}
            <select
              value={conditionFilter}
              onChange={(e) => {
                setConditionFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 focus:outline-hidden"
            >
              <option value="all">All Conditions</option>
              <option value="Good">Good</option>
              <option value="Under Repair">Under Repair</option>
              <option value="spare / Emergency">spare / Emergency</option>
              <option value="Faulty">Faulty</option>
            </select>

            {/* Overdue Toggle Pill */}
            <button
              onClick={() => {
                setOnlyOverdue(!onlyOverdue);
                setCurrentPage(1);
              }}
              className={`px-3 py-2 rounded-xl text-xs font-semibold border transition-all flex items-center gap-1.5 ${
                onlyOverdue
                  ? 'bg-rose-500 text-white border-rose-600 shadow-xs'
                  : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Overdue Calibration</span>
            </button>

            {/* Density Selector */}
            <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-xl p-0.5 border border-slate-200 dark:border-slate-700 text-xs font-medium">
              <button
                onClick={() => setDensity('compact')}
                className={`px-2 py-1.5 rounded-lg transition-colors ${density === 'compact' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-xs' : 'text-slate-500'}`}
              >
                Compact
              </button>
              <button
                onClick={() => setDensity('normal')}
                className={`px-2 py-1.5 rounded-lg transition-colors ${density === 'normal' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-xs' : 'text-slate-500'}`}
              >
                Normal
              </button>
            </div>

            {/* Columns Menu */}
            <div className="relative">
              <button
                onClick={() => setShowColMenu(!showColMenu)}
                className="px-3 py-2 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-700 dark:text-slate-300 flex items-center gap-1.5"
              >
                <Eye className="w-3.5 h-3.5 text-slate-500" />
                Columns
              </button>

              {showColMenu && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setShowColMenu(false)} />
                  <div className="absolute right-0 mt-1 w-48 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 p-2 z-40 space-y-1 text-xs">
                    <p className="font-semibold text-slate-400 px-2 py-1 uppercase text-[10px]">Show / Hide Columns</p>
                    {Object.keys(visibleColumns).map((colKey) => (
                      <label key={colKey} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer text-slate-700 dark:text-slate-200 capitalize">
                        <input
                          type="checkbox"
                          checked={(visibleColumns as any)[colKey]}
                          onChange={(e) => setVisibleColumns({ ...visibleColumns, [colKey]: e.target.checked })}
                          className="rounded-sm text-indigo-600"
                        />
                        {colKey.replace(/([A-Z])/g, ' $1')}
                      </label>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Bulk Action Bar */}
        {selectedIds.size > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-800/80 rounded-xl text-xs text-indigo-900 dark:text-indigo-200">
            <div className="flex items-center gap-2 font-semibold">
              <span className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[10px]">
                {selectedIds.size}
              </span>
              <span>{selectedIds.size} item(s) selected</span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => onBulkConditionChange(Array.from(selectedIds), 'Good')}
                className="px-2.5 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-emerald-700 dark:text-emerald-400 rounded-lg font-medium"
              >
                Mark Good
              </button>
              <button
                onClick={() => onBulkConditionChange(Array.from(selectedIds), 'Under Repair')}
                className="px-2.5 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-amber-700 dark:text-amber-400 rounded-lg font-medium"
              >
                Mark Under Repair
              </button>
              <button
                onClick={() => onBulkConditionChange(Array.from(selectedIds), 'Faulty')}
                className="px-2.5 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-rose-700 dark:text-rose-400 rounded-lg font-medium"
              >
                Mark Faulty
              </button>
              <button
                onClick={() => {
                  const selectedRows = rows.filter(r => selectedIds.has(r.id));
                  ExcelService.exportToExcel(selectedRows, `SheetSync_Equipment_Selected_${selectedIds.size}.xlsx`);
                }}
                className="px-2.5 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-lg font-medium flex items-center gap-1"
              >
                <Download className="w-3.5 h-3.5" /> Export
              </button>
              <button
                onClick={() => {
                  if (window.confirm(`Delete ${selectedIds.size} selected items?`)) {
                    onBulkDelete(Array.from(selectedIds));
                    setSelectedIds(new Set());
                  }
                }}
                className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-medium flex items-center gap-1"
              >
                <Trash2 className="w-3.5 h-3.5" /> Delete
              </button>
              <button onClick={() => setSelectedIds(new Set())} className="p-1 text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ================= SPREADSHEET TABLE ================= */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
        <div className="overflow-x-auto max-w-full">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/80 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider select-none">
                <th className={`${thPadding} w-10 text-center`}>
                  <input
                    type="checkbox"
                    checked={selectedIds.size > 0 && selectedIds.size === paginatedRows.length}
                    onChange={handleSelectAll}
                    className="rounded-sm text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                  />
                </th>

                {visibleColumns.slno && (
                  <th onClick={() => handleSort('slno')} className={`${thPadding} min-w-[75px] cursor-pointer group`}>
                    <div className="flex items-center gap-1">
                      <span>{activeSheetTab !== 'Full list' ? 'S.No' : 'SLNO'}</span>
                      {getSortIcon('slno')}
                    </div>
                  </th>
                )}

                {visibleColumns.description && (
                  <th onClick={() => handleSort('description')} className={`${thPadding} min-w-[220px] cursor-pointer group`}>
                    <div className="flex items-center gap-1">
                      <span>Description</span>
                      {getSortIcon('description')}
                    </div>
                  </th>
                )}

                {visibleColumns.make && (
                  <th onClick={() => handleSort('make')} className={`${thPadding} min-w-[120px] cursor-pointer group`}>
                    <div className="flex items-center gap-1">
                      <span>Make</span>
                      {getSortIcon('make')}
                    </div>
                  </th>
                )}

                {visibleColumns.model && (
                  <th onClick={() => handleSort('model')} className={`${thPadding} min-w-[110px] cursor-pointer group`}>
                    <div className="flex items-center gap-1">
                      <span>Model</span>
                      {getSortIcon('model')}
                    </div>
                  </th>
                )}

                {visibleColumns.serialNo && (
                  <th onClick={() => handleSort('serialNo')} className={`${thPadding} min-w-[130px] cursor-pointer group`}>
                    <div className="flex items-center gap-1">
                      <span>Serial No</span>
                      {getSortIcon('serialNo')}
                    </div>
                  </th>
                )}

                {visibleColumns.type && (
                  <th onClick={() => handleSort('type')} className={`${thPadding} min-w-[100px] cursor-pointer group`}>
                    <div className="flex items-center gap-1">
                      <span>Type</span>
                      {getSortIcon('type')}
                    </div>
                  </th>
                )}

                {visibleColumns.condition && (
                  <th onClick={() => handleSort('condition')} className={`${thPadding} min-w-[140px] cursor-pointer group`}>
                    <div className="flex items-center gap-1">
                      <span>Condition</span>
                      {getSortIcon('condition')}
                    </div>
                  </th>
                )}

                {visibleColumns.location && (
                  <th onClick={() => handleSort('location')} className={`${thPadding} min-w-[140px] cursor-pointer group`}>
                    <div className="flex items-center gap-1">
                      <span>Location / Individual</span>
                      {getSortIcon('location')}
                    </div>
                  </th>
                )}

                {visibleColumns.calibrationDueDate && (
                  <th onClick={() => handleSort('calibrationDueDate')} className={`${thPadding} min-w-[130px] cursor-pointer group`}>
                    <div className="flex items-center gap-1">
                      <span>Calibration Due</span>
                      {getSortIcon('calibrationDueDate')}
                    </div>
                  </th>
                )}

                {visibleColumns.dueDays && (
                  <th onClick={() => handleSort('dueDays')} className={`${thPadding} min-w-[100px] cursor-pointer group`}>
                    <div className="flex items-center gap-1">
                      <span>Due Days</span>
                      {getSortIcon('dueDays')}
                    </div>
                  </th>
                )}

                {visibleColumns.remarks && (
                  <th className={`${thPadding} min-w-[200px]`}>Remarks</th>
                )}

                {visibleColumns.actions && (
                  <th className={`${thPadding} w-20 text-right`}>Actions</th>
                )}
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-800 dark:text-slate-200">
              {paginatedRows.length === 0 ? (
                <tr>
                  <td colSpan={13} className="py-12 text-center text-slate-400 dark:text-slate-500">
                    <AlertCircle className="w-8 h-8 mx-auto mb-2 text-slate-300 dark:text-slate-600" />
                    <p className="text-sm font-semibold">No equipment rows found</p>
                    <p className="text-xs mt-1">Try clearing search filters or add a new equipment item.</p>
                  </td>
                </tr>
              ) : (
                paginatedRows.map((row) => {
                  const isSelected = selectedIds.has(row.id);
                  const isHighlighted = highlightedRowId === row.id;
                  const dueDaysCalc = calculateDueDays(row.calibrationDueDate);
                  const isOverdue = dueDaysCalc !== null && dueDaysCalc < 0;

                  return (
                    <tr
                      key={row.id}
                      className={`group transition-colors duration-150 ${
                        isHighlighted
                          ? 'bg-amber-100/60 dark:bg-amber-950/40 ring-2 ring-amber-400'
                          : isSelected
                          ? 'bg-indigo-50/70 dark:bg-indigo-950/40'
                          : isOverdue
                          ? 'bg-rose-50/20 dark:bg-rose-950/10 hover:bg-rose-50/40'
                          : 'hover:bg-slate-50/80 dark:hover:bg-slate-800/40'
                      }`}
                    >
                      {/* Select Checkbox */}
                      <td className={`${cellPadding} text-center`}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelectRow(row.id)}
                          className="rounded-sm text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                        />
                      </td>

                      {/* SLNO / Serial no. - Clean number without '#' symbol */}
                      {visibleColumns.slno && (
                        <td className={`${cellPadding} font-mono font-semibold`}>
                          <span className="text-slate-800 dark:text-slate-200">
                            {row.sheetSlno ?? row.slno}
                          </span>
                        </td>
                      )}

                      {/* Description (Inline Editable when permitted) */}
                      {visibleColumns.description && (
                        <td className={`${cellPadding} font-medium text-slate-900 dark:text-white`}>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {editingCell?.id === row.id && editingCell.field === 'description' && canEdit ? (
                              <input
                                autoFocus
                                type="text"
                                value={inlineValue}
                                onChange={(e) => setInlineValue(e.target.value)}
                                onBlur={() => saveInlineEdit(row)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') saveInlineEdit(row);
                                  if (e.key === 'Escape') setEditingCell(null);
                                }}
                                className="w-full px-2 py-1 bg-white dark:bg-slate-800 border border-indigo-500 rounded text-xs outline-hidden"
                              />
                            ) : (
                              <span
                                onDoubleClick={() => canEdit && startEditing(row, 'description')}
                                title={canEdit ? 'Double click to edit description' : undefined}
                                className={canEdit ? 'hover:underline cursor-pointer decoration-dotted' : ''}
                              >
                                {row.description}
                              </span>
                            )}

                            {/* When Make column is hidden, show Make in a neat small box right after description */}
                            {!visibleColumns.make && row.make && (
                              <span
                                className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded border border-slate-200 dark:border-slate-700 shadow-2xs shrink-0"
                                title={`Make: ${row.make}`}
                              >
                                {row.make}
                              </span>
                            )}

                            {row.syncStatus === 'pending' && (
                              <span className="w-2 h-2 rounded-full bg-orange-500 shrink-0" title="Changes queued in IndexedDB" />
                            )}
                          </div>
                        </td>
                      )}

                      {/* Make */}
                      {visibleColumns.make && (
                        <td className={cellPadding}>
                          <span className="font-semibold text-slate-700 dark:text-slate-300">
                            {row.make}
                          </span>
                        </td>
                      )}

                      {/* Model */}
                      {visibleColumns.model && (
                        <td className={`${cellPadding} font-mono text-xs text-slate-700 dark:text-slate-300`}>
                          {row.model ? (
                            <span>{row.model}</span>
                          ) : (
                            <span className="text-slate-300 dark:text-slate-600">—</span>
                          )}
                        </td>
                      )}

                      {/* Serial No */}
                      {visibleColumns.serialNo && (
                        <td className={`${cellPadding} font-mono text-xs font-semibold text-slate-800 dark:text-slate-200`}>
                          {row.serialNo ? (
                            <span>{row.serialNo}</span>
                          ) : (
                            <span className="text-slate-300 dark:text-slate-600 font-normal">—</span>
                          )}
                        </td>
                      )}

                      {/* Type (Personal / Common) */}
                      {visibleColumns.type && (
                        <td className={cellPadding}>
                          <span className="inline-flex px-2 py-0.5 rounded-md text-[11px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                            {row.type}
                          </span>
                        </td>
                      )}

                      {/* Condition (Quick Inline Dropdown when permitted) */}
                      {visibleColumns.condition && (
                        <td className={cellPadding}>
                          {canEdit ? (
                            <select
                              value={row.condition}
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
                              className={`px-2.5 py-1 rounded-full text-xs font-semibold border cursor-pointer focus:outline-hidden ${getConditionBadge(
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
                              className={`inline-block px-2.5 py-1 rounded-full text-xs font-semibold border ${getConditionBadge(
                                row.condition
                              )}`}
                            >
                              {row.condition}
                            </span>
                          )}
                        </td>
                      )}

                      {/* Location / Individual */}
                      {visibleColumns.location && (
                        <td className={cellPadding}>
                          <span className="font-medium text-slate-700 dark:text-slate-300">
                            {row.location}
                          </span>
                        </td>
                      )}

                      {/* Calibration Due Date */}
                      {visibleColumns.calibrationDueDate && (
                        <td className={`${cellPadding} font-mono text-xs ${isOverdue ? 'text-rose-600 dark:text-rose-400 font-bold' : 'text-slate-600 dark:text-slate-400'}`}>
                          {formatDateStamp(row.calibrationDueDate)}
                        </td>
                      )}

                      {/* Due Days (Negative = Overdue) */}
                      {visibleColumns.dueDays && (
                        <td className={cellPadding}>
                          {dueDaysCalc !== null ? (
                            isOverdue ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-rose-500 text-white">
                                {dueDaysCalc} (Overdue)
                              </span>
                            ) : (
                              <span className="font-mono text-xs font-medium text-slate-600 dark:text-slate-400">
                                {dueDaysCalc} days
                              </span>
                            )
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                      )}

                      {/* Remarks */}
                      {visibleColumns.remarks && (
                        <td className={`${cellPadding} text-xs text-slate-500 dark:text-slate-400 max-w-[240px] truncate`} title={row.remarks}>
                          {row.remarks || '-'}
                        </td>
                      )}

                      {/* Actions */}
                      {visibleColumns.actions && (
                        <td className={`${cellPadding} text-right`}>
                          <div className="flex items-center justify-end gap-1 opacity-70 group-hover:opacity-100 transition-opacity">
                            {canEdit && (
                              <button
                                onClick={() => onOpenEditModal(row)}
                                className="p-1 rounded text-slate-500 hover:text-indigo-600"
                                title="Edit item"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                            {canEdit && (
                              <button
                                onClick={() => onDuplicateRow(row)}
                                className="p-1 rounded text-slate-500 hover:text-emerald-600"
                                title="Duplicate item"
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
                                className="p-1 rounded text-slate-500 hover:text-rose-600"
                                title="Delete item"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                            {!canEdit && !canDelete && (
                              <button
                                onClick={() => onOpenEditModal(row)}
                                className="p-1 rounded text-slate-400 hover:text-slate-600"
                                title="View details"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs">
          <div className="text-slate-500 dark:text-slate-400">
            Showing <span className="font-semibold text-slate-900 dark:text-white">{sortedRows.length === 0 ? 0 : (currentPage - 1) * pageSize + 1}</span> to{' '}
            <span className="font-semibold text-slate-900 dark:text-white">
              {Math.min(currentPage * pageSize, sortedRows.length)}
            </span>{' '}
            of <span className="font-semibold text-slate-900 dark:text-white">{sortedRows.length}</span> equipment items
            {filteredRows.length !== rows.length && (
              <span className="ml-1 text-slate-400">(filtered from {rows.length} total)</span>
            )}
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-slate-500">
              <span>Per page:</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-xs"
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={() => setCurrentPage(1)}
                disabled={currentPage === 1}
                className="p-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 disabled:opacity-40"
              >
                <ChevronsLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 disabled:opacity-40"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <span className="px-3 py-1 font-semibold text-slate-700 dark:text-slate-300">
                Page {currentPage} of {totalPages}
              </span>

              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="p-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 disabled:opacity-40"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
              <button
                onClick={() => setCurrentPage(totalPages)}
                disabled={currentPage === totalPages}
                className="p-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 disabled:opacity-40"
              >
                <ChevronsRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
