/**
 * ==================================================
 * 06_prices_fmp.gs - Financial Modeling Prep Price Fetcher
 * ==================================================
 *
 * Fetches OHLC price data from Financial Modeling Prep (FMP) API.
 * Fallback price source with free tier (250 calls/day).
 *
 * Usage:
 *   const ohlc = fetchFmpEod('AAPL', '2024-01-01', '2024-06-01');
 */

/**
 * Fetches historical EOD price data from FMP.
 * @param {string} ticker - The stock ticker symbol
 * @param {string} fromDate - Start date (YYYY-MM-DD)
 * @param {string} toDate - End date (YYYY-MM-DD)
 * @returns {Object} { success, data: Array<{date, open, high, low, close, adjclose, volume}>, error }
 */
function fetchFmpEod(ticker, fromDate, toDate) {
  // Check if FMP is known to be available
  const fmpOk = getConfigValue(CONFIG_KEYS.FMP_OK, null);
  if (fmpOk === false) {
    return {
      success: false,
      data: null,
      error: 'FMP marked as unavailable in CONFIG'
    };
  }

  // Get API key
  const apiKey = getConfigValue(CONFIG_KEYS.FMP_KEY, '');
  if (!apiKey) {
    return {
      success: false,
      data: null,
      error: 'FMP_KEY not configured'
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

  incrementProviderCounter('fmp');

  // Format dates if needed
  fromDate = formatDateYMD_(fromDate);
  toDate = formatDateYMD_(toDate);

  const url = fillUrlTemplate(API_ENDPOINTS.FMP_EOD, {
    TICKER: ticker,
    FROM: fromDate,
    TO: toDate,
    KEY: apiKey
  });

  logDebug('prices_fmp', `Fetching ${ticker} (${fromDate} to ${toDate})`);

  const response = httpGetJson(url);

  if (!response.success) {
    logWarn('prices_fmp', `Failed to fetch ${ticker}`, { error: response.error });
    return {
      success: false,
      data: null,
      error: response.error
    };
  }

  // Parse FMP response
  const parsed = parseFmpEodResponse_(response.data, ticker);

  if (!parsed.success) {
    logWarn('prices_fmp', `Failed to parse ${ticker}`, { error: parsed.error });
  } else {
    logDebug('prices_fmp', `Fetched ${parsed.data.length} bars for ${ticker}`);
  }

  return parsed;
}

/**
 * Parses FMP historical price API response.
 * @private
 */
function parseFmpEodResponse_(json, ticker) {
  try {
    // Check for error response
    if (json.Error || json['Error Message']) {
      return {
        success: false,
        data: null,
        error: json.Error || json['Error Message']
      };
    }

    // FMP returns { symbol, historical: [...] }
    let historical = json.historical;

    // Sometimes it returns array directly
    if (Array.isArray(json)) {
      historical = json;
    }

    if (!historical || historical.length === 0) {
      return {
        success: false,
        data: null,
        error: 'No historical data in response'
      };
    }

    const bars = [];

    for (const day of historical) {
      if (day.open == null || day.high == null || day.low == null || day.close == null) {
        continue;
      }

      bars.push({
        date: day.date,
        ticker: ticker,
        open: roundPrice_(day.open),
        high: roundPrice_(day.high),
        low: roundPrice_(day.low),
        close: roundPrice_(day.close),
        adjclose: day.adjClose != null ? roundPrice_(day.adjClose) : roundPrice_(day.close),
        volume: day.volume || 0,
        source: DATA_SOURCES.PRICES.FMP_EOD
      });
    }

    // FMP returns newest first, sort ascending
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
 * Fetches EOD data for multiple tickers from FMP.
 * Note: FMP free tier has 250 calls/day, use sparingly.
 * @param {Array<string>} tickers - Array of ticker symbols
 * @param {string} fromDate - Start date
 * @param {string} toDate - End date
 * @returns {Object} Map of ticker -> { success, data, error }
 */
function fetchFmpEodBatch(tickers, fromDate, toDate) {
  const results = {};

  // Track FMP-specific calls to stay under 250/day
  let fmpCalls = RUNTIME_CACHE.budgetCounters.provider_requests_fmp || 0;
  const fmpLimit = LIMITS.FMP_FREE_DAILY_CALLS;

  for (const ticker of tickers) {
    // Check FMP-specific limit
    if (fmpCalls >= fmpLimit * 0.9) {
      logWarn('prices_fmp', `Approaching FMP daily limit (${fmpCalls}/${fmpLimit}), stopping batch`);
      break;
    }

    if (isBudgetLimitReached(CONFIG_KEYS.MAX_DAILY_HTTP, 'http_requests_total')) {
      break;
    }

    results[ticker] = fetchFmpEod(ticker, fromDate, toDate);
    fmpCalls++;

    // Respect rate limits
    Utilities.sleep(400);
  }

  return results;
}

/**
 * Tests FMP availability.
 * @returns {Object} { available: boolean, message: string }
 */
function testFmpAvailability() {
  const apiKey = getConfigValue(CONFIG_KEYS.FMP_KEY, '');
  if (!apiKey) {
    return {
      available: false,
      message: 'FMP_KEY not configured'
    };
  }

  const testTicker = 'AAPL';
  const toDate = formatDateYMD_(new Date());
  const fromDate = formatDateYMD_(subtractDays_(new Date(), 7));

  try {
    const result = fetchFmpEod(testTicker, fromDate, toDate);

    if (result.success && result.data && result.data.length > 0) {
      return {
        available: true,
        message: `FMP OK, fetched ${result.data.length} bars for ${testTicker}`
      };
    }

    // Check for plan limitations
    if (result.error && (result.error.includes('limit') || result.error.includes('Limit'))) {
      return {
        available: false,
        message: `FMP limit reached: ${result.error}`
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
 * Gets quote for a single ticker (useful for current price).
 * @param {string} ticker - The stock ticker symbol
 * @returns {Object} { success, data: { price, change, ... }, error }
 */
function fetchFmpQuote(ticker) {
  const apiKey = getConfigValue(CONFIG_KEYS.FMP_KEY, '');
  if (!apiKey) {
    return { success: false, data: null, error: 'FMP_KEY not configured' };
  }

  if (isBudgetLimitReached(CONFIG_KEYS.MAX_DAILY_HTTP, 'http_requests_total')) {
    return { success: false, data: null, error: 'Budget exceeded' };
  }

  incrementProviderCounter('fmp');

  const url = `https://financialmodelingprep.com/api/v3/quote/${encodeURIComponent(ticker)}?apikey=${encodeURIComponent(apiKey)}`;

  const response = httpGetJson(url);

  if (!response.success) {
    return { success: false, data: null, error: response.error };
  }

  if (Array.isArray(response.data) && response.data.length > 0) {
    return { success: true, data: response.data[0], error: null };
  }

  return { success: false, data: null, error: 'No quote data' };
}

/**
 * Saves FMP price data to the PRICES_DAILY sheet.
 * @param {Array<Object>} bars - Array of price bars
 */
function saveFmpPricesToSheet(bars) {
  if (!bars || bars.length === 0) {
    return;
  }

  upsertRows(SHEET_NAMES.PRICES_DAILY, bars, ['date', 'ticker']);
}
