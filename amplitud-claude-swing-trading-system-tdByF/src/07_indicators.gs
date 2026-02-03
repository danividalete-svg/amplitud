/**
 * ==================================================
 * 07_indicators.gs - Technical Indicators
 * ==================================================
 *
 * Calculates technical indicators (SMA, etc.) for price data.
 *
 * Usage:
 *   const sma20 = computeSMA(closePrices, 20);
 *   const ohlcWithSMA = attachSMAs(ohlcArray);
 */

/**
 * Computes Simple Moving Average for a series.
 * @param {Array<number>} series - Array of numeric values
 * @param {number} period - SMA period
 * @returns {Array<number|null>} SMA values (null for insufficient data)
 */
function computeSMA(series, period) {
  if (!series || series.length === 0) {
    return [];
  }

  const result = [];

  for (let i = 0; i < series.length; i++) {
    if (i < period - 1) {
      result.push(null);
    } else {
      let sum = 0;
      for (let j = 0; j < period; j++) {
        sum += series[i - j];
      }
      result.push(roundPrice_(sum / period));
    }
  }

  return result;
}

/**
 * Attaches SMA values to OHLC data.
 * @param {Array<Object>} ohlc - Array of {date, close, ...} objects
 * @param {Array<number>} [periods=[20, 50, 200]] - SMA periods to calculate
 * @returns {Array<Object>} OHLC with sma20, sma50, sma200 fields
 */
function attachSMAs(ohlc, periods) {
  periods = periods || [20, 50, 200];

  if (!ohlc || ohlc.length === 0) {
    return ohlc;
  }

  // Extract close prices
  const closes = ohlc.map(bar => bar.close);

  // Compute SMAs
  const smaResults = {};
  for (const period of periods) {
    smaResults[period] = computeSMA(closes, period);
  }

  // Attach to OHLC objects
  return ohlc.map((bar, i) => {
    const enhanced = { ...bar };

    for (const period of periods) {
      const smaValue = smaResults[period][i];
      if (period === 20) enhanced.sma20 = smaValue;
      else if (period === 50) enhanced.sma50 = smaValue;
      else if (period === 200) enhanced.sma200 = smaValue;
    }

    return enhanced;
  });
}

/**
 * Computes SMA slope (rate of change) over a window.
 * @param {Array<number>} smaValues - SMA series
 * @param {number} window - Window for slope calculation
 * @returns {Array<number|null>} Slope values
 */
function computeSMASlope(smaValues, window) {
  const result = [];

  for (let i = 0; i < smaValues.length; i++) {
    if (i < window - 1 || smaValues[i] === null || smaValues[i - window + 1] === null) {
      result.push(null);
    } else {
      const startVal = smaValues[i - window + 1];
      const endVal = smaValues[i];
      // Percentage change over window
      const slope = ((endVal - startVal) / startVal) * 100;
      result.push(Math.round(slope * 1000) / 1000);
    }
  }

  return result;
}

/**
 * Checks if a value is above its SMA.
 * @param {number} value - Current value
 * @param {number} sma - SMA value
 * @returns {boolean} True if value > SMA
 */
function isAboveSMA(value, sma) {
  if (value === null || value === undefined || sma === null || sma === undefined) {
    return false;
  }
  return value > sma;
}

/**
 * Computes ATR (Average True Range) for volatility.
 * @param {Array<Object>} ohlc - Array of {high, low, close} objects
 * @param {number} period - ATR period (default 14)
 * @returns {Array<number|null>} ATR values
 */
function computeATR(ohlc, period) {
  period = period || 14;

  if (!ohlc || ohlc.length < 2) {
    return [];
  }

  // Calculate True Range
  const tr = [];
  for (let i = 0; i < ohlc.length; i++) {
    if (i === 0) {
      tr.push(ohlc[i].high - ohlc[i].low);
    } else {
      const hl = ohlc[i].high - ohlc[i].low;
      const hc = Math.abs(ohlc[i].high - ohlc[i - 1].close);
      const lc = Math.abs(ohlc[i].low - ohlc[i - 1].close);
      tr.push(Math.max(hl, hc, lc));
    }
  }

  // Compute ATR as SMA of TR
  return computeSMA(tr, period);
}

/**
 * Detects candlestick patterns.
 * @param {Array<Object>} ohlc - Array of OHLC bars
 * @returns {Array<Object>} Array of { date, patterns: [...] }
 */
