/**
 * ==================================================
 * 17_statistics_advanced.gs - Advanced Statistical Analysis
 * ==================================================
 *
 * Implements advanced statistical methods for market breadth analysis:
 * - Standard and Robust Z-scores (using mean/stdev or median/MAD)
 * - Percentile calculations
 * - Winsorization to reduce outlier impact
 * - Persistence and reversion detection
 * - Extreme score computation for ranking
 *
 * This module implements Section 11 of the specification:
 * "Capa Estadística Avanzada de Amplitud"
 *
 * Key functions:
 *   computeAdvancedZScores(etf, pctAbove20, pctAbove50)
 *   computeRobustZScore(value, series)
 *   winsorize(series, pct)
 */

/**
 * Computes advanced Z-scores and related statistics.
 * This is the main entry point called by the breadth module.
 *
 * @param {string} etf - The ETF symbol
 * @param {number} pctAbove20 - Current pct_above_sma20
 * @param {number} pctAbove50 - Current pct_above_sma50
 * @returns {Object} Complete statistics result including z-scores, percentiles, and extreme flags
 */
function computeAdvancedZScores(etf, pctAbove20, pctAbove50) {
  // Get configuration
  const method = getConfigValue(CONFIG_KEYS.Z_METHOD, 'ROBUST');
  const windowDays = getConfigValue(CONFIG_KEYS.Z_WINDOW_DAYS, 252);
  const minObs = getConfigValue(CONFIG_KEYS.Z_MIN_OBS, 126);
  const doWinsorize = getConfigValue(CONFIG_KEYS.Z_WINSORIZE, true);
  const winsorPct = getConfigValue(CONFIG_KEYS.Z_WINSOR_PCT, 0.02);

  // Extreme thresholds
  const extremeZ20 = getConfigValue(CONFIG_KEYS.EXTREME_Z20, -1.8);
  const extremeZ50 = getConfigValue(CONFIG_KEYS.EXTREME_Z50, -1.8);
  const extremePctl20 = getConfigValue(CONFIG_KEYS.EXTREME_PCTL20, 0.05);
  const extremePctl50 = getConfigValue(CONFIG_KEYS.EXTREME_PCTL50, 0.10);
  const usePctl = getConfigValue(CONFIG_KEYS.EXTREME_USE_PCTL, true);
  const combiner = getConfigValue(CONFIG_KEYS.EXTREME_COMBINER, 'ANY');

  // Get historical breadth data
  const history = getBreadthHistory(etf, windowDays + 10);

  // Extract series
  const series20 = history
    .filter(h => h.pct_above_sma20 !== null && h.pct_above_sma20 !== undefined && !isNaN(h.pct_above_sma20))
    .map(h => parseFloat(h.pct_above_sma20));

  const series50 = history
    .filter(h => h.pct_above_sma50 !== null && h.pct_above_sma50 !== undefined && !isNaN(h.pct_above_sma50))
    .map(h => parseFloat(h.pct_above_sma50));

  // Initialize results
  const result = {
    z20: null,
    z50: null,
    pctl20: null,
    pctl50: null,
    method: method,
    windowUsed: 0,
    extremeByZ: false,
    extremeByPctl: false,
    extremeScore: null,
    stats20: null,
    stats50: null
  };

  // Check minimum observations
  if (series20.length < minObs) {
    logDebug('stats', `Insufficient observations for ${etf} SMA20: ${series20.length}/${minObs}`);
    result.windowUsed = series20.length;
    return result;
  }

  if (series50.length < minObs) {
    logDebug('stats', `Insufficient observations for ${etf} SMA50: ${series50.length}/${minObs}`);
    result.windowUsed = series50.length;
    return result;
  }

  result.windowUsed = Math.min(series20.length, series50.length);

  // Winsorize if enabled
  let processed20 = series20;
  let processed50 = series50;

  if (doWinsorize) {
    processed20 = winsorize(series20, winsorPct);
    processed50 = winsorize(series50, winsorPct);
  }

  // Compute Z-scores based on method
  if (method === 'ROBUST') {
    result.stats20 = computeRobustStats(processed20);
    result.stats50 = computeRobustStats(processed50);

    result.z20 = computeRobustZScore(pctAbove20, result.stats20);
    result.z50 = computeRobustZScore(pctAbove50, result.stats50);
  } else {
    // Standard Z-score
    result.stats20 = computeStandardStats(processed20);
    result.stats50 = computeStandardStats(processed50);

    result.z20 = computeStandardZScore(pctAbove20, result.stats20);
    result.z50 = computeStandardZScore(pctAbove50, result.stats50);
  }

  // Compute percentiles (always using original series for accuracy)
  result.pctl20 = computePercentileRank(pctAbove20, series20);
  result.pctl50 = computePercentileRank(pctAbove50, series50);

  // Determine extreme by Z-score
  result.extremeByZ = determineExtremeByZ_(
    result.z20, result.z50,
    extremeZ20, extremeZ50,
    combiner
  );

  // Determine extreme by percentile
  if (usePctl) {
    result.extremeByPctl = determineExtremeByPctl_(
      result.pctl20, result.pctl50,
      extremePctl20, extremePctl50,
      combiner
    );
  }

  // Compute extreme score for ranking
  result.extremeScore = computeExtremeScore_(
    result.z20, result.z50,
    pctAbove20, pctAbove50
  );

  return result;
}

