/**
 * ==================================================
 * 09_holdings_issuer_file.gs - Issuer File Holdings Parser
 * ==================================================
 *
 * Fetches and parses ETF holdings from official issuer files (CSV/XLSX).
 * Secondary holdings source - downloads official holdings files from ETF providers.
 *
 * Supported issuers:
 * - State Street / SPDR: Most XL*, XS*, XM*, XA*, K* ETFs
 * - iShares: IFRA, IHF, and other iShares ETFs
 *
 * Usage:
 *   const holdings = fetchIssuerHoldings('XLK');
 */

/**
 * ETF to issuer mapping with download URLs.
 * @private
 */
const ISSUER_ETF_MAP = {
  // State Street / SPDR ETFs - they publish daily holdings CSVs
  XLK: { issuer: 'SPDR', fundId: 'xlk' },
  XSW: { issuer: 'SPDR', fundId: 'xsw' },
  XSD: { issuer: 'SPDR', fundId: 'xsd' },
  XLU: { issuer: 'SPDR', fundId: 'xlu' },
  XLB: { issuer: 'SPDR', fundId: 'xlb' },
  XME: { issuer: 'SPDR', fundId: 'xme' },
  XLRE: { issuer: 'SPDR', fundId: 'xlre' },
  XAR: { issuer: 'SPDR', fundId: 'xar' },
  XTN: { issuer: 'SPDR', fundId: 'xtn' },
  XHS: { issuer: 'SPDR', fundId: 'xhs' },
  XBI: { issuer: 'SPDR', fundId: 'xbi' },
  XPH: { issuer: 'SPDR', fundId: 'xph' },
  XHE: { issuer: 'SPDR', fundId: 'xhe' },
  KCE: { issuer: 'SPDR', fundId: 'kce' },
  KIE: { issuer: 'SPDR', fundId: 'kie' },
  XLV: { issuer: 'SPDR', fundId: 'xlv' },
  XLF: { issuer: 'SPDR', fundId: 'xlf' },
  KBE: { issuer: 'SPDR', fundId: 'kbe' },
  KRE: { issuer: 'SPDR', fundId: 'kre' },
  XLE: { issuer: 'SPDR', fundId: 'xle' },
  XOP: { issuer: 'SPDR', fundId: 'xop' },
  XES: { issuer: 'SPDR', fundId: 'xes' },
  XLY: { issuer: 'SPDR', fundId: 'xly' },
  XRT: { issuer: 'SPDR', fundId: 'xrt' },
  XHB: { issuer: 'SPDR', fundId: 'xhb' },
  XLC: { issuer: 'SPDR', fundId: 'xlc' },
  XTL: { issuer: 'SPDR', fundId: 'xtl' },
  XLP: { issuer: 'SPDR', fundId: 'xlp' },
  XLI: { issuer: 'SPDR', fundId: 'xli' },

  // iShares ETFs
  IFRA: { issuer: 'ISHARES', fundId: '284618', name: 'IFRA' },
  IHF: { issuer: 'ISHARES', fundId: '239522', name: 'IHF' }
};

/**
 * Fetches holdings from issuer official files.
 * @param {string} etf - The ETF symbol
 * @returns {Object} { success, data: Array<{ticker, weight, rank}>, error }
 */
