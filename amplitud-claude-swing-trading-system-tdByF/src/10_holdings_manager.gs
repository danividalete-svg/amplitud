/**
 * ==================================================
 * 10_holdings_manager.gs - Holdings Manager
 * ==================================================
 *
 * Central manager for ETF holdings with automatic fallback chain.
 * Handles caching, staleness detection, and source selection.
 *
 * Source priority:
 * 1. FINNHUB (if available in plan)
 * 2. ISSUER_FILE (official CSV/XLSX from ETF provider)
 * 3. SEC_NPORT (SEC filings, delayed)
 * 4. MANUAL (user-provided in MANUAL_HOLDINGS sheet)
 *
 * Usage:
 *   const holdings = getHoldingsForEtf('XLK');
 *   refreshHoldings('XLK');
 */

/**
 * Gets the latest holdings for an ETF.
 * Uses cached data if recent enough, otherwise refreshes.
 * @param {string} etf - The ETF symbol
 * @param {boolean} [forceRefresh=false] - Force refresh from source
 * @returns {Object} { holdings: Array, asofDate: string, source: string, isStale: boolean }
 */
function getHoldingsForEtf(etf, forceRefresh) {
  etf = etf.toUpperCase();

  // Check for existing holdings
  const existingHoldings = getLatestHoldingsForEtf(etf);

  if (!forceRefresh && existingHoldings.length > 0) {
    // Check if holdings are recent enough
    const asofDate = existingHoldings[0].asof_date;
    const daysSince = daysBetween_(asofDate, new Date());
    const refreshDays = getConfigValue(CONFIG_KEYS.HOLDINGS_REFRESH_DAYS, 30);

    if (daysSince < refreshDays) {
      logDebug('holdings_manager', `Using cached holdings for ${etf} (${daysSince} days old)`);

      return {
        holdings: existingHoldings.map(h => ({
          ticker: h.holding_ticker,
          weight: h.weight,
          rank: h.rank
        })),
        asofDate: formatDateYMD_(asofDate),
        source: existingHoldings[0].source,
        isStale: existingHoldings[0].is_stale === true || existingHoldings[0].is_stale === 'TRUE'
      };
    }
  }

  // Need to refresh - try each source in order
  return refreshHoldings(etf);
}

/**
 * Refreshes holdings for an ETF using the fallback chain.
 * @param {string} etf - The ETF symbol
 * @returns {Object} { holdings: Array, asofDate: string, source: string, isStale: boolean }
 */
function refreshHoldings(etf) {
  etf = etf.toUpperCase();

  logInfo('holdings_manager', `Refreshing holdings for ${etf}`);

  // Get ETF config for source preferences
  const etfConfig = getEtfConfig_(etf);
  const sources = buildSourceChain_(etfConfig);

  for (const source of sources) {
    const result = tryFetchHoldings_(etf, source);

    if (result.success && result.data && result.data.length > 0) {
      // Save to sheet
      saveHoldingsToSheet_(etf, result.data, source);

      logInfo('holdings_manager', `Refreshed ${etf} with ${result.data.length} holdings from ${source}`);

      return {
        holdings: result.data,
        asofDate: getTodayDateStr(),
        source: source,
        isStale: false
      };
    }

    logDebug('holdings_manager', `Source ${source} failed for ${etf}: ${result.error}`);
  }

  // All sources failed - check for existing stale data
  const existingHoldings = getLatestHoldingsForEtf(etf);

  if (existingHoldings.length > 0) {
    // Mark as stale
    markHoldingsAsStale_(etf);

    logWarn('holdings_manager', `All sources failed for ${etf}, using stale data`);

    return {
      holdings: existingHoldings.map(h => ({
        ticker: h.holding_ticker,
        weight: h.weight,
        rank: h.rank
      })),
      asofDate: formatDateYMD_(existingHoldings[0].asof_date),
      source: existingHoldings[0].source,
      isStale: true
    };
  }

  // Try manual holdings as last resort
  const manualHoldings = getManualHoldings_(etf);

  if (manualHoldings.length > 0) {
    saveHoldingsToSheet_(etf, manualHoldings, DATA_SOURCES.HOLDINGS.MANUAL);

    logWarn('holdings_manager', `Using manual holdings for ${etf}`);

    return {
      holdings: manualHoldings,
      asofDate: getTodayDateStr(),
      source: DATA_SOURCES.HOLDINGS.MANUAL,
      isStale: false
    };
  }

  // Complete failure
  logError('holdings_manager', `No holdings available for ${etf}`);

  return {
    holdings: [],
    asofDate: null,
    source: null,
    isStale: true
  };
}