// ==================================================
// WINSORIZATION
// ==================================================

/**
 * Winsorizes a series to reduce outlier impact.
 * Clamps values to the p-th and (1-p)-th percentiles.
 *
 * @param {Array<number>} series - The data series
 * @param {number} pct - Percentile to winsorize (e.g., 0.02 = 2%)
 * @returns {Array<number>} Winsorized series
 */
function winsorize(series, pct) {
  if (!series || series.length === 0 || pct <= 0 || pct >= 0.5) {
    return series;
  }

  // Sort to find percentiles
  const sorted = [...series].sort((a, b) => a - b);
  const n = sorted.length;

  const lowerIndex = Math.floor(n * pct);
  const upperIndex = Math.floor(n * (1 - pct));

  const lowerBound = sorted[lowerIndex];
  const upperBound = sorted[upperIndex];

  // Clamp values
  return series.map(x => {
    if (x < lowerBound) return lowerBound;
    if (x > upperBound) return upperBound;
    return x;
  });
}

// ==================================================
// STANDARD STATISTICS
// ==================================================

/**
 * Computes standard statistics (mean, stdev).
 *
 * @param {Array<number>} series - The data series
 * @returns {Object} { mean, stdev, n }
 */
function computeStandardStats(series) {
  if (!series || series.length === 0) {
    return { mean: null, stdev: null, n: 0 };
  }

  const n = series.length;
  const mean = series.reduce((a, b) => a + b, 0) / n;

  let sumSq = 0;
  for (const x of series) {
    sumSq += (x - mean) * (x - mean);
  }
  const stdev = Math.sqrt(sumSq / n);

  return {
    mean: round4_(mean),
    stdev: round4_(stdev),
    n: n
  };
}

/**
 * Computes standard Z-score.
 *
 * @param {number} value - The value to compute Z-score for
 * @param {Object} stats - Stats object with mean and stdev
 * @returns {number|null} Z-score or null if cannot compute
 */
function computeStandardZScore(value, stats) {
  if (!stats || stats.stdev === null || stats.stdev === 0) {
    return null;
  }

  const z = (value - stats.mean) / stats.stdev;
  return round4_(z);
}

// ==================================================
// ROBUST STATISTICS (MEDIAN / MAD)
// ==================================================

/**
 * Computes robust statistics using median and MAD.
 * MAD = Median Absolute Deviation
 * Robust sigma ≈ 1.4826 * MAD (for normal distribution)
 *
 * @param {Array<number>} series - The data series
 * @returns {Object} { median, mad, robustSigma, n }
 */
function computeRobustStats(series) {
  if (!series || series.length === 0) {
    return { median: null, mad: null, robustSigma: null, n: 0 };
  }

  const sorted = [...series].sort((a, b) => a - b);
  const n = sorted.length;

  // Compute median
  const median = computeMedian_(sorted);

  // Compute MAD (Median Absolute Deviation)
  const deviations = series.map(x => Math.abs(x - median));
  const sortedDeviations = deviations.sort((a, b) => a - b);
  const mad = computeMedian_(sortedDeviations);

  // Robust sigma using scale factor 1.4826
  // This makes robust sigma equivalent to standard deviation for normal distribution
  const robustSigma = 1.4826 * mad;

  return {
    median: round4_(median),
    mad: round4_(mad),
    robustSigma: round4_(robustSigma),
    n: n
  };
}

/**
 * Computes robust Z-score using median and MAD.
 *
 * @param {number} value - The value to compute Z-score for
 * @param {Object} stats - Stats object with median and robustSigma
 * @returns {number|null} Robust Z-score or null if cannot compute
 */
function computeRobustZScore(value, stats) {
  if (!stats || stats.robustSigma === null || stats.robustSigma === 0) {
    return null;
  }

  const z = (value - stats.median) / stats.robustSigma;
  return round4_(z);
}

/**
 * Computes median of a sorted array.
 * @private
 */
