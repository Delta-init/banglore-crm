/**
 * ════════════════════════════════════════════════════════════════════
 *  Delta BLR — LEAD SHEET BANGALORE → CRM Sync (Google Apps Script)
 * ════════════════════════════════════════════════════════════════════
 *
 *  Syncs the "LEAD SHEET BANGALORE" spreadsheet → CRM backend.
 *  Same engine as the "DELTA BLR ADS" script, adapted to THIS sheet's
 *  columns (a manual lead sheet, not the Facebook Lead Ads export).
 *
 *  SHEETS SYNCED:
 *    • Sheet1   (only this tab — edit SHEETS_TO_SYNC to add more)
 *
 *  Columns expected (LEAD SHEET BANGALORE):
 *    Name · Phone Number · Platform · Course · City · Status ·
 *    Remarks · Follow Up 1 · Follow Up 2 · Follow up 3 · Follow up 4
 *
 *    Mapped to the CRM:  Name → full_name · Phone Number → phone_number ·
 *                        Platform → platform · City → city
 *    NOT sent (the sync endpoint doesn't accept them yet):
 *                        Course · Status · Remarks · Follow Up 1–4
 *
 *  FEATURES:
 *    • Manual sync via custom menu (Delta CRM → Sync All / Sync This Sheet)
 *    • Auto-sync: new row added → instantly pushed to CRM
 *    • Safety-net timer: drains any un-synced / pending rows every 10 min
 *    • Tracks each row's sync status in a "CRM Sync" column
 *    • Batches 200 rows per request (backend limit)
 *    • Skips blank rows, already-synced rows, and invalid/test leads
 *    • Duplicate phone numbers → skipped by backend automatically
 *      (dedup is shared across ALL sheets)
 *
 *  SETUP (one-time):
 *    1. Open the sheet → Extensions → Apps Script
 *    2. Paste this entire script, set CONFIG below, Save
 *    3. Run → setupTriggers()  (installs auto-sync + 10-min safety net)
 *    4. Authorize when prompted
 *    5. "Delta CRM" menu appears in the sheet toolbar
 *
 * ════════════════════════════════════════════════════════════════════
 */

// ── Configuration ─────────────────────────────────────────────────────────────
var CRM_BASE_URL    = "https://api-crm-banglore.deltainstitutions.com";
var API_KEY         = "PASTE_SHEETS_API_KEY_HERE";  // = SHEETS_API_KEY in backend .env
var BATCH_SIZE      = 200;   // max rows per API call (hard limit on backend)
var SYNC_COL_HEADER = "CRM Sync";
var SHEETS_TO_SYNC  = ["Sheet1"];   // tab(s) in THIS spreadsheet to sync

// Fixed source label stamped on EVERY lead from this sheet.
// Leave "" to let the CRM derive the source from the Platform column
// (e.g. "Meta"). Set a label like "meta - bangalore sheet" to tag these
// leads distinctly in reports.
var LEAD_SOURCE = "";

var MAX_TRIGGER_ROWS = 200;   // onEdit trigger cap — bigger pastes are queued for the timer
var SAFETY_NET_MINUTES = 10;  // how often the time-driven trigger drains pending rows

// Status values written into the CRM Sync column
var STATUS_SYNCED   = "✅ Synced";
var STATUS_DUPLICATE= "⚠️ Duplicate";
var STATUS_ERROR    = "❌ Error";
var STATUS_INVALID  = "🔴 Invalid";
var STATUS_PENDING  = "🔄 Pending";

// ── Menu Setup ────────────────────────────────────────────────────────────────

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("🔄 Delta CRM")
    .addItem("Sync All Sheets", "syncAllSheets")
    .addItem("Sync This Sheet Only", "syncActiveSheet")
    .addSeparator()
    .addItem("Setup Auto-Sync + Safety Net", "setupTriggers")
    .addItem("Remove All Triggers", "removeTriggers")
    .addSeparator()
    .addItem("Clear All Sync Status", "clearAllSyncStatus")
    .addToUi();
}

// ── Main Sync Functions ───────────────────────────────────────────────────────

function syncAllSheets() {
  var summary = runSyncAll(true);
  if (!summary) return; // another run held the lock
  var msg = "✅ Sync complete!\n"
    + "Created: "   + summary.created   + "\n"
    + "Duplicate: " + summary.duplicate + "\n"
    + "Skipped: "   + summary.skipped   + "\n"
    + "Invalid: "   + summary.invalid   + "\n"
    + "Errors: "    + summary.error;
  SpreadsheetApp.getUi().alert(msg);
}

