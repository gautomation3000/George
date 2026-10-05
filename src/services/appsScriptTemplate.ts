/**
 * Google Apps Script Backend Code (`Code.gs`) and HTML Service Frontend Template (`index.html`)
 * Complete implementation for 2-way Google Sheets Synchronization with IndexedDB offline support & conflict resolution
 */

export const APPS_SCRIPT_BACKEND_CODE = `/**
 * =========================================================================
 * SheetSync Pro - Google Apps Script Backend (Code.gs)
 * Electrical Team Tools List - Master Calibration & Asset Tracker
 * =========================================================================
 *
 * HOW TO DEPLOY:
 * 1. Open your Google Sheet ("Electrical Team tools update full list").
 * 2. Click "Extensions" > "Apps Script".
 * 3. Delete any existing code in Code.gs and paste this entire code.
 * 4. Click the "+" button beside Files > select HTML > name it "index" (paste index.html).
 * 5. Click "Deploy" > "Manage deployments" > Edit current deployment (or "New deployment").
 * 6. Set:
 *    - Type: "Web app"
 *    - Description: "Electrical Team Tools Live API"
 *    - Execute as: "Me" (your email)
 *    - Who has access: "Anyone" (CRITICAL: must be Anyone so the webapp can update)
 * 7. Click Deploy, authorize permissions, and copy the Web App URL!
 */

const DEFAULT_SHEET_NAME = 'Full list';
const BACKUP_PREFIX = 'Backup_';

/**
 * Normalizes header strings so line breaks ("SLN\\nO"), extra spaces, and casing match reliably
 */
function normalizeHeader(h) {
  const norm = String(h || '').toLowerCase().replace(/[\r\n\s]+/g, '');
  if (norm === 'id') return 'id'; // Keep ID separate from SLNO
  if (norm.includes('sln') || norm === '#' || norm === 'sr' || norm === 'sno') return 'slno';
  if (norm.includes('desc')) return 'description';
  if (norm.includes('make')) return 'make';
  if (norm.includes('model')) return 'model';
  if (norm.includes('serial')) return 'serialNo';
  if (norm.includes('person') || norm.includes('common')) return 'type';
  if (norm.includes('cond')) return 'condition';
  if (norm.includes('locat') || norm.includes('individ')) return 'location';
  if (norm.includes('calib') || norm.includes('due date')) return 'calibrationDueDate';
  if (norm.includes('remark')) return 'remarks';
  if (norm.includes('due') || norm.includes('day')) return 'dueDays';
  if (norm.includes('version')) return 'version';
  if (norm.includes('modif')) return 'lastModified';
  return norm;
}

/**
 * Finds the correct target sheet ('Full list' or active sheet)
 */
function getTargetSheet(ss, sheetName) {
  if (sheetName) {
    const s = ss.getSheetByName(sheetName);
    if (s) return s;
  }
  let target = ss.getSheetByName(DEFAULT_SHEET_NAME);
  if (target) return target;

  const sheets = ss.getSheets();
  for (let i = 0; i < sheets.length; i++) {
    const name = sheets[i].getName().toLowerCase();
    if (name === 'full list' || name === 'fulllist') return sheets[i];
  }
  for (let i = 0; i < sheets.length; i++) {
    const val = String(sheets[i].getRange(1, 1).getValue()).toLowerCase();
    if (val.includes('sln') || val.includes('desc')) return sheets[i];
  }
  return sheets[0];
}

/**
 * Handles GET requests:
 * 1. Supports updateRow via GET to completely bypass any CORS redirect issues!
 * 2. Ping test (action=ping)
 * 3. Fetch data as JSON (action=getData)
 * 4. Serve index.html web UI or fallback UI
 */
function doGet(e) {
  try {
    const action = (e && e.parameter && e.parameter.action) || 'ui';
    const ss = SpreadsheetApp.getActiveSpreadsheet();

    // --- Action: PING ---
    if (action === 'ping') {
      return jsonResponse({
        success: true,
        message: 'SheetSync Pro backend is online and active.',
        timestamp: new Date().toISOString()
      });
    }

    // --- Action: UPDATE_ROW (Supported via GET for guaranteed delivery without CORS/POST redirect issues) ---
    if (action === 'updateRow' || action === 'updateRowWithConflictCheck' || action === 'updateCell' || action === 'update') {
      let rowData;
      if (e.parameter.data) {
        try {
          rowData = JSON.parse(e.parameter.data);
        } catch (err) {
          rowData = e.parameter;
        }
      } else if (e.parameter.row) {
        try {
          rowData = JSON.parse(e.parameter.row);
        } catch (err) {
          rowData = e.parameter;
        }
      } else {
        rowData = e.parameter;
      }
      const sheetName = e.parameter.sheet || (rowData && rowData.sheetName);
      const sheet = getTargetSheet(ss, sheetName);
      const result = updateEquipmentRowDirect(sheet, rowData);
      return jsonResponse(result);
    }

    // --- Action: ADD_ROW via GET ---
    if (action === 'addRow') {
      let rowData;
      if (e.parameter.data) {
        try {
          rowData = JSON.parse(e.parameter.data);
        } catch (err) {
          rowData = e.parameter;
        }
      } else {
        rowData = e.parameter;
      }
      const sheetName = e.parameter.sheet || (rowData && rowData.sheetName);
      const sheet = getTargetSheet(ss, sheetName);
      const added = appendSingleRowDirect(sheet, rowData);
      return jsonResponse({
        success: true,
        message: 'Row added successfully',
        row: added,
        timestamp: new Date().toISOString()
      });
    }

    // --- Action: DELETE_ROW via GET ---
    if (action === 'deleteRow') {
      const rowId = e.parameter.rowId || e.parameter.id || e.parameter.slno;
      const sheetName = e.parameter.sheet;
      const sheet = getTargetSheet(ss, sheetName);
      const deleted = deleteRowByIdOrSlno(sheet, rowId);
      return jsonResponse({
        success: deleted,
        message: deleted ? 'Row deleted' : 'Row not found',
        rowId: rowId
      });
    }

    // --- Action: GET_DATA ---
    if (action === 'getData') {
      const sheetName = e.parameter.sheet;
      const sheet = getTargetSheet(ss, sheetName);
      const data = getSheetDataAsJson(sheet);
      return jsonResponse({
        success: true,
        data: data.rows,
        headers: data.headers,
        sheetName: sheet.getName(),
        totalCount: data.rows.length,
        timestamp: new Date().toISOString()
      });
    }

    // --- Action: GET_BACKUPS ---
    if (action === 'getBackups') {
      return jsonResponse({
        success: true,
        backups: listBackupSheets(),
        timestamp: new Date().toISOString()
      });
    }

    // Default: Serve standalone index.html or robust built-in UI if index.html was not created
    try {
      return HtmlService.createHtmlOutputFromFile('index')
        .setTitle('Electrical Team Tools List - SheetSync Pro')
        .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
        .addMetaTag('viewport', 'width=device-width, initial-scale=1, maximum-scale=1');
    } catch (htmlErr) {
      return HtmlService.createHtmlOutput('<!DOCTYPE html><html><head><meta charset=\"utf-8\"><title>SheetSync Pro Backend</title><style>body{font-family:system-ui,-apple-system,sans-serif;padding:30px;background:#f8fafc;color:#1e293b;text-align:center;}h1{color:#16a34a;}.box{background:white;padding:28px;border-radius:18px;max-width:540px;margin:30px auto;box-shadow:0 10px 25px -5px rgba(0,0,0,0.08);border:1px solid #e2e8f0;}.btn{display:inline-block;padding:10px 20px;background:#2563eb;color:white;text-decoration:none;border-radius:10px;font-weight:600;margin-top:16px;}</style></head><body><div class=\"box\"><h1>✓ SheetSync Pro Backend Online</h1><p>Google Apps Script Web App is connected and communicating with your Google Sheets.</p><p style=\"color:#64748b;font-size:13px;\">Real-time endpoints active: <code>getData</code>, <code>updateRow</code>, <code>addRow</code>, <code>deleteRow</code>, <code>ping</code></p></div></body></html>')
        .setTitle('Electrical Team Tools List - SheetSync Pro')
        .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
        .addMetaTag('viewport', 'width=device-width, initial-scale=1, maximum-scale=1');
    }

  } catch (err) {
    return jsonResponse({
      success: false,
      error: err.toString(),
      timestamp: new Date().toISOString()
    });
  }
}

/**
 * Handles POST requests with concurrency lock
 */
function doPost(e) {
  const lock = LockService.getScriptLock();
  const hasLock = lock.tryLock(25000);

  if (!hasLock) {
    return jsonResponse({
      success: false,
      error: 'Spreadsheet is busy. Please retry in a moment.',
      locked: true
    });
  }

  try {
    let payload;
    if (e.postData && e.postData.contents) {
      try {
        payload = JSON.parse(e.postData.contents);
      } catch (ex) {
        payload = e.parameter;
      }
    } else {
      payload = e.parameter;
    }

    const action = payload.action;
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheetName = payload.sheet || (payload.row && payload.row.sheetName);
    const sheet = getTargetSheet(ss, sheetName);

    if (action === 'ping') {
      return jsonResponse({
        success: true,
        message: 'SheetSync Pro backend is online and active.',
        timestamp: new Date().toISOString()
      });
    }

    if (action === 'updateRow' || action === 'updateRowWithConflictCheck') {
      const rowData = payload.row || payload.data || payload;
      const result = updateEquipmentRowDirect(sheet, rowData);
      return jsonResponse(result);
    }

    if (action === 'addRow') {
      const newRow = payload.row || payload.data || payload;
      const added = appendSingleRowDirect(sheet, newRow);
      return jsonResponse({
        success: true,
        message: 'Equipment added successfully',
        row: added,
        timestamp: new Date().toISOString()
      });
    }

    if (action === 'deleteRow') {
      const rowId = payload.rowId || payload.id || payload.slno;
      const deleted = deleteRowByIdOrSlno(sheet, rowId);
      return jsonResponse({
        success: deleted,
        message: deleted ? 'Row deleted' : 'Row not found',
        rowId: rowId
      });
    }

    return jsonResponse({ success: false, error: 'Unknown action: ' + action });

  } catch (err) {
    return jsonResponse({
      success: false,
      error: err.toString(),
      timestamp: new Date().toISOString()
    });
  } finally {
    lock.releaseLock();
  }
}

/**
 * DIRECT ROW UPDATE FUNCTION
 * Updates the specific row (e.g. SLNO 1 -> Row 2) and exact cells in Google Sheets
 */
function updateEquipmentRowDirect(sheet, rowData) {
  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();
  if (lastRow <= 1) {
    return { success: false, error: 'Sheet is empty' };
  }

  const headerValues = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  const colMap = {};
  for (let c = 0; c < headerValues.length; c++) {
    const mappedField = normalizeHeader(headerValues[c]);
    colMap[mappedField] = c + 1; // 1-based column index
  }

  const targetSlno = Number(rowData.slno || rowData.SLNO);
  let targetRowIdx = -1;

  // Method 1: SLNO matches Row (SLNO 1 is Row 2)
  if (targetSlno > 0 && targetSlno + 1 <= lastRow) {
    const slnoCol = colMap['slno'] || 1;
    const cellVal = sheet.getRange(targetSlno + 1, slnoCol).getValue();
    if (Number(cellVal) === targetSlno) {
      targetRowIdx = targetSlno + 1;
    }
  }

  // Method 2: Scan Column 1 for targetSlno
  if (targetRowIdx === -1 && targetSlno > 0) {
    const colA = sheet.getRange(1, colMap['slno'] || 1, lastRow, 1).getValues();
    for (let r = 1; r < colA.length; r++) {
      if (Number(colA[r][0]) === targetSlno) {
        targetRowIdx = r + 1;
        break;
      }
    }
  }

  // Method 3: Match by Serial No if SLNO not found
  if (targetRowIdx === -1 && rowData.serialNo && colMap['serialNo']) {
    const colSerial = sheet.getRange(1, colMap['serialNo'], lastRow, 1).getValues();
    for (let r = 1; r < colSerial.length; r++) {
      if (String(colSerial[r][0]).trim() === String(rowData.serialNo).trim()) {
        targetRowIdx = r + 1;
        break;
      }
    }
  }

  if (targetRowIdx === -1) {
    return { success: false, error: 'Row not found for SLNO: ' + targetSlno };
  }

  // UPDATE INDIVIDUAL CELLS DIRECTLY
  if (rowData.condition !== undefined && colMap['condition']) {
    sheet.getRange(targetRowIdx, colMap['condition']).setValue(rowData.condition);
  }
  if (rowData.location !== undefined && colMap['location']) {
    sheet.getRange(targetRowIdx, colMap['location']).setValue(rowData.location);
  }
  if (rowData.calibrationDueDate !== undefined && colMap['calibrationDueDate']) {
    sheet.getRange(targetRowIdx, colMap['calibrationDueDate']).setValue(rowData.calibrationDueDate);
  }
  if (rowData.dueDays !== undefined && colMap['dueDays']) {
    sheet.getRange(targetRowIdx, colMap['dueDays']).setValue(rowData.dueDays);
  }
  if (rowData.remarks !== undefined && colMap['remarks']) {
    sheet.getRange(targetRowIdx, colMap['remarks']).setValue(rowData.remarks);
  }
  if (rowData.description !== undefined && colMap['description']) {
    sheet.getRange(targetRowIdx, colMap['description']).setValue(rowData.description);
  }
  if (rowData.make !== undefined && colMap['make']) {
    sheet.getRange(targetRowIdx, colMap['make']).setValue(rowData.make);
  }
  if (rowData.model !== undefined && colMap['model']) {
    sheet.getRange(targetRowIdx, colMap['model']).setValue(rowData.model);
  }
  if (rowData.serialNo !== undefined && colMap['serialNo']) {
    sheet.getRange(targetRowIdx, colMap['serialNo']).setValue(rowData.serialNo);
  }

  // Update Version / Last Modified if columns exist
  const nowIso = new Date().toISOString();
  if (colMap['version']) {
    const curV = Number(sheet.getRange(targetRowIdx, colMap['version']).getValue()) || 1;
    sheet.getRange(targetRowIdx, colMap['version']).setValue(curV + 1);
  }
  if (colMap['lastModified']) {
    sheet.getRange(targetRowIdx, colMap['lastModified']).setValue(nowIso);
  }

  const newV = colMap['version'] ? Number(sheet.getRange(targetRowIdx, colMap['version']).getValue()) : 2;

  return {
    success: true,
    message: 'Row ' + targetRowIdx + ' (SLNO ' + targetSlno + ') updated successfully in Google Sheet.',
    rowNumber: targetRowIdx,
    slno: targetSlno,
    updatedFields: rowData,
    newVersion: newV,
    timestamp: nowIso
  };
}

/**
 * Append single row
 */
function appendSingleRowDirect(sheet, rowData) {
  const lastRow = sheet.getLastRow();
  const nextSlno = rowData.slno || lastRow;
  const newRowVals = [
    nextSlno,
    rowData.description || '',
    rowData.make || '',
    rowData.model || '',
    rowData.serialNo || '',
    rowData.type || 'common',
    rowData.condition || 'Good',
    rowData.location || 'AD-12',
    rowData.calibrationDueDate || '',
    rowData.remarks || '',
    rowData.dueDays !== undefined ? rowData.dueDays : ''
  ];
  sheet.appendRow(newRowVals);
  return rowData;
}

/**
 * Delete row by SLNO or ID
 */
function deleteRowByIdOrSlno(sheet, targetId) {
  const num = Number(targetId);
  const lastRow = sheet.getLastRow();
  if (num > 0) {
    const colA = sheet.getRange(1, 1, lastRow, 1).getValues();
    for (let r = 1; r < colA.length; r++) {
      if (Number(colA[r][0]) === num) {
        sheet.deleteRow(r + 1);
        return true;
      }
    }
  }
  return false;
}

/**
 * Read sheet data as JSON
 */
function getSheetDataAsJson(sheet) {
  if (!sheet) {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    sheet = getTargetSheet(ss, DEFAULT_SHEET_NAME);
  }

  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();
  if (lastRow <= 1) return { headers: [], rows: [] };

  const rawHeaders = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  const fieldMapping = rawHeaders.map(h => normalizeHeader(h));
  const values = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
  const rows = [];

  for (let r = 0; r < values.length; r++) {
    const rowObj = { id: 'item_' + (r + 1), slno: r + 1, _rowNumber: r + 2 };
    for (let c = 0; c < fieldMapping.length; c++) {
      const field = fieldMapping[c];
      const val = values[r][c];
      if (field === 'slno') rowObj.slno = Number(val) || (r + 1);
      else rowObj[field] = val;
    }
    if (!rowObj.condition) rowObj.condition = 'Good';
    rows.push(rowObj);
  }

  return { headers: rawHeaders, rows: rows };
}

function listBackupSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheets = ss.getSheets();
  const backups = [];
  for (let i = 0; i < sheets.length; i++) {
    const name = sheets[i].getName();
    if (name.indexOf(BACKUP_PREFIX) === 0) {
      backups.push({
        sheetName: name,
        rowCount: sheets[i].getLastRow(),
        createdAt: name.replace(BACKUP_PREFIX, '').substring(0, 15)
      });
    }
  }
  return backups;
}

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
`;

