/**
 * ==================================================
 * 01_logger.gs - Logging Module
 * ==================================================
 *
 * Provides structured logging to both the LOG sheet and console.
 * All logs include timestamp, level, module, message, and optional metadata.
 *
 * Usage:
 *   logInfo('prices', 'Fetched 100 tickers', { count: 100 });
 *   logWarn('holdings', 'Using stale data', { etf: 'XLK' });
 *   logError('http', 'Request failed', { url: '...', error: e.message });
 */

/**
 * Logs a message at INFO level.
 * @param {string} module - The module name (e.g., 'prices', 'breadth')
 * @param {string} message - The log message
 * @param {Object} [meta] - Optional metadata object
 */
function logInfo(module, message, meta) {
  writeLog_(LOG_LEVELS.INFO, module, message, meta);
}

/**
 * Logs a message at WARN level.
 * @param {string} module - The module name
 * @param {string} message - The log message
 * @param {Object} [meta] - Optional metadata object
 */
function logWarn(module, message, meta) {
  writeLog_(LOG_LEVELS.WARN, module, message, meta);
}

/**
 * Logs a message at ERROR level.
 * @param {string} module - The module name
 * @param {string} message - The log message
 * @param {Object} [meta] - Optional metadata object
 */
function logError(module, message, meta) {
  writeLog_(LOG_LEVELS.ERROR, module, message, meta);
}

/**
 * Logs a message at DEBUG level.
 * @param {string} module - The module name
 * @param {string} message - The log message
 * @param {Object} [meta] - Optional metadata object
 */
function logDebug(module, message, meta) {
  writeLog_(LOG_LEVELS.DEBUG, module, message, meta);
}

/**
 * Internal function to write log entry to sheet and console.
 * @private
 */
function writeLog_(level, module, message, meta) {
  const timestamp = new Date().toISOString();
  const metaJson = meta ? JSON.stringify(meta) : '';

  // Write to Apps Script Logger (console)
  const consoleMsg = `[${level}] [${module}] ${message}${meta ? ' ' + metaJson : ''}`;
  if (level === LOG_LEVELS.ERROR) {
    console.error(consoleMsg);
  } else if (level === LOG_LEVELS.WARN) {
    console.warn(consoleMsg);
  } else {
    console.log(consoleMsg);
  }

  // Write to LOG sheet (with try-catch to prevent logging failures from breaking the system)
  try {
    const logSheet = getOrCreateSheet(SHEET_NAMES.LOG);
    const row = [timestamp, level, module, message, metaJson];

    // Ensure headers exist
    if (logSheet.getLastRow() === 0) {
      logSheet.appendRow(COLUMNS.LOG);
    }

    logSheet.appendRow(row);

    // Trim old logs if exceeding limit
    trimLogSheet_(logSheet);
  } catch (e) {
    console.error('Failed to write to LOG sheet: ' + e.message);
  }
}

/**
 * Trims the LOG sheet if it exceeds the maximum number of rows.
 * @private
 */
function trimLogSheet_(logSheet) {
  const maxRows = LIMITS.LOG_MAX_ROWS;
  const currentRows = logSheet.getLastRow();

  if (currentRows > maxRows) {
    const rowsToDelete = currentRows - maxRows + 100; // Delete extra 100 for buffer
    logSheet.deleteRows(2, rowsToDelete); // Keep header row
  }
}

/**
 * Logs a batch operation start.
 * @param {string} operation - The operation name
 * @param {Object} params - Parameters for the operation
 */
function logOperationStart(operation, params) {
  logInfo('system', `Starting: ${operation}`, params);
}

/**
 * Logs a batch operation end.
 * @param {string} operation - The operation name
 * @param {Object} result - Result summary
 */
function logOperationEnd(operation, result) {
  logInfo('system', `Completed: ${operation}`, result);
}

/**
 * Logs an API call for tracking and auditing.
 * @param {string} provider - The provider name (yahoo, finnhub, fmp, etc.)
 * @param {string} endpoint - The endpoint called
 * @param {number} statusCode - HTTP status code
 * @param {number} durationMs - Request duration in milliseconds
 */
function logApiCall(provider, endpoint, statusCode, durationMs) {
  logDebug('api', `${provider}: ${statusCode} in ${durationMs}ms`, {
    provider: provider,
    endpoint: endpoint.substring(0, 100), // Truncate long URLs
    statusCode: statusCode,
    durationMs: durationMs
  });
}

/**
 * Creates a structured error log with stack trace.
 * @param {string} module - The module where error occurred
 * @param {string} operation - The operation that failed
 * @param {Error} error - The error object
 * @param {Object} [context] - Additional context
 */
function logException(module, operation, error, context) {
  const meta = {
    operation: operation,
    errorMessage: error.message,
    errorStack: error.stack,
    ...context
  };
  logError(module, `Exception in ${operation}`, meta);
}

/**
 * Logs a circuit breaker state change.
 * @param {string} domain - The domain affected
 * @param {string} newState - The new state (open, closed, half-open)
 * @param {string} reason - Reason for state change
 */
function logCircuitBreaker(domain, newState, reason) {
  logWarn('circuit_breaker', `${domain}: ${newState}`, { reason: reason });
}

/**
 * Logs budget/quota warnings.
 * @param {string} resource - The resource type
 * @param {number} used - Amount used
 * @param {number} limit - The limit
 */
function logQuotaWarning(resource, used, limit) {
  const pct = ((used / limit) * 100).toFixed(1);
  logWarn('budget', `${resource}: ${used}/${limit} (${pct}%)`, {
    resource: resource,
    used: used,
    limit: limit
  });
}

/**
 * Clears all logs from the LOG sheet (keeps header).
 * Useful for debugging/testing.
 */
function clearLogs() {
  const logSheet = getOrCreateSheet(SHEET_NAMES.LOG);
  const lastRow = logSheet.getLastRow();
  if (lastRow > 1) {
    logSheet.deleteRows(2, lastRow - 1);
  }
  logInfo('system', 'Logs cleared');
}

/**
 * Gets recent log entries as an array of objects.
 * @param {number} [count=100] - Number of recent entries to retrieve
 * @param {string} [levelFilter] - Optional level filter (INFO, WARN, ERROR, DEBUG)
 * @returns {Array<Object>} Array of log entries
 */
function getRecentLogs(count, levelFilter) {
  count = count || 100;
  const logSheet = getOrCreateSheet(SHEET_NAMES.LOG);
  const lastRow = logSheet.getLastRow();

  if (lastRow <= 1) {
    return [];
  }

  const startRow = Math.max(2, lastRow - count + 1);
  const numRows = lastRow - startRow + 1;
  const data = logSheet.getRange(startRow, 1, numRows, COLUMNS.LOG.length).getValues();

  const logs = data.map(row => ({
    timestamp: row[0],
    level: row[1],
    module: row[2],
    message: row[3],
    meta: row[4] ? tryParseJson_(row[4]) : null
  }));

  // Filter by level if specified
  if (levelFilter) {
    return logs.filter(log => log.level === levelFilter);
  }

  return logs.reverse(); // Most recent first
}

/**
 * Helper to safely parse JSON.
 * @private
 */
function tryParseJson_(str) {
  try {
    return JSON.parse(str);
  } catch (e) {
    return str;
  }
}

/**
 * Logs a dry-run action (when testing without making real changes).
 * @param {string} module - The module name
 * @param {string} action - The action that would be taken
 * @param {Object} [details] - Details about the action
 */
function logDryRun(module, action, details) {
  logInfo(module, `[DRY-RUN] Would: ${action}`, details);
}
