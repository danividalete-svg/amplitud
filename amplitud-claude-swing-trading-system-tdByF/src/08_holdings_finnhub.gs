/**
 * ==================================================
 * 08_holdings_finnhub.gs - Finnhub ETF Holdings Fetcher
 * ==================================================
 *
 * Fetches ETF holdings from Finnhub API.
 * Primary holdings source (requires API key, availability varies by plan).
 *
 * Usage:
 *   const holdings = fetchFinnhubEtfHoldings('XLK');
 */

/**
 * Fetches ETF holdings from Finnhub.
 * @param {string} etf - The ETF symbol
 * @returns {Object} { success, data: Array<{ticker, weight, rank}>, error }
 */
function fetchFinnhubEtfHoldings(etf) {
  // Check if Finnhub holdings are known to be available
  const holdingsOk = getConfigValue(CONFIG_KEYS.FINNHUB_HOLDINGS_OK, null);
  if (holdingsOk === false) {
    return {
      success: false,
      data: null,
      error: 'Finnhub holdings marked as unavailable in CONFIG'
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

  const url = fillUrlTemplate(API_ENDPOINTS.FINNHUB_HOLDINGS, {
    ETF: etf,
    TOKEN: token
  });

  logDebug('holdings_finnhub', `Fetching holdings for ${etf}`);

  const response = httpGetJson(url);

  if (!response.success) {
    // Check for specific error codes indicating plan limitations
    if (response.statusCode === 403 || response.statusCode === 402) {
      logWarn('holdings_finnhub', `Holdings not available on current plan for ${etf}`, {
        statusCode: response.statusCode
      });
      // Mark as unavailable for future requests
      setConfigValue(CONFIG_KEYS.FINNHUB_HOLDINGS_OK, false, 'Auto-detected: plan limitation');
    }

    return {
      success: false,
      data: null,
      error: response.error
    };
  }

  // Parse response
  const parsed = parseFinnhubHoldingsResponse_(response.data, etf);

  if (!parsed.success) {
    logWarn('holdings_finnhub', `Failed to parse holdings for ${etf}`, { error: parsed.error });
  } else {
    logInfo('holdings_finnhub', `Fetched ${parsed.data.length} holdings for ${etf}`);
  }

  return parsed;
}

/**
 * Parses Finnhub ETF holdings response.
 * @private
 */
function parseFinnhubHoldingsResponse_(json, etf) {
  try {
    // Check for error response
    if (json.error) {
      return {
        success: false,
        data: null,
        error: json.error
      };
    }

    // Finnhub returns { holdings: [...], symbol: ... }
    const holdings = json.holdings;

    if (!holdings || holdings.length === 0) {
      return {
        success: false,
        data: null,
        error: 'No holdings in response'
      };
    }

    const topN = getConfigValue(CONFIG_KEYS.HOLDINGS_TOP_N, 30);

    // Sort by weight descending and take top N
    const sorted = holdings
      .filter(h => h.symbol && h.symbol.length > 0)
      .sort((a, b) => (b.percent || 0) - (a.percent || 0))
      .slice(0, topN);

    const result = sorted.map((h, index) => ({
      ticker: normalizeTickerSymbol_(h.symbol),
      weight: h.percent != null ? Math.round(h.percent * 100) / 100 : null,
      rank: index + 1
    }));

    return {
      success: true,
      data: result,
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
 * Fetches holdings for multiple ETFs from Finnhub.
 * @param {Array<string>} etfs - Array of ETF symbols
 * @returns {Object} Map of etf -> { success, data, error }
 */
function fetchFinnhubHoldingsBatch(etfs) {
  const results = {};

  for (const etf of etfs) {
    if (isBudgetLimitReached(CONFIG_KEYS.MAX_DAILY_HTTP, 'http_requests_total')) {
      logWarn('holdings_finnhub', 'Budget limit reached, stopping batch');
      break;
    }

    results[etf] = fetchFinnhubEtfHoldings(etf);

    // Check if we should stop due to plan limitation
    const holdingsOk = getConfigValue(CONFIG_KEYS.FINNHUB_HOLDINGS_OK, null);
    if (holdingsOk === false) {
      logWarn('holdings_finnhub', 'Finnhub holdings unavailable, stopping batch');
      break;
    }

    // Respect rate limits
    Utilities.sleep(300);
  }

  return results;
}

/**
 * Tests Finnhub holdings availability.
 * @returns {Object} { available: boolean, message: string }
 */
function testFinnhubHoldingsAvailability() {
  const token = getConfigValue(CONFIG_KEYS.FINNHUB_TOKEN, '');
  if (!token) {
    return {
      available: false,
      message: 'FINNHUB_TOKEN not configured'
    };
  }

  // Test with a well-known ETF
  const testEtf = 'SPY';

  try {
    const result = fetchFinnhubEtfHoldings(testEtf);

    if (result.success && result.data && result.data.length > 0) {
      return {
        available: true,
        message: `Finnhub holdings OK, fetched ${result.data.length} holdings for ${testEtf}`
      };
    }

    // Check for specific plan limitations
    if (result.error && (result.error.includes('403') || result.error.includes('402'))) {
      return {
        available: false,
        message: `Finnhub holdings not available on current plan: ${result.error}`
      };
    }

    return {
      available: false,
      message: result.error || 'No holdings data returned'
    };

  } catch (e) {
    return {
      available: false,
      message: `Exception: ${e.message}`
    };
  }
}

/**
 * Saves holdings to the HOLDINGS_SNAPSHOT sheet.
 * @param {string} etf - The ETF symbol
 * @param {Array<Object>} holdings - Holdings data
 * @param {string} source - Data source
 */
function saveFinnhubHoldingsToSheet(etf, holdings, source) {
  if (!holdings || holdings.length === 0) {
    return;
  }

  const asofDate = getTodayDateStr();

  const rows = holdings.map(h => ({
    asof_date: asofDate,
    etf: etf,
    holding_ticker: h.ticker,
    weight: h.weight,
    rank: h.rank,
    source: source || DATA_SOURCES.HOLDINGS.FINNHUB,
    is_stale: false
  }));

  // Delete existing holdings for this ETF/date before inserting
  deleteRowsFiltered(SHEET_NAMES.HOLDINGS_SNAPSHOT, { etf: etf, asof_date: asofDate });

  batchWrite(SHEET_NAMES.HOLDINGS_SNAPSHOT, rows);
}

/**
 * Normalizes a ticker symbol (remove extra characters, uppercase).
 * @private
 */
function normalizeTickerSymbol_(symbol) {
  if (!symbol) return '';

  // Remove common suffixes like .US, -US, etc.
  let normalized = symbol.toUpperCase();
  normalized = normalized.replace(/\.(US|L|TO|AX|PA|SW|HK|SG)$/i, '');
  normalized = normalized.replace(/-(US|CA|GB)$/i, '');

  // Remove spaces
  normalized = normalized.trim();

  return normalized;
}
