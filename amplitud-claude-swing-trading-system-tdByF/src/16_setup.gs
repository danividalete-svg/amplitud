/**
 * ==================================================
 * 16_setup.gs - System Setup and Initialization
 * ==================================================
 *
 * Provides functions to set up the system from scratch:
 * - Create required sheets with correct columns
 * - Populate default configuration
 * - Seed ETF universe
 * - Create Drive folders
 * - Set up triggers
 *
 * Usage:
 *   setupAll();  // Run once to initialize everything
 */

/**
 * Main setup function - initializes the entire system.
 * Run this once when setting up the system in a new spreadsheet.
 */
function setupAll() {
  logOperationStart('setupAll', {});

  try {
    // Step 1: Create all sheets
    setupSheets();

    // Step 2: Populate default configuration
    setupDefaultConfig();

    // Step 3: Seed ETF universe
    seedEtfsUniverse();

    // Step 4: Set up Drive folders
    setupDriveFolders();

    // Step 5: Test endpoints and update availability flags
    warmUpTestCalls();

    // Step 6: Set up triggers
    setupTriggers();

    logInfo('setup', 'System setup complete!');
    logOperationEnd('setupAll', { success: true });

    return { success: true, message: 'Setup complete!' };

  } catch (e) {
    logException('setup', 'setupAll', e);
    return { success: false, error: e.message };
  }
}

/**
 * Creates all required sheets with correct headers.
 */
function setupSheets() {
  logInfo('setup', 'Creating sheets...');

  // Create each sheet with its columns
  for (const sheetName of Object.values(SHEET_NAMES)) {
    const columns = COLUMNS[sheetName];

    if (!columns) {
      logWarn('setup', `No column definition for ${sheetName}, skipping`);
      continue;
    }

    const sheet = getOrCreateSheet(sheetName);

    // Check if sheet already has data
    if (sheet.getLastRow() > 0) {
      // Verify headers match
      const existingHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
      const headersMatch = columns.every((col, i) => existingHeaders[i] === col);

      if (!headersMatch) {
        logWarn('setup', `Headers mismatch in ${sheetName}, updating...`);
        sheet.getRange(1, 1, 1, columns.length).setValues([columns]);
      }
    } else {
      // Add headers
      sheet.appendRow(columns);
      sheet.setFrozenRows(1);
      sheet.getRange(1, 1, 1, columns.length).setFontWeight('bold');
    }

    logDebug('setup', `Sheet ${sheetName} ready`);
  }

  logInfo('setup', 'All sheets created');
}

/**
 * Populates CONFIG sheet with default values.
 */
function setupDefaultConfig() {
  logInfo('setup', 'Setting up default configuration...');

  const sheet = getOrCreateSheet(SHEET_NAMES.CONFIG);

  // Get existing keys
  const existingData = sheet.getDataRange().getValues();
  const existingKeys = new Set();

  for (let i = 1; i < existingData.length; i++) {
    if (existingData[i][0]) {
      existingKeys.add(existingData[i][0]);
    }
  }

  // Add missing default values
  const newRows = [];

  for (const [key, value] of Object.entries(DEFAULT_CONFIG)) {
    if (!existingKeys.has(key)) {
      const note = getConfigNote_(key);
      newRows.push([key, value, note]);
    }
  }

  // API key placeholders (user must fill these)
  const apiKeyPlaceholders = [
    [CONFIG_KEYS.FINNHUB_TOKEN, '', 'Get from https://finnhub.io/'],
    [CONFIG_KEYS.FMP_KEY, '', 'Get from https://financialmodelingprep.com/'],
    [CONFIG_KEYS.GCV_API_KEY, '', 'Get from Google Cloud Console (Vision API)']
  ];

  for (const [key, value, note] of apiKeyPlaceholders) {
    if (!existingKeys.has(key)) {
      newRows.push([key, value, note]);
    }
  }

  if (newRows.length > 0) {
    const startRow = sheet.getLastRow() + 1;
    sheet.getRange(startRow, 1, newRows.length, 3).setValues(newRows);
  }

  // Clear config cache
  clearConfigCache();

  logInfo('setup', `Added ${newRows.length} config entries`);
}

/**
 * Gets a descriptive note for a config key.
 * @private
 */
