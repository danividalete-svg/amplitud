/**
 * ==================================================
 * 19_orchestrator.gs - Main Orchestration Module
 * ==================================================
 *
 * Provides the main entry points for running the trading system:
 * - runDaily(): Main daily execution
 * - runHoldingsRefresh(): Monthly holdings update
 * - Manual execution functions
 *
 * Orchestrates the complete pipeline:
 * 1. Refresh holdings (if needed)
 * 2. Fetch prices for all tickers
 * 3. Compute breadth metrics
 * 4. Compute technical levels
 * 5. Generate signals
 * 6. (Optional) Vision analysis
 * 7. Export report
 */

/**
 * Main daily execution function.
 * Called by trigger at market close.
 */
function runDaily() {
  const startTime = Date.now();
  const date = getTodayDateStr();

  logOperationStart('runDaily', { date });
  logInfo('orchestrator', '========================================');
  logInfo('orchestrator', `Starting daily run for ${date}`);
  logInfo('orchestrator', '========================================');

  // Initialize budget tracking
  initBudgetTracking();

  const results = {
    date: date,
    holdingsRefreshed: 0,
    pricesFetched: 0,
    breadthComputed: 0,
    techComputed: 0,
    signalsGenerated: 0,
    visionAnalyzed: 0,
    errors: []
  };

  try {
    // Step 1: Check holdings freshness and refresh if needed
    logInfo('orchestrator', 'Step 1: Checking holdings...');
    const holdingsResult = runHoldingsCheckAndRefresh_();
    results.holdingsRefreshed = holdingsResult.refreshed;

    // Check budget status
    if (!checkShouldContinue().canContinue) {
      throw new Error('Budget exhausted after holdings refresh');
    }

    // Step 2: Get all tickers we need prices for
    logInfo('orchestrator', 'Step 2: Building ticker universe...');
    const tickerUniverse = buildTickerUniverse_();
    logInfo('orchestrator', `Ticker universe: ${tickerUniverse.length} tickers`);

    // Step 3: Fetch and store prices
    logInfo('orchestrator', 'Step 3: Fetching prices...');
    const pricesResult = fetchAndStorePrices(tickerUniverse);
    results.pricesFetched = pricesResult.success;

    // Check budget status
    if (!checkShouldContinue().canContinue) {
      logWarn('orchestrator', 'Budget critical, skipping some steps');
    }

    // Step 4: Compute breadth metrics
    logInfo('orchestrator', 'Step 4: Computing breadth...');
    const breadthResult = computeAndStoreBreadthForAllEtfs(date);
    results.breadthComputed = breadthResult.success;

    // Step 5: Compute technical levels
    logInfo('orchestrator', 'Step 5: Computing technicals...');
    const techResult = computeAndStoreEtfTechForAllEtfs(date);
    results.techComputed = techResult.success;

    // Step 6: Generate signals
    logInfo('orchestrator', 'Step 6: Generating signals...');
    const signalsResult = computeAndStoreSignalsForAllEtfs(date);
    results.signalsGenerated = signalsResult.enter + signalsResult.watch;

    // Step 7: Vision analysis (if enabled)
    const visionEnabled = getConfigValue(CONFIG_KEYS.VISION_ENABLED, false);
    if (visionEnabled && !shouldSkipVision()) {
      logInfo('orchestrator', 'Step 7: Running vision analysis...');

      // Download images for candidates
      const imageResult = downloadImagesForCandidates(date);

      // Analyze images
      const visionResult = runVisionForNewImages(date);
      results.visionAnalyzed = visionResult.analyzed;

      // Recompute signals with vision
      recomputeSignalsWithVision(date);
    } else {
      logInfo('orchestrator', 'Step 7: Vision analysis skipped');
    }

    // Step 8: Export daily report
    logInfo('orchestrator', 'Step 8: Exporting report...');
    exportDailyReport(date);

    // Log final summary
    const durationSec = ((Date.now() - startTime) / 1000).toFixed(1);

    logInfo('orchestrator', '========================================');
    logInfo('orchestrator', `Daily run completed in ${durationSec}s`);
    logInfo('orchestrator', `Results: ${JSON.stringify(results)}`);
    logInfo('orchestrator', '========================================');

    // Log budget report
    logBudgetReport();

    // Get signal summary for final log
    const enterSignals = getTodayEnterSignals();
    const watchSignals = getTodayWatchSignals();

    logInfo('orchestrator', `ENTER signals: ${enterSignals.length}`);
    for (const sig of enterSignals) {
      logInfo('orchestrator', `  - ${sig.etf}: score=${sig.score}, reason=${sig.reason}`);
    }

    logInfo('orchestrator', `WATCH signals: ${watchSignals.length}`);
    for (const sig of watchSignals.slice(0, 5)) {
      logInfo('orchestrator', `  - ${sig.etf}: score=${sig.score}, reason=${sig.reason}`);
    }

  } catch (e) {
    results.errors.push(e.message);
    logException('orchestrator', 'runDaily', e);
  }

  logOperationEnd('runDaily', results);
  return results;
}

