/**
 * ==================================================
 * 11_breadth.gs - Market Breadth Calculation
 * ==================================================
 *
 * Calculates market breadth metrics for each ETF based on its holdings:
 * - pct_above_sma20: Percentage of holdings trading above their 20-day SMA
 * - pct_above_sma50: Percentage of holdings trading above their 50-day SMA
 * - Z-scores for historical comparison
 * - Extreme and giro (reversal) flags
 *
 * Usage:
 *   const breadth = computeBreadthForEtf('XLK');
 *   computeAndStoreBreadthForAllEtfs();
 */

/**
 * Computes breadth metrics for a single ETF.
 * @param {string} etf - The ETF symbol
 * @param {string} [date] - Date to compute for (default: today)
 * @returns {Object} Breadth metrics object
 */
function computeBreadthForEtf(etf, date) {
  date = date || getTodayDateStr();
  etf = etf.toUpperCase();

  logDebug('breadth', `Computing breadth for ${etf} on ${date}`);

  // Get holdings
  const holdingsResult = getHoldingsForEtf(etf);

  if (!holdingsResult.holdings || holdingsResult.holdings.length === 0) {
    logWarn('breadth', `No holdings for ${etf}`);
    return createEmptyBreadthRow_(etf, date, 'No holdings');
  }

  const holdings = holdingsResult.holdings;
  const holdingTickers = holdings.map(h => h.ticker);

  // Count holdings above SMAs
  let countAbove20 = 0;
  let countAbove50 = 0;
  let countValid = 0;

  for (const ticker of holdingTickers) {
    const priceData = getLatestPriceWithSMA_(ticker, date);

    if (!priceData || priceData.close === null) {
      logDebug('breadth', `No price data for holding ${ticker}`);
      continue;
    }

    countValid++;

    if (priceData.sma20 !== null && priceData.close > priceData.sma20) {
      countAbove20++;
    }

    if (priceData.sma50 !== null && priceData.close > priceData.sma50) {
      countAbove50++;
    }
  }

  // Calculate percentages
  const topN = getConfigValue(CONFIG_KEYS.HOLDINGS_TOP_N, 30);
  const minHoldings = Math.ceil(topN * 0.75); // Need at least 75% of expected holdings

  if (countValid < minHoldings) {
    logWarn('breadth', `Insufficient data for ${etf}: ${countValid}/${topN} holdings`);
    return createEmptyBreadthRow_(etf, date, `Insufficient data: ${countValid}/${topN}`);
  }

  const pctAbove20 = Math.round((countAbove20 / countValid) * 10000) / 100;
  const pctAbove50 = Math.round((countAbove50 / countValid) * 10000) / 100;

  // Calculate data quality
  const dataQuality = calculateDataQuality_(countValid, topN);

  // Get historical data for Z-score calculation
  const zScoreResult = computeZScores_(etf, pctAbove20, pctAbove50);

  // Determine extreme flag (threshold-based)
  const extremeByThreshold = isExtremeByThreshold_(pctAbove20, pctAbove50);

  // Get previous day breadth for giro calculation
  const prevBreadth = getPreviousBreadth_(etf, date);
  const giroResult = computeGiro_(pctAbove20, pctAbove50, prevBreadth);

  // Check holdings stability for regime change
  const regimeChange = didHoldingsChangeRecently(etf);

  const breadthRow = {
    date: date,
    etf: etf,
    n_holdings: countValid,
    pct_above_sma20: pctAbove20,
    pct_above_sma50: pctAbove50,
    z_pct_above_sma20: zScoreResult.z20,
    z_pct_above_sma50: zScoreResult.z50,
    // Advanced stats columns (Section 11)
    pct_above_sma20_pctl: zScoreResult.pctl20,
    pct_above_sma50_pctl: zScoreResult.pctl50,
    z20_method: zScoreResult.method,
    z50_method: zScoreResult.method,
    z20_window_used: zScoreResult.windowUsed,
    z50_window_used: zScoreResult.windowUsed,
    extreme_by_z: zScoreResult.extremeByZ,
    extreme_by_pctl: zScoreResult.extremeByPctl,
    extreme_score: zScoreResult.extremeScore,
    regime_change_flag: regimeChange,
    data_quality_flag: dataQuality,
    // Original flags
    extreme_flag: extremeByThreshold || zScoreResult.extremeByZ || zScoreResult.extremeByPctl,
    giro_flag: giroResult.giroFlag,
    source: holdingsResult.source
  };

  logDebug('breadth', `Breadth for ${etf}: ${pctAbove20}% > SMA20, ${pctAbove50}% > SMA50, z20=${zScoreResult.z20}`);

  return breadthRow;
}

