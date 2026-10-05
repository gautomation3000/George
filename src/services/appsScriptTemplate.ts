/**
 * Google Apps Script Backend Code (`Code.gs`) and HTML Service Frontend Template (`index.html`)
 * Complete implementation for 2-way Google Sheets Synchronization with IndexedDB offline support & conflict resolution
 */

export const APPS_SCRIPT_BACKEND_CODE = `/**
 * =========================================================================
 * SheetSync Pro - Google Apps Script Backend (Code.gs)
 * Equipment Calibration & Asset Tracker with Real-Time Two-Way Sync,
 * IndexedDB Offline Queue Processing, Concurrency Locks & Conflict Resolution
 * =========================================================================
 *
 * HOW TO DEPLOY:
 * 1. In your Google Sheet, click "Extensions" > "Apps Script".
 * 2. Delete any existing code in Code.gs and paste this entire code.
 * 3. In Apps Script, click the "+" icon beside "Files", select "HTML", name it "index" (creates index.html).
 * 4. Paste the companion index.html code into that file.
 * 5. Click "Deploy" > "New deployment" > Select type: "Web app".
 * 6. Set Description: "SheetSync Pro Realtime API & Offline Frontend".
 * 7. Execute as: "Me" (your email).
 * 8. Who has access: "Anyone" (allows direct access & API calls).
 * 9. Click "Deploy", authorize permissions, and copy the Web App URL!
 */

const SHEET_NAME = 'Sheet1'; // Change if your sheet tab has another name
const BACKUP_PREFIX = 'Backup_';

// Standard equipment headers matching your spreadsheet
const EXPECTED_HEADERS = [
  'SLNO',
  'Description',
  'Make',
  'Model',
  'Serial No',
  'Personal /Common',
  'condition',
  'Location/Individual',
  'Calibration due date',
  'Remarks',
  'Due days',
  'Version',
  'Last Modified',
  'ID'
];

/**
 * Serves GET requests or opens HTML Web UI
 */
function doGet(e) {
  try {
    const action = (e && e.parameter && e.parameter.action) || 'ui';

    if (action === 'ping') {
      return jsonResponse({
        success: true,
        message: 'SheetSync Pro backend is online and active.',
        timestamp: new Date().toISOString()
      });
    }

    if (action === 'getData') {
      const data = getSheetDataAsJson();
      return jsonResponse({
        success: true,
        data: data.rows,
        headers: data.headers,
        totalCount: data.rows.length,
        timestamp: new Date().toISOString()
      });
    }

    if (action === 'getBackups') {
      return jsonResponse({
        success: true,
        backups: listBackupSheets(),
        timestamp: new Date().toISOString()
      });
    }

    // Default: Serve standalone index.html with IndexedDB offline support
    return HtmlService.createHtmlOutputFromFile('index')
      .setTitle('SheetSync Pro - Equipment Calibration & Tracker')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
      .addMetaTag('viewport', 'width=device-width, initial-scale=1, maximum-scale=1');

  } catch (err) {
    return jsonResponse({
      success: false,
      error: err.toString(),
      timestamp: new Date().toISOString()
    });
  }
}

/**
 * Serves POST requests with Concurrency Lock & Conflict Resolution
 */
function doPost(e) {
  const lock = LockService.getScriptLock();
  const hasLock = lock.tryLock(30000); // 30-second lock to prevent race conditions

  if (!hasLock) {
    return jsonResponse({
      success: false,
      error: 'Spreadsheet is busy processing another transaction. Please retry.',
      locked: true
    });
  }

  try {
    let payload;
    if (e.postData && e.postData.contents) {
      payload = JSON.parse(e.postData.contents);
    } else {
      payload = e.parameter;
    }

    const action = payload.action;
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName(SHEET_NAME);
    if (!sheet) sheet = ss.getSheets()[0];

    // Ensure headers exist
    ensureSheetHeaders(sheet);

    // --- Action: UPDATE_ROW (with Conflict Detection) ---
    if (action === 'updateRow' || action === 'updateRowWithConflictCheck') {
      const rowData = payload.row;
      const baseVersion = Number(payload.baseVersion) || Number(rowData.version) || 1;
      const forceOverwrite = payload.forceOverwrite === true || payload.strategy === 'CLIENT_WINS';

      const updateResult = updateRowWithConflictCheck(sheet, rowData, baseVersion, forceOverwrite);
      return jsonResponse(updateResult);
    }

    // --- Action: ADD_ROW ---
    if (action === 'addRow') {
      const newRow = payload.row;
      const added = appendSingleRow(sheet, newRow);
      return jsonResponse({
        success: true,
        message: 'Equipment row added successfully',
        row: added,
        timestamp: new Date().toISOString()
      });
    }

    // --- Action: DELETE_ROW ---
    if (action === 'deleteRow') {
      const rowId = payload.rowId || payload.id;
      const deleted = deleteRowById(sheet, rowId);
      return jsonResponse({
        success: deleted,
        message: deleted ? 'Row deleted from sheet' : 'Row ID not found',
        rowId: rowId,
        timestamp: new Date().toISOString()
      });
    }

    // --- Action: BATCH_SYNC_OFFLINE_QUEUE ---
    if (action === 'batchSync' || action === 'batchSyncOfflineQueue') {
      const items = payload.queue || payload.rows || [];
      const results = processOfflineQueueBatch(sheet, items);
      return jsonResponse({
        success: true,
        results: results,
        timestamp: new Date().toISOString()
      });
    }

    // --- Action: CREATE_BACKUP ---
    if (action === 'createBackup') {
      const backupTitle = payload.title || 'Snapshot';
      const backupName = createSheetBackup(ss, sheet, backupTitle);
      return jsonResponse({
        success: true,
        backupSheetName: backupName,
        message: 'Cloud backup tab created: ' + backupName,
        timestamp: new Date().toISOString()
      });
    }

    // --- Action: RESTORE_BACKUP ---
    if (action === 'restoreBackup') {
      restoreSheetBackup(ss, payload.backupSheetName);
      return jsonResponse({
        success: true,
        message: 'Spreadsheet restored to ' + payload.backupSheetName,
        timestamp: new Date().toISOString()
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
 * Direct function for google.script.run in index.html
 */
function getSheetDataAsJson() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) sheet = ss.getSheets()[0];

  ensureSheetHeaders(sheet);

  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();

  if (lastRow <= 1) {
    return { headers: EXPECTED_HEADERS, rows: [] };
  }

  const values = sheet.getRange(1, 1, lastRow, lastCol).getValues();
  const headers = values[0].map(h => String(h).trim());
  const rows = [];

  for (let i = 1; i < values.length; i++) {
    const rowObj = { _rowNumber: i + 1 };
    for (let c = 0; c < headers.length; c++) {
      rowObj[headers[c]] = values[i][c];
    }
    // Normalize properties for frontend
    rowObj['id'] = rowObj['ID'] || rowObj['id'] || ('item_' + (rowObj['SLNO'] || i));
    rowObj['slno'] = Number(rowObj['SLNO']) || i;
    rowObj['description'] = rowObj['Description'] || '';
    rowObj['make'] = rowObj['Make'] || '';
    rowObj['model'] = rowObj['Model'] || '';
    rowObj['serialNo'] = rowObj['Serial No'] || '';
    rowObj['type'] = rowObj['Personal /Common'] || 'common';
    rowObj['condition'] = rowObj['condition'] || 'Good';
    rowObj['location'] = rowObj['Location/Individual'] || '';
    rowObj['calibrationDueDate'] = rowObj['Calibration due date'] || '';
    rowObj['remarks'] = rowObj['Remarks'] || '';
    rowObj['dueDays'] = rowObj['Due days'] !== undefined ? rowObj['Due days'] : '';
    rowObj['version'] = Number(rowObj['Version']) || 1;
    rowObj['lastModified'] = rowObj['Last Modified'] || new Date().toISOString();

    rows.push(rowObj);
  }

  return { headers: headers, rows: rows };
}

/**
 * Direct function for google.script.run from offline sync queue
 */
function syncOfflineItem(item) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) sheet = ss.getSheets()[0];

  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    if (item.type === 'UPDATE' || item.type === 'UPDATE_ROW') {
      return updateRowWithConflictCheck(sheet, item.payload, item.baseVersion, item.forceOverwrite);
    } else if (item.type === 'ADD' || item.type === 'ADD_ROW') {
      const added = appendSingleRow(sheet, item.payload);
      return { success: true, row: added };
    } else if (item.type === 'DELETE' || item.type === 'DELETE_ROW') {
      const deleted = deleteRowById(sheet, item.rowId || item.payload.id);
      return { success: deleted };
    }
    return { success: false, error: 'Unknown queue type' };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Updates a row with optimistic conflict checking
 */
function updateRowWithConflictCheck(sheet, rowData, baseVersion, forceOverwrite) {
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(h => String(h).trim());
  const idColIdx = headers.indexOf('ID');
  const slnoColIdx = headers.indexOf('SLNO');
  const versionColIdx = headers.indexOf('Version');
  const values = sheet.getDataRange().getValues();

  let targetRowIdx = -1;
  const targetId = String(rowData.id || rowData.ID || '');
  const targetSlno = Number(rowData.slno || rowData.SLNO);

  for (let r = 1; r < values.length; r++) {
    const rowId = idColIdx !== -1 ? String(values[r][idColIdx]) : '';
    const rowSlno = slnoColIdx !== -1 ? Number(values[r][slnoColIdx]) : -1;
    if ((targetId && rowId === targetId) || (targetSlno && rowSlno === targetSlno)) {
      targetRowIdx = r + 1; // 1-based row index
      break;
    }
  }

  if (targetRowIdx === -1) {
    // Row not found on server, append
    const added = appendSingleRow(sheet, rowData);
    return { success: true, message: 'Row not found on server, appended as new', row: added };
  }

  // Check Conflict: Server version vs Base version
  const currentServerVersion = versionColIdx !== -1 ? (Number(values[targetRowIdx - 1][versionColIdx]) || 1) : 1;

  if (!forceOverwrite && baseVersion && currentServerVersion > baseVersion) {
    // Conflict Detected! Server has a newer update
    const serverRowObj = {};
    for (let c = 0; c < headers.length; c++) {
      serverRowObj[headers[c]] = values[targetRowIdx - 1][c];
    }
    return {
      success: false,
      conflict: true,
      message: 'Conflict detected: Server has newer version (' + currentServerVersion + ' > ' + baseVersion + ').',
      serverRow: serverRowObj,
      clientRow: rowData,
      serverVersion: currentServerVersion,
      clientBaseVersion: baseVersion
    };
  }

  // Apply Update
  const newVersion = currentServerVersion + 1;
  const nowIso = new Date().toISOString();

  const newValues = headers.map(h => {
    if (h === 'Version') return newVersion;
    if (h === 'Last Modified') return nowIso;
    if (h === 'ID') return targetId || ('item_' + (rowData.slno || targetRowIdx));
    if (h === 'SLNO') return rowData.slno !== undefined ? rowData.slno : rowData.SLNO;
    if (h === 'Description') return rowData.description !== undefined ? rowData.description : rowData.Description;
    if (h === 'Make') return rowData.make !== undefined ? rowData.make : rowData.Make;
    if (h === 'Model') return rowData.model !== undefined ? rowData.model : rowData.Model;
    if (h === 'Serial No') return rowData.serialNo !== undefined ? rowData.serialNo : rowData['Serial No'];
    if (h === 'Personal /Common') return rowData.type !== undefined ? rowData.type : rowData['Personal /Common'];
    if (h === 'condition') return rowData.condition !== undefined ? rowData.condition : rowData.condition;
    if (h === 'Location/Individual') return rowData.location !== undefined ? rowData.location : rowData['Location/Individual'];
    if (h === 'Calibration due date') return rowData.calibrationDueDate !== undefined ? rowData.calibrationDueDate : rowData['Calibration due date'];
    if (h === 'Remarks') return rowData.remarks !== undefined ? rowData.remarks : rowData.Remarks;
    if (h === 'Due days') return rowData.dueDays !== undefined ? rowData.dueDays : rowData['Due days'];
    return rowData[h] !== undefined ? rowData[h] : '';
  });

  sheet.getRange(targetRowIdx, 1, 1, headers.length).setValues([newValues]);

  rowData.version = newVersion;
  rowData.lastModified = nowIso;
  return {
    success: true,
    message: 'Row updated successfully',
    row: rowData,
    newVersion: newVersion
  };
}

/**
 * Append single row
 */
function appendSingleRow(sheet, rowData) {
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(h => String(h).trim());
  const nowIso = new Date().toISOString();
  const nextSlno = sheet.getLastRow();

  const rowVals = headers.map(h => {
    if (h === 'SLNO') return rowData.slno || rowData.SLNO || nextSlno;
    if (h === 'Version') return 1;
    if (h === 'Last Modified') return nowIso;
    if (h === 'ID') return rowData.id || rowData.ID || ('item_' + nextSlno);
    if (h === 'Description') return rowData.description || rowData.Description || '';
    if (h === 'Make') return rowData.make || rowData.Make || '';
    if (h === 'Model') return rowData.model || rowData.Model || '';
    if (h === 'Serial No') return rowData.serialNo || rowData['Serial No'] || '';
    if (h === 'Personal /Common') return rowData.type || rowData['Personal /Common'] || 'common';
    if (h === 'condition') return rowData.condition || 'Good';
    if (h === 'Location/Individual') return rowData.location || rowData['Location/Individual'] || '';
    if (h === 'Calibration due date') return rowData.calibrationDueDate || rowData['Calibration due date'] || '';
    if (h === 'Remarks') return rowData.remarks || rowData.Remarks || '';
    if (h === 'Due days') return rowData.dueDays !== undefined ? rowData.dueDays : '';
    return rowData[h] !== undefined ? rowData[h] : '';
  });

  sheet.appendRow(rowVals);
  rowData.version = 1;
  rowData.lastModified = nowIso;
  rowData.id = rowData.id || ('item_' + nextSlno);
  return rowData;
}

/**
 * Delete row by ID or SLNO
 */
function deleteRowById(sheet, rowId) {
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(h => String(h).trim());
  const idColIdx = headers.indexOf('ID');
  const slnoColIdx = headers.indexOf('SLNO');
  const values = sheet.getDataRange().getValues();

  for (let r = 1; r < values.length; r++) {
    const rId = idColIdx !== -1 ? String(values[r][idColIdx]) : '';
    const rSlno = slnoColIdx !== -1 ? String(values[r][slnoColIdx]) : '';
    if ((rId && rId === String(rowId)) || (rSlno && rSlno === String(rowId))) {
      sheet.deleteRow(r + 1);
      return true;
    }
  }
  return false;
}

/**
 * Process queued actions from offline storage
 */
function processOfflineQueueBatch(sheet, queue) {
  const results = [];
  for (let i = 0; i < queue.length; i++) {
    const item = queue[i];
    try {
      if (item.type === 'UPDATE' || item.type === 'UPDATE_ROW') {
        const res = updateRowWithConflictCheck(sheet, item.payload, item.baseVersion, item.forceOverwrite);
        results.push({ id: item.id, ...res });
      } else if (item.type === 'ADD' || item.type === 'ADD_ROW') {
        const added = appendSingleRow(sheet, item.payload);
        results.push({ id: item.id, success: true, row: added });
      } else if (item.type === 'DELETE' || item.type === 'DELETE_ROW') {
        const del = deleteRowById(sheet, item.rowId || item.payload.id);
        results.push({ id: item.id, success: del });
      }
    } catch (e) {
      results.push({ id: item.id, success: false, error: e.toString() });
    }
  }
  return results;
}

/**
 * Ensure standard equipment headers exist in the sheet
 */
function ensureSheetHeaders(sheet) {
  const lastCol = sheet.getLastColumn();
  if (lastCol === 0) {
    sheet.appendRow(EXPECTED_HEADERS);
    sheet.getRange(1, 1, 1, EXPECTED_HEADERS.length).setFontWeight('bold').setBackground('#F1F5F9');
    return;
  }

  const existingHeaders = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(h => String(h).trim());
  if (existingHeaders.indexOf('Version') === -1) {
    sheet.getRange(1, lastCol + 1).setValue('Version');
  }
  if (existingHeaders.indexOf('Last Modified') === -1) {
    sheet.getRange(1, lastCol + 2).setValue('Last Modified');
  }
  if (existingHeaders.indexOf('ID') === -1) {
    sheet.getRange(1, lastCol + 3).setValue('ID');
  }
}

/**
 * Backup spreadsheet tab
 */
function createSheetBackup(ss, sourceSheet, title) {
  const now = new Date();
  const dateStr = Utilities.formatDate(now, Session.getScriptTimeZone(), 'yyyyMMdd_HHmmss');
  const backupName = BACKUP_PREFIX + dateStr + '_' + (title || 'Snapshot').replace(/[^a-zA-Z0-9]/g, '_');
  const backupSheet = sourceSheet.copyTo(ss);
  backupSheet.setName(backupName);
  backupSheet.setTabColor('#10B981');
  return backupName;
}

/**
 * List backups
 */
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

/**
 * Restore spreadsheet from backup tab
 */
function restoreSheetBackup(ss, backupSheetName) {
  const backupSheet = ss.getSheetByName(backupSheetName);
  if (!backupSheet) throw new Error('Backup sheet not found: ' + backupSheetName);

  let activeSheet = ss.getSheetByName(SHEET_NAME);
  if (activeSheet) {
    // create safeguard copy first
    activeSheet.copyTo(ss).setName('Safeguard_' + Date.now());
    ss.deleteSheet(activeSheet);
  }
  const restored = backupSheet.copyTo(ss);
  restored.setName(SHEET_NAME);
  ss.setActiveSheet(restored);
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
  <!-- DataTables CSS & Responsive CDN -->
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

    <!-- Offline Alert Banner (Shows when offline) -->
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
          <!-- Real-Time Status Indicator Badge -->
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

    <!-- Google Sheets Tab Switcher Bar (Full list, Hand tools, Faulty Tools, Spare tools, Regular Calibration tools) -->
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
        <!-- Quick Filters -->
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
          Double-click any row to edit • Offline edits auto-saved
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
          <!-- Loaded from IndexedDB / Google Sheet -->
        </tbody>
      </table>
    </div>
  </div>

  <!-- Conflict Resolution Modal -->
  <div id="conflictModal" class="hidden fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
    <div class="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-xl w-full p-6 space-y-4">
      <div class="flex items-center gap-3 text-amber-600">
        <span class="p-2 bg-amber-100 rounded-xl text-lg">⚠️</span>
        <div>
          <h3 class="font-bold text-base text-slate-900">Sync Conflict Detected</h3>
          <p class="text-xs text-slate-500">Another team member modified this row while you were offline.</p>
        </div>
      </div>

      <div class="grid grid-cols-2 gap-3 text-xs bg-slate-50 p-3 rounded-2xl border border-slate-200">
        <div>
          <p class="font-bold text-indigo-600 mb-1">Your Offline Changes:</p>
          <div id="conflictClientView" class="space-y-1 font-mono text-[11px] text-slate-600"></div>
        </div>
        <div>
          <p class="font-bold text-emerald-600 mb-1">Google Sheet (Server) Version:</p>
          <div id="conflictServerView" class="space-y-1 font-mono text-[11px] text-slate-600"></div>
        </div>
      </div>

      <div class="flex flex-col sm:flex-row justify-end gap-2 pt-2 text-xs">
        <button onclick="resolveConflict('SERVER_WINS')" class="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl">
          Accept Server Version (Discard Local)
        </button>
        <button onclick="resolveConflict('CLIENT_WINS')" class="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl shadow-xs">
          Force My Changes (Client Wins)
        </button>
      </div>
    </div>
  </div>

  <!-- Add / Edit Equipment Modal -->
  <div id="editModal" class="hidden fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
    <div class="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-lg w-full p-6 space-y-4">
      <h3 id="modalTitle" class="font-bold text-base text-slate-900">Edit Equipment</h3>
      <form id="equipmentForm" onsubmit="saveEquipment(event)" class="space-y-3 text-xs">
        <input type="hidden" id="editRowId">
        <input type="hidden" id="editBaseVersion">

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
            <input type="text" id="editSerial" class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs">
          </div>
          <div>
            <label class="block font-bold text-slate-700 mb-1">Condition</label>
            <select id="editCondition" class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs">
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
            <input type="text" id="editDueDate" class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs" placeholder="e.g. 10-Mar-2027">
          </div>
        </div>

        <div>
          <label class="block font-bold text-slate-700 mb-1">Remarks</label>
          <textarea id="editRemarks" rows="2" class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"></textarea>
        </div>

        <div class="flex justify-end gap-2 pt-2">
          <button type="button" onclick="closeEditModal()" class="px-4 py-2 text-slate-500 font-semibold hover:text-slate-700">Cancel</button>
          <button type="submit" class="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl shadow-xs">Save Changes</button>
        </div>
      </form>
    </div>
  </div>

  <!-- IndexedDB & DataTables Controller Script -->
  <script>
    let dtTable;
    let db;
    const DB_NAME = 'SheetSync_GAS_DB';
    const DB_VERSION = 1;
    let currentConflict = null;

    // --- 1. Initialize IndexedDB ---
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

    // --- 2. IndexedDB Operations ---
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

    // --- 3. DataTables Initialization ---
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
              return '<button class="text-indigo-600 hover:underline mr-2 font-medium" onclick="openEditModal(\\'' + row.id + '\\')">Edit</button>' +
                     '<button class="text-rose-600 hover:underline font-medium" onclick="deleteRow(\\'' + row.id + '\\')">Delete</button>';
            }
          }
        ]
      });

      // Double-click row to edit
      $('#equipmentTable tbody').on('dblclick', 'tr', function () {
        const data = dtTable.row(this).data();
        if (data) openEditModal(data.id);
      });
    }

    let currentSheetTab = 'Full list';

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

    // --- 4. Load Data (IndexedDB First, Then Remote Sync) ---
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
              // Cache in IndexedDB
              await idbClear('equipment');
              for (const r of data.rows) {
                await idbPut('equipment', r);
              }
              dtTable.clear().rows.add(data.rows).draw();
              setSyncStatus('synced');
            }
          })
          .withFailureHandler(function(err) {
            console.error(err);
            setSyncStatus('error');
          })
          .getSheetDataAsJson();
      } else {
        // Fallback for direct testing
        setSyncStatus('synced');
      }
    }

    // --- 5. Offline Queue Processing & Conflict Handling ---
    async function triggerSync() {
      if (!navigator.onLine) {
        alert('You are currently offline. Edits are safely stored in IndexedDB.');
        return;
      }

      setSyncStatus('syncing');
      const queue = await idbGetAll('offline_queue');

      if (queue.length === 0) {
        fetchFromSheet();
        return;
      }

      // Process queued actions in sequence
      for (const item of queue) {
        if (typeof google !== 'undefined' && google.script && google.script.run) {
          await new Promise((res) => {
            google.script.run
              .withSuccessHandler(async function(resp) {
                if (resp && resp.conflict) {
                  // Conflict Detected! Prompt user
                  currentConflict = { item: item, serverRow: resp.serverRow, clientRow: resp.clientRow };
                  showConflictModal(resp.clientRow, resp.serverRow);
                } else {
                  await idbDelete('offline_queue', item.id);
                }
                res();
              })
              .withFailureHandler(function(err) {
                console.error('Queue item error', err);
                res();
              })
              .syncOfflineItem(item);
          });
        }
      }

      updateQueueUI();
      fetchFromSheet();
    }

    // --- 6. Save / Edit Logic with Offline Fallback ---
    async function saveEquipment(e) {
      e.preventDefault();
      const id = document.getElementById('editRowId').value;
      const baseVersion = Number(document.getElementById('editBaseVersion').value) || 1;

      const cached = await idbGetAll('equipment');
      let row = cached.find(r => r.id === id);

      const isNew = !row;
      if (isNew) {
        row = {
          id: 'item_' + Date.now(),
          slno: cached.length + 1,
          version: 1,
          lastModified: new Date().toISOString()
        };
      }

      row.description = document.getElementById('editDesc').value;
      row.make = document.getElementById('editMake').value;
      row.model = document.getElementById('editModel').value;
      row.serialNo = document.getElementById('editSerial').value;
      row.condition = document.getElementById('editCondition').value;
      row.location = document.getElementById('editLocation').value;
      row.calibrationDueDate = document.getElementById('editDueDate').value;
      row.remarks = document.getElementById('editRemarks').value;
      row.lastModified = new Date().toISOString();

      // 1. Immediately update IndexedDB
      await idbPut('equipment', row);

      // 2. Queue into offline_queue
      const queueItem = {
        id: 'q_' + Date.now(),
        type: isNew ? 'ADD' : 'UPDATE',
        rowId: row.id,
        payload: row,
        baseVersion: baseVersion,
        timestamp: new Date().toISOString()
      };
      await idbPut('offline_queue', queueItem);

      // 3. Update Table UI Optimistically
      const rows = await idbGetAll('equipment');
      dtTable.clear().rows.add(rows).draw();
      closeEditModal();
      updateQueueUI();

      // 4. If online, trigger background sync
      if (navigator.onLine) {
        triggerSync();
      }
    }

    async function deleteRow(id) {
      if (!confirm('Are you sure you want to delete this equipment item?')) return;
      await idbDelete('equipment', id);
      await idbPut('offline_queue', {
        id: 'q_' + Date.now(),
        type: 'DELETE',
        rowId: id,
        timestamp: new Date().toISOString()
      });
      const rows = await idbGetAll('equipment');
      dtTable.clear().rows.add(rows).draw();
      updateQueueUI();
      if (navigator.onLine) triggerSync();
    }

    // --- 7. Modal Handlers ---
    async function openEditModal(id) {
      const cached = await idbGetAll('equipment');
      const row = cached.find(r => r.id === id);
      if (!row) return;

      document.getElementById('modalTitle').textContent = 'Edit Equipment #' + row.slno;
      document.getElementById('editRowId').value = row.id;
      document.getElementById('editBaseVersion').value = row.version || 1;
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
      document.getElementById('modalTitle').textContent = 'Add New Equipment';
      document.getElementById('equipmentForm').reset();
      document.getElementById('editRowId').value = '';
      document.getElementById('editBaseVersion').value = '1';
      document.getElementById('editModal').classList.remove('hidden');
    }

    function closeEditModal() {
      document.getElementById('editModal').classList.add('hidden');
    }

    // --- 8. Conflict Resolution Dialog ---
    function showConflictModal(client, server) {
      document.getElementById('conflictClientView').innerHTML =
        '<p>Desc: ' + (client.description || '') + '</p>' +
        '<p>Cond: ' + (client.condition || '') + '</p>' +
        '<p>Location: ' + (client.location || '') + '</p>';

      document.getElementById('conflictServerView').innerHTML =
        '<p>Desc: ' + (server.Description || '') + '</p>' +
        '<p>Cond: ' + (server.condition || '') + '</p>' +
        '<p>Location: ' + (server['Location/Individual'] || '') + '</p>';

      document.getElementById('conflictModal').classList.remove('hidden');
    }

    async function resolveConflict(strategy) {
      if (!currentConflict) return;
      document.getElementById('conflictModal').classList.add('hidden');

      if (strategy === 'CLIENT_WINS') {
        // Force client version
        currentConflict.item.forceOverwrite = true;
        await idbPut('offline_queue', currentConflict.item);
        triggerSync();
      } else {
        // Server wins: remove from queue and refresh from sheet
        await idbDelete('offline_queue', currentConflict.item.id);
        fetchFromSheet();
      }
      currentConflict = null;
    }

    // --- 9. UI Status Helpers ---
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
        text.textContent = 'Sync Error (Click Sync Now)';
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

    // --- 10. Online / Offline Event Listeners ---
    window.addEventListener('online', () => {
      updateQueueUI();
      triggerSync();
    });

    window.addEventListener('offline', () => {
      updateQueueUI();
    });

    // Start App
    $(document).ready(async function() {
      await initIndexedDB();
      initTable();
      loadData();
    });
  </script>
</body>
</html>
`;