/** Time-driven entry point (installed by setupTriggers). Runs headless. */
function scheduledSync() {
  runSyncAll(false);
}

/**
 * Core "sync every sheet" routine, shared by the menu and the timer.
 * Uses a script lock so the timer and a manual run never overlap.
 */
function runSyncAll(interactive) {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) {
    if (interactive) showToast("⏳ A sync is already running — try again shortly.", "Delta CRM Sync");
    Logger.log("runSyncAll: lock busy, skipping this run");
    return null;
  }

  try {
    var ss      = SpreadsheetApp.getActiveSpreadsheet();
    var summary = { created: 0, duplicate: 0, invalid: 0, error: 0, skipped: 0 };

    if (interactive) showToast("Starting sync…", "Delta CRM Sync");

    SHEETS_TO_SYNC.forEach(function(sheetName) {
      var sheet = ss.getSheetByName(sheetName);
      if (!sheet) { Logger.log("Sheet not found: " + sheetName); return; }
      var result = syncSheet(sheet);
      summary.created   += result.created;
      summary.duplicate += result.duplicate;
      summary.invalid   += result.invalid;
      summary.error     += result.error;
      summary.skipped   += result.skipped;
    });

    Logger.log("runSyncAll summary: " + JSON.stringify(summary));
    if (interactive) {
      showToast(
        "✅ " + summary.created + " created | ⚠️ " + summary.duplicate
        + " dup | ❌ " + summary.error + " err",
        "Delta CRM Sync"
      );
    }
    return summary;
  } finally {
    lock.releaseLock();
  }
}

function syncActiveSheet() {
  var sheet = SpreadsheetApp.getActiveSheet();
  if (SHEETS_TO_SYNC.indexOf(sheet.getName()) === -1) {
    SpreadsheetApp.getUi().alert(
      "⚠️ This sheet is not in the sync list.\n\nSynced sheets: " + SHEETS_TO_SYNC.join(", ")
    );
    return;
  }
  showToast("Syncing " + sheet.getName() + "…", "Delta CRM Sync");
  var result = syncSheet(sheet);
  var msg = "✅ Done!\nCreated: " + result.created
    + " | Duplicate: " + result.duplicate
    + " | Skipped: "   + result.skipped
    + " | Errors: "    + result.error;
  showToast(msg, "Delta CRM Sync");
  SpreadsheetApp.getUi().alert(msg);
}

// ── Core Sheet Processor ──────────────────────────────────────────────────────

function syncSheet(sheet) {
  var result = { created: 0, duplicate: 0, invalid: 0, error: 0, skipped: 0 };

  var data = sheet.getDataRange().getValues();
  if (data.length < 2) { Logger.log(sheet.getName() + ": empty sheet, skipping"); return result; }

  var headers     = data[0].map(function(h) { return String(h).trim(); });
  var syncColIdx  = getOrCreateSyncColumn(sheet, headers);
  var rowObjects  = [];   // { rowIndex, payload }

  for (var i = 1; i < data.length; i++) {
    var row     = data[i];
    var syncVal = String(row[syncColIdx] || "").trim();

    if (syncVal === STATUS_SYNCED || syncVal === STATUS_DUPLICATE) { result.skipped++; continue; }

    var payload = buildPayload(headers, row);
    if (!payload) {
      if (rowHasContent(row)) {
        result.invalid++;
        writeStatus(sheet, i + 1, syncColIdx + 1, STATUS_INVALID);
      } else {
        result.skipped++;
      }
      continue;
    }
    rowObjects.push({ rowIndex: i + 1, payload: payload });
  }

  Logger.log(sheet.getName() + ": " + rowObjects.length + " rows to sync");

  for (var b = 0; b < rowObjects.length; b += BATCH_SIZE) {
    var batch    = rowObjects.slice(b, b + BATCH_SIZE);
    var payloads = batch.map(function(r) { return r.payload; });
    var response = callBatchApi(payloads);

    if (!response) {
      batch.forEach(function(r) {
        writeStatus(sheet, r.rowIndex, syncColIdx + 1, STATUS_ERROR);
        result.error++;
      });
      continue;
    }

    var byIndex = indexResults(response.results);
    batch.forEach(function(r, idx) {
      var apiRow = byIndex[idx];
      if (!apiRow) {
        writeStatus(sheet, r.rowIndex, syncColIdx + 1, STATUS_ERROR);
        result.error++;
        return;
      }
      if (apiRow.status === "created") {
        writeStatus(sheet, r.rowIndex, syncColIdx + 1, STATUS_SYNCED);
        result.created++;
      } else if (apiRow.status === "duplicate") {
        writeStatus(sheet, r.rowIndex, syncColIdx + 1, STATUS_DUPLICATE);
        result.duplicate++;
      } else {
        writeStatus(sheet, r.rowIndex, syncColIdx + 1, STATUS_ERROR + " " + (apiRow.reason || ""));
        result.invalid++;
      }
    });

    SpreadsheetApp.flush();
    Utilities.sleep(300);
  }

  Logger.log(sheet.getName() + " result: " + JSON.stringify(result));
  return result;
}