/**
 * Computes and stores breadth for all enabled ETFs.
 * @param {string} [date] - Date to compute for
 * @returns {Object} Summary of results
 */
function computeAndStoreBreadthForAllEtfs(date) {
  date = date || getTodayDateStr();

  logOperationStart('computeAndStoreBreadth', { date });

  const enabledEtfs = getEnabledEtfs();
  const breadthRows = [];
  let success = 0;
  let failed = 0;

  for (const etfConfig of enabledEtfs) {
    try {
      const breadth = computeBreadthForEtf(etfConfig.etf, date);
      breadthRows.push(breadth);

      if (breadth.data_quality_flag !== DATA_QUALITY.BAD) {
        success++;
      } else {
        failed++;
      }
    } catch (e) {
      logException('breadth', `computeBreadthForEtf(${etfConfig.etf})`, e);
      failed++;
    }
  }

  // Save all breadth rows
  if (breadthRows.length > 0) {
    upsertRows(SHEET_NAMES.BREADTH_DAILY, breadthRows, ['date', 'etf']);
  }

  const summary = { date, success, failed, total: enabledEtfs.length };
  logOperationEnd('computeAndStoreBreadth', summary);

  return summary;
}

/**
 * Gets the latest price and SMA for a ticker as of a date.
 * @private
 */
function getLatestPriceWithSMA_(ticker, asOfDate) {
  const priceHistory = getPriceHistory(ticker, 60);

  if (!priceHistory || priceHistory.length === 0) {
    return null;
  }

  // Find the latest price on or before asOfDate
  let latestPrice = null;

  for (let i = priceHistory.length - 1; i >= 0; i--) {
    const priceDate = formatDateYMD_(priceHistory[i].date);
    if (priceDate <= asOfDate) {
      latestPrice = priceHistory[i];
      break;
    }
  }

  if (!latestPrice) {
    // Use most recent available
    latestPrice = priceHistory[priceHistory.length - 1];
  }

  // If SMAs are not pre-calculated, calculate them
  if (latestPrice.sma20 === null || latestPrice.sma20 === undefined) {
    const closes = extractCloses(priceHistory);
    const sma20Array = computeSMA(closes, 20);
    const sma50Array = computeSMA(closes, 50);

    const idx = priceHistory.indexOf(latestPrice);
    if (idx >= 0) {
      latestPrice = {
        ...latestPrice,
        sma20: sma20Array[idx],
        sma50: sma50Array[idx]
      };
    }
  }

  return latestPrice;
}

/**
 * Gets the previous day's breadth for an ETF.
 * @private
 */
function getPreviousBreadth_(etf, currentDate) {
  const breadthHistory = getBreadthHistory(etf, 10);

  if (!breadthHistory || breadthHistory.length === 0) {
    return null;
  }

  // Find the most recent breadth before currentDate
  for (let i = breadthHistory.length - 1; i >= 0; i--) {
    const breadthDate = formatDateYMD_(breadthHistory[i].date);
    if (breadthDate < currentDate) {
      return breadthHistory[i];
    }
  }

  return null;
}

/**
 * Checks if breadth is extreme by threshold values.
 * @private
 */