function getConfigNote_(key) {
  const notes = {
    [CONFIG_KEYS.TIMEZONE]: 'Timezone for date calculations (e.g., America/New_York)',
    [CONFIG_KEYS.HOLDINGS_TOP_N]: 'Number of top holdings to track per ETF',
    [CONFIG_KEYS.HOLDINGS_REFRESH_DAYS]: 'Days between holdings refresh',
    [CONFIG_KEYS.PRICE_LOOKBACK_DAYS]: 'Days of price history to maintain',
    [CONFIG_KEYS.BREADTH_Z_WINDOW]: 'Window (days) for Z-score calculation',
    [CONFIG_KEYS.SUPPORT_LOOKBACK_DAYS]: 'Days of history for support detection',
    [CONFIG_KEYS.SUPPORT_NEAR_PCT]: 'Percentage threshold for "near support" (e.g., 0.015 = 1.5%)',
    [CONFIG_KEYS.EXTREME_Z]: 'Legacy: Z-score threshold for extreme breadth',
    [CONFIG_KEYS.EXTREME_PCT_ABOVE20]: 'Percentage threshold for extreme (pct above SMA20)',
    [CONFIG_KEYS.EXTREME_PCT_ABOVE50]: 'Percentage threshold for extreme (pct above SMA50)',
    [CONFIG_KEYS.REQUIRE_GIRO]: 'Require breadth uptick (giro) for ENTER signal',
    [CONFIG_KEYS.VISION_ENABLED]: 'Enable vision/OCR layer (requires API key)',
    [CONFIG_KEYS.IMAGE_PROVIDER]: 'FINVIZ, FINBIT, or INTERNAL_CHARTS',
    [CONFIG_KEYS.IMAGE_TIMEFRAMES]: 'Comma-separated timeframes: D,W,M',
    [CONFIG_KEYS.MAX_HTTP_RETRIES]: 'Maximum HTTP request retries',
    [CONFIG_KEYS.HTTP_COOLDOWN_MS]: 'Base cooldown between retries (ms)',
    [CONFIG_KEYS.RATE_LIMIT_PER_DOMAIN_MS]: 'Minimum time between requests to same domain (ms)',
    [CONFIG_KEYS.MAX_DAILY_HTTP]: 'Daily budget for HTTP requests',
    [CONFIG_KEYS.MAX_DAILY_VISION]: 'Daily budget for Vision API calls',
    [CONFIG_KEYS.Z_METHOD]: 'Z-score method: STD (standard) or ROBUST (median/MAD)',
    [CONFIG_KEYS.Z_WINDOW_DAYS]: 'Window for advanced Z-score (default 252)',
    [CONFIG_KEYS.Z_MIN_OBS]: 'Minimum observations for Z-score (default 126)',
    [CONFIG_KEYS.Z_WINSORIZE]: 'Winsorize historical data to reduce outlier impact',
    [CONFIG_KEYS.Z_WINSOR_PCT]: 'Winsorization percentile (e.g., 0.02 = 2%)',
    [CONFIG_KEYS.EXTREME_Z20]: 'Z-score threshold for SMA20 extreme',
    [CONFIG_KEYS.EXTREME_Z50]: 'Z-score threshold for SMA50 extreme',
    [CONFIG_KEYS.EXTREME_COMBINER]: 'ANY, BOTH, or WEIGHTED for combining extremes',
    [CONFIG_KEYS.EXTREME_PCTL20]: 'Percentile threshold for SMA20 extreme (e.g., 0.05 = 5th percentile)',
    [CONFIG_KEYS.EXTREME_PCTL50]: 'Percentile threshold for SMA50 extreme',
    [CONFIG_KEYS.EXTREME_USE_PCTL]: 'Use percentile in addition to Z-score',
    [CONFIG_KEYS.EXTREME_REQUIRE_PERSISTENCE]: 'Require extreme condition to persist N days',
    [CONFIG_KEYS.EXTREME_PERSIST_DAYS]: 'Days of persistence required',
    [CONFIG_KEYS.EXTREME_REQUIRE_REVERSION]: 'Require uptick/reversion for signal',
    [CONFIG_KEYS.REVERSION_MIN_UPTICK]: 'Minimum uptick in pct_above for reversion',
    [CONFIG_KEYS.REVERSION_CROSS_LEVEL20]: 'Level crossing threshold for reversion',
    [CONFIG_KEYS.HOLDINGS_STABILITY_REQUIRED]: 'Require holdings stability for Z-based signals',
    [CONFIG_KEYS.HOLDINGS_STABILITY_DAYS]: 'Days of stability required',
    [CONFIG_KEYS.TREND_METHOD]: 'SMA200, SMA50_SLOPE, or BOTH for trend determination'
  };

  return notes[key] || '';
}