function computeMedian_(sortedArray) {
  const n = sortedArray.length;
  if (n === 0) return null;

  const mid = Math.floor(n / 2);

  if (n % 2 === 0) {
    return (sortedArray[mid - 1] + sortedArray[mid]) / 2;
  } else {
    return sortedArray[mid];
  }
}

// ==================================================
// PERCENTILE CALCULATIONS
// ==================================================

/**
 * Computes the percentile rank of a value in a series.
 * Returns the proportion of values <= the given value.
 *
 * @param {number} value - The value to find percentile for
 * @param {Array<number>} series - The reference series
 * @returns {number} Percentile rank (0 to 1)
 */
function computePercentileRank(value, series) {
  if (!series || series.length === 0) {
    return null;
  }

  let countBelow = 0;
  let countEqual = 0;

  for (const x of series) {
    if (x < value) countBelow++;
    else if (x === value) countEqual++;
  }

  // Use the middle of the equal values for tie-breaking
  const rank = (countBelow + countEqual / 2) / series.length;
  return round4_(rank);
}

/**
 * Computes the value at a given percentile.
 *
 * @param {Array<number>} series - The data series
 * @param {number} percentile - Percentile (0 to 1)
 * @returns {number} Value at percentile
 */
function computePercentileValue(series, percentile) {
  if (!series || series.length === 0) {
    return null;
  }

  const sorted = [...series].sort((a, b) => a - b);
  const n = sorted.length;
  const index = Math.floor(percentile * (n - 1));

  return sorted[Math.min(index, n - 1)];
}

// ==================================================
// EXTREME DETECTION
// ==================================================

/**
 * Determines if extreme by Z-score based on combiner method.
 * @private
 */
function determineExtremeByZ_(z20, z50, thresholdZ20, thresholdZ50, combiner) {
  if (z20 === null && z50 === null) return false;

  const extreme20 = z20 !== null && z20 <= thresholdZ20;
  const extreme50 = z50 !== null && z50 <= thresholdZ50;

  switch (combiner) {
    case 'ANY':
      return extreme20 || extreme50;
    case 'BOTH':
      return extreme20 && extreme50;
    case 'WEIGHTED':
      // Use z_combo threshold
      if (z20 === null || z50 === null) return extreme20 || extreme50;
      const w20 = getConfigValue(CONFIG_KEYS.Z_COMBO_W20, 0.65);
      const w50 = getConfigValue(CONFIG_KEYS.Z_COMBO_W50, 0.35);
      const zCombo = w20 * z20 + w50 * z50;
      const comboThreshold = w20 * thresholdZ20 + w50 * thresholdZ50;
      return zCombo <= comboThreshold;
    default:
      return extreme20 || extreme50;
  }
}

/**
 * Determines if extreme by percentile based on combiner method.
 * @private
 */
function determineExtremeByPctl_(pctl20, pctl50, threshold20, threshold50, combiner) {
  if (pctl20 === null && pctl50 === null) return false;

  const extreme20 = pctl20 !== null && pctl20 <= threshold20;
  const extreme50 = pctl50 !== null && pctl50 <= threshold50;

  switch (combiner) {
    case 'ANY':
      return extreme20 || extreme50;
    case 'BOTH':
      return extreme20 && extreme50;
    case 'WEIGHTED':
      return extreme20 || extreme50; // Percentiles don't combine the same way
    default:
      return extreme20 || extreme50;
  }
}

// ==================================================
// EXTREME SCORE FOR RANKING
// ==================================================

/**
 * Computes extreme score for ranking (0 to 1, higher = more extreme/better candidate).
 *
 * Section 11.5: extreme_score = 0.6*extreme_score_base + 0.4*sev_combo
 *
 * @private
 */
function computeExtremeScore_(z20, z50, pctAbove20, pctAbove50) {
  // Get thresholds for severity calculation
  const threshold20 = getConfigValue(CONFIG_KEYS.EXTREME_PCT_ABOVE20, 10);
  const threshold50 = getConfigValue(CONFIG_KEYS.EXTREME_PCT_ABOVE50, 25);

  // Z-combo for base score
  let extremeScoreBase = 0;
  if (z20 !== null && z50 !== null) {
    const w20 = getConfigValue(CONFIG_KEYS.Z_COMBO_W20, 0.65);
    const w50 = getConfigValue(CONFIG_KEYS.Z_COMBO_W50, 0.35);
    const zCombo = w20 * z20 + w50 * z50;

    // Normalize: more negative z_combo = higher score
    // Clamp to 0..6 range, then normalize to 0..1
    extremeScoreBase = Math.max(0, Math.min(1, -zCombo / 6));
  }

  // Severity based on absolute thresholds
  let sev20 = 0;
  let sev50 = 0;

  if (pctAbove20 !== null && threshold20 > 0) {
    sev20 = Math.max(0, Math.min(1, (threshold20 - pctAbove20) / threshold20));
  }

  if (pctAbove50 !== null && threshold50 > 0) {
    sev50 = Math.max(0, Math.min(1, (threshold50 - pctAbove50) / threshold50));
  }

  const sevCombo = 0.7 * sev20 + 0.3 * sev50;

  // Final extreme score
  const extremeScore = 0.6 * extremeScoreBase + 0.4 * sevCombo;

  return round4_(extremeScore);
}

