/**
 * ==================================================
 * 02_storage.gs - Storage Helpers
 * ==================================================
 *
 * Provides helpers for reading and writing data to Google Sheets.
 * Implements batch operations and upsert logic for efficient data management.
 *
 * Key functions:
 * - getSheetData: Read data from a sheet
 * - upsertRows: Insert or update rows by key
 * - batchWrite: Write multiple rows efficiently
 * - getConfigValue: Get configuration from CONFIG sheet
 */

// ==================================================
// CONFIG MANAGEMENT
// ==================================================

/**
 * Gets all configuration values from the CONFIG sheet.
 * Caches the result during execution for performance.
 * @returns {Object} Configuration key-value pairs
 */
function getAllConfig() {
  if (RUNTIME_CACHE.config) {
    return RUNTIME_CACHE.config;
  }

  const sheet = getOrCreateSheet(SHEET_NAMES.CONFIG);
  const data = sheet.getDataRange().getValues();

  const config = { ...DEFAULT_CONFIG }; // Start with defaults

  // Skip header row
  for (let i = 1; i < data.length; i++) {
    const key = data[i][0];
    const value = data[i][1];

    if (key && value !== '' && value !== null && value !== undefined) {
      config[key] = parseConfigValue_(value);
    }
  }

  RUNTIME_CACHE.config = config;
  return config;
}

/**
 * Gets a single configuration value.
 * @param {string} key - The configuration key
 * @param {*} [defaultValue] - Default value if not found
 * @returns {*} The configuration value
 */
function getConfigValue(key, defaultValue) {
  const config = getAllConfig();
  const value = config[key];
  return value !== undefined && value !== null ? value : defaultValue;
}

/**
 * Sets a configuration value in the CONFIG sheet.
 * @param {string} key - The configuration key
 * @param {*} value - The value to set
 * @param {string} [notes] - Optional notes
 */
function setConfigValue(key, value, notes) {
  const sheet = getOrCreateSheet(SHEET_NAMES.CONFIG);
  const data = sheet.getDataRange().getValues();

  // Find existing row
  let rowIndex = -1;
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === key) {
      rowIndex = i + 1; // 1-indexed
      break;
    }
  }

  if (rowIndex > 0) {
    // Update existing
    sheet.getRange(rowIndex, 2).setValue(value);
    if (notes !== undefined) {
      sheet.getRange(rowIndex, 3).setValue(notes);
    }
  } else {
    // Append new
    sheet.appendRow([key, value, notes || '']);
  }

  // Invalidate cache
  if (RUNTIME_CACHE.config) {
    RUNTIME_CACHE.config[key] = parseConfigValue_(value);
  }
}

/**
 * Parses a config value to the appropriate type.
 * @private
 */
function parseConfigValue_(value) {
  if (typeof value === 'string') {
    const lower = value.toLowerCase();
    if (lower === 'true') return true;
    if (lower === 'false') return false;
    if (!isNaN(value) && value !== '') return Number(value);
  }
  return value;
}

/**
 * Clears the configuration cache, forcing a refresh on next read.
 */
function clearConfigCache() {
  RUNTIME_CACHE.config = null;
}

// ==================================================
// SHEET DATA OPERATIONS
// ==================================================

/**
 * Gets all data from a sheet as an array of objects.
 * @param {string} sheetName - The sheet name
 * @param {Object} [options] - Options: { includeEmpty: false, limit: null }
 * @returns {Array<Object>} Array of row objects with column names as keys
 */
function getSheetData(sheetName, options) {
  options = options || {};
  const sheet = getOrCreateSheet(sheetName);
  const data = sheet.getDataRange().getValues();

  if (data.length <= 1) {
    return []; // Only header or empty
  }

  const headers = data[0];
  const rows = [];

  for (let i = 1; i < data.length; i++) {
    if (options.limit && rows.length >= options.limit) {
      break;
    }

    const row = data[i];

    // Skip empty rows unless includeEmpty
    if (!options.includeEmpty && isEmptyRow_(row)) {
      continue;
    }

    const obj = {};
    for (let j = 0; j < headers.length; j++) {
      obj[headers[j]] = row[j];
    }
    rows.push(obj);
  }

  return rows;
}