/**
 * Seeds the ETFS sheet with the initial ETF universe.
 */
function seedEtfsUniverse() {
  logInfo('setup', 'Seeding ETF universe...');

  const sheet = getOrCreateSheet(SHEET_NAMES.ETFS);

  // Get existing ETFs
  const existingData = sheet.getDataRange().getValues();
  const existingEtfs = new Set();

  for (let i = 1; i < existingData.length; i++) {
    if (existingData[i][0]) {
      existingEtfs.add(existingData[i][0]);
    }
  }

  // Add missing ETFs
  const newRows = [];

  for (const etfInfo of ETF_UNIVERSE) {
    if (!existingEtfs.has(etfInfo.etf)) {
      newRows.push({
        etf: etfInfo.etf,
        nombre: etfInfo.nombre,
        enabled: true,
        holdings_source_primary: DATA_SOURCES.HOLDINGS.FINNHUB,
        holdings_source_fallback: DATA_SOURCES.HOLDINGS.ISSUER_FILE,
        price_source_primary: DATA_SOURCES.PRICES.YAHOO_CHART,
        price_source_fallback: DATA_SOURCES.PRICES.FINNHUB_CANDLES,
        notes: etfInfo.sector
      });
    }
  }

  if (newRows.length > 0) {
    batchWrite(SHEET_NAMES.ETFS, newRows);
  }

  logInfo('setup', `Added ${newRows.length} ETFs, total universe: ${ETF_UNIVERSE.length}`);
}

/**
 * Sets up Drive folders for image storage.
 */
function setupDriveFolders() {
  logInfo('setup', 'Setting up Drive folders...');

  try {
    // Create root folder if it doesn't exist
    const rootFolderName = DRIVE_FOLDERS.ROOT;
    const existingFolders = DriveApp.getFoldersByName(rootFolderName);

    if (!existingFolders.hasNext()) {
      DriveApp.createFolder(rootFolderName);
      logInfo('setup', `Created Drive folder: ${rootFolderName}`);
    } else {
      logDebug('setup', `Drive folder already exists: ${rootFolderName}`);
    }
  } catch (e) {
    logWarn('setup', `Could not set up Drive folders: ${e.message}`);
  }
}

/**
 * Tests API endpoints and updates availability flags.
 */
function warmUpTestCalls() {
  logInfo('setup', 'Testing API endpoints...');

  const results = {};

  // Test Yahoo Finance
  const yahooResult = testYahooAvailability();
  results.yahoo = yahooResult;
  setConfigValue(CONFIG_KEYS.YAHOO_OK, yahooResult.available, yahooResult.message);

  // Test Finnhub Candles
  const finnhubCandlesResult = testFinnhubCandlesAvailability();
  results.finnhubCandles = finnhubCandlesResult;
  setConfigValue(CONFIG_KEYS.FINNHUB_CANDLES_OK, finnhubCandlesResult.available, finnhubCandlesResult.message);

  // Test Finnhub Holdings
  const finnhubHoldingsResult = testFinnhubHoldingsAvailability();
  results.finnhubHoldings = finnhubHoldingsResult;
  setConfigValue(CONFIG_KEYS.FINNHUB_HOLDINGS_OK, finnhubHoldingsResult.available, finnhubHoldingsResult.message);

  // Test FMP
  const fmpResult = testFmpAvailability();
  results.fmp = fmpResult;
  setConfigValue(CONFIG_KEYS.FMP_OK, fmpResult.available, fmpResult.message);

  // Log results
  logInfo('setup', 'API availability test results:', results);

  return results;
}

/**
 * Sets up time-based triggers for automation.
 */
