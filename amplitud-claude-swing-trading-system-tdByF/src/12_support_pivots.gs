/**
 * ==================================================
 * 12_support_pivots.gs - Support Level Detection via Pivot Clustering
 * ==================================================
 *
 * Detects support levels for ETFs using pivot point clustering.
 * A pivot low is a local minimum in price where the low is lower
 * than surrounding bars.
 *
 * Method:
 * 1. Detect pivot lows in historical OHLC data
 * 2. Cluster pivots by price proximity
 * 3. Identify support level as the cluster with most pivots near current price
 *
 * Usage:
 *   const techData = computeEtfTechnicals('XLK');
 *   computeAndStoreEtfTechForAllEtfs();
 */

/**
 * Computes technical data for an ETF including support levels.
 * @param {string} etf - The ETF symbol
 * @param {string} [date] - Date to compute for (default: today)
 * @returns {Object} Technical data object
 */
function computeEtfTechnicals(etf, date) {
  date = date || getTodayDateStr();
  etf = etf.toUpperCase();

  logDebug('support', `Computing technicals for ${etf} on ${date}`);

  // Get price history for the ETF itself
  const lookbackDays = getConfigValue(CONFIG_KEYS.SUPPORT_LOOKBACK_DAYS, 252);
  const priceHistory = getPriceHistory(etf, lookbackDays + 50);

  if (!priceHistory || priceHistory.length < 50) {
    logWarn('support', `Insufficient price history for ${etf}: ${priceHistory ? priceHistory.length : 0} bars`);
    return createEmptyTechRow_(etf, date, 'Insufficient price data');
  }

  // Calculate SMAs if not present
  const enhancedPrices = attachSMAs(priceHistory, [50, 200]);

  // Find the latest price on or before target date
  let latestPrice = null;
  let latestIndex = -1;

  for (let i = enhancedPrices.length - 1; i >= 0; i--) {
    const priceDate = formatDateYMD_(enhancedPrices[i].date);
    if (priceDate <= date) {
      latestPrice = enhancedPrices[i];
      latestIndex = i;
      break;
    }
  }

  if (!latestPrice) {
    latestPrice = enhancedPrices[enhancedPrices.length - 1];
    latestIndex = enhancedPrices.length - 1;
  }

  const currentClose = latestPrice.close;
  const sma50 = latestPrice.sma50;
  const sma200 = latestPrice.sma200;

  // Detect pivot lows
  const pivotRadius = 3; // k bars on each side
  const pivotLows = detectPivotLows(enhancedPrices, pivotRadius, latestIndex);

  // Cluster pivots to find support levels
  const atr = computeRecentATR_(enhancedPrices, latestIndex);
  const supportResult = clusterPivotsToSupportLevel(pivotLows, currentClose, atr);

  // Check if near support
  const nearSupportPct = getConfigValue(CONFIG_KEYS.SUPPORT_NEAR_PCT, 0.015);
  const nearSupport = supportResult.supportLevel !== null &&
                      isNearLevel(currentClose, supportResult.supportLevel, nearSupportPct);

  // Compute trend flag
  const trendFlag = computeTrendFlag_(enhancedPrices, latestIndex, currentClose, sma50, sma200);

  const techRow = {
    date: date,
    etf: etf,
    close: currentClose,
    sma50: sma50,
    sma200: sma200,
    support_level: supportResult.supportLevel,
    support_method: 'PIVOT_CLUSTER',
    near_support_flag: nearSupport,
    trend_flag: trendFlag,
    notes_json: JSON.stringify({
      pivotCount: pivotLows.length,
      clusterCount: supportResult.clusterCount,
      distanceToSupport: supportResult.distancePct,
      atr: atr
    })
  };

  logDebug('support', `Technicals for ${etf}: close=${currentClose}, support=${supportResult.supportLevel}, near=${nearSupport}, trend=${trendFlag}`);

  return techRow;
}

/**
 * Detects pivot lows in OHLC data.
 * A pivot low at index i means low[i] < low[i-k...i-1] and low[i] < low[i+1...i+k]
 * @param {Array<Object>} ohlc - OHLC data array
 * @param {number} k - Radius for pivot detection
 * @param {number} [maxIndex] - Maximum index to consider
 * @returns {Array<Object>} Array of pivot objects { index, date, low, price }
 */