/**
 * Gets data from a sheet filtered by a condition.
 * @param {string} sheetName - The sheet name
 * @param {Object} filters - Filter object { column: value }
 * @returns {Array<Object>} Filtered row objects
 */
function getSheetDataFiltered(sheetName, filters) {
  const data = getSheetData(sheetName);

  return data.filter(row => {
    for (const col in filters) {
      if (row[col] !== filters[col]) {
        return false;
      }
    }
    return true;
  });
}

/**
 * Gets data from a sheet by date range.
 * @param {string} sheetName - The sheet name
 * @param {string} dateColumn - The date column name
 * @param {string} startDate - Start date (YYYY-MM-DD)
 * @param {string} endDate - End date (YYYY-MM-DD)
 * @returns {Array<Object>} Filtered row objects
 */
function getSheetDataByDateRange(sheetName, dateColumn, startDate, endDate) {
  const data = getSheetData(sheetName);

  return data.filter(row => {
    const rowDate = formatDateYMD_(row[dateColumn]);
    return rowDate >= startDate && rowDate <= endDate;
  });
}

/**
 * Gets the latest row for each unique key.
 * @param {string} sheetName - The sheet name
 * @param {string} keyColumn - The key column name (e.g., 'etf')
 * @param {string} [dateColumn] - Optional date column to determine "latest"
 * @returns {Object} Map of key -> latest row object
 */
function getLatestByKey(sheetName, keyColumn, dateColumn) {
  const data = getSheetData(sheetName);
  const result = {};

  for (const row of data) {
    const key = row[keyColumn];
    if (!key) continue;

    const existing = result[key];
    if (!existing) {
      result[key] = row;
    } else if (dateColumn) {
      const existingDate = formatDateYMD_(existing[dateColumn]);
      const rowDate = formatDateYMD_(row[dateColumn]);
      if (rowDate > existingDate) {
        result[key] = row;
      }
    }
  }

  return result;
}

// ==================================================
// WRITE OPERATIONS
// ==================================================

/**
 * Appends a single row to a sheet.
 * @param {string} sheetName - The sheet name
 * @param {Object} rowObj - Row object with column names as keys
 * @param {Array<string>} [columns] - Column order (defaults to COLUMNS[sheetName])
 */
function appendRow(sheetName, rowObj, columns) {
  columns = columns || COLUMNS[sheetName];
  if (!columns) {
    throw new Error(`No column definition for sheet: ${sheetName}`);
  }

  const sheet = getOrCreateSheet(sheetName);

  // Ensure headers exist
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(columns);
  }

  const rowArray = columns.map(col => rowObj[col] !== undefined ? rowObj[col] : '');
  sheet.appendRow(rowArray);
}

/**
 * Batch writes multiple rows to a sheet.
 * Much more efficient than individual appendRow calls.
 * @param {string} sheetName - The sheet name
 * @param {Array<Object>} rowObjs - Array of row objects
 * @param {Array<string>} [columns] - Column order
 */
function batchWrite(sheetName, rowObjs, columns) {
  if (!rowObjs || rowObjs.length === 0) {
    return;
  }

  columns = columns || COLUMNS[sheetName];
  if (!columns) {
    throw new Error(`No column definition for sheet: ${sheetName}`);
  }

  const sheet = getOrCreateSheet(sheetName);

  // Ensure headers exist
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(columns);
  }

  // Convert objects to arrays
  const rowArrays = rowObjs.map(obj =>
    columns.map(col => obj[col] !== undefined ? obj[col] : '')
  );

  // Batch write
  const startRow = sheet.getLastRow() + 1;
  sheet.getRange(startRow, 1, rowArrays.length, columns.length).setValues(rowArrays);

  logDebug('storage', `Batch wrote ${rowArrays.length} rows to ${sheetName}`);
}

/**
 * Upserts rows by a composite key.
 * Updates existing rows if key exists, otherwise inserts.
 * @param {string} sheetName - The sheet name
 * @param {Array<Object>} rowObjs - Array of row objects
 * @param {Array<string>} keyColumns - Columns that form the unique key
 * @param {Array<string>} [columns] - Column order
 */