function fetchIssuerHoldings(etf) {
  const etfInfo = ISSUER_ETF_MAP[etf.toUpperCase()];

  if (!etfInfo) {
    return {
      success: false,
      data: null,
      error: `No issuer mapping for ETF: ${etf}`
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

  logDebug('holdings_issuer', `Fetching holdings for ${etf} from ${etfInfo.issuer}`);

  switch (etfInfo.issuer) {
    case 'SPDR':
      return fetchSpdrHoldings_(etf, etfInfo.fundId);
    case 'ISHARES':
      return fetchISharesHoldings_(etf, etfInfo.fundId);
    default:
      return {
        success: false,
        data: null,
        error: `Unknown issuer: ${etfInfo.issuer}`
      };
  }
}

/**
 * Fetches SPDR/State Street holdings.
 * @private
 */
function fetchSpdrHoldings_(etf, fundId) {
  // SPDR provides holdings as CSV
  // URL pattern: https://www.ssga.com/us/en/intermediary/etfs/library-content/products/fund-data/etfs/us/holdings-daily-us-en-{fundid}.xlsx
  // Alternative: https://www.ssga.com/us/en/intermediary/etfs/funds/{fundid}/holdings-daily.xlsx

  const urls = [
    `https://www.ssga.com/us/en/intermediary/etfs/library-content/products/fund-data/etfs/us/holdings-daily-us-en-${fundId}.xlsx`,
    `https://www.ssga.com/us/en/intermediary/etfs/funds/${fundId}/holdings-daily.xlsx`
  ];

  for (const url of urls) {
    const response = httpGet(url, { timeout: 30000 });

    if (response.success && response.statusCode === 200) {
      // For XLSX files, we need special handling
      // Google Apps Script can't parse XLSX directly, so we try to use a CSV endpoint
      logDebug('holdings_issuer', `Got response from ${url}, attempting to parse`);

      // Try to parse as CSV (some endpoints might serve CSV)
      const parsed = parseHoldingsCsv_(response.body, etf);
      if (parsed.success && parsed.data && parsed.data.length > 0) {
        logInfo('holdings_issuer', `Parsed ${parsed.data.length} holdings for ${etf} from SPDR`);
        return parsed;
      }
    }
  }

  // Try alternative CSV endpoint
  const csvUrl = `https://www.ssga.com/us/en/intermediary/library-content/products/fund-data/etfs/us/holdings-daily-us-en-${fundId}.csv`;
  const csvResponse = httpGet(csvUrl, { timeout: 30000 });

  if (csvResponse.success && csvResponse.statusCode === 200) {
    const parsed = parseHoldingsCsv_(csvResponse.body, etf);
    if (parsed.success) {
      logInfo('holdings_issuer', `Parsed ${parsed.data.length} holdings for ${etf} from SPDR CSV`);
      return parsed;
    }
  }

  return {
    success: false,
    data: null,
    error: 'Could not fetch or parse SPDR holdings file'
  };
}

/**
 * Fetches iShares holdings.
 * @private
 */
function fetchISharesHoldings_(etf, fundId) {
  // iShares provides holdings downloads
  // URL pattern: https://www.ishares.com/us/products/{fundId}/fund-download.dl

  const url = `https://www.ishares.com/us/products/${fundId}/fund-download.dl`;

  const response = httpGet(url, {
    timeout: 30000,
    headers: {
      'Accept': 'text/csv,application/csv'
    }
  });

  if (!response.success) {
    return {
      success: false,
      data: null,
      error: response.error
    };
  }

  if (response.statusCode !== 200) {
    return {
      success: false,
      data: null,
      error: `HTTP ${response.statusCode}`
    };
  }

  const parsed = parseISharesHoldingsCsv_(response.body, etf);

  if (parsed.success) {
    logInfo('holdings_issuer', `Parsed ${parsed.data.length} holdings for ${etf} from iShares`);
  }

  return parsed;
}

/**
 * Parses generic holdings CSV.
 * @private
 */
function parseHoldingsCsv_(csvContent, etf) {
  try {
    if (!csvContent || csvContent.length < 100) {
      return { success: false, data: null, error: 'Empty or too short response' };
    }

    // Split into lines
    const lines = csvContent.split(/\r?\n/).filter(line => line.trim().length > 0);

    if (lines.length < 5) {
      return { success: false, data: null, error: 'Too few lines in CSV' };
    }

    // Find header row (look for common column names)
    let headerIndex = -1;
    let headers = [];
    const tickerPatterns = ['ticker', 'symbol', 'name', 'holding', 'security'];
    const weightPatterns = ['weight', 'percent', 'shares'];

    for (let i = 0; i < Math.min(20, lines.length); i++) {
      const line = lines[i].toLowerCase();
      if (tickerPatterns.some(p => line.includes(p)) &&
          (weightPatterns.some(p => line.includes(p)) || line.includes('identifier'))) {
        headerIndex = i;
        headers = parseCSVLine_(lines[i]);
        break;
      }
    }

    if (headerIndex === -1) {
      return { success: false, data: null, error: 'Could not find header row' };
    }

    // Find column indices
    const tickerCol = findColumnIndex_(headers, ['ticker', 'symbol', 'identifier']);
    const weightCol = findColumnIndex_(headers, ['weight', 'percent', '%']);
    const nameCol = findColumnIndex_(headers, ['name', 'security', 'holding']);

    if (tickerCol === -1 && nameCol === -1) {
      return { success: false, data: null, error: 'Could not find ticker/name column' };
    }

    // Parse data rows
    const holdings = [];
    const topN = getConfigValue(CONFIG_KEYS.HOLDINGS_TOP_N, 30);

    for (let i = headerIndex + 1; i < lines.length && holdings.length < topN * 2; i++) {
      const values = parseCSVLine_(lines[i]);

      if (values.length < Math.max(tickerCol, weightCol, nameCol) + 1) {
        continue;
      }

      let ticker = tickerCol >= 0 ? values[tickerCol] : null;

      // Skip non-equity rows
      if (!ticker || ticker.length > 10 || ticker.includes(' ')) {
        // Try to extract ticker from name if available
        if (nameCol >= 0 && !ticker) {
          const name = values[nameCol];
          // Some files have "AAPL - Apple Inc" format
          const match = name.match(/^([A-Z]{1,5})\s*[-–]/);
          if (match) {
            ticker = match[1];
          }
        }
        if (!ticker) continue;
      }

      // Clean ticker
      ticker = normalizeTickerSymbol_(ticker);
      if (!ticker || ticker.length < 1 || ticker.length > 6) continue;

      // Parse weight
      let weight = null;
      if (weightCol >= 0) {
        const weightStr = values[weightCol].replace(/[%,]/g, '').trim();
        weight = parseFloat(weightStr);
        if (isNaN(weight)) weight = null;
      }

      holdings.push({ ticker, weight });
    }

    if (holdings.length === 0) {
      return { success: false, data: null, error: 'No valid holdings parsed' };
    }

    // Sort by weight if available, take top N
    if (holdings[0].weight !== null) {
      holdings.sort((a, b) => (b.weight || 0) - (a.weight || 0));
    }

    const result = holdings.slice(0, topN).map((h, i) => ({
      ticker: h.ticker,
      weight: h.weight,
      rank: i + 1
    }));

    return { success: true, data: result, error: null };

  } catch (e) {
    return { success: false, data: null, error: `Parse error: ${e.message}` };
  }
}

/**
 * Parses iShares specific CSV format.
 * @private
 */
function parseISharesHoldingsCsv_(csvContent, etf) {
  // iShares CSVs have specific format with metadata rows at top
  try {
    const lines = csvContent.split(/\r?\n/).filter(line => line.trim().length > 0);

    // Find the actual data section (after metadata)
    let dataStart = -1;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].toLowerCase().includes('ticker') &&
          lines[i].toLowerCase().includes('name')) {
        dataStart = i;
        break;
      }
    }

    if (dataStart === -1) {
      // Try generic parse
      return parseHoldingsCsv_(csvContent, etf);
    }

    // Parse from data section
    const dataContent = lines.slice(dataStart).join('\n');
    return parseHoldingsCsv_(dataContent, etf);

  } catch (e) {
    return { success: false, data: null, error: `iShares parse error: ${e.message}` };
  }
}

