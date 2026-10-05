import * as XLSX from 'xlsx';
import { SheetRow, EquipmentCondition } from '../types/sheet';

export class ExcelService {
  /**
   * Parse an uploaded Excel or CSV file
   */
  public static async parseExcelFile(file: File): Promise<SheetRow[]> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = (e) => {
        try {
          const buffer = e.target?.result;
          const workbook = XLSX.read(buffer, { type: 'binary', cellDates: true });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];

          const rawJson: any[] = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

          if (!rawJson || rawJson.length === 0) {
            throw new Error('Spreadsheet appears to be empty or has no data rows.');
          }

          const parsedRows: SheetRow[] = rawJson.map((row, index) => {
            const getVal = (...keys: string[]) => {
              for (const k of keys) {
                if (row[k] !== undefined && row[k] !== '') return row[k];
                for (const rowKey of Object.keys(row)) {
                  if (rowKey.toLowerCase().replace(/[^a-z0-9]/g, '') === k.toLowerCase().replace(/[^a-z0-9]/g, '')) {
                    return row[rowKey];
                  }
                }
              }
              return '';
            };

            const slno = Number(getVal('slno', 'SLNO', '#')) || (index + 1);
            const description = String(getVal('description', 'Description', 'Item', 'Name', 'Task Name') || `Equipment #${index + 1}`);
            const make = String(getVal('make', 'Make', 'Brand') || 'Fluke');
            const model = String(getVal('model', 'Model') || '');
            const serialNo = String(getVal('serialNo', 'Serial No', 'Serial', 'S/N') || '');
            const type = String(getVal('type', 'Personal /Common', 'Personal/Common') || 'common');
            const condition = String(getVal('condition', 'Condition', 'Status') || 'Good');
            const location = String(getVal('location', 'Location/Individual', 'Location') || 'AD-12');
            const calibrationDueDate = String(getVal('calibrationDueDate', 'Calibration due date', 'Due Date') || '');
            const remarks = String(getVal('remarks', 'Remarks', 'Notes') || '');
            const dueDays = getVal('dueDays', 'Due days', 'Days') || 0;

            return {
              id: 'item_' + Date.now() + '_' + (index + 1),
              slno,
              description,
              make,
              model,
              serialNo,
              type,
              condition: (condition as EquipmentCondition) || 'Good',
              location,
              calibrationDueDate,
              remarks,
              dueDays,
              lastModified: new Date().toISOString(),
              lastModifiedBy: 'Excel Import',
              version: 1,
              syncStatus: 'pending',
            };
          });

          resolve(parsedRows);
        } catch (err) {
          reject(err);
        }
      };

      reader.onerror = (err) => reject(err);
      reader.readAsBinaryString(file);
    });
  }

  /**
   * Export equipment rows to formatted Excel (.xlsx)
   */
  public static exportToExcel(rows: SheetRow[], filename: string = 'Equipment_Calibration_Tracker.xlsx') {
    const formattedData = rows.map((r) => ({
      'SLNO': r.slno,
      'Description': r.description,
      'Make': r.make,
      'Model': r.model,
      'Serial No': r.serialNo,
      'Personal /Common': r.type,
      'condition': r.condition,
      'Location/Individual': r.location,
      'Calibration due date': r.calibrationDueDate,
      'Remarks': r.remarks,
      'Due days': r.dueDays,
      'Version': r.version,
      'Last Modified': r.lastModified,
    }));

    const worksheet = XLSX.utils.json_to_sheet(formattedData);

    const colWidths = [
      { wch: 8 },  // SLNO
      { wch: 35 }, // Description
      { wch: 15 }, // Make
      { wch: 18 }, // Model
      { wch: 18 }, // Serial No
      { wch: 16 }, // Personal /Common
      { wch: 16 }, // condition
      { wch: 22 }, // Location/Individual
      { wch: 20 }, // Calibration due date
      { wch: 45 }, // Remarks
      { wch: 12 }, // Due days
      { wch: 10 }, // Version
      { wch: 22 }, // Last Modified
    ];
    worksheet['!cols'] = colWidths;

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Equipment Master');
    XLSX.writeFile(workbook, filename);
  }

  /**
   * Export to CSV
   */
  public static exportToCsv(rows: SheetRow[], filename: string = 'Equipment_Calibration_Tracker.csv') {
    const formattedData = rows.map((r) => ({
      'SLNO': r.slno,
      'Description': r.description,
      'Make': r.make,
      'Model': r.model,
      'Serial No': r.serialNo,
      'Personal /Common': r.type,
      'condition': r.condition,
      'Location/Individual': r.location,
      'Calibration due date': r.calibrationDueDate,
      'Remarks': r.remarks,
      'Due days': r.dueDays,
    }));

    const worksheet = XLSX.utils.json_to_sheet(formattedData);
    const csvContent = XLSX.utils.sheet_to_csv(worksheet);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  /**
   * Export to JSON backup
   */
  public static exportToJson(rows: SheetRow[], filename: string = 'Equipment_CloudBackup.json') {
    const jsonStr = JSON.stringify(
      {
        exportedAt: new Date().toISOString(),
        version: '2.0',
        rowCount: rows.length,
        rows: rows,
      },
      null,
      2
    );
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}
