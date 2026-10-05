import React, { useState, useEffect } from 'react';
import { SheetRow, EquipmentCondition, EquipmentType } from '../types/sheet';
import { formatDateStamp, calculateDueDays } from '../utils/dateUtils';
import {
  Edit3,
  PlusCircle,
  X,
  AlertTriangle,
  Clock
} from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  rowToEdit?: SheetRow | null;
  onSave: (row: SheetRow, isNew: boolean) => void;
  nextSlno: number;
}

export const EditRowModal: React.FC<Props> = ({
  isOpen,
  onClose,
  rowToEdit,
  onSave,
  nextSlno,
}) => {
  const isNew = !rowToEdit;

  const [description, setDescription] = useState('');
  const [make, setMake] = useState('Fluke');
  const [model, setModel] = useState('');
  const [serialNo, setSerialNo] = useState('');
  const [type, setType] = useState<EquipmentType>('Personal');
  const [condition, setCondition] = useState<EquipmentCondition>('Good');
  const [location, setLocation] = useState('AD-12');
  const [calibrationDueDate, setCalibrationDueDate] = useState('');
  const [dueDays, setDueDays] = useState<string | number>(150);
  const [remarks, setRemarks] = useState('');

  useEffect(() => {
    if (rowToEdit) {
      setDescription(rowToEdit.description);
      setMake(rowToEdit.make || 'Fluke');
      setModel(rowToEdit.model || '');
      setSerialNo(rowToEdit.serialNo || '');
      setType(rowToEdit.type || 'Personal');
      setCondition((rowToEdit.condition as EquipmentCondition) || 'Good');
      setLocation(rowToEdit.location || 'AD-12');
      setCalibrationDueDate(rowToEdit.calibrationDueDate || '');
      setDueDays(rowToEdit.dueDays !== undefined ? rowToEdit.dueDays : '');
      setRemarks(rowToEdit.remarks || '');
    } else {
      setDescription('');
      setMake('Fluke');
      setModel('');
      setSerialNo('');
      setType('common');
      setCondition('Good');
      setLocation('AD-12');
      setCalibrationDueDate('10.Mar.2027');
      setDueDays(calculateDueDays('10.Mar.2027') ?? 155);
      setRemarks('');
    }
  }, [rowToEdit, isOpen]);

  useEffect(() => {
    if (calibrationDueDate) {
      const calculated = calculateDueDays(calibrationDueDate);
      if (calculated !== null) {
        setDueDays(calculated);
      }
    }
  }, [calibrationDueDate]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim()) return;

    const formattedDue = formatDateStamp(calibrationDueDate.trim());
    const calculatedDueDays = calculateDueDays(calibrationDueDate.trim());

    const rowData: SheetRow = {
      id: rowToEdit ? rowToEdit.id : 'item_' + Date.now(),
      slno: rowToEdit ? rowToEdit.slno : nextSlno,
      description: description.trim(),
      make: make.trim(),
      model: model.trim(),
      serialNo: serialNo.trim(),
      type,
      condition,
      location: location.trim(),
      calibrationDueDate: formattedDue !== '—' ? formattedDue : calibrationDueDate.trim(),
      remarks: remarks.trim(),
      dueDays: calculatedDueDays !== null ? calculatedDueDays : dueDays,
      lastModified: new Date().toISOString(),
      lastModifiedBy: 'You',
      version: rowToEdit ? (rowToEdit.version || 1) + 1 : 1,
      syncStatus: 'pending',
    };

    onSave(rowData, isNew);
    onClose();
  };

  const isDueNegative = Number(dueDays) < 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-2xl bg-indigo-500/10 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-400">
              {isNew ? <PlusCircle className="w-6 h-6" /> : <Edit3 className="w-6 h-6" />}
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                {isNew ? 'Add Equipment Item' : `Edit Item #${rowToEdit.slno}`}
              </h2>
              <p className="text-xs text-slate-500">
                Equipment specifications and calibration schedule
              </p>
            </div>
          </div>

          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-4 text-xs">
          {/* Description */}
          <div className="space-y-1">
            <label className="block font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
              Equipment Description *
            </label>
            <input
              type="text"
              required
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Battery impendence tester / Clamp meter"
              className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm text-slate-900 dark:text-white"
            />
          </div>

          {/* Make & Model */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="block font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                Make (Manufacturer)
              </label>
              <input
                type="text"
                value={make}
                onChange={(e) => setMake(e.target.value)}
                placeholder="Fluke, Megger, Seaward..."
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
              />
            </div>
            <div className="space-y-1">
              <label className="block font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                Model
              </label>
              <input
                type="text"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder="e.g. 87V, 376, Bite 2P..."
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
              />
            </div>
          </div>

          {/* Serial No & Type */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="block font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                Serial No
              </label>
              <input
                type="text"
                value={serialNo}
                onChange={(e) => setSerialNo(e.target.value)}
                placeholder="e.g. 97990591"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-mono"
              />
            </div>
            <div className="space-y-1">
              <label className="block font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                Personal / Common
              </label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-medium"
              >
                <option value="Personal">Personal</option>
                <option value="common">Common</option>
              </select>
            </div>
          </div>

          {/* Condition & Location */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="block font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                Condition
              </label>
              <select
                value={condition}
                onChange={(e) => setCondition(e.target.value as EquipmentCondition)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-semibold"
              >
                <option value="Good">Good</option>
                <option value="Under Repair">Under Repair</option>
                <option value="spare / Emergency">spare / Emergency</option>
                <option value="Faulty">Faulty (Triggers Alert)</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="block font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                Location / Individual
              </label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g. AD-12, Neelakandan, Gopal"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
              />
            </div>
          </div>

          {/* Calibration Due Date & Due Days */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="block font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                Calibration Due Date
              </label>
              <input
                type="text"
                value={calibrationDueDate}
                onChange={(e) => setCalibrationDueDate(e.target.value)}
                placeholder="e.g. 10-Mar-2027"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-mono"
              />
            </div>

            <div className="space-y-1">
              <label className="block font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                Due Days (Negative = Overdue)
              </label>
              <input
                type="text"
                value={dueDays}
                onChange={(e) => setDueDays(e.target.value)}
                placeholder="e.g. 155 or -47"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-mono"
              />
              {isDueNegative && (
                <span className="text-[11px] text-rose-600 dark:text-rose-400 font-bold flex items-center gap-1 mt-1">
                  <AlertTriangle className="w-3 h-3" /> Calibration Overdue ({dueDays} days)!
                </span>
              )}
            </div>
          </div>

          {/* Remarks */}
          <div className="space-y-1">
            <label className="block font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
              Remarks &amp; Audit Notes
            </label>
            <textarea
              rows={3}
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="e.g. Due for calibration/sent to Haris Al Afaq on 20-08-2026..."
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl resize-none"
            />
          </div>

          {/* Footer Submit */}
          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-slate-500 font-semibold hover:text-slate-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl shadow-xs"
            >
              {isNew ? 'Save & Queue in IndexedDB' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
