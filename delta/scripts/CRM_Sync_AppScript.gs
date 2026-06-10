/**
 * ════════════════════════════════════════════════════════════════════
 *  Delta BLR CRM — Google Sheets Sync App Script
 * ════════════════════════════════════════════════════════════════════
 *
 *  Syncs Facebook Lead Ads from Google Sheets → CRM backend.
 *
 *  SHEETS SYNCED:
 *    • Leads              (main — 2723+ leads)
 *    • Sheet1             (26 leads)
 *    • Out of Keral Webinar (49 leads)
 *    • Malayalam          (29 leads)
 *
 *  FEATURES:
 *    • Manual sync via custom menu (Delta CRM → Sync All / Sync This Sheet)
 *    • Auto-sync: new row added → instantly pushed to CRM
 *    • Tracks each row's sync status in "CRM Sync" column
 *    • Batches 200 rows per request (backend limit)
 *    • Skips blank rows and already-synced rows
 *    • Duplicate phone numbers → skipped by backend automatically
 *
 *  SETUP (one-time):
 *    1. Open Extensions → Apps Script in your Google Sheet
 *    2. Paste this entire script
 *    3. Click Run → setupTriggers()  (grants permissions & installs auto-sync)
 *    4. Authorize when prompted
 *    5. Done! "Delta CRM" menu appears in the sheet toolbar
 *
 * ════════════════════════════════════════════════════════════════════
 */

// ── Configuration ─────────────────────────────────────────────────────────────

var CRM_BASE_URL    = "https://api-crm-banglore.deltainstitutions.com";
var API_KEY         = "DELTA BANGLORE_sheets_key_change_in_production_2024";
var BATCH_SIZE      = 200;   // max rows per API call (hard limit on backend)
var SYNC_COL_HEADER = "CRM Sync";
var SHEETS_TO_SYNC  = ["Leads", "Sheet1", "Out of Keral Webinar", "Malayalam"];
var MAX_TRIGGER_ROWS = 50;   // onEdit trigger cap — use Sync All for larger pastes

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
    .addItem("Setup Auto-Sync Trigger", "setupTriggers")
    .addItem("Remove Auto-Sync Trigger", "removeTriggers")
    .addSeparator()
    .addItem("Clear All Sync Status", "clearAllSyncStatus")
    .addToUi();
}

// ── Main Sync Functions ───────────────────────────────────────────────────────

/**
 * Syncs all configured sheets to the CRM.
 * Called from the menu "Sync All Sheets".
 */
function syncAllSheets() {
  var ss      = SpreadsheetApp.getActiveSpreadsheet();
  var summary = { created: 0, duplicate: 0, invalid: 0, error: 0, skipped: 0 };

  showToast("Starting sync across all sheets…", "Delta CRM Sync");

  SHEETS_TO_SYNC.forEach(function(sheetName) {
    var sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      Logger.log("Sheet not found: " + sheetName);
      return;
    }
    var result = syncSheet(sheet);
    summary.created   += result.created;
    summary.duplicate += result.duplicate;
    summary.invalid   += result.invalid;
    summary.error     += result.error;
    summary.skipped   += result.skipped;
  });

  var msg = "✅ Sync complete!\n"
    + "Created: "   + summary.created   + "\n"
    + "Duplicate: " + summary.duplicate + "\n"
    + "Skipped: "   + summary.skipped   + "\n"
    + "Invalid: "   + summary.invalid   + "\n"
    + "Errors: "    + summary.error;

  showToast(msg, "Delta CRM Sync");
  SpreadsheetApp.getUi().alert(msg);
}

/**
 * Syncs only the currently active sheet.
 * Called from the menu "Sync This Sheet Only".
 */