// ── Row Builder ───────────────────────────────────────────────────────────────

/**
 * Maps a LEAD SHEET BANGALORE row → CRM API payload.
 * Returns null if phone or name is missing / invalid.
 */
function buildPayload(headers, row) {
  var obj = {};
  for (var c = 0; c < headers.length; c++) {
    var header = headers[c].toLowerCase().trim();
    var value  = row[c];
    if (value === null || value === undefined || value === "") continue;
    var strVal = String(value).trim();
    if (!strVal) continue;

    switch (header) {
      case "phone":
      case "phone_number":
      case "phone number":
        obj.phone_number = cleanPhone(strVal);
        break;
      case "full_name":
      case "name":
        obj.full_name = strVal;
        break;
      case "email":
        obj.email = strVal;
        break;
      case "city":
      case "place":
        obj.city = strVal;
        break;
      case "platform":
        obj.platform = strVal;
        break;
      // Facebook Lead Ads fields — harmless if present, ignored if not.
      case "campaign_name": obj.campaign_name = strVal; break;
      case "campaign_id":   obj.campaign_id   = strVal; break;
      case "ad_name":       obj.ad_name       = strVal; break;
      case "ad_id":         obj.ad_id         = strVal; break;
      case "adset_name":    obj.adset_name    = strVal; break;
      case "adset_id":      obj.adset_id      = strVal; break;
      case "form_name":     obj.form_name     = strVal; break;
      case "form_id":       obj.form_id       = strVal; break;
      case "is_organic":    obj.is_organic    = strVal; break;
      case "id":            obj.id            = strVal; break;
      case "created_time":  obj.created_time  = strVal; break;
      case "lead_status":   obj.lead_status   = strVal; break;
      // Columns this sheet has but the CRM endpoint does not accept — skipped:
      //   course · status · remarks · follow up 1..4
      default:
        break;
    }
  }

  // ── Validate required fields ───────────────────────────────────────────────
  if (!isValidPhone(obj.phone_number)) return null;
  if (!obj.full_name) return null;
  var nameLc = obj.full_name.toLowerCase();
  if (nameLc === "nan") return null;
  if (nameLc === "name" || nameLc === "full_name") return null; // stray repeated header
  if (obj.full_name.charAt(0) === "<") return null;             // test-lead dummy name

  if (LEAD_SOURCE) obj.source = LEAD_SOURCE;

  return obj;
}

/** True only for a real phone: optional leading +, then 8+ digits, nothing else */
function isValidPhone(p) {
  if (!p) return false;
  var digits = p.replace(/^\+/, "");
  return /^[0-9]{8,}$/.test(digits);
}

// ── API Calls ──────────────────────────────────────────────────────────────────

/** Batch → POST /api/v1/sheets/sync/batch. Returns parsed data, or null on error. */
function callBatchApi(rows) {
  var url  = CRM_BASE_URL + "/api/v1/sheets/sync/batch";
  var options = {
    method: "post", contentType: "application/json",
    headers: { "x-api-key": API_KEY },
    payload: JSON.stringify({ rows: rows }),
    muteHttpExceptions: true,
  };
  try {
    var response = UrlFetchApp.fetch(url, options);
    var code = response.getResponseCode();
    var text = response.getContentText();
    var parsed = JSON.parse(text);
    Logger.log("API " + code + ": " + text.substring(0, 200));
    if (code >= 200 && code < 300 && parsed.success) return parsed.data;
    Logger.log("API error " + code + ": " + text);
    return null;
  } catch (e) {
    Logger.log("Network error: " + e.message);
    return null;
  }
}

/** Single → POST /api/v1/sheets/sync */
function callSingleApi(payload) {
  var url  = CRM_BASE_URL + "/api/v1/sheets/sync";
  var options = {
    method: "post", contentType: "application/json",
    headers: { "x-api-key": API_KEY },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  };
  try {
    var response = UrlFetchApp.fetch(url, options);
    var code = response.getResponseCode();
    var parsed = JSON.parse(response.getContentText());
    if (code >= 200 && code < 300 && parsed.success) return parsed.data;
    return null;
  } catch (e) {
    Logger.log("Single API error: " + e.message);
    return null;
  }
}