function upsertRows(sheetName, rowObjs, keyColumns, columns) {
  if (!rowObjs || rowObjs.length === 0) {
    return;
  }

  columns = columns || COLUMNS[sheetName];
  if (!columns) {
    throw new Error(`No column definition for sheet: ${sheetName}`);
  }

  const sheet = getOrCreateSheet(sheetName);

  // Ensure headers exist
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(columns);
    // If sheet was empty, just batch write all
    batchWrite(sheetName, rowObjs, columns);
    return;
  }

  // Get existing data
  const existingData = sheet.getDataRange().getValues();
  const headers = existingData[0];

  // Build key index
  const keyIndices = keyColumns.map(col => headers.indexOf(col));
  const existingKeyToRow = {};

  for (let i = 1; i < existingData.length; i++) {
    const key = keyIndices.map(idx => existingData[i][idx]).join('|');
    existingKeyToRow[key] = i + 1; // 1-indexed row number
  }

  const toInsert = [];
  const toUpdate = [];

  for (const obj of rowObjs) {
    const key = keyColumns.map(col => obj[col]).join('|');
    const existingRow = existingKeyToRow[key];

    if (existingRow) {
      toUpdate.push({ rowNum: existingRow, obj: obj });
    } else {
      toInsert.push(obj);
    }
  }

  // Update existing rows
  for (const update of toUpdate) {
    const rowArray = columns.map(col => update.obj[col] !== undefined ? update.obj[col] : '');
    sheet.getRange(update.rowNum, 1, 1, columns.length).setValues([rowArray]);
  }

  // Insert new rows
  if (toInsert.length > 0) {
    batchWrite(sheetName, toInsert, columns);
  }

  logDebug('storage', `Upserted to ${sheetName}: ${toUpdate.length} updated, ${toInsert.length} inserted`);
}

/**
 * Deletes rows matching a filter.
 * @param {string} sheetName - The sheet name
 * @param {Object} filters - Filter object { column: value }
 * @returns {number} Number of rows deleted
 */
function deleteRowsFiltered(sheetName, filters) {
  const sheet = getOrCreateSheet(sheetName);
  const data = sheet.getDataRange().getValues();

  if (data.length <= 1) {
    return 0;
  }

  const headers = data[0];
  const filterIndices = {};
  for (const col in filters) {
    filterIndices[col] = headers.indexOf(col);
  }

  // Find rows to delete (in reverse order to preserve indices)
  const rowsToDelete = [];
  for (let i = data.length - 1; i >= 1; i--) {
    let match = true;
    for (const col in filters) {
      if (data[i][filterIndices[col]] !== filters[col]) {
        match = false;
        break;
      }
    }
    if (match) {
      rowsToDelete.push(i + 1); // 1-indexed
    }
  }

  // Delete rows
  for (const rowNum of rowsToDelete) {
    sheet.deleteRow(rowNum);
  }

  return rowsToDelete.length;
}

/**
 * Clears all data from a sheet (keeps header).
 * @param {string} sheetName - The sheet name
 */
function clearSheetData(sheetName) {
  const sheet = getOrCreateSheet(sheetName);
  const lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    sheet.deleteRows(2, lastRow - 1);
  }
}

// ==================================================
// SPECIALIZED QUERIES
// ==================================================

/**
 * Gets enabled ETFs from the ETFS sheet.
 * @returns {Array<Object>} Array of ETF configuration objects
 */
function getEnabledEtfs() {
  return getSheetDataFiltered(SHEET_NAMES.ETFS, { enabled: true });
}

/**
 * Gets the latest holdings snapshot for an ETF.
 * @param {string} etf - The ETF symbol
 * @returns {Array<Object>} Holdings for the ETF
 */
function getLatestHoldingsForEtf(etf) {
  const allHoldings = getSheetDataFiltered(SHEET_NAMES.HOLDINGS_SNAPSHOT, { etf: etf });

  if (allHoldings.length === 0) {
    return [];
  }

  // Find the latest date
  let latestDate = '';
  for (const h of allHoldings) {
    const date = formatDateYMD_(h.asof_date);
    if (date > latestDate) {
      latestDate = date;
    }
  }

  // Return holdings for latest date
  return allHoldings.filter(h => formatDateYMD_(h.asof_date) === latestDate);
}