/**
 * Holdings refresh function.
 * Called by monthly trigger.
 */
function runHoldingsRefresh() {
  logOperationStart('runHoldingsRefresh (monthly)', {});

  initBudgetTracking();

  const result = runHoldingsRefreshInternal_();

  logBudgetReport();
  logOperationEnd('runHoldingsRefresh (monthly)', result);

  return result;
}

// ==================================================
// INTERNAL ORCHESTRATION HELPERS
// ==================================================

/**
 * Checks holdings freshness and refreshes if needed.
 * @private
 */
function runHoldingsCheckAndRefresh_() {
  const enabledEtfs = getEnabledEtfs();
  const refreshDays = getConfigValue(CONFIG_KEYS.HOLDINGS_REFRESH_DAYS, 30);

  let refreshed = 0;
  let skipped = 0;

  for (const etfConfig of enabledEtfs) {
    const etf = etfConfig.etf;
    const lastDate = getLastHoldingsDate(etf);

    if (!lastDate) {
      // No holdings - must refresh
      try {
        const result = refreshHoldings(etf);
        if (result.holdings && result.holdings.length > 0) {
          refreshed++;
        }
      } catch (e) {
        logException('orchestrator', `refreshHoldings(${etf})`, e);
      }
    } else {
      const daysSince = daysBetween_(lastDate, new Date());
      if (daysSince >= refreshDays) {
        // Stale - refresh
        try {
          const result = refreshHoldings(etf);
          if (result.holdings && result.holdings.length > 0 && !result.isStale) {
            refreshed++;
          }
        } catch (e) {
          logException('orchestrator', `refreshHoldings(${etf})`, e);
        }
      } else {
        skipped++;
      }
    }

    // Check budget periodically
    if (!checkShouldContinue().canContinue) {
      logWarn('orchestrator', 'Budget critical during holdings refresh');
      break;
    }
  }

  return { refreshed, skipped, total: enabledEtfs.length };
}

/**
 * Internal holdings refresh function.
 * @private
 */
function runHoldingsRefreshInternal_() {
  const result = runHoldingsRefresh();
  return result;
}

/**
 * Builds the complete ticker universe (ETFs + all holdings).
 * @private
 */
function buildTickerUniverse_() {
  const enabledEtfs = getEnabledEtfs();
  const tickers = new Set();

  // Add ETFs themselves
  for (const etfConfig of enabledEtfs) {
    tickers.add(etfConfig.etf);
  }

  // Add all holdings
  const allHoldingTickers = getAllUniqueTickers();
  for (const ticker of allHoldingTickers) {
    tickers.add(ticker);
  }

  return Array.from(tickers).sort();
}

/**
 * Fetches and stores prices for a list of tickers.
 * Uses fallback chain: Yahoo -> Finnhub -> FMP.
 * @param {Array<string>} tickers - List of tickers
 * @returns {Object} Summary of results
 */