function detectPivotLows(ohlc, k, maxIndex) {
  k = k || 3;
  maxIndex = maxIndex !== undefined ? maxIndex : ohlc.length - 1;

  const pivots = [];

  for (let i = k; i <= maxIndex - k; i++) {
    const currentLow = ohlc[i].low;
    let isPivot = true;

    // Check left side
    for (let j = 1; j <= k; j++) {
      if (ohlc[i - j].low <= currentLow) {
        isPivot = false;
        break;
      }
    }

    // Check right side
    if (isPivot) {
      for (let j = 1; j <= k; j++) {
        if (ohlc[i + j].low <= currentLow) {
          isPivot = false;
          break;
        }
      }
    }

    if (isPivot) {
      pivots.push({
        index: i,
        date: ohlc[i].date,
        low: currentLow,
        price: currentLow
      });
    }
  }

  return pivots;
}

/**
 * Detects pivot highs in OHLC data (for resistance levels).
 * @param {Array<Object>} ohlc - OHLC data array
 * @param {number} k - Radius for pivot detection
 * @param {number} [maxIndex] - Maximum index to consider
 * @returns {Array<Object>} Array of pivot objects
 */
function detectPivotHighs(ohlc, k, maxIndex) {
  k = k || 3;
  maxIndex = maxIndex !== undefined ? maxIndex : ohlc.length - 1;

  const pivots = [];

  for (let i = k; i <= maxIndex - k; i++) {
    const currentHigh = ohlc[i].high;
    let isPivot = true;

    for (let j = 1; j <= k; j++) {
      if (ohlc[i - j].high >= currentHigh || ohlc[i + j].high >= currentHigh) {
        isPivot = false;
        break;
      }
    }

    if (isPivot) {
      pivots.push({
        index: i,
        date: ohlc[i].date,
        high: currentHigh,
        price: currentHigh
      });
    }
  }

  return pivots;
}

/**
 * Clusters pivot points to identify support levels.
 * @param {Array<Object>} pivots - Array of pivot objects with price field
 * @param {number} currentPrice - Current price for relevance scoring
 * @param {number} [atr] - ATR for dynamic bin sizing
 * @returns {Object} { supportLevel, clusterCount, distancePct }
 */
function clusterPivotsToSupportLevel(pivots, currentPrice, atr) {
  if (!pivots || pivots.length === 0) {
    return {
      supportLevel: null,
      clusterCount: 0,
      distancePct: null
    };
  }

  // Determine bin size (0.5% of price or based on ATR)
  let binSize;
  if (atr && atr > 0) {
    binSize = atr * 0.5; // Half ATR as bin size
  } else {
    binSize = currentPrice * 0.005; // 0.5% of price
  }

  // Only consider pivots below current price (support, not resistance)
  const supportPivots = pivots.filter(p => p.price < currentPrice);

  if (supportPivots.length === 0) {
    return {
      supportLevel: null,
      clusterCount: 0,
      distancePct: null
    };
  }

  // Create bins and count pivots
  const bins = {};

  for (const pivot of supportPivots) {
    const binKey = Math.floor(pivot.price / binSize) * binSize;
    if (!bins[binKey]) {
      bins[binKey] = {
        price: binKey + binSize / 2, // Bin center
        count: 0,
        pivots: []
      };
    }
    bins[binKey].count++;
    bins[binKey].pivots.push(pivot);
  }

  // Find the best support level:
  // - Prioritize bins with more pivots
  // - Among equal counts, prefer closer to current price
  const binArray = Object.values(bins);

  if (binArray.length === 0) {
    return {
      supportLevel: null,
      clusterCount: 0,
      distancePct: null
    };
  }

  // Sort by count (desc) then by closeness to current price (asc)
  binArray.sort((a, b) => {
    if (b.count !== a.count) {
      return b.count - a.count;
    }
    return Math.abs(currentPrice - a.price) - Math.abs(currentPrice - b.price);
  });

  // Take the best bin, but prefer one that's reasonably close
  // If the top bin is too far (> 15%), check if there's a closer one with decent count
  let selectedBin = binArray[0];

  const distancePct = Math.abs(currentPrice - selectedBin.price) / currentPrice;

  if (distancePct > 0.15 && binArray.length > 1) {
    // Check for a closer bin with at least half the count
    for (const bin of binArray) {
      const thisDistance = Math.abs(currentPrice - bin.price) / currentPrice;
      if (thisDistance < 0.15 && bin.count >= selectedBin.count * 0.5) {
        selectedBin = bin;
        break;
      }
    }
  }

  // Calculate weighted average of pivots in selected bin for more precise level
  let sumPrice = 0;
  let sumWeight = 0;

  for (const pivot of selectedBin.pivots) {
    // Weight recent pivots more heavily
    const recency = pivot.index / pivots.length;
    const weight = 0.5 + 0.5 * recency;
    sumPrice += pivot.price * weight;
    sumWeight += weight;
  }

  const supportLevel = sumWeight > 0 ?
    Math.round((sumPrice / sumWeight) * 100) / 100 :
    Math.round(selectedBin.price * 100) / 100;

  return {
    supportLevel: supportLevel,
    clusterCount: selectedBin.count,
    distancePct: Math.round(((currentPrice - supportLevel) / supportLevel) * 10000) / 100
  };
}