/**
 * Gets price history for a ticker.
 * @param {string} ticker - The ticker symbol
 * @param {number} [days] - Number of days of history (default from config)
 * @returns {Array<Object>} Price rows sorted by date ascending
 */
function getPriceHistory(ticker, days) {
  days = days || getConfigValue(CONFIG_KEYS.PRICE_LOOKBACK_DAYS, 140);

  const startDate = subtractDays_(new Date(), days);
  const startDateStr = formatDateYMD_(startDate);

  const prices = getSheetDataFiltered(SHEET_NAMES.PRICES_DAILY, { ticker: ticker });

  return prices
    .filter(p => formatDateYMD_(p.date) >= startDateStr)
    .sort((a, b) => formatDateYMD_(a.date).localeCompare(formatDateYMD_(b.date)));
}

/**
 * Gets breadth history for an ETF.
 * @param {string} etf - The ETF symbol
 * @param {number} [days] - Number of days of history
 * @returns {Array<Object>} Breadth rows sorted by date ascending
 */
function getBreadthHistory(etf, days) {
  days = days || getConfigValue(CONFIG_KEYS.BREADTH_Z_WINDOW, 252);

  const startDate = subtractDays_(new Date(), days);
  const startDateStr = formatDateYMD_(startDate);

  const breadth = getSheetDataFiltered(SHEET_NAMES.BREADTH_DAILY, { etf: etf });

  return breadth
    .filter(b => formatDateYMD_(b.date) >= startDateStr)
    .sort((a, b) => formatDateYMD_(a.date).localeCompare(formatDateYMD_(b.date)));
}

/**
 * Gets the latest signal for each ETF.
 * @returns {Object} Map of etf -> latest signal row
 */
function getLatestSignals() {
  return getLatestByKey(SHEET_NAMES.SIGNALS, 'etf', 'date');
}

// ==================================================
// UTILITY FUNCTIONS
// ==================================================

/**
 * Checks if a row is empty.
 * @private
 */
function isEmptyRow_(row) {
  return row.every(cell => cell === '' || cell === null || cell === undefined);
}

/**
 * Formats a date as YYYY-MM-DD.
 * @param {Date|string} date - The date to format
 * @returns {string} Formatted date string
 */
function formatDateYMD_(date) {
  if (!date) return '';

  if (typeof date === 'string') {
    // Already a string, try to normalize
    if (date.match(/^\d{4}-\d{2}-\d{2}$/)) {
      return date;
    }
    date = new Date(date);
  }

  if (!(date instanceof Date) || isNaN(date)) {
    return '';
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

/**
 * Subtracts days from a date.
 * @private
 */
function subtractDays_(date, days) {
  const result = new Date(date);
  result.setDate(result.getDate() - days);
  return result;
}

/**
 * Gets today's date in the configured timezone as YYYY-MM-DD.
 * @returns {string} Today's date
 */
function getTodayDateStr() {
  const tz = getConfigValue(CONFIG_KEYS.TIMEZONE, 'America/New_York');
  const now = new Date();
  const formatted = Utilities.formatDate(now, tz, 'yyyy-MM-dd');
  return formatted;
}

/**
 * Converts a Unix timestamp to Date.
 * @param {number} unixTimestamp - Unix timestamp in seconds
 * @returns {Date} Date object
 */
function unixToDate(unixTimestamp) {
  return new Date(unixTimestamp * 1000);
}

/**
 * Converts a Date to Unix timestamp.
 * @param {Date} date - Date object
 * @returns {number} Unix timestamp in seconds
 */
function dateToUnix(date) {
  return Math.floor(date.getTime() / 1000);
}

/**
 * Parses a JSON string safely.
 * @param {string} jsonStr - JSON string
 * @param {*} [defaultValue] - Default value if parsing fails
 * @returns {*} Parsed value or default
 */
function safeParseJson(jsonStr, defaultValue) {
  if (!jsonStr) return defaultValue;
  try {
    return JSON.parse(jsonStr);
  } catch (e) {
    return defaultValue;
  }
}