function isExtremeByThreshold_(pctAbove20, pctAbove50) {
  const threshold20 = getConfigValue(CONFIG_KEYS.EXTREME_PCT_ABOVE20, 10);
  const threshold50 = getConfigValue(CONFIG_KEYS.EXTREME_PCT_ABOVE50, 25);

  return pctAbove20 <= threshold20 || pctAbove50 <= threshold50;
}

/**
 * Computes giro (reversal) flag.
 * @private
 */
function computeGiro_(pctAbove20, pctAbove50, prevBreadth) {
  if (!prevBreadth) {
    return { giroFlag: false, uptick20: null, uptick50: null };
  }

  const prevPct20 = prevBreadth.pct_above_sma20;
  const prevPct50 = prevBreadth.pct_above_sma50;

  const uptick20 = pctAbove20 - prevPct20;
  const uptick50 = pctAbove50 - prevPct50;

  const requireReversion = getConfigValue(CONFIG_KEYS.EXTREME_REQUIRE_REVERSION, true);
  const minUptick = getConfigValue(CONFIG_KEYS.REVERSION_MIN_UPTICK, 2.0);
  const crossLevel = getConfigValue(CONFIG_KEYS.REVERSION_CROSS_LEVEL20, 12.5);

  let giroFlag = false;

  if (requireReversion) {
    // Giro if uptick >= min threshold
    const hasUptick = uptick20 >= minUptick || uptick50 >= minUptick;

    // Or if crossed above the cross level
    const crossedLevel = (pctAbove20 >= crossLevel && prevPct20 < crossLevel) ||
                         (pctAbove50 >= crossLevel && prevPct50 < crossLevel);

    giroFlag = hasUptick || crossedLevel;
  } else {
    // Simple giro: just needs to be rising
    giroFlag = uptick20 > 0 || uptick50 > 0;
  }

  return {
    giroFlag: giroFlag,
    uptick20: Math.round(uptick20 * 100) / 100,
    uptick50: Math.round(uptick50 * 100) / 100
  };
}

/**
 * Calculates data quality based on holdings count.
 * @private
 */
function calculateDataQuality_(countValid, expected) {
  const ratio = countValid / expected;

  if (ratio >= 0.9) {
    return DATA_QUALITY.OK;
  } else if (ratio >= 0.75) {
    return DATA_QUALITY.PARTIAL;
  } else {
    return DATA_QUALITY.BAD;
  }
}

/**
 * Creates an empty breadth row for missing data.
 * @private
 */
function createEmptyBreadthRow_(etf, date, reason) {
  return {
    date: date,
    etf: etf,
    n_holdings: 0,
    pct_above_sma20: null,
    pct_above_sma50: null,
    z_pct_above_sma20: null,
    z_pct_above_sma50: null,
    pct_above_sma20_pctl: null,
    pct_above_sma50_pctl: null,
    z20_method: null,
    z50_method: null,
    z20_window_used: null,
    z50_window_used: null,
    extreme_by_z: false,
    extreme_by_pctl: false,
    extreme_score: null,
    regime_change_flag: false,
    data_quality_flag: DATA_QUALITY.BAD,
    extreme_flag: false,
    giro_flag: false,
    source: reason
  };
}

/**
 * Computes Z-scores using the advanced statistics module.
 * This is a wrapper that delegates to the statistics module.
 * @private
 */
function computeZScores_(etf, pctAbove20, pctAbove50) {
  // This calls the advanced statistics module (17_statistics_advanced.gs)
  // If that module hasn't loaded yet, use a simpler fallback
  if (typeof computeAdvancedZScores === 'function') {
    return computeAdvancedZScores(etf, pctAbove20, pctAbove50);
  }

  // Fallback: simple Z-score calculation
  return computeSimpleZScores_(etf, pctAbove20, pctAbove50);
}

/**
 * Simple Z-score calculation fallback.
 * @private
 */
