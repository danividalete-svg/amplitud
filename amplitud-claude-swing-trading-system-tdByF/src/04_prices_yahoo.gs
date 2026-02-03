/**
 * ==================================================
 * 04_prices_yahoo.gs - Yahoo Finance Price Fetcher
 * ==================================================
 *
 * Fetches OHLC price data from Yahoo Finance Chart API.
 * This is the primary price source (unofficial, may have availability issues).
 *
 * Usage:
 *   const ohlc = fetchYahooChart('AAPL', '6mo', '1d');
 */

/**
 * Fetches price data from Yahoo Finance Chart API.
 * @param {string} ticker - The stock ticker symbol
 * @param {string} [range='6mo'] - Time range (1d, 5d, 1mo, 3mo, 6mo, 1y, 2y, 5y, ytd, max)
 * @param {string} [interval='1d'] - Interval (1m, 2m, 5m, 15m, 30m, 60m, 90m, 1h, 1d, 5d, 1wk, 1mo, 3mo)
 * @returns {Object} { success, data: Array<{date, open, high, low, close, adjclose, volume}>, error }
 */
function fetchYahooChart(ticker, range, interval) {
  range = range || '6mo';
  interval = interval || '1d';

  // Check if Yahoo is known to be unavailable
  const yahooOk = getConfigValue(CONFIG_KEYS.YAHOO_OK, null);
  if (yahooOk === false) {
    return {
      success: false,
      data: null,
      error: 'Yahoo Finance is marked as unavailable in CONFIG'
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

  incrementProviderCounter('yahoo');

  const url = fillUrlTemplate(API_ENDPOINTS.YAHOO_CHART, {
    TICKER: ticker,
    RANGE: range,
    INTERVAL: interval
  });

  logDebug('prices_yahoo', `Fetching ${ticker} (${range}/${interval})`);

  const response = httpGetJson(url);

  if (!response.success) {
    logWarn('prices_yahoo', `Failed to fetch ${ticker}`, { error: response.error });
    return {
      success: false,
      data: null,
      error: response.error
    };
  }

  // Parse Yahoo response
  const parsed = parseYahooChartResponse_(response.data, ticker);

  if (!parsed.success) {
    logWarn('prices_yahoo', `Failed to parse ${ticker}`, { error: parsed.error });
  } else {
    logDebug('prices_yahoo', `Fetched ${parsed.data.length} bars for ${ticker}`);
  }

  return parsed;
}

/**
 * Parses Yahoo Finance chart API response.
 * @private
 */
function parseYahooChartResponse_(json, ticker) {
  try {
    // Check for error response
    if (json.chart && json.chart.error) {
      return {
        success: false,
        data: null,
        error: json.chart.error.description || 'Yahoo API error'
      };
    }

    const result = json.chart && json.chart.result && json.chart.result[0];

    if (!result) {
      return {
        success: false,
        data: null,
        error: 'No data in Yahoo response'
      };
    }

    const timestamps = result.timestamp;
    const quote = result.indicators && result.indicators.quote && result.indicators.quote[0];
    const adjClose = result.indicators && result.indicators.adjclose &&
                     result.indicators.adjclose[0] && result.indicators.adjclose[0].adjclose;

    if (!timestamps || !quote) {
      return {
        success: false,
        data: null,
        error: 'Missing timestamp or quote data'
      };
    }

    const bars = [];

    for (let i = 0; i < timestamps.length; i++) {
      // Skip if any required value is null/undefined
      if (quote.open[i] == null || quote.high[i] == null ||
          quote.low[i] == null || quote.close[i] == null) {
        continue;
      }

      const date = unixToDate(timestamps[i]);
      const dateStr = formatDateYMD_(date);

      bars.push({
        date: dateStr,
        ticker: ticker,
        open: roundPrice_(quote.open[i]),
        high: roundPrice_(quote.high[i]),
        low: roundPrice_(quote.low[i]),
        close: roundPrice_(quote.close[i]),
        adjclose: adjClose && adjClose[i] != null ? roundPrice_(adjClose[i]) : roundPrice_(quote.close[i]),
        volume: quote.volume[i] || 0,
        source: DATA_SOURCES.PRICES.YAHOO_CHART
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
 * Fetches price data for multiple tickers from Yahoo.
 * @param {Array<string>} tickers - Array of ticker symbols
 * @param {string} [range='6mo'] - Time range
 * @param {string} [interval='1d'] - Interval
 * @returns {Object} Map of ticker -> { success, data, error }
 */
function fetchYahooChartBatch(tickers, range, interval) {
  const results = {};

  for (const ticker of tickers) {
    // Check budget between each request
    if (isBudgetLimitReached(CONFIG_KEYS.MAX_DAILY_HTTP, 'http_requests_total')) {
      logWarn('prices_yahoo', 'Budget limit reached, stopping batch');
      break;
    }

    results[ticker] = fetchYahooChart(ticker, range, interval);

    // Small delay between requests to be respectful
    Utilities.sleep(200);
  }

  return results;
}

/**
 * Tests Yahoo Finance availability.
 * @returns {Object} { available: boolean, message: string }
 */
function testYahooAvailability() {
  const testTicker = 'SPY';

  try {
    const result = fetchYahooChart(testTicker, '5d', '1d');

    if (result.success && result.data && result.data.length > 0) {
      return {
        available: true,
        message: `Yahoo Finance OK, fetched ${result.data.length} bars for ${testTicker}`
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
 * Determines the appropriate range parameter based on required days.
 * @param {number} days - Number of days needed
 * @returns {string} Yahoo range parameter
 */
function getYahooRangeForDays(days) {
  if (days <= 5) return '5d';
  if (days <= 30) return '1mo';
  if (days <= 90) return '3mo';
  if (days <= 180) return '6mo';
  if (days <= 365) return '1y';
  if (days <= 730) return '2y';
  return '5y';
}

/**
 * Rounds a price to 2 decimal places.
 * @private
 */
function roundPrice_(price) {
  return Math.round(price * 100) / 100;
}

/**
 * Saves Yahoo price data to the PRICES_DAILY sheet.
 * @param {Array<Object>} bars - Array of price bars
 */
function saveYahooPricesToSheet(bars) {
  if (!bars || bars.length === 0) {
    return;
  }

  // Upsert by date + ticker
  upsertRows(SHEET_NAMES.PRICES_DAILY, bars, ['date', 'ticker']);
}
