/**
 * ==================================================
 * 18_budget_manager.gs - Budget and Quota Management
 * ==================================================
 *
 * Manages API quotas, request budgets, and degradation strategies.
 * Ensures the system operates within limits and degrades gracefully
 * when budgets are exceeded.
 *
 * Features:
 * - Daily HTTP request budget tracking
 * - Per-provider request counting
 * - Vision API quota management
 * - Automatic degradation strategies
 * - Budget persistence across executions
 *
 * Usage:
 *   initBudgetTracking();
 *   checkBudgetStatus();
 */

// Budget storage key in PropertiesService
const BUDGET_PROPERTY_KEY = 'DAILY_BUDGET_COUNTERS';
const BUDGET_DATE_KEY = 'BUDGET_DATE';

/**
 * Initializes budget tracking for a new execution.
 * Resets counters if the date has changed.
 */
function initBudgetTracking() {
  const today = getTodayDateStr();
  const storedDate = getBudgetDate_();

  if (storedDate !== today) {
    // New day - reset counters
    resetBudgetCounters_();
    setBudgetDate_(today);
    logInfo('budget', `Budget counters reset for new day: ${today}`);
  } else {
    // Same day - load existing counters
    loadBudgetCounters_();
  }
}

/**
 * Gets the current budget status.
 * @returns {Object} Budget status with counters and limits
 */
function checkBudgetStatus() {
  initBudgetTracking();

  const counters = getBudgetCounters();

  const limits = {
    http_total: getConfigValue(CONFIG_KEYS.MAX_DAILY_HTTP, 500),
    vision: getConfigValue(CONFIG_KEYS.MAX_DAILY_VISION, 20),
    fmp: LIMITS.FMP_FREE_DAILY_CALLS
  };

  const status = {
    date: getTodayDateStr(),
    counters: counters,
    limits: limits,
    remaining: {
      http: limits.http_total - (counters.http_requests_total || 0),
      vision: limits.vision - (counters.vision_requests || 0),
      fmp: limits.fmp - (counters.provider_requests_fmp || 0)
    },
    percentUsed: {
      http: ((counters.http_requests_total || 0) / limits.http_total * 100).toFixed(1),
      vision: ((counters.vision_requests || 0) / limits.vision * 100).toFixed(1),
      fmp: ((counters.provider_requests_fmp || 0) / limits.fmp * 100).toFixed(1)
    },
    warnings: []
  };

  // Add warnings for high usage
  if (status.remaining.http < limits.http_total * 0.2) {
    status.warnings.push('HTTP budget nearly exhausted');
  }
  if (status.remaining.vision < limits.vision * 0.2) {
    status.warnings.push('Vision budget nearly exhausted');
  }
  if (status.remaining.fmp < limits.fmp * 0.2) {
    status.warnings.push('FMP budget nearly exhausted');
  }

  return status;
}

/**
 * Checks if a specific budget limit has been reached.
 * @param {string} limitKey - The config key for the limit
 * @param {string} counterName - The counter name to check
 * @returns {boolean} True if limit reached
 */
function checkBudgetLimit(limitKey, counterName) {
  initBudgetTracking();

  const limit = getConfigValue(limitKey, Infinity);
  const used = RUNTIME_CACHE.budgetCounters[counterName] || 0;

  return used >= limit;
}

/**
 * Increments a budget counter and persists it.
 * @param {string} counterName - The counter name
 * @param {number} [amount=1] - Amount to increment
 */
function incrementBudget(counterName, amount) {
  amount = amount || 1;
  initBudgetTracking();

  RUNTIME_CACHE.budgetCounters[counterName] =
    (RUNTIME_CACHE.budgetCounters[counterName] || 0) + amount;

  saveBudgetCounters_();
}

/**
 * Gets degradation mode based on budget status.
 * Returns recommendations for what to skip/reduce.
 * @returns {Object} Degradation recommendations
 */
function getDegradationMode() {
  const status = checkBudgetStatus();

  const degradation = {
    skipVision: false,
    skipNewHoldings: false,
    limitTickers: false,
    maxTickers: null,
    skipImages: false,
    useCacheOnly: false,
    reason: []
  };

  // Check vision budget
  if (status.remaining.vision <= 0) {
    degradation.skipVision = true;
    degradation.skipImages = true;
    degradation.reason.push('Vision budget exhausted');
  }

  // Check HTTP budget
  if (status.remaining.http <= 50) {
    degradation.skipVision = true;
    degradation.skipImages = true;
    degradation.skipNewHoldings = true;
    degradation.reason.push('HTTP budget critical');

    if (status.remaining.http <= 20) {
      degradation.useCacheOnly = true;
      degradation.reason.push('HTTP budget nearly exhausted - cache only');
    }
  }

  // Check FMP budget
  if (status.remaining.fmp <= 10) {
    degradation.limitTickers = true;
    degradation.maxTickers = 10;
    degradation.reason.push('FMP budget limited');
  }

  // Log if degraded
  if (degradation.reason.length > 0) {
    logWarn('budget', 'Operating in degraded mode', degradation);
  }

  return degradation;
}

/**
 * Applies degradation to a list of tickers.
 * @param {Array<string>} tickers - Original ticker list
 * @returns {Array<string>} Possibly reduced ticker list
 */