function fetchAndStorePrices(tickers) {
  logOperationStart('fetchAndStorePrices', { count: tickers.length });

  const lookbackDays = getConfigValue(CONFIG_KEYS.PRICE_LOOKBACK_DAYS, 140);
  const range = getYahooRangeForDays(lookbackDays);

  let success = 0;
  let failed = 0;
  const failedTickers = [];

  // Apply degradation if needed
  tickers = applyTickerDegradation(tickers);

  // Process tickers with Yahoo as primary
  for (const ticker of tickers) {
    // Check budget
    if (!checkShouldContinue().canContinue) {
      logWarn('orchestrator', 'Budget exhausted during price fetch');
      break;
    }

    const result = fetchPriceWithFallback_(ticker, range);

    if (result.success && result.data && result.data.length > 0) {
      // Attach SMAs
      const enhancedData = attachSMAs(result.data, [20, 50, 200]);

      // Save to sheet
      upsertRows(SHEET_NAMES.PRICES_DAILY, enhancedData, ['date', 'ticker']);
      success++;
    } else {
      failed++;
      failedTickers.push(ticker);
    }

    // Small delay to be respectful
    if (success % 10 === 0) {
      Utilities.sleep(100);
    }
  }

  if (failedTickers.length > 0) {
    logWarn('orchestrator', `Failed to fetch prices for ${failedTickers.length} tickers`, {
      sample: failedTickers.slice(0, 10)
    });
  }

  const summary = { success, failed, total: tickers.length };
  logOperationEnd('fetchAndStorePrices', summary);

  return summary;
}

/**
 * Fetches price with fallback chain.
 * @private
 */
function fetchPriceWithFallback_(ticker, range) {
  // Try Yahoo first
  const yahooOk = getConfigValue(CONFIG_KEYS.YAHOO_OK, true);
  if (yahooOk !== false) {
    const yahooResult = fetchYahooChart(ticker, range, '1d');
    if (yahooResult.success && yahooResult.data && yahooResult.data.length > 0) {
      return yahooResult;
    }
  }

  // Try Finnhub
  const finnhubOk = getConfigValue(CONFIG_KEYS.FINNHUB_CANDLES_OK, null);
  if (finnhubOk !== false) {
    const toDate = new Date();
    const fromDate = subtractDays_(toDate, parseInt(range.replace(/[^0-9]/g, '')) || 180);
    const finnhubResult = fetchFinnhubCandles(ticker, fromDate, toDate);
    if (finnhubResult.success && finnhubResult.data && finnhubResult.data.length > 0) {
      return finnhubResult;
    }
  }

  // Try FMP as last resort (be careful with quota)
  const fmpOk = getConfigValue(CONFIG_KEYS.FMP_OK, null);
  const degradation = getDegradationMode();

  if (fmpOk !== false && !degradation.limitTickers) {
    const toDate = formatDateYMD_(new Date());
    const fromDate = formatDateYMD_(subtractDays_(new Date(), 180));
    const fmpResult = fetchFmpEod(ticker, fromDate, toDate);
    if (fmpResult.success && fmpResult.data && fmpResult.data.length > 0) {
      return fmpResult;
    }
  }

  return { success: false, data: null, error: 'All sources failed' };
}

// ==================================================
// MANUAL EXECUTION FUNCTIONS
// ==================================================

/**
 * Runs the complete pipeline for a specific date.
 * Useful for backfilling or testing.
 * @param {string} date - Date in YYYY-MM-DD format
 */
function runForDate(date) {
  if (!date || !date.match(/^\d{4}-\d{2}-\d{2}$/)) {
    throw new Error('Invalid date format. Use YYYY-MM-DD');
  }

  logInfo('orchestrator', `Running pipeline for specific date: ${date}`);

  // Note: Price fetching will get current data, not historical
  // This is mainly useful for recomputing signals with existing data

  // Compute breadth
  const breadthResult = computeAndStoreBreadthForAllEtfs(date);
  logInfo('orchestrator', `Breadth computed: ${breadthResult.success}`);

  // Compute technicals
  const techResult = computeAndStoreEtfTechForAllEtfs(date);
  logInfo('orchestrator', `Technicals computed: ${techResult.success}`);

  // Generate signals
  const signalsResult = computeAndStoreSignalsForAllEtfs(date);
  logInfo('orchestrator', `Signals: ${signalsResult.enter} ENTER, ${signalsResult.watch} WATCH`);

  // Export report
  exportDailyReport(date);

  return {
    date,
    breadth: breadthResult,
    tech: techResult,
    signals: signalsResult
  };
}

/**
 * Quick test function to verify the system works.
 * Tests a single ETF through the pipeline.
 * @param {string} [etf='XLK'] - ETF to test
 */