// ==================================================
// PERSISTENCE DETECTION
// ==================================================

/**
 * Checks if extreme condition has persisted for N days.
 *
 * @param {string} etf - The ETF symbol
 * @param {number} days - Required persistence days
 * @returns {boolean} True if extreme persisted
 */
function checkExtremePersistence(etf, days) {
  days = days || getConfigValue(CONFIG_KEYS.EXTREME_PERSIST_DAYS, 2);

  const history = getBreadthHistory(etf, days + 5);

  if (history.length < days) return false;

  // Check last N days
  const recent = history.slice(-days);

  for (const day of recent) {
    const extreme = day.extreme_by_z === true || day.extreme_by_z === 'TRUE' ||
                    day.extreme_by_pctl === true || day.extreme_by_pctl === 'TRUE' ||
                    day.extreme_flag === true || day.extreme_flag === 'TRUE';

    if (!extreme) return false;
  }

  return true;
}

/**
 * Checks for reversion (uptick) in breadth.
 * Section 11.4: giro if uptick >= minUptick OR crosses above crossLevel
 *
 * @param {number} current20 - Current pct_above_sma20
 * @param {number} previous20 - Previous day's pct_above_sma20
 * @param {number} current50 - Current pct_above_sma50
 * @param {number} previous50 - Previous day's pct_above_sma50
 * @returns {Object} { hasReversion, uptick20, uptick50 }
 */
function checkReversion(current20, previous20, current50, previous50) {
  const minUptick = getConfigValue(CONFIG_KEYS.REVERSION_MIN_UPTICK, 2.0);
  const crossLevel = getConfigValue(CONFIG_KEYS.REVERSION_CROSS_LEVEL20, 12.5);

  const uptick20 = current20 - (previous20 || 0);
  const uptick50 = current50 - (previous50 || 0);

  // Check uptick threshold
  const hasUptick = uptick20 >= minUptick || uptick50 >= minUptick;

  // Check level crossing
  const crossed20 = current20 >= crossLevel && (previous20 || 0) < crossLevel;
  const crossed50 = current50 >= crossLevel && (previous50 || 0) < crossLevel;

  return {
    hasReversion: hasUptick || crossed20 || crossed50,
    uptick20: round4_(uptick20),
    uptick50: round4_(uptick50),
    crossed20: crossed20,
    crossed50: crossed50
  };
}

// ==================================================
// UTILITY FUNCTIONS
// ==================================================

/**
 * Rounds to 4 decimal places.
 * @private
 */
function round4_(value) {
  if (value === null || value === undefined || isNaN(value)) return null;
  return Math.round(value * 10000) / 10000;
}

/**
 * Computes combined Z-score.
 *
 * @param {number} z20 - Z-score for SMA20
 * @param {number} z50 - Z-score for SMA50
 * @returns {number|null} Combined Z-score
 */
function computeZCombo(z20, z50) {
  if (z20 === null || z50 === null) return null;

  const w20 = getConfigValue(CONFIG_KEYS.Z_COMBO_W20, 0.65);
  const w50 = getConfigValue(CONFIG_KEYS.Z_COMBO_W50, 0.35);

  return round4_(w20 * z20 + w50 * z50);
}

/**
 * Gets the recommended defaults for advanced stats configuration.
 * Useful for displaying to user.
 *
 * @returns {Object} Recommended configuration values
 */
function getRecommendedStatsConfig() {
  return {
    Z_METHOD: 'ROBUST',
    Z_WINDOW_DAYS: 252,
    Z_MIN_OBS: 126,
    Z_WINSORIZE: true,
    Z_WINSOR_PCT: 0.02,
    EXTREME_Z20: -1.8,
    EXTREME_Z50: -1.8,
    EXTREME_COMBINER: 'ANY',
    EXTREME_PCTL20: 0.05,
    EXTREME_PCTL50: 0.10,
    EXTREME_USE_PCTL: true,
    EXTREME_REQUIRE_REVERSION: true,
    REVERSION_MIN_UPTICK: 2.0,
    REVERSION_CROSS_LEVEL20: 12.5,
    HOLDINGS_STABILITY_REQUIRED: true,
    HOLDINGS_STABILITY_DAYS: 10
  };
}