function setupTriggers() {
  logInfo('setup', 'Setting up triggers...');

  // Remove existing triggers for our functions
  const existingTriggers = ScriptApp.getProjectTriggers();

  for (const trigger of existingTriggers) {
    const handlerName = trigger.getHandlerFunction();
    if (['runDaily', 'runHoldingsRefresh'].includes(handlerName)) {
      ScriptApp.deleteTrigger(trigger);
      logDebug('setup', `Removed existing trigger: ${handlerName}`);
    }
  }

  // Create daily trigger for runDaily
  // Run at 5 PM Eastern (after market close)
  ScriptApp.newTrigger('runDaily')
    .timeBased()
    .everyDays(1)
    .atHour(17)
    .nearMinute(30)
    .create();

  logInfo('setup', 'Created daily trigger for runDaily at 17:30');

  // Create monthly trigger for holdings refresh
  ScriptApp.newTrigger('runHoldingsRefresh')
    .timeBased()
    .onMonthDay(1)
    .atHour(6)
    .create();

  logInfo('setup', 'Created monthly trigger for runHoldingsRefresh');
}

/**
 * Removes all project triggers.
 */
function removeTriggers() {
  const triggers = ScriptApp.getProjectTriggers();
  for (const trigger of triggers) {
    ScriptApp.deleteTrigger(trigger);
  }
  logInfo('setup', `Removed ${triggers.length} triggers`);
}

/**
 * Creates a test configuration for dry-run mode.
 */
function setupDryRunMode() {
  setConfigValue('DRY_RUN', true, 'Dry-run mode: no external API calls');
  logInfo('setup', 'Dry-run mode enabled');
}

/**
 * Disables dry-run mode.
 */
function disableDryRunMode() {
  setConfigValue('DRY_RUN', false, 'Normal mode');
  logInfo('setup', 'Dry-run mode disabled');
}

/**
 * Checks if dry-run mode is enabled.
 * @returns {boolean}
 */
function isDryRunMode() {
  return getConfigValue('DRY_RUN', false) === true;
}

/**
 * Verifies system health and logs a status report.
 */
function verifySystemHealth() {
  logOperationStart('verifySystemHealth', {});

  const health = {
    sheets: {},
    config: {},
    apiAvailability: {},
    budgets: {}
  };

  // Check sheets
  for (const sheetName of Object.values(SHEET_NAMES)) {
    const sheet = getSpreadsheet().getSheetByName(sheetName);
    health.sheets[sheetName] = {
      exists: !!sheet,
      rows: sheet ? sheet.getLastRow() : 0
    };
  }

  // Check critical config
  const criticalKeys = [
    CONFIG_KEYS.TIMEZONE,
    CONFIG_KEYS.HOLDINGS_TOP_N,
    CONFIG_KEYS.PRICE_LOOKBACK_DAYS
  ];

  for (const key of criticalKeys) {
    const value = getConfigValue(key, null);
    health.config[key] = value !== null && value !== undefined && value !== '';
  }

  // Check API keys
  health.config.hasFinnhubToken = !!getConfigValue(CONFIG_KEYS.FINNHUB_TOKEN, '');
  health.config.hasFmpKey = !!getConfigValue(CONFIG_KEYS.FMP_KEY, '');
  health.config.hasGcvKey = !!getConfigValue(CONFIG_KEYS.GCV_API_KEY, '');

  // Check API availability
  health.apiAvailability = {
    yahoo: getConfigValue(CONFIG_KEYS.YAHOO_OK, null),
    finnhubCandles: getConfigValue(CONFIG_KEYS.FINNHUB_CANDLES_OK, null),
    finnhubHoldings: getConfigValue(CONFIG_KEYS.FINNHUB_HOLDINGS_OK, null),
    fmp: getConfigValue(CONFIG_KEYS.FMP_OK, null)
  };

  // Check budgets
  health.budgets = getBudgetCounters();

  // Log report
  logInfo('setup', 'System health check', health);
  logOperationEnd('verifySystemHealth', health);

  return health;
}

/**
 * Resets all data sheets (keeps CONFIG and ETFS).
 * USE WITH CAUTION!
 */
function resetDataSheets() {
  const sheetsToReset = [
    SHEET_NAMES.HOLDINGS_SNAPSHOT,
    SHEET_NAMES.PRICES_DAILY,
    SHEET_NAMES.BREADTH_DAILY,
    SHEET_NAMES.ETF_TECH_DAILY,
    SHEET_NAMES.IMAGES,
    SHEET_NAMES.VISION_SIGNALS,
    SHEET_NAMES.SIGNALS,
    SHEET_NAMES.LOG
  ];

  for (const sheetName of sheetsToReset) {
    clearSheetData(sheetName);
    logInfo('setup', `Cleared ${sheetName}`);
  }

  logInfo('setup', 'Data sheets reset complete');
}