// ── onEdit Auto-Trigger ───────────────────────────────────────────────────────

function onEditTrigger(e) {
  if (!e || !e.range) return;

  var sheet     = e.range.getSheet();
  var sheetName = sheet.getName();
  if (SHEETS_TO_SYNC.indexOf(sheetName) === -1) return;

  var startRow = e.range.getRow();
  var endRow   = e.range.getLastRow();
  if (endRow <= 1) return;             // header-only edit
  if (startRow <= 1) startRow = 2;

  var data       = sheet.getDataRange().getValues();
  var headers    = data[0].map(function(h) { return String(h).trim(); });
  var syncColIdx = getOrCreateSyncColumn(sheet, headers);

  var totalRows = endRow - startRow + 1;
  if (totalRows > MAX_TRIGGER_ROWS) {
    markRangePending(sheet, data, syncColIdx, startRow, endRow);
    showToast(
      "🔄 " + totalRows + " rows queued — auto-sync will process them within ~"
      + SAFETY_NET_MINUTES + " min.\nOr click 🔄 Delta CRM → Sync All Sheets to run now.",
      "Delta CRM Sync"
    );
    return;
  }

  var rowObjects = [];
  for (var r = startRow; r <= endRow; r++) {
    var dataIdx = r - 1;
    if (dataIdx >= data.length) break;
    var row = data[dataIdx];
    var syncStatus = String(row[syncColIdx] || "").trim();
    if (syncStatus === STATUS_SYNCED || syncStatus === STATUS_DUPLICATE) continue;

    var payload = buildPayload(headers, row);
    if (!payload) {
      if (rowHasContent(row)) writeStatus(sheet, r, syncColIdx + 1, STATUS_INVALID);
      continue;
    }
    writeStatus(sheet, r, syncColIdx + 1, STATUS_PENDING);
    rowObjects.push({ rowIndex: r, payload: payload });
  }

  if (rowObjects.length === 0) return;
  SpreadsheetApp.flush();

  if (rowObjects.length === 1) {
    var item = rowObjects[0];
    var response = callSingleApi(item.payload);
    if (!response) { writeStatus(sheet, item.rowIndex, syncColIdx + 1, STATUS_ERROR); return; }
    if (response.duplicate) {
      writeStatus(sheet, item.rowIndex, syncColIdx + 1, STATUS_DUPLICATE);
    } else {
      writeStatus(sheet, item.rowIndex, syncColIdx + 1, STATUS_SYNCED);
      showToast("✅ Lead synced: " + (item.payload.full_name || item.payload.phone_number), "CRM Sync");
    }
    return;
  }

  var payloads = rowObjects.map(function(r) { return r.payload; });
  var batchResponse = callBatchApi(payloads);
  if (!batchResponse) {
    rowObjects.forEach(function(item) { writeStatus(sheet, item.rowIndex, syncColIdx + 1, STATUS_ERROR); });
    showToast("❌ Sync failed — check your connection.", "CRM Sync");
    return;
  }

  var byIndex = indexResults(batchResponse.results);
  var created = 0, duplicates = 0, errors = 0;
  rowObjects.forEach(function(item, idx) {
    var apiRow = byIndex[idx];
    if (!apiRow) { writeStatus(sheet, item.rowIndex, syncColIdx + 1, STATUS_ERROR); errors++; return; }
    if (apiRow.status === "created") { writeStatus(sheet, item.rowIndex, syncColIdx + 1, STATUS_SYNCED); created++; }
    else if (apiRow.status === "duplicate") { writeStatus(sheet, item.rowIndex, syncColIdx + 1, STATUS_DUPLICATE); duplicates++; }
    else { writeStatus(sheet, item.rowIndex, syncColIdx + 1, STATUS_ERROR + " " + (apiRow.reason || "")); errors++; }
  });

  SpreadsheetApp.flush();
  showToast(
    "✅ " + created + " synced"
    + (duplicates > 0 ? " | ⚠️ " + duplicates + " duplicate" : "")
    + (errors     > 0 ? " | ❌ " + errors     + " error"     : ""),
    "CRM Sync"
  );
}

// ── Trigger Management ────────────────────────────────────────────────────────