function computeSimpleZScores_(etf, pctAbove20, pctAbove50) {
  const windowDays = getConfigValue(CONFIG_KEYS.Z_WINDOW_DAYS, 252);
  const minObs = getConfigValue(CONFIG_KEYS.Z_MIN_OBS, 126);

  const history = getBreadthHistory(etf, windowDays + 10);

  // Extract historical values
  const hist20 = history
    .filter(h => h.pct_above_sma20 !== null && h.pct_above_sma20 !== undefined)
    .map(h => h.pct_above_sma20);

  const hist50 = history
    .filter(h => h.pct_above_sma50 !== null && h.pct_above_sma50 !== undefined)
    .map(h => h.pct_above_sma50);

  let z20 = null;
  let z50 = null;
  let pctl20 = null;
  let pctl50 = null;
  let extremeByZ = false;
  let extremeByPctl = false;

  const extremeZ20 = getConfigValue(CONFIG_KEYS.EXTREME_Z20, -1.8);
  const extremeZ50 = getConfigValue(CONFIG_KEYS.EXTREME_Z50, -1.8);
  const extremePctl20 = getConfigValue(CONFIG_KEYS.EXTREME_PCTL20, 0.05);
  const extremePctl50 = getConfigValue(CONFIG_KEYS.EXTREME_PCTL50, 0.10);

  if (hist20.length >= minObs) {
    const stats20 = computeBasicStats_(hist20);
    if (stats20.stdev > 0) {
      z20 = Math.round(((pctAbove20 - stats20.mean) / stats20.stdev) * 100) / 100;
    }
    pctl20 = computePercentile_(pctAbove20, hist20);

    if (z20 !== null && z20 <= extremeZ20) {
      extremeByZ = true;
    }
    if (pctl20 !== null && pctl20 <= extremePctl20) {
      extremeByPctl = true;
    }
  }

  if (hist50.length >= minObs) {
    const stats50 = computeBasicStats_(hist50);
    if (stats50.stdev > 0) {
      z50 = Math.round(((pctAbove50 - stats50.mean) / stats50.stdev) * 100) / 100;
    }
    pctl50 = computePercentile_(pctAbove50, hist50);

    if (z50 !== null && z50 <= extremeZ50) {
      extremeByZ = true;
    }
    if (pctl50 !== null && pctl50 <= extremePctl50) {
      extremeByPctl = true;
    }
  }

  // Compute extreme score
  let extremeScore = null;
  if (z20 !== null && z50 !== null) {
    const w20 = getConfigValue(CONFIG_KEYS.Z_COMBO_W20, 0.65);
    const w50 = getConfigValue(CONFIG_KEYS.Z_COMBO_W50, 0.35);
    const zCombo = w20 * z20 + w50 * z50;
    extremeScore = Math.max(0, Math.min(1, -zCombo / 6));
    extremeScore = Math.round(extremeScore * 1000) / 1000;
  }

  return {
    z20: z20,
    z50: z50,
    pctl20: pctl20,
    pctl50: pctl50,
    method: 'STD',
    windowUsed: Math.min(hist20.length, hist50.length),
    extremeByZ: extremeByZ,
    extremeByPctl: extremeByPctl,
    extremeScore: extremeScore
  };
}

/**
 * Computes basic statistics for a series.
 * @private
 */
function computeBasicStats_(series) {
  if (!series || series.length === 0) {
    return { mean: null, stdev: null };
  }

  const n = series.length;
  const mean = series.reduce((a, b) => a + b, 0) / n;

  let sumSq = 0;
  for (const x of series) {
    sumSq += (x - mean) * (x - mean);
  }
  const stdev = Math.sqrt(sumSq / n);

  return {
    mean: Math.round(mean * 100) / 100,
    stdev: Math.round(stdev * 100) / 100
  };
}

/**
 * Computes percentile of a value in a series.
 * @private
 */
function computePercentile_(value, series) {
  if (!series || series.length === 0) {
    return null;
  }

  let countBelow = 0;
  for (const x of series) {
    if (x <= value) {
      countBelow++;
    }
  }

  const pctl = countBelow / series.length;
  return Math.round(pctl * 1000) / 1000;
}