/**
 * Gets holdings for all enabled ETFs.
 * @param {boolean} [forceRefresh=false] - Force refresh all
 * @returns {Object} Map of etf -> holdings result
 */
function getHoldingsForAllEtfs(forceRefresh) {
  const enabledEtfs = getEnabledEtfs();
  const results = {};

  for (const etfConfig of enabledEtfs) {
    const etf = etfConfig.etf;

    try {
      results[etf] = getHoldingsForEtf(etf, forceRefresh);
    } catch (e) {
      logException('holdings_manager', `getHoldingsForEtf(${etf})`, e);
      results[etf] = {
        holdings: [],
        asofDate: null,
        source: null,
        isStale: true
      };
    }
  }

  return results;
}

/**
 * Refreshes holdings for ETFs that need updating.
 * @returns {Object} Summary of refresh results
 */
function runHoldingsRefresh() {
  logOperationStart('runHoldingsRefresh', {});

  const enabledEtfs = getEnabledEtfs();
  const refreshDays = getConfigValue(CONFIG_KEYS.HOLDINGS_REFRESH_DAYS, 30);

  let refreshed = 0;
  let skipped = 0;
  let failed = 0;

  for (const etfConfig of enabledEtfs) {
    const etf = etfConfig.etf;

    // Check if refresh is needed
    const existing = getLatestHoldingsForEtf(etf);

    if (existing.length > 0) {
      const asofDate = existing[0].asof_date;
      const daysSince = daysBetween_(asofDate, new Date());

      if (daysSince < refreshDays) {
        skipped++;
        continue;
      }
    }

    // Refresh needed
    try {
      const result = refreshHoldings(etf);

      if (result.holdings && result.holdings.length > 0 && !result.isStale) {
        refreshed++;
      } else {
        failed++;
      }
    } catch (e) {
      logException('holdings_manager', `refreshHoldings(${etf})`, e);
      failed++;
    }

    // Small delay between ETFs
    Utilities.sleep(200);
  }

  const summary = { refreshed, skipped, failed, total: enabledEtfs.length };
  logOperationEnd('runHoldingsRefresh', summary);

  return summary;
}

/**
 * Gets union of all unique holding tickers across all ETFs.
 * @returns {Array<string>} Unique ticker symbols
 */
function getAllUniqueTickers() {
  const holdings = getSheetData(SHEET_NAMES.HOLDINGS_SNAPSHOT);
  const tickers = new Set();

  for (const h of holdings) {
    if (h.holding_ticker) {
      tickers.add(h.holding_ticker);
    }
  }

  return Array.from(tickers);
}

/**
 * Gets the date of the last holdings snapshot for an ETF.
 * @param {string} etf - The ETF symbol
 * @returns {string|null} Date string or null
 */
function getLastHoldingsDate(etf) {
  const holdings = getLatestHoldingsForEtf(etf);
  if (holdings.length === 0) return null;
  return formatDateYMD_(holdings[0].asof_date);
}

/**
 * Checks if holdings changed recently (for regime change detection).
 * @param {string} etf - The ETF symbol
 * @param {number} [days] - Window to check
 * @returns {boolean} True if holdings changed within window
 */
function didHoldingsChangeRecently(etf, days) {
  days = days || getConfigValue(CONFIG_KEYS.HOLDINGS_STABILITY_DAYS, 10);

  const holdings = getSheetDataFiltered(SHEET_NAMES.HOLDINGS_SNAPSHOT, { etf: etf });

  if (holdings.length === 0) return false;

  // Get unique dates
  const dates = [...new Set(holdings.map(h => formatDateYMD_(h.asof_date)))].sort();

  if (dates.length < 2) return false;

  const latestDate = dates[dates.length - 1];
  const previousDate = dates[dates.length - 2];

  const daysSinceChange = daysBetween_(previousDate, latestDate);

  return daysSinceChange <= days;
}

// ==================================================
// PRIVATE HELPER FUNCTIONS
// ==================================================

/**
 * Gets ETF configuration from ETFS sheet.
 * @private
 */
function getEtfConfig_(etf) {
  const etfs = getSheetDataFiltered(SHEET_NAMES.ETFS, { etf: etf });
  return etfs.length > 0 ? etfs[0] : null;
}

/**
 * Builds the source chain based on ETF config and availability.
 * @private
 */