function setupTriggers() {
  removeTriggers();
  ScriptApp.newTrigger("onEditTrigger").forSpreadsheet(SpreadsheetApp.getActive()).onEdit().create();
  ScriptApp.newTrigger("scheduledSync").timeBased().everyMinutes(SAFETY_NET_MINUTES).create();
  SpreadsheetApp.getUi().alert(
    "✅ Triggers installed!\n\n"
    + "1) Instant auto-sync on new rows (≤ " + MAX_TRIGGER_ROWS + " at a time)\n"
    + "2) Safety net every " + SAFETY_NET_MINUTES + " min — drains large pastes\n"
    + "   and anything left 🔄 Pending or blank.\n\n"
    + "Synced sheets:\n• " + SHEETS_TO_SYNC.join("\n• ")
  );
}

function removeTriggers() {
  ScriptApp.getProjectTriggers().forEach(function(t) {
    var fn = t.getHandlerFunction();
    if (fn === "onEditTrigger" || fn === "scheduledSync") ScriptApp.deleteTrigger(t);
  });
}

// ── Utilities ─────────────────────────────────────────────────────────────────

function rowHasContent(row) {
  return row.some(function(cell) { return cell !== null && cell !== undefined && cell !== ""; });
}

function indexResults(results) {
  var map = {};
  var arr = results || [];
  for (var i = 0; i < arr.length; i++) {
    var r = arr[i];
    if (!r) continue;
    var key = (typeof r.index === "number") ? r.index : i;
    map[key] = r;
  }
  return map;
}

function markRangePending(sheet, data, syncColIdx, startRow, endRow) {
  var n = endRow - startRow + 1;
  if (n <= 0) return;
  var values = [];
  for (var r = startRow; r <= endRow; r++) {
    var dataIdx = r - 1;
    var row = (dataIdx < data.length) ? data[dataIdx] : null;
    var cur = row ? String(row[syncColIdx] || "").trim() : "";
    if (cur === STATUS_SYNCED || cur === STATUS_DUPLICATE) values.push([cur]);
    else if (row && rowHasContent(row)) values.push([STATUS_PENDING]);
    else values.push([cur]);
  }
  sheet.getRange(startRow, syncColIdx + 1, n, 1).setValues(values);
  SpreadsheetApp.flush();
}

/** Strip "p:" prefix and clean up the phone number */
function cleanPhone(raw) {
  if (!raw) return "";
  var s = String(raw).trim();
  s = s.replace(/^p:/i, "").trim();
  s = s.replace(/\s+/g, "");
  return s;
}

function getOrCreateSyncColumn(sheet, headers) {
  var idx = headers.indexOf(SYNC_COL_HEADER);
  if (idx !== -1) return idx;
  var newCol = headers.length + 1;
  sheet.getRange(1, newCol).setValue(SYNC_COL_HEADER).setFontWeight("bold").setBackground("#e8f5e9");
  SpreadsheetApp.flush();
  return headers.length;
}

function writeStatus(sheet, rowNum, colNum, status) {
  var cell = sheet.getRange(rowNum, colNum);
  cell.setValue(status);
  if (status === STATUS_SYNCED) {
    cell.setBackground("#c8e6c9").setFontColor("#1b5e20");
  } else if (status === STATUS_DUPLICATE) {
    cell.setBackground("#fff9c4").setFontColor("#f57f17");
  } else if (status.indexOf("Error") !== -1 || status === STATUS_INVALID) {
    cell.setBackground("#ffcdd2").setFontColor("#b71c1c");
  } else if (status === STATUS_PENDING) {
    cell.setBackground("#e3f2fd").setFontColor("#0d47a1");
  } else {
    cell.setBackground(null).setFontColor(null);
  }
}

function clearAllSyncStatus() {
  var ui = SpreadsheetApp.getUi();
  var confirm = ui.alert(
    "Clear Sync Status",
    "This will clear all ✅ Synced / ⚠️ Duplicate statuses so rows can be re-synced.\n\nContinue?",
    ui.ButtonSet.YES_NO
  );
  if (confirm !== ui.Button.YES) return;

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  SHEETS_TO_SYNC.forEach(function(sheetName) {
    var sheet = ss.getSheetByName(sheetName);
    if (!sheet) return;
    var data    = sheet.getDataRange().getValues();
    var headers = data[0].map(function(h) { return String(h).trim(); });
    var idx     = headers.indexOf(SYNC_COL_HEADER);
    if (idx === -1) return;
    if (data.length > 1) {
      sheet.getRange(2, idx + 1, data.length - 1, 1).clearContent().setBackground(null).setFontColor(null);
    }
  });
  ui.alert("✅ All sync statuses cleared.");
}

function showToast(msg, title) {
  SpreadsheetApp.getActiveSpreadsheet().toast(msg, title || "CRM Sync", 5);
}