/**
 * Computes and stores technical data for all enabled ETFs.
 * @param {string} [date] - Date to compute for
 * @returns {Object} Summary of results
 */
function computeAndStoreEtfTechForAllEtfs(date) {
  date = date || getTodayDateStr();

  logOperationStart('computeAndStoreEtfTech', { date });

  const enabledEtfs = getEnabledEtfs();
  const techRows = [];
  let success = 0;
  let failed = 0;

  for (const etfConfig of enabledEtfs) {
    try {
      const tech = computeEtfTechnicals(etfConfig.etf, date);
      techRows.push(tech);

      if (tech.support_level !== null) {
        success++;
      } else {
        failed++;
      }
    } catch (e) {
      logException('support', `computeEtfTechnicals(${etfConfig.etf})`, e);
      failed++;
    }
  }

  // Save all tech rows
  if (techRows.length > 0) {
    upsertRows(SHEET_NAMES.ETF_TECH_DAILY, techRows, ['date', 'etf']);
  }

  const summary = { date, success, failed, total: enabledEtfs.length };
  logOperationEnd('computeAndStoreEtfTech', summary);

  return summary;
}

/**
 * Computes trend flag based on configuration.
 * @private
 */
function computeTrendFlag_(priceHistory, latestIndex, close, sma50, sma200) {
  const trendMethod = getConfigValue(CONFIG_KEYS.TREND_METHOD, 'SMA200');

  switch (trendMethod) {
    case 'SMA200':
      // Bullish if close > SMA200
      return sma200 !== null && close > sma200;

    case 'SMA50_SLOPE':
      // Bullish if SMA50 has positive slope
      return computeSma50SlopePositive_(priceHistory, latestIndex);

    case 'BOTH':
      // Bullish if both conditions are met
      const aboveSma200 = sma200 !== null && close > sma200;
      const slopePositive = computeSma50SlopePositive_(priceHistory, latestIndex);
      return aboveSma200 && slopePositive;

    default:
      return sma200 !== null && close > sma200;
  }
}

/**
 * Checks if SMA50 slope is positive.
 * @private
 */
function computeSma50SlopePositive_(priceHistory, latestIndex) {
  const window = getConfigValue(CONFIG_KEYS.TREND_SMA50_SLOPE_WINDOW, 20);

  if (latestIndex < window || !priceHistory[latestIndex].sma50) {
    return false;
  }

  const startIndex = latestIndex - window;
  const startSma = priceHistory[startIndex].sma50;
  const endSma = priceHistory[latestIndex].sma50;

  if (!startSma || !endSma) {
    return false;
  }

  // Positive slope if end > start
  return endSma > startSma;
}

/**
 * Computes recent ATR.
 * @private
 */
function computeRecentATR_(priceHistory, latestIndex) {
  const period = 14;

  if (latestIndex < period) {
    return null;
  }

  const recentBars = priceHistory.slice(latestIndex - period + 1, latestIndex + 1);
  const atrArray = computeATR(recentBars, period);

  // Return last value
  return atrArray.length > 0 ? atrArray[atrArray.length - 1] : null;
}

/**
 * Creates an empty tech row for missing data.
 * @private
 */
function createEmptyTechRow_(etf, date, reason) {
  return {
    date: date,
    etf: etf,
    close: null,
    sma50: null,
    sma200: null,
    support_level: null,
    support_method: 'PIVOT_CLUSTER',
    near_support_flag: false,
    trend_flag: false,
    notes_json: JSON.stringify({ error: reason })
  };
}

/**
 * Gets the latest technical data for an ETF.
 * @param {string} etf - The ETF symbol
 * @returns {Object|null} Latest tech row or null
 */
function getLatestEtfTech(etf) {
  const techData = getSheetDataFiltered(SHEET_NAMES.ETF_TECH_DAILY, { etf: etf });

  if (!techData || techData.length === 0) {
    return null;
  }

  // Find latest by date
  let latest = techData[0];
  for (const row of techData) {
    if (formatDateYMD_(row.date) > formatDateYMD_(latest.date)) {
      latest = row;
    }
  }

  return latest;
}