function buildSourceChain_(etfConfig) {
  const sources = [];

  // Add primary source
  let primary = DATA_SOURCES.HOLDINGS.FINNHUB;
  if (etfConfig && etfConfig.holdings_source_primary) {
    primary = etfConfig.holdings_source_primary;
  }

  // Check if Finnhub is available
  const finnhubOk = getConfigValue(CONFIG_KEYS.FINNHUB_HOLDINGS_OK, null);
  if (primary === DATA_SOURCES.HOLDINGS.FINNHUB && finnhubOk !== false) {
    sources.push(DATA_SOURCES.HOLDINGS.FINNHUB);
  }

  // Add issuer file
  if (!sources.includes(DATA_SOURCES.HOLDINGS.ISSUER_FILE)) {
    sources.push(DATA_SOURCES.HOLDINGS.ISSUER_FILE);
  }

  // Add fallback source
  if (etfConfig && etfConfig.holdings_source_fallback) {
    const fallback = etfConfig.holdings_source_fallback;
    if (!sources.includes(fallback)) {
      sources.push(fallback);
    }
  }

  // Always add manual as last resort (will be handled separately)

  return sources;
}

/**
 * Tries to fetch holdings from a specific source.
 * @private
 */
function tryFetchHoldings_(etf, source) {
  switch (source) {
    case DATA_SOURCES.HOLDINGS.FINNHUB:
      return fetchFinnhubEtfHoldings(etf);

    case DATA_SOURCES.HOLDINGS.ISSUER_FILE:
      return fetchIssuerHoldings(etf);

    case DATA_SOURCES.HOLDINGS.SEC_NPORT:
      return fetchSecNportHoldings_(etf);

    case DATA_SOURCES.HOLDINGS.MANUAL:
      const manual = getManualHoldings_(etf);
      return {
        success: manual.length > 0,
        data: manual,
        error: manual.length === 0 ? 'No manual holdings' : null
      };

    default:
      return {
        success: false,
        data: null,
        error: `Unknown source: ${source}`
      };
  }
}

/**
 * Fetches holdings from SEC N-PORT (placeholder - complex to implement fully).
 * @private
 */
function fetchSecNportHoldings_(etf) {
  // SEC N-PORT is complex - for now, return failure and fall through to next source
  // Full implementation would require:
  // 1. Find CIK for ETF
  // 2. Fetch latest N-PORT filing
  // 3. Parse XML
  return {
    success: false,
    data: null,
    error: 'SEC N-PORT not implemented (use ISSUER_FILE or MANUAL instead)'
  };
}

/**
 * Gets manual holdings from MANUAL_HOLDINGS sheet.
 * @private
 */
function getManualHoldings_(etf) {
  const manualData = getSheetDataFiltered(SHEET_NAMES.MANUAL_HOLDINGS, { etf: etf });

  if (manualData.length === 0) {
    return [];
  }

  return manualData
    .filter(h => h.holding_ticker)
    .sort((a, b) => (a.rank || 999) - (b.rank || 999))
    .map((h, i) => ({
      ticker: h.holding_ticker,
      weight: h.weight || null,
      rank: h.rank || i + 1
    }));
}

/**
 * Saves holdings to the HOLDINGS_SNAPSHOT sheet.
 * @private
 */
function saveHoldingsToSheet_(etf, holdings, source) {
  const asofDate = getTodayDateStr();

  const rows = holdings.map(h => ({
    asof_date: asofDate,
    etf: etf,
    holding_ticker: h.ticker,
    weight: h.weight,
    rank: h.rank,
    source: source,
    is_stale: false
  }));

  // Delete existing holdings for this ETF/date before inserting
  deleteRowsFiltered(SHEET_NAMES.HOLDINGS_SNAPSHOT, { etf: etf, asof_date: asofDate });

  batchWrite(SHEET_NAMES.HOLDINGS_SNAPSHOT, rows);
}

/**
 * Marks existing holdings as stale.
 * @private
 */
function markHoldingsAsStale_(etf) {
  const sheet = getOrCreateSheet(SHEET_NAMES.HOLDINGS_SNAPSHOT);
  const data = sheet.getDataRange().getValues();

  if (data.length <= 1) return;

  const headers = data[0];
  const etfCol = headers.indexOf('etf');
  const staleCol = headers.indexOf('is_stale');

  if (etfCol === -1 || staleCol === -1) return;

  for (let i = 1; i < data.length; i++) {
    if (data[i][etfCol] === etf) {
      sheet.getRange(i + 1, staleCol + 1).setValue(true);
    }
  }
}

/**
 * Calculates days between two dates.
 * @private
 */
function daysBetween_(date1, date2) {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  const diffMs = Math.abs(d2 - d1);
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}