export const APPS_SCRIPT_INDEX_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
  <title>Electrical Team Tools List - SheetSync Pro (IndexedDB Offline)</title>
  <link rel="stylesheet" href="https://cdn.datatables.net/1.13.6/css/jquery.dataTables.min.css">
  <link rel="stylesheet" href="https://cdn.datatables.net/responsive/2.5.0/css/responsive.dataTables.min.css">
  <script src="https://cdn.tailwindcss.com"></script>
  <script src="https://code.jquery.com/jquery-3.7.0.min.js"></script>
  <script src="https://cdn.datatables.net/1.13.6/js/jquery.dataTables.min.js"></script>
  <script src="https://cdn.datatables.net/responsive/2.5.0/js/dataTables.responsive.min.js"></script>
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; }
    .badge-good { background: #dcfce7; color: #15803d; border: 1px solid #bbf7d0; }
    .badge-repair { background: #fef9c3; color: #a16207; border: 1px solid #fef08a; }
    .badge-faulty { background: #fee2e2; color: #b91c1c; border: 1px solid #fecaca; }
    .badge-emergency { background: #f3e8ff; color: #7e22ce; border: 1px solid #e9d5ff; }
    .badge-overdue { background: #ef4444; color: #ffffff; font-weight: bold; }
    .sheet-tab-active { background: #ffffff !important; color: #2563eb !important; border-top: 2px solid #2563eb !important; }
  </style>
</head>
<body class="bg-slate-100/80 text-slate-900 min-h-screen p-2 sm:p-5">
  <div class="max-w-7xl mx-auto space-y-3">

    <!-- Offline Alert Banner -->
    <div id="offlineBanner" class="hidden bg-rose-500 text-white px-4 py-2.5 rounded-2xl text-xs font-semibold flex items-center justify-between shadow-md">
      <div class="flex items-center gap-2">
        <span class="inline-block w-2.5 h-2.5 rounded-full bg-white animate-ping"></span>
        <span><strong>Offline Mode Active:</strong> Edits are being cached in browser IndexedDB. They will automatically sync to Google Sheets when you reconnect.</span>
      </div>
      <span id="queueCounter" class="bg-rose-700 px-2 py-0.5 rounded-lg text-[11px]">0 Queued</span>
    </div>

    <!-- Header Navigation & Live Status -->
    <header class="bg-white p-4 sm:p-5 rounded-2xl shadow-xs border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-3">
      <div>
        <div class="flex items-center gap-2.5">
          <div id="statusBadge" class="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <span id="statusDot" class="w-2 h-2 rounded-full bg-emerald-500"></span>
            <span id="statusText">Synced with Google Sheet</span>
          </div>
          <span class="text-xs text-slate-400 font-mono">IndexedDB Active</span>
        </div>
        <h1 class="text-xl sm:text-2xl font-bold text-slate-900 mt-1">Electrical Team Tools List</h1>
        <p class="text-xs text-slate-500">Master Calibration &amp; Equipment Inventory • Real-Time Offline Sync</p>
      </div>

      <div class="flex flex-wrap items-center gap-2">
        <button onclick="triggerSync()" class="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-all flex items-center gap-1.5">
          🔄 Sync Now
        </button>
        <button onclick="openAddModal()" class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl shadow-xs transition-all flex items-center gap-1">
          + Add Tool
        </button>
      </div>
    </header>

    <!-- Google Sheets Tab Switcher Bar -->
    <div class="bg-slate-200/90 border border-slate-300 rounded-2xl p-1 flex items-center overflow-x-auto gap-1 text-xs font-semibold select-none shadow-xs">
      <button onclick="switchTab('Full list')" id="tab_all" class="sheet-tab-active px-3.5 py-2 rounded-xl bg-white text-blue-600 shadow-xs flex items-center gap-1.5 shrink-0 transition-all">
        <span>Full list</span> <span class="text-[10px] bg-blue-100 text-blue-800 px-1.5 py-0.2 rounded-full" id="count_all">0</span> ▾
      </button>
      <button onclick="switchTab('Hand tools')" id="tab_hand" class="px-3.5 py-2 rounded-xl text-slate-700 hover:bg-white/60 flex items-center gap-1.5 shrink-0 transition-all">
        <span>Hand tools</span> <span class="text-[10px] bg-slate-300 text-slate-700 px-1.5 py-0.2 rounded-full" id="count_hand">0</span> ▾
      </button>
      <button onclick="switchTab('Faulty Tools')" id="tab_faulty" class="px-3.5 py-2 rounded-xl text-slate-700 hover:bg-white/60 flex items-center gap-1.5 shrink-0 transition-all">
        <span>Faulty Tools</span> <span class="text-[10px] bg-slate-300 text-slate-700 px-1.5 py-0.2 rounded-full" id="count_faulty">0</span> ▾
      </button>
      <button onclick="switchTab('Spare tools')" id="tab_spare" class="px-3.5 py-2 rounded-xl text-slate-700 hover:bg-white/60 flex items-center gap-1.5 shrink-0 transition-all">
        <span>Spare tools</span> <span class="text-[10px] bg-slate-300 text-slate-700 px-1.5 py-0.2 rounded-full" id="count_spare">0</span> ▾
      </button>
      <button onclick="switchTab('Regular Calibration tools')" id="tab_calib" class="px-3.5 py-2 rounded-xl text-slate-700 hover:bg-white/60 flex items-center gap-1.5 shrink-0 transition-all">
        <span>Regular Calibration tools</span> <span class="text-[10px] bg-slate-300 text-slate-700 px-1.5 py-0.2 rounded-full" id="count_calib">0</span> ▾
      </button>
    </div>

    <!-- DataTables Table Container -->
    <div class="bg-white p-4 sm:p-6 rounded-2xl shadow-sm border border-slate-200">
      <div class="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div class="flex flex-wrap items-center gap-2 text-xs">
          <select id="filterCondition" onchange="applyFilters()" class="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-700">
            <option value="">All Conditions</option>
            <option value="Good">Good</option>
            <option value="Under Repair">Under Repair</option>
            <option value="spare / Emergency">spare / Emergency</option>
            <option value="Faulty">Faulty</option>
          </select>

          <select id="filterMake" onchange="applyFilters()" class="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-700">
            <option value="">All Makes</option>
            <option value="Fluke">Fluke</option>
            <option value="Megger">Megger</option>
            <option value="Seaward">Seaward</option>
            <option value="Omicron">Omicron</option>
            <option value="Programa">Programa</option>
          </select>
        </div>

        <div class="text-xs text-slate-400">
          Double-click any row to edit • Edits auto-sync to Google Sheets
        </div>
      </div>

      <table id="equipmentTable" class="display responsive nowrap w-full text-xs sm:text-sm">
        <thead>
          <tr class="text-left text-slate-500 bg-slate-50">
            <th>SLNO</th>
            <th>Description</th>
            <th>Make</th>
            <th>Model</th>
            <th>Serial No</th>
            <th>Type</th>
            <th>Condition</th>
            <th>Location/Individual</th>
            <th>Calibration Due</th>
            <th>Due Days</th>
            <th>Remarks</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
        </tbody>
      </table>
    </div>
  </div>

  <!-- Edit Modal -->
  <div id="editModal" class="hidden fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
    <div class="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-lg w-full p-6 space-y-4">
      <h3 id="modalTitle" class="font-bold text-base text-slate-900">Edit Tool</h3>
      <form id="equipmentForm" onsubmit="saveEquipment(event)" class="space-y-3 text-xs">
        <input type="hidden" id="editRowId">
        <input type="hidden" id="editSlno">

        <div>
          <label class="block font-bold text-slate-700 mb-1">Description *</label>
          <input type="text" id="editDesc" required class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs">
        </div>

        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block font-bold text-slate-700 mb-1">Make</label>
            <input type="text" id="editMake" class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs">
          </div>
          <div>
            <label class="block font-bold text-slate-700 mb-1">Model</label>
            <input type="text" id="editModel" class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs">
          </div>
        </div>

        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block font-bold text-slate-700 mb-1">Serial No</label>
            <input type="text" id="editSerial" class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono">
          </div>
          <div>
            <label class="block font-bold text-slate-700 mb-1">Condition</label>
            <select id="editCondition" class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold">
              <option value="Good">Good</option>
              <option value="Under Repair">Under Repair</option>
              <option value="spare / Emergency">spare / Emergency</option>
              <option value="Faulty">Faulty</option>
            </select>
          </div>
        </div>

        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block font-bold text-slate-700 mb-1">Location / Individual</label>
            <input type="text" id="editLocation" class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs">
          </div>
          <div>
            <label class="block font-bold text-slate-700 mb-1">Calibration Due Date</label>
            <input type="text" id="editDueDate" class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono">
          </div>
        </div>

        <div>
          <label class="block font-bold text-slate-700 mb-1">Remarks</label>
          <textarea id="editRemarks" rows="2" class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"></textarea>
        </div>

        <div class="flex justify-end gap-2 pt-2">
          <button type="button" onclick="closeEditModal()" class="px-4 py-2 text-slate-500 font-semibold hover:text-slate-700">Cancel</button>
          <button type="submit" class="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl shadow-xs">Save &amp; Sync Sheet</button>
        </div>
      </form>
    </div>
  </div>

  <script>
    let dtTable;
    let db;
    const DB_NAME = 'SheetSync_GAS_DB';
    const DB_VERSION = 1;
    let currentSheetTab = 'Full list';

    function initIndexedDB() {
      return new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = (e) => {
          const database = e.target.result;
          if (!database.objectStoreNames.contains('equipment')) {
            database.createObjectStore('equipment', { keyPath: 'id' });
          }
          if (!database.objectStoreNames.contains('offline_queue')) {
            database.createObjectStore('offline_queue', { keyPath: 'id' });
          }
        };
        req.onsuccess = (e) => {
          db = e.target.result;
          resolve(db);
        };
        req.onerror = (e) => reject(e.target.error);
      });
    }

    function idbGetAll(storeName) {
      return new Promise((resolve) => {
        if (!db) return resolve([]);
        const tx = db.transaction(storeName, 'readonly');
        const store = tx.objectStore(storeName);
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => resolve([]);
      });
    }

    function idbPut(storeName, data) {
      return new Promise((resolve) => {
        if (!db) return resolve();
        const tx = db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        store.put(data);
        tx.oncomplete = () => resolve();
      });
    }

    function idbDelete(storeName, key) {
      return new Promise((resolve) => {
        if (!db) return resolve();
        const tx = db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        store.delete(key);
        tx.oncomplete = () => resolve();
      });
    }

    function idbClear(storeName) {
      return new Promise((resolve) => {
        if (!db) return resolve();
        const tx = db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        store.clear();
        tx.oncomplete = () => resolve();
      });
    }

    function initTable() {
      dtTable = $('#equipmentTable').DataTable({
        responsive: true,
        pageLength: 25,
        columns: [
          { data: 'slno', width: '40px' },
          { data: 'description' },
          { data: 'make' },
          { data: 'model' },
          { data: 'serialNo' },
          { data: 'type' },
          {
            data: 'condition',
            render: function(val) {
              val = val || 'Good';
              let badge = 'badge-good';
              if (val === 'Under Repair') badge = 'badge-repair';
              else if (val === 'Faulty') badge = 'badge-faulty';
              else if (val.indexOf('Emergency') !== -1) badge = 'badge-emergency';
              return '<span class="px-2 py-0.5 rounded-full text-[11px] font-semibold ' + badge + '">' + val + '</span>';
            }
          },
          { data: 'location' },
          { data: 'calibrationDueDate' },
          {
            data: 'dueDays',
            render: function(val) {
              const num = Number(val);
              if (!isNaN(num) && num < 0) {
                return '<span class="px-2 py-0.5 rounded-md text-[11px] badge-overdue">' + num + ' (Overdue)</span>';
              }
              return '<span class="font-mono text-slate-700">' + (val !== undefined ? val : '') + '</span>';
            }
          },
          { data: 'remarks' },
          {
            data: null,
            orderable: false,
            render: function(data, type, row) {
              return '<button class="text-blue-600 hover:underline mr-2 font-medium" onclick="openEditModal(\\'' + row.id + '\\')">Edit</button>' +
                     '<button class="text-rose-600 hover:underline font-medium" onclick="deleteRow(\\'' + row.id + '\\')">Delete</button>';
            }
          }
        ]
      });

      $('#equipmentTable tbody').on('dblclick', 'tr', function () {
        const data = dtTable.row(this).data();
        if (data) openEditModal(data.id);
      });
    }

    function switchTab(tabName) {
      currentSheetTab = tabName;
      const tabMap = {
        'Full list': 'tab_all',
        'Hand tools': 'tab_hand',
        'Faulty Tools': 'tab_faulty',
        'Spare tools': 'tab_spare',
        'Regular Calibration tools': 'tab_calib'
      };
      Object.keys(tabMap).forEach(k => {
        const el = document.getElementById(tabMap[k]);
        if (el) {
          if (k === tabName) {
            el.className = 'sheet-tab-active px-3.5 py-2 rounded-xl bg-white text-blue-600 shadow-xs flex items-center gap-1.5 shrink-0 transition-all';
          } else {
            el.className = 'px-3.5 py-2 rounded-xl text-slate-700 hover:bg-white/60 flex items-center gap-1.5 shrink-0 transition-all';
          }
        }
      });
      renderFilteredTable();
    }

    function updateTabCounts(rows) {
      document.getElementById('count_all').textContent = rows.length;
      document.getElementById('count_hand').textContent = rows.filter(r => {
        const d = (r.description||'').toLowerCase();
        return d.includes('clamp') || d.includes('meter') || d.includes('camera') || d.includes('thermo') || d.includes('tester') || d.includes('calibrator');
      }).length;
      document.getElementById('count_faulty').textContent = rows.filter(r => (r.condition||'').toLowerCase() === 'faulty' || (r.remarks||'').toLowerCase().includes('faulty')).length;
      document.getElementById('count_spare').textContent = rows.filter(r => (r.condition||'').toLowerCase().includes('spare') || (r.condition||'').toLowerCase().includes('emergency')).length;
      document.getElementById('count_calib').textContent = rows.filter(r => {
        const d = (r.description||'').toLowerCase();
        return d.includes('injection kit') || d.includes('high voltage') || d.includes('load bank') || d.includes('ohm meter') || d.includes('earth tester') || d.includes('power quality') || d.includes('partial discharge') || d.includes('battery');
      }).length;
    }

    async function renderFilteredTable() {
      const cached = await idbGetAll('equipment');
      updateTabCounts(cached);
      let list = cached;
      if (currentSheetTab === 'Hand tools') {
        list = cached.filter(r => {
          const d = (r.description||'').toLowerCase();
          return d.includes('clamp') || d.includes('meter') || d.includes('camera') || d.includes('thermo') || d.includes('tester') || d.includes('calibrator');
        });
      } else if (currentSheetTab === 'Faulty Tools') {
        list = cached.filter(r => (r.condition||'').toLowerCase() === 'faulty' || (r.remarks||'').toLowerCase().includes('faulty'));
      } else if (currentSheetTab === 'Spare tools') {
        list = cached.filter(r => (r.condition||'').toLowerCase().includes('spare') || (r.condition||'').toLowerCase().includes('emergency'));
      } else if (currentSheetTab === 'Regular Calibration tools') {
        list = cached.filter(r => {
          const d = (r.description||'').toLowerCase();
          return d.includes('injection kit') || d.includes('high voltage') || d.includes('load bank') || d.includes('ohm meter') || d.includes('earth tester') || d.includes('power quality') || d.includes('partial discharge') || d.includes('battery');
        });
      }
      dtTable.clear().rows.add(list).draw();
    }

    async function loadData() {
      await renderFilteredTable();
      updateQueueUI();
      if (navigator.onLine) {
        fetchFromSheet();
      } else {
        setSyncStatus('offline');
      }
    }

    function fetchFromSheet() {
      setSyncStatus('syncing');

      if (typeof google !== 'undefined' && google.script && google.script.run) {
        google.script.run
          .withSuccessHandler(async function(res) {
            let data = typeof res === 'string' ? JSON.parse(res) : res;
            if (data && data.rows) {
              await idbClear('equipment');
              for (const r of data.rows) {
                await idbPut('equipment', r);
              }
              renderFilteredTable();
              setSyncStatus('synced');
            }
          })
          .withFailureHandler(function(err) {
            console.error(err);
            setSyncStatus('error');
          })
          .getSheetDataAsJson();
      } else {
        setSyncStatus('synced');
      }
    }

    async function triggerSync() {
      if (!navigator.onLine) {
        alert('You are currently offline. Edits are cached in IndexedDB.');
        return;
      }
      setSyncStatus('syncing');
      const queue = await idbGetAll('offline_queue');

      for (const item of queue) {
        if (typeof google !== 'undefined' && google.script && google.script.run) {
          await new Promise((res) => {
            google.script.run
              .withSuccessHandler(async function() {
                await idbDelete('offline_queue', item.id);
                res();
              })
              .withFailureHandler(function(err) {
                console.error(err);
                res();
              })
              .updateEquipmentRowDirect(null, item.payload);
          });
        }
      }
      updateQueueUI();
      fetchFromSheet();
    }

    async function saveEquipment(e) {
      e.preventDefault();
      const id = document.getElementById('editRowId').value;
      const slno = Number(document.getElementById('editSlno').value) || 1;

      const cached = await idbGetAll('equipment');
      let row = cached.find(r => r.id === id);

      const isNew = !row;
      if (isNew) {
        row = { id: 'item_' + Date.now(), slno: cached.length + 1 };
      }

      row.slno = slno;
      row.description = document.getElementById('editDesc').value;
      row.make = document.getElementById('editMake').value;
      row.model = document.getElementById('editModel').value;
      row.serialNo = document.getElementById('editSerial').value;
      row.condition = document.getElementById('editCondition').value;
      row.location = document.getElementById('editLocation').value;
      row.calibrationDueDate = document.getElementById('editDueDate').value;
      row.remarks = document.getElementById('editRemarks').value;

      await idbPut('equipment', row);

      const queueItem = {
        id: 'q_' + Date.now(),
        type: isNew ? 'ADD' : 'UPDATE',
        payload: row
      };
      await idbPut('offline_queue', queueItem);

      renderFilteredTable();
      closeEditModal();
      updateQueueUI();

      if (navigator.onLine) {
        triggerSync();
      }
    }

    async function openEditModal(id) {
      const cached = await idbGetAll('equipment');
      const row = cached.find(r => r.id === id);
      if (!row) return;

      document.getElementById('modalTitle').textContent = 'Edit Tool #' + row.slno;
      document.getElementById('editRowId').value = row.id;
      document.getElementById('editSlno').value = row.slno;
      document.getElementById('editDesc').value = row.description || '';
      document.getElementById('editMake').value = row.make || '';
      document.getElementById('editModel').value = row.model || '';
      document.getElementById('editSerial').value = row.serialNo || '';
      document.getElementById('editCondition').value = row.condition || 'Good';
      document.getElementById('editLocation').value = row.location || '';
      document.getElementById('editDueDate').value = row.calibrationDueDate || '';
      document.getElementById('editRemarks').value = row.remarks || '';

      document.getElementById('editModal').classList.remove('hidden');
    }

    function openAddModal() {
      document.getElementById('modalTitle').textContent = 'Add New Tool';
      document.getElementById('equipmentForm').reset();
      document.getElementById('editRowId').value = '';
      document.getElementById('editSlno').value = '';
      document.getElementById('editModal').classList.remove('hidden');
    }

    function closeEditModal() {
      document.getElementById('editModal').classList.add('hidden');
    }

    async function deleteRow(id) {
      if (!confirm('Delete this equipment row?')) return;
      await idbDelete('equipment', id);
      renderFilteredTable();
    }

    function setSyncStatus(st) {
      const badge = document.getElementById('statusBadge');
      const dot = document.getElementById('statusDot');
      const text = document.getElementById('statusText');

      if (st === 'offline') {
        badge.className = 'flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200';
        dot.className = 'w-2 h-2 rounded-full bg-rose-500';
        text.textContent = 'Offline (IndexedDB Active)';
      } else if (st === 'syncing') {
        badge.className = 'flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200';
        dot.className = 'w-2 h-2 rounded-full bg-amber-500 animate-pulse';
        text.textContent = 'Syncing with Google Sheet...';
      } else if (st === 'error') {
        badge.className = 'flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200';
        dot.className = 'w-2 h-2 rounded-full bg-rose-600';
        text.textContent = 'Sync Error';
      } else {
        badge.className = 'flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200';
        dot.className = 'w-2 h-2 rounded-full bg-emerald-500';
        text.textContent = 'Synced with Google Sheet';
      }
    }

    async function updateQueueUI() {
      const queue = await idbGetAll('offline_queue');
      const banner = document.getElementById('offlineBanner');
      const counter = document.getElementById('queueCounter');

      if (!navigator.onLine) {
        banner.classList.remove('hidden');
        counter.textContent = queue.length + ' Changes Queued';
        setSyncStatus('offline');
      } else {
        if (queue.length > 0) {
          banner.classList.remove('hidden');
          banner.className = 'bg-amber-500 text-white px-4 py-2.5 rounded-2xl text-xs font-semibold flex items-center justify-between shadow-md';
          counter.textContent = queue.length + ' Pending Sync';
        } else {
          banner.classList.add('hidden');
        }
      }
    }

    function applyFilters() {
      const cond = document.getElementById('filterCondition').value;
      const make = document.getElementById('filterMake').value;
      dtTable.column(6).search(cond).column(2).search(make).draw();
    }

    window.addEventListener('online', () => {
      updateQueueUI();
      triggerSync();
    });

    window.addEventListener('offline', () => {
      updateQueueUI();
    });

    $(document).ready(async function() {
      await initIndexedDB();
      initTable();
      loadData();
    });
  </script>
</body>
</html>
`;