function syncActiveSheet() {
  var sheet = SpreadsheetApp.getActiveSheet();
  if (SHEETS_TO_SYNC.indexOf(sheet.getName()) === -1) {
    SpreadsheetApp.getUi().alert(
      "⚠️ This sheet is not in the sync list.\n\n"
      + "Synced sheets: " + SHEETS_TO_SYNC.join(", ")
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

/**
 * Reads all un-synced rows from a sheet, builds row objects,
 * sends them to the CRM in batches of BATCH_SIZE, and writes
 * the result status back into the "CRM Sync" column.
 *
 * @param {Sheet} sheet — Google Sheets Sheet object
 * @returns {{ created, duplicate, invalid, error, skipped }}
 */
function syncSheet(sheet) {
  var result = { created: 0, duplicate: 0, invalid: 0, error: 0, skipped: 0 };

  var data = sheet.getDataRange().getValues();
  if (data.length < 2) {
    Logger.log(sheet.getName() + ": empty sheet, skipping");
    return result;
  }

  var headers     = data[0].map(function(h) { return String(h).trim(); });
  var syncColIdx  = getOrCreateSyncColumn(sheet, headers);
  var rowObjects  = [];   // { rowIndex, payload }

  // ── Build row payloads ────────────────────────────────────────────────────
  for (var i = 1; i < data.length; i++) {
    var row     = data[i];
    var syncVal = String(row[syncColIdx] || "").trim();

    // Skip already-synced rows
    if (syncVal === STATUS_SYNCED || syncVal === STATUS_DUPLICATE) {
      result.skipped++;
      continue;
    }

    var payload = buildPayload(headers, row);
    if (!payload) {
      result.invalid++;
      writeStatus(sheet, i + 1, syncColIdx + 1, STATUS_INVALID);
      continue;
    }

    rowObjects.push({ rowIndex: i + 1, payload: payload });
  }

  Logger.log(sheet.getName() + ": " + rowObjects.length + " rows to sync");

  // ── Send in batches ───────────────────────────────────────────────────────
  for (var b = 0; b < rowObjects.length; b += BATCH_SIZE) {
    var batch   = rowObjects.slice(b, b + BATCH_SIZE);
    var payloads= batch.map(function(r) { return r.payload; });

    var response = callBatchApi(payloads);

    if (!response) {
      // Network or server error — mark all as error
      batch.forEach(function(r) {
        writeStatus(sheet, r.rowIndex, syncColIdx + 1, STATUS_ERROR);
        result.error++;
      });
      continue;
    }

    // Write per-row status back to sheet
    var apiResults = response.results || [];
    batch.forEach(function(r, idx) {
      var apiRow = apiResults[idx];
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
        writeStatus(sheet, r.rowIndex, syncColIdx + 1,
          STATUS_ERROR + " " + (apiRow.reason || ""));
        result.invalid++;
      }
    });

    // Flush writes after each batch
    SpreadsheetApp.flush();
    Utilities.sleep(300); // small pause between batches
  }

  Logger.log(sheet.getName() + " result: " + JSON.stringify(result));
  return result;
}

// ── Row Builder ───────────────────────────────────────────────────────────────

/**
 * Maps a sheet row → CRM API payload object.
 * Returns null if phone or name is missing.
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
      case "campaign_name":
        obj.campaign_name = strVal;
        break;
      case "campaign_id":
        obj.campaign_id = strVal;
        break;
      case "ad_name":
        obj.ad_name = strVal;
        break;
      case "ad_id":
        obj.ad_id = strVal;
        break;
      case "adset_name":
        obj.adset_name = strVal;
        break;
      case "adset_id":
        obj.adset_id = strVal;
        break;
      case "form_name":
        obj.form_name = strVal;
        break;
      case "form_id":
        obj.form_id = strVal;
        break;
      case "is_organic":
        obj.is_organic = strVal;
        break;
      case "id":
        obj.id = strVal;
        break;
      case "created_time":
        obj.created_time = strVal;
        break;
      case "lead_status":
        obj.lead_status = strVal;
        break;
      case "when_are_you_willing_to_join?":
        // not a CRM field — skip
        break;
      default:
        break;
    }
  }

  // Validate required fields
  if (!obj.phone_number || obj.phone_number.length < 8) return null;
  if (!obj.full_name || obj.full_name === "nan") return null;

  return obj;
}

// ── API Call ──────────────────────────────────────────────────────────────────

/**
 * Sends a batch of row payloads to POST /api/v1/sheets/sync/batch
 * Returns the parsed response data, or null on network error.
 */
function callBatchApi(rows) {
  var url  = CRM_BASE_URL + "/api/v1/sheets/sync/batch";
  var body = JSON.stringify({ rows: rows });

  var options = {
    method:             "post",
    contentType:        "application/json",
    headers:            { "x-api-key": API_KEY },
    payload:            body,
    muteHttpExceptions: true,
  };

  try {
    var response = UrlFetchApp.fetch(url, options);
    var code     = response.getResponseCode();
    var text     = response.getContentText();
    var parsed   = JSON.parse(text);

    Logger.log("API " + code + ": " + text.substring(0, 200));

    if (code >= 200 && code < 300 && parsed.success) {
      return parsed.data;
    } else {
      Logger.log("API error " + code + ": " + text);
      return null;
    }
  } catch (e) {
    Logger.log("Network error: " + e.message);
    return null;
  }
}

// ── onEdit Auto-Trigger ───────────────────────────────────────────────────────

/**
 * Fires on every cell edit in the spreadsheet.
 * Handles BOTH single-cell edits AND multi-row pastes correctly.
 *
 * Single row  → single API call (fast)
 * 2–50 rows   → batch API call  (efficient)
 * 51+ rows    → shows toast asking user to use "Sync All Sheets" instead
 *               (onEdit has a 30s execution limit — large pastes would time out)
 */
function onEditTrigger(e) {
  if (!e || !e.range) return;

  var sheet     = e.range.getSheet();
  var sheetName = sheet.getName();

  if (SHEETS_TO_SYNC.indexOf(sheetName) === -1) return;

  var startRow = e.range.getRow();
  var endRow   = e.range.getLastRow();

  // Ignore edits that only touch the header row
  if (endRow <= 1) return;

  // Clamp startRow to first data row
  if (startRow <= 1) startRow = 2;

  // Too many rows — the 30s trigger limit would be exceeded
  var totalRows = endRow - startRow + 1;
  if (totalRows > MAX_TRIGGER_ROWS) {
    showToast(
      "⚠️ " + totalRows + " rows pasted — too large for auto-sync.\n"
      + "Use 🔄 Delta CRM → Sync This Sheet Only instead.",
      "Delta CRM Sync"
    );
    return;
  }

  var data       = sheet.getDataRange().getValues();
  var headers    = data[0].map(function(h) { return String(h).trim(); });
  var syncColIdx = getOrCreateSyncColumn(sheet, headers);

  // ── Collect all rows in the edited range that need syncing ───────────────
  var rowObjects = [];   // { rowIndex (1-based), payload }

  for (var r = startRow; r <= endRow; r++) {
    var dataIdx = r - 1;  // data[] is 0-based
    if (dataIdx >= data.length) break;

    var row        = data[dataIdx];
    var syncStatus = String(row[syncColIdx] || "").trim();

    // Skip already-synced rows
    if (syncStatus === STATUS_SYNCED || syncStatus === STATUS_DUPLICATE) continue;

    var payload = buildPayload(headers, row);
    if (!payload) {
      // Mark invalid only if row has some content (not a blank row)
      var hasContent = row.some(function(cell) { return cell !== null && cell !== ""; });
      if (hasContent) {
        writeStatus(sheet, r, syncColIdx + 1, STATUS_INVALID);
      }
      continue;
    }

    // Mark as pending immediately so user sees progress
    writeStatus(sheet, r, syncColIdx + 1, STATUS_PENDING);
    rowObjects.push({ rowIndex: r, payload: payload });
  }

  if (rowObjects.length === 0) return;

  SpreadsheetApp.flush(); // flush pending-state writes before API calls

  // ── Single row → use single API (faster, better error detail) ────────────
  if (rowObjects.length === 1) {
    var item     = rowObjects[0];
    var response = callSingleApi(item.payload);

    if (!response) {
      writeStatus(sheet, item.rowIndex, syncColIdx + 1, STATUS_ERROR);
      return;
    }
    if (response.duplicate) {
      writeStatus(sheet, item.rowIndex, syncColIdx + 1, STATUS_DUPLICATE);
    } else {
      writeStatus(sheet, item.rowIndex, syncColIdx + 1, STATUS_SYNCED);
      showToast(
        "✅ Lead synced: " + (item.payload.full_name || item.payload.phone_number),
        "CRM Sync"
      );
    }
    return;
  }

  // ── Multiple rows → use batch API ────────────────────────────────────────
  var payloads = rowObjects.map(function(r) { return r.payload; });
  var batchResponse = callBatchApi(payloads);

  if (!batchResponse) {
    rowObjects.forEach(function(item) {
      writeStatus(sheet, item.rowIndex, syncColIdx + 1, STATUS_ERROR);
    });
    showToast("❌ Sync failed — check your connection.", "CRM Sync");
    return;
  }

  var apiResults = batchResponse.results || [];
  var created = 0, duplicates = 0, errors = 0;

  rowObjects.forEach(function(item, idx) {
    var apiRow = apiResults[idx];
    if (!apiRow) {
      writeStatus(sheet, item.rowIndex, syncColIdx + 1, STATUS_ERROR);
      errors++;
      return;
    }
    if (apiRow.status === "created") {
      writeStatus(sheet, item.rowIndex, syncColIdx + 1, STATUS_SYNCED);
      created++;
    } else if (apiRow.status === "duplicate") {
      writeStatus(sheet, item.rowIndex, syncColIdx + 1, STATUS_DUPLICATE);
      duplicates++;
    } else {
      writeStatus(sheet, item.rowIndex, syncColIdx + 1,
        STATUS_ERROR + " " + (apiRow.reason || ""));
      errors++;
    }
  });

  SpreadsheetApp.flush();

  showToast(
    "✅ " + created + " synced"
    + (duplicates > 0 ? " | ⚠️ " + duplicates + " duplicate" : "")
    + (errors     > 0 ? " | ❌ " + errors     + " error"     : ""),
    "CRM Sync"
  );
}

/**
 * Single-row sync — POST /api/v1/sheets/sync
 */
function callSingleApi(payload) {
  var url  = CRM_BASE_URL + "/api/v1/sheets/sync";
  var options = {
    method:             "post",
    contentType:        "application/json",
    headers:            { "x-api-key": API_KEY },
    payload:            JSON.stringify(payload),
    muteHttpExceptions: true,
  };

  try {
    var response = UrlFetchApp.fetch(url, options);
    var code     = response.getResponseCode();
    var parsed   = JSON.parse(response.getContentText());
    if (code >= 200 && code < 300 && parsed.success) return parsed.data;
    return null;
  } catch (e) {
    Logger.log("Single API error: " + e.message);
    return null;
  }
}

// ── Trigger Management ────────────────────────────────────────────────────────

/**
 * Run this once to install the onEdit trigger.
 * After this, every new row edit auto-syncs to CRM.
 */
function setupTriggers() {
  // Remove existing to avoid duplicates
  removeTriggers();

  ScriptApp.newTrigger("onEditTrigger")
    .forSpreadsheet(SpreadsheetApp.getActive())
    .onEdit()
    .create();

  SpreadsheetApp.getUi().alert(
    "✅ Auto-sync trigger installed!\n\n"
    + "New rows added to these sheets will sync automatically:\n"
    + SHEETS_TO_SYNC.join("\n• ")
  );
}

function removeTriggers() {
  var triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(function(t) {
    if (t.getHandlerFunction() === "onEditTrigger") {
      ScriptApp.deleteTrigger(t);
    }
  });
}

// ── Utilities ─────────────────────────────────────────────────────────────────

/** Strip "p:" prefix and clean up the phone number */
function cleanPhone(raw) {
  if (!raw) return "";
  var s = String(raw).trim();
  s = s.replace(/^p:/i, "").trim();
  s = s.replace(/\s+/g, "");
  return s;
}

/**
 * Returns the 0-based index of the "CRM Sync" column.
 * If it doesn't exist, adds it to the right of the last column.
 */
function getOrCreateSyncColumn(sheet, headers) {
  var idx = headers.indexOf(SYNC_COL_HEADER);
  if (idx !== -1) return idx;

  // Not found — add a new column at the end
  var newCol = headers.length + 1;
  sheet.getRange(1, newCol).setValue(SYNC_COL_HEADER)
    .setFontWeight("bold")
    .setBackground("#e8f5e9");

  SpreadsheetApp.flush();
  return headers.length; // 0-based index of new column
}

/** Writes a status value into the CRM Sync column for a given row */
function writeStatus(sheet, rowNum, colNum, status) {
  var cell = sheet.getRange(rowNum, colNum);
  cell.setValue(status);

  // Color-code the cell
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

/** Clear all CRM Sync status columns across synced sheets */
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

    // Clear all status cells (skip header row)
    if (data.length > 1) {
      var range = sheet.getRange(2, idx + 1, data.length - 1, 1);
      range.clearContent().setBackground(null).setFontColor(null);
    }
  });

  ui.alert("✅ All sync statuses cleared.");
}

function showToast(msg, title) {
  SpreadsheetApp.getActiveSpreadsheet().toast(msg, title || "CRM Sync", 5);
}