/**
 * Finds a column index by possible names.
 * @private
 */
function findColumnIndex_(headers, possibleNames) {
  const lowerHeaders = headers.map(h => h.toLowerCase().trim());

  for (let i = 0; i < lowerHeaders.length; i++) {
    for (const name of possibleNames) {
      if (lowerHeaders[i].includes(name.toLowerCase())) {
        return i;
      }
    }
  }

  return -1;
}

/**
 * Parses a CSV line handling quotes.
 * @private
 */
function parseCSVLine_(line) {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  result.push(current.trim());
  return result;
}

/**
 * Fetches holdings for multiple ETFs from issuer files.
 * @param {Array<string>} etfs - Array of ETF symbols
 * @returns {Object} Map of etf -> { success, data, error }
 */
function fetchIssuerHoldingsBatch(etfs) {
  const results = {};

  for (const etf of etfs) {
    if (isBudgetLimitReached(CONFIG_KEYS.MAX_DAILY_HTTP, 'http_requests_total')) {
      logWarn('holdings_issuer', 'Budget limit reached, stopping batch');
      break;
    }

    results[etf] = fetchIssuerHoldings(etf);

    // Be respectful with requests
    Utilities.sleep(500);
  }

  return results;
}

/**
 * Tests issuer file availability for an ETF.
 * @param {string} etf - ETF symbol
 * @returns {Object} { available: boolean, message: string }
 */
function testIssuerHoldingsAvailability(etf) {
  const etfInfo = ISSUER_ETF_MAP[etf.toUpperCase()];

  if (!etfInfo) {
    return {
      available: false,
      message: `No issuer mapping for ETF: ${etf}`
    };
  }

  try {
    const result = fetchIssuerHoldings(etf);

    if (result.success && result.data && result.data.length > 0) {
      return {
        available: true,
        message: `Issuer file OK for ${etf}, fetched ${result.data.length} holdings`
      };
    }

    return {
      available: false,
      message: result.error || 'No holdings data'
    };

  } catch (e) {
    return {
      available: false,
      message: `Exception: ${e.message}`
    };
  }
}

/**
 * Saves issuer holdings to the HOLDINGS_SNAPSHOT sheet.
 * @param {string} etf - The ETF symbol
 * @param {Array<Object>} holdings - Holdings data
 */
function saveIssuerHoldingsToSheet(etf, holdings) {
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
    source: DATA_SOURCES.HOLDINGS.ISSUER_FILE,
    is_stale: false
  }));

  // Delete existing holdings for this ETF/date before inserting
  deleteRowsFiltered(SHEET_NAMES.HOLDINGS_SNAPSHOT, { etf: etf, asof_date: asofDate });

  batchWrite(SHEET_NAMES.HOLDINGS_SNAPSHOT, rows);
}