function applyTickerDegradation(tickers) {
  const degradation = getDegradationMode();

  if (degradation.limitTickers && degradation.maxTickers) {
    return tickers.slice(0, degradation.maxTickers);
  }

  return tickers;
}

/**
 * Checks if vision operations should be skipped.
 * @returns {boolean} True if vision should be skipped
 */
function shouldSkipVision() {
  const visionEnabled = getConfigValue(CONFIG_KEYS.VISION_ENABLED, false);
  if (!visionEnabled) return true;

  const degradation = getDegradationMode();
  return degradation.skipVision;
}

/**
 * Checks if images should be downloaded.
 * @returns {boolean} True if images should be skipped
 */
function shouldSkipImages() {
  const degradation = getDegradationMode();
  return degradation.skipImages;
}

/**
 * Estimates remaining API capacity.
 * @returns {Object} Estimated remaining calls by provider
 */
function estimateRemainingCapacity() {
  const status = checkBudgetStatus();

  return {
    totalHttpRemaining: status.remaining.http,
    visionRemaining: status.remaining.vision,
    estimatedTickersCanFetch: Math.floor(status.remaining.http / 2), // Rough estimate: 2 calls per ticker
    estimatedEtfsCanProcess: Math.floor(status.remaining.http / 5), // Rough estimate
    canDoVision: status.remaining.vision > 0,
    canRefreshHoldings: status.remaining.http > 100
  };
}

// ==================================================
// PERSISTENCE HELPERS
// ==================================================

/**
 * Gets the stored budget date.
 * @private
 */
function getBudgetDate_() {
  try {
    const props = PropertiesService.getScriptProperties();
    return props.getProperty(BUDGET_DATE_KEY) || '';
  } catch (e) {
    return '';
  }
}

/**
 * Sets the budget date.
 * @private
 */
function setBudgetDate_(date) {
  try {
    const props = PropertiesService.getScriptProperties();
    props.setProperty(BUDGET_DATE_KEY, date);
  } catch (e) {
    logWarn('budget', 'Could not persist budget date: ' + e.message);
  }
}

/**
 * Resets all budget counters.
 * @private
 */
function resetBudgetCounters_() {
  RUNTIME_CACHE.budgetCounters = {
    http_requests_total: 0,
    provider_requests_yahoo: 0,
    provider_requests_finnhub: 0,
    provider_requests_fmp: 0,
    vision_requests: 0
  };

  saveBudgetCounters_();
}

/**
 * Loads budget counters from persistent storage.
 * @private
 */
function loadBudgetCounters_() {
  try {
    const props = PropertiesService.getScriptProperties();
    const stored = props.getProperty(BUDGET_PROPERTY_KEY);

    if (stored) {
      const parsed = JSON.parse(stored);
      RUNTIME_CACHE.budgetCounters = { ...RUNTIME_CACHE.budgetCounters, ...parsed };
    }
  } catch (e) {
    logWarn('budget', 'Could not load budget counters: ' + e.message);
  }
}

/**
 * Saves budget counters to persistent storage.
 * @private
 */
function saveBudgetCounters_() {
  try {
    const props = PropertiesService.getScriptProperties();
    props.setProperty(BUDGET_PROPERTY_KEY, JSON.stringify(RUNTIME_CACHE.budgetCounters));
  } catch (e) {
    logWarn('budget', 'Could not persist budget counters: ' + e.message);
  }
}

/**
 * Manually resets budget counters (useful for testing).
 */
function resetBudgetCountersManual() {
  resetBudgetCounters_();
  setBudgetDate_(getTodayDateStr());
  logInfo('budget', 'Budget counters manually reset');
}

/**
 * Gets budget report for logging/display.
 * @returns {string} Formatted budget report
 */
function getBudgetReport() {
  const status = checkBudgetStatus();

  const lines = [
    `Budget Report for ${status.date}`,
    '================================',
    `HTTP Requests: ${status.counters.http_requests_total || 0}/${status.limits.http_total} (${status.percentUsed.http}%)`,
    `  - Yahoo: ${status.counters.provider_requests_yahoo || 0}`,
    `  - Finnhub: ${status.counters.provider_requests_finnhub || 0}`,
    `  - FMP: ${status.counters.provider_requests_fmp || 0}/${status.limits.fmp} (${status.percentUsed.fmp}%)`,
    `Vision Requests: ${status.counters.vision_requests || 0}/${status.limits.vision} (${status.percentUsed.vision}%)`
  ];

  if (status.warnings.length > 0) {
    lines.push('');
    lines.push('⚠️ Warnings:');
    for (const warning of status.warnings) {
      lines.push(`  - ${warning}`);
    }
  }

  return lines.join('\n');
}

/**
 * Logs the budget report.
 */
function logBudgetReport() {
  const report = getBudgetReport();
  logInfo('budget', report);
}

/**
 * Checks if the system should continue processing or stop due to budget.
 * @returns {Object} { canContinue: boolean, message: string }
 */
function checkShouldContinue() {
  const status = checkBudgetStatus();

  if (status.remaining.http <= 10) {
    return {
      canContinue: false,
      message: 'HTTP budget exhausted, stopping processing'
    };
  }

  return {
    canContinue: true,
    message: `HTTP remaining: ${status.remaining.http}`
  };
}