function testSingleEtf(etf) {
  etf = etf || 'XLK';
  const date = getTodayDateStr();

  logInfo('orchestrator', `Testing single ETF: ${etf}`);

  // Get holdings
  const holdings = getHoldingsForEtf(etf);
  logInfo('orchestrator', `Holdings: ${holdings.holdings ? holdings.holdings.length : 0}`);

  // Compute breadth
  const breadth = computeBreadthForEtf(etf, date);
  logInfo('orchestrator', `Breadth: pct20=${breadth.pct_above_sma20}, z20=${breadth.z_pct_above_sma20}`);

  // Compute technicals
  const tech = computeEtfTechnicals(etf, date);
  logInfo('orchestrator', `Tech: support=${tech.support_level}, nearSupport=${tech.near_support_flag}`);

  // Compute signal
  upsertRows(SHEET_NAMES.BREADTH_DAILY, [breadth], ['date', 'etf']);
  upsertRows(SHEET_NAMES.ETF_TECH_DAILY, [tech], ['date', 'etf']);

  const signal = computeSignalForEtf(etf, date);
  logInfo('orchestrator', `Signal: ${signal.final_signal}, score=${signal.score}`);

  return { etf, holdings, breadth, tech, signal };
}

/**
 * Runs a dry-run without making external API calls.
 * Uses cached data only.
 */
function runDryRun() {
  setupDryRunMode();

  logInfo('orchestrator', '========================================');
  logInfo('orchestrator', 'Starting DRY-RUN (no external API calls)');
  logInfo('orchestrator', '========================================');

  const date = getTodayDateStr();

  // Just compute with existing data
  const breadthResult = computeAndStoreBreadthForAllEtfs(date);
  const techResult = computeAndStoreEtfTechForAllEtfs(date);
  const signalsResult = computeAndStoreSignalsForAllEtfs(date);

  disableDryRunMode();

  return {
    date,
    breadth: breadthResult,
    tech: techResult,
    signals: signalsResult,
    dryRun: true
  };
}

/**
 * Gets a summary of current system state.
 * @returns {Object} System state summary
 */
function getSystemSummary() {
  const health = verifySystemHealth();
  const budget = checkBudgetStatus();

  const enabledEtfs = getEnabledEtfs();
  const latestSignals = getLatestSignals();

  const enterCount = Object.values(latestSignals)
    .filter(s => s.final_signal === SIGNAL_TYPES.ENTER).length;
  const watchCount = Object.values(latestSignals)
    .filter(s => s.final_signal === SIGNAL_TYPES.WATCH).length;

  return {
    timestamp: new Date().toISOString(),
    etfsEnabled: enabledEtfs.length,
    signalsGenerated: Object.keys(latestSignals).length,
    currentEnter: enterCount,
    currentWatch: watchCount,
    budgetRemaining: budget.remaining,
    apiAvailability: health.apiAvailability,
    configStatus: health.config
  };
}

/**
 * Prints the current system summary to log.
 */
function logSystemSummary() {
  const summary = getSystemSummary();
  logInfo('orchestrator', 'System Summary', summary);
  return summary;
}

// ==================================================
// HELPER TO PREVENT MULTIPLE SIMULTANEOUS RUNS
// ==================================================

const LOCK_KEY = 'RUNNING_LOCK';
const LOCK_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes

/**
 * Acquires a lock to prevent simultaneous runs.
 * @returns {boolean} True if lock acquired
 */
function acquireLock_() {
  const props = PropertiesService.getScriptProperties();
  const existing = props.getProperty(LOCK_KEY);

  if (existing) {
    const lockTime = parseInt(existing);
    if (Date.now() - lockTime < LOCK_TIMEOUT_MS) {
      logWarn('orchestrator', 'Another run is already in progress');
      return false;
    }
    // Lock expired
  }

  props.setProperty(LOCK_KEY, Date.now().toString());
  return true;
}

/**
 * Releases the run lock.
 */
function releaseLock_() {
  const props = PropertiesService.getScriptProperties();
  props.deleteProperty(LOCK_KEY);
}

/**
 * Safe version of runDaily that prevents simultaneous execution.
 */
function runDailySafe() {
  if (!acquireLock_()) {
    return { success: false, error: 'Lock not acquired' };
  }

  try {
    return runDaily();
  } finally {
    releaseLock_();
  }
}
