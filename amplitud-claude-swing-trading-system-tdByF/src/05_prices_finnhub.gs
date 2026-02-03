/**
 * ==================================================
 * 05_prices_finnhub.gs - Finnhub Price Fetcher
 * ==================================================
 *
 * Fetches OHLC price data from Finnhub Stock Candles API.
 * Secondary price source with API key requirement.
 *
 * Usage:
 *   const ohlc = fetchFinnhubCandles('AAPL', startDate, endDate);
 */

/**
 * Fetches candle data from Finnhub.
 * @param {string} ticker - The stock ticker symbol
 * @param {Date|string} fromDate - Start date
 * @param {Date|string} toDate - End date
 * @returns {Object} { success, data: Array<{date, open, high, low, close, volume}>, error }
 */
function fetchFinnhubCandles(ticker, fromDate, toDate) {
  // Check if Finnhub candles are known to be available
  const finnhubOk = getConfigValue(CONFIG_KEYS.FINNHUB_CANDLES_OK, null);
  if (finnhubOk === false) {
    return {
      success: false,
      data: null,
      error: 'Finnhub candles marked as unavailable in CONFIG'
    };
  }

  // Get API token
  const token = getConfigValue(CONFIG_KEYS.FINNHUB_TOKEN, '');
  if (!token) {
    return {
      success: false,
      data: null,
      error: 'FINNHUB_TOKEN not configured'
    };
  }

  // Check budget
  if (isBudgetLimitReached(CONFIG_KEYS.MAX_DAILY_HTTP, 'http_requests_total')) {
    return {
      success: false,
      data: null,
      error: 'Daily HTTP budget exceeded'
    };
  }

  incrementProviderCounter('finnhub');

  // Convert dates to Unix timestamps
  const fromUnix = dateToUnix(normalizeToDate_(fromDate));
  const toUnix = dateToUnix(normalizeToDate_(toDate));

  const url = fillUrlTemplate(API_ENDPOINTS.FINNHUB_CANDLES, {
    TICKER: ticker,
    FROM: fromUnix.toString(),
    TO: toUnix.toString(),
    TOKEN: token
  });

  logDebug('prices_finnhub', `Fetching ${ticker} (${formatDateYMD_(fromDate)} to ${formatDateYMD_(toDate)})`);

  const response = httpGetJson(url);

  if (!response.success) {
    logWarn('prices_finnhub', `Failed to fetch ${ticker}`, { error: response.error });
    return {
      success: false,
      data: null,
      error: response.error
    };
  }

  // Parse Finnhub response
  const parsed = parseFinnhubCandlesResponse_(response.data, ticker);

  if (!parsed.success) {
    logWarn('prices_finnhub', `Failed to parse ${ticker}`, { error: parsed.error });
  } else {
    logDebug('prices_finnhub', `Fetched ${parsed.data.length} candles for ${ticker}`);
  }

  return parsed;
}

/**
 * Parses Finnhub candles API response.
 * @private
 */
function parseFinnhubCandlesResponse_(json, ticker) {
  try {
    // Check for "no_data" status
    if (json.s === 'no_data') {
      return {
        success: false,
        data: null,
        error: 'No data available for this ticker/range'
      };
    }

    if (json.s !== 'ok') {
      return {
        success: false,
        data: null,
        error: `Finnhub status: ${json.s}`
      };
    }

    const timestamps = json.t;
    const opens = json.o;
    const highs = json.h;
    const lows = json.l;
    const closes = json.c;
    const volumes = json.v;

    if (!timestamps || !opens || !highs || !lows || !closes) {
      return {
        success: false,
        data: null,
        error: 'Missing OHLC data in response'
      };
    }

    const bars = [];

    for (let i = 0; i < timestamps.length; i++) {
      if (opens[i] == null || highs[i] == null || lows[i] == null || closes[i] == null) {
        continue;
      }

      const date = unixToDate(timestamps[i]);
      const dateStr = formatDateYMD_(date);

      bars.push({
        date: dateStr,
        ticker: ticker,
        open: roundPrice_(opens[i]),
        high: roundPrice_(highs[i]),
        low: roundPrice_(lows[i]),
        close: roundPrice_(closes[i]),
        adjclose: roundPrice_(closes[i]), // Finnhub doesn't provide adjusted close
        volume: volumes[i] || 0,
        source: DATA_SOURCES.PRICES.FINNHUB_CANDLES
      });
    }

    // Sort by date ascending
    bars.sort((a, b) => a.date.localeCompare(b.date));

    return {
      success: true,
      data: bars,
      error: null
    };

  } catch (e) {
    return {
      success: false,
      data: null,
      error: `Parse error: ${e.message}`
    };
  }
}

/**
 * Fetches candle data for multiple tickers from Finnhub.
 * @param {Array<string>} tickers - Array of ticker symbols
 * @param {Date|string} fromDate - Start date
 * @param {Date|string} toDate - End date
 * @returns {Object} Map of ticker -> { success, data, error }
 */
function fetchFinnhubCandlesBatch(tickers, fromDate, toDate) {
  const results = {};

  for (const ticker of tickers) {
    if (isBudgetLimitReached(CONFIG_KEYS.MAX_DAILY_HTTP, 'http_requests_total')) {
      logWarn('prices_finnhub', 'Budget limit reached, stopping batch');
      break;
    }

    results[ticker] = fetchFinnhubCandles(ticker, fromDate, toDate);

    // Finnhub has rate limits, add delay
    Utilities.sleep(300);
  }

  return results;
}

/**
 * Tests Finnhub candles availability.
 * @returns {Object} { available: boolean, message: string }
 */
function testFinnhubCandlesAvailability() {
  const token = getConfigValue(CONFIG_KEYS.FINNHUB_TOKEN, '');
  if (!token) {
    return {
      available: false,
      message: 'FINNHUB_TOKEN not configured'
    };
  }

  const testTicker = 'AAPL';
  const toDate = new Date();
  const fromDate = subtractDays_(toDate, 7);

  try {
    const result = fetchFinnhubCandles(testTicker, fromDate, toDate);

    if (result.success && result.data && result.data.length > 0) {
      return {
        available: true,
        message: `Finnhub candles OK, fetched ${result.data.length} bars for ${testTicker}`
      };
    }

    // Check for specific error codes indicating plan limitations
    if (result.error && (result.error.includes('403') || result.error.includes('402'))) {
      return {
        available: false,
        message: `Finnhub candles not available on current plan: ${result.error}`
      };
    }

    return {
      available: false,
      message: result.error || 'No data returned'
    };

  } catch (e) {
    return {
      available: false,
      message: `Exception: ${e.message}`
    };
  }
}

/**
 * Saves Finnhub price data to the PRICES_DAILY sheet.
 * @param {Array<Object>} bars - Array of price bars
 */
function saveFinnhubPricesToSheet(bars) {
  if (!bars || bars.length === 0) {
    return;
  }

  upsertRows(SHEET_NAMES.PRICES_DAILY, bars, ['date', 'ticker']);
}

/**
 * Normalizes a date value to a Date object.
 * @private
 */
function normalizeToDate_(dateValue) {
  if (dateValue instanceof Date) {
    return dateValue;
  }
  if (typeof dateValue === 'string') {
    return new Date(dateValue);
  }
  return new Date(dateValue);
}