function detectCandlePatterns(ohlc) {
  if (!ohlc || ohlc.length < 3) {
    return [];
  }

  const results = [];

  for (let i = 1; i < ohlc.length; i++) {
    const patterns = [];
    const curr = ohlc[i];
    const prev = ohlc[i - 1];
    const prev2 = i >= 2 ? ohlc[i - 2] : null;

    const body = Math.abs(curr.close - curr.open);
    const upperWick = curr.high - Math.max(curr.open, curr.close);
    const lowerWick = Math.min(curr.open, curr.close) - curr.low;
    const range = curr.high - curr.low;

    const isBullish = curr.close > curr.open;
    const isBearish = curr.close < curr.open;

    // Hammer: small body, long lower wick, bullish after decline
    if (body / range < 0.3 && lowerWick > body * 2 && upperWick < body * 0.5) {
      patterns.push('hammer');
    }

    // Shooting Star: small body, long upper wick, bearish after rise
    if (body / range < 0.3 && upperWick > body * 2 && lowerWick < body * 0.5) {
      patterns.push('shooting_star');
    }

    // Bullish Engulfing
    if (prev && isBullish && prev.close < prev.open &&
        curr.open < prev.close && curr.close > prev.open) {
      patterns.push('bullish_engulfing');
    }

    // Bearish Engulfing
    if (prev && isBearish && prev.close > prev.open &&
        curr.open > prev.close && curr.close < prev.open) {
      patterns.push('bearish_engulfing');
    }

    // Doji: very small body
    if (body / range < 0.1 && range > 0) {
      patterns.push('doji');
    }

    // Inside Bar: current range inside previous range
    if (prev && curr.high < prev.high && curr.low > prev.low) {
      patterns.push('inside_bar');
    }

    // Gap Up
    if (prev && curr.low > prev.high) {
      patterns.push('gap_up');
    }

    // Gap Down
    if (prev && curr.high < prev.low) {
      patterns.push('gap_down');
    }

    // Morning Star (simplified)
    if (prev2 && prev && isBullish &&
        prev2.close < prev2.open && // Day 1: bearish
        Math.abs(prev.close - prev.open) / (prev.high - prev.low || 1) < 0.3 && // Day 2: small body
        curr.close > (prev2.open + prev2.close) / 2) { // Day 3: closes above midpoint of day 1
      patterns.push('morning_star');
    }

    results.push({
      date: curr.date,
      patterns: patterns
    });
  }

  return results;
}

/**
 * Calculates RSI (Relative Strength Index).
 * @param {Array<number>} closes - Close prices
 * @param {number} period - RSI period (default 14)
 * @returns {Array<number|null>} RSI values (0-100)
 */
function computeRSI(closes, period) {
  period = period || 14;

  if (!closes || closes.length < period + 1) {
    return closes.map(() => null);
  }

  const result = [];
  const gains = [];
  const losses = [];

  // Calculate changes
  for (let i = 1; i < closes.length; i++) {
    const change = closes[i] - closes[i - 1];
    gains.push(change > 0 ? change : 0);
    losses.push(change < 0 ? -change : 0);
  }

  // Calculate RSI
  for (let i = 0; i < closes.length; i++) {
    if (i < period) {
      result.push(null);
    } else {
      // Simple average for first RSI
      let avgGain = 0;
      let avgLoss = 0;

      for (let j = i - period; j < i; j++) {
        avgGain += gains[j];
        avgLoss += losses[j];
      }
      avgGain /= period;
      avgLoss /= period;

      if (avgLoss === 0) {
        result.push(100);
      } else {
        const rs = avgGain / avgLoss;
        const rsi = 100 - (100 / (1 + rs));
        result.push(Math.round(rsi * 100) / 100);
      }
    }
  }

  return result;
}

/**
 * Calculates percentage distance from a value to another.
 * @param {number} value - Current value
 * @param {number} reference - Reference value
 * @returns {number} Percentage distance
 */
function percentDistance(value, reference) {
  if (!value || !reference || reference === 0) {
    return null;
  }
  return ((value - reference) / reference) * 100;
}

/**
 * Checks if price is near a level (within percentage threshold).
 * @param {number} price - Current price
 * @param {number} level - Target level
 * @param {number} thresholdPct - Threshold percentage (e.g., 0.015 = 1.5%)
 * @returns {boolean} True if near
 */
function isNearLevel(price, level, thresholdPct) {
  if (!price || !level || level === 0) {
    return false;
  }
  const distance = Math.abs(price - level) / level;
  return distance <= thresholdPct;
}

/**
 * Gets the latest SMA value from a price history.
 * @param {Array<Object>} priceHistory - Price history with sma20, sma50, etc.
 * @param {string} smaField - Field name (sma20, sma50, sma200)
 * @returns {number|null} Latest SMA value
 */
function getLatestSMA(priceHistory, smaField) {
  if (!priceHistory || priceHistory.length === 0) {
    return null;
  }

  // Find latest non-null SMA
  for (let i = priceHistory.length - 1; i >= 0; i--) {
    const val = priceHistory[i][smaField];
    if (val !== null && val !== undefined) {
      return val;
    }
  }

  return null;
}

/**
 * Extracts close prices from OHLC array.
 * @param {Array<Object>} ohlc - OHLC array
 * @returns {Array<number>} Close prices
 */
function extractCloses(ohlc) {
  return ohlc.map(bar => bar.close).filter(c => c !== null && c !== undefined);
}

/**
 * Extracts a field from OHLC array.
 * @param {Array<Object>} ohlc - OHLC array
 * @param {string} field - Field name
 * @returns {Array<number>} Field values
 */
function extractField(ohlc, field) {
  return ohlc.map(bar => bar[field]).filter(v => v !== null && v !== undefined);
}
