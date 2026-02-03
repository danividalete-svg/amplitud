/**
 * ==================================================
 * 00_constants.gs - Global Constants and Configuration Keys
 * ==================================================
 *
 * Sistema de Swing Trading por Industrias basado en Amplitud de Mercado
 *
 * Este fichero define todas las constantes globales del sistema:
 * - Nombres de hojas de cálculo
 * - Claves de configuración
 * - Timeouts y límites
 * - Universo de ETFs
 *
 * Para añadir nuevos ETFs: modificar ETF_UNIVERSE al final de este fichero
 * Para cambiar fuentes: modificar CONFIG en la hoja de cálculo
 */

// ==================================================
// SHEET NAMES
// ==================================================

const SHEET_NAMES = {
  CONFIG: 'CONFIG',
  ETFS: 'ETFS',
  HOLDINGS_SNAPSHOT: 'HOLDINGS_SNAPSHOT',
  PRICES_DAILY: 'PRICES_DAILY',
  BREADTH_DAILY: 'BREADTH_DAILY',
  ETF_TECH_DAILY: 'ETF_TECH_DAILY',
  IMAGES: 'IMAGES',
  VISION_SIGNALS: 'VISION_SIGNALS',
  SIGNALS: 'SIGNALS',
  LOG: 'LOG',
  MANUAL_HOLDINGS: 'MANUAL_HOLDINGS'
};

// ==================================================
// CONFIG KEYS - Core Settings
// ==================================================

const CONFIG_KEYS = {
  // Timezone and general settings
  TIMEZONE: 'TIMEZONE',
  HOLDINGS_TOP_N: 'HOLDINGS_TOP_N',
  HOLDINGS_REFRESH_DAYS: 'HOLDINGS_REFRESH_DAYS',
  PRICE_LOOKBACK_DAYS: 'PRICE_LOOKBACK_DAYS',

  // Breadth and Z-score settings (original)
  BREADTH_Z_WINDOW: 'BREADTH_Z_WINDOW',
  SUPPORT_LOOKBACK_DAYS: 'SUPPORT_LOOKBACK_DAYS',
  SUPPORT_NEAR_PCT: 'SUPPORT_NEAR_PCT',
  EXTREME_Z: 'EXTREME_Z',
  EXTREME_PCT_ABOVE20: 'EXTREME_PCT_ABOVE20',
  EXTREME_PCT_ABOVE50: 'EXTREME_PCT_ABOVE50',
  REQUIRE_GIRO: 'REQUIRE_GIRO',

  // Vision settings
  VISION_ENABLED: 'VISION_ENABLED',
  IMAGE_PROVIDER: 'IMAGE_PROVIDER',
  IMAGE_TIMEFRAMES: 'IMAGE_TIMEFRAMES',
  FINBIT_IMAGE_URL_TEMPLATE: 'FINBIT_IMAGE_URL_TEMPLATE',

  // HTTP and rate limiting
  MAX_HTTP_RETRIES: 'MAX_HTTP_RETRIES',
  HTTP_COOLDOWN_MS: 'HTTP_COOLDOWN_MS',
  RATE_LIMIT_PER_DOMAIN_MS: 'RATE_LIMIT_PER_DOMAIN_MS',

  // API Keys
  FINNHUB_TOKEN: 'FINNHUB_TOKEN',
  FMP_KEY: 'FMP_KEY',
  GCV_API_KEY: 'GCV_API_KEY',

  // Budget limits
  MAX_DAILY_HTTP: 'MAX_DAILY_HTTP',
  MAX_DAILY_VISION: 'MAX_DAILY_VISION',

  // Provider availability flags (auto-detected)
  FINNHUB_HOLDINGS_OK: 'FINNHUB_HOLDINGS_OK',
  FINNHUB_CANDLES_OK: 'FINNHUB_CANDLES_OK',
  YAHOO_OK: 'YAHOO_OK',
  FMP_OK: 'FMP_OK',

  // ==================================================
  // ADVANCED STATISTICS CONFIG KEYS (Section 11)
  // ==================================================

  // Z-score method and window
  Z_METHOD: 'Z_METHOD',                          // STD | ROBUST
  Z_WINDOW_DAYS: 'Z_WINDOW_DAYS',                // Default 252
  Z_MIN_OBS: 'Z_MIN_OBS',                        // Default 126
  Z_WINSORIZE: 'Z_WINSORIZE',                    // TRUE/FALSE
  Z_WINSOR_PCT: 'Z_WINSOR_PCT',                  // Default 0.02

  // Extreme thresholds by indicator
  EXTREME_Z20: 'EXTREME_Z20',                    // Default -1.8
  EXTREME_Z50: 'EXTREME_Z50',                    // Default -1.8

  // How to combine extremes
  EXTREME_COMBINER: 'EXTREME_COMBINER',          // ANY | BOTH | WEIGHTED

  // Percentile thresholds
  EXTREME_PCTL20: 'EXTREME_PCTL20',              // Default 0.05
  EXTREME_PCTL50: 'EXTREME_PCTL50',              // Default 0.10
  EXTREME_USE_PCTL: 'EXTREME_USE_PCTL',          // TRUE/FALSE

  // Persistence requirements
  EXTREME_REQUIRE_PERSISTENCE: 'EXTREME_REQUIRE_PERSISTENCE',  // TRUE/FALSE
  EXTREME_PERSIST_DAYS: 'EXTREME_PERSIST_DAYS',                // Default 2

  // Reversion/giro requirements
  EXTREME_REQUIRE_REVERSION: 'EXTREME_REQUIRE_REVERSION',      // TRUE/FALSE
  REVERSION_MIN_UPTICK: 'REVERSION_MIN_UPTICK',                // Default 2.0
  REVERSION_CROSS_LEVEL20: 'REVERSION_CROSS_LEVEL20',          // Default 12.5

  // Holdings stability
  HOLDINGS_STABILITY_REQUIRED: 'HOLDINGS_STABILITY_REQUIRED',  // TRUE/FALSE
  HOLDINGS_STABILITY_DAYS: 'HOLDINGS_STABILITY_DAYS',          // Default 10

  // Z-combo weights (optional)
  Z_COMBO_W20: 'Z_COMBO_W20',                    // Default 0.65
  Z_COMBO_W50: 'Z_COMBO_W50',                    // Default 0.35

  // Trend definition
  TREND_METHOD: 'TREND_METHOD',                  // SMA200 | SMA50_SLOPE | BOTH
  TREND_SMA50_SLOPE_WINDOW: 'TREND_SMA50_SLOPE_WINDOW'  // Default 20
};

// ==================================================
// DEFAULT CONFIG VALUES
// ==================================================

const DEFAULT_CONFIG = {
  // General
  [CONFIG_KEYS.TIMEZONE]: 'America/New_York',
  [CONFIG_KEYS.HOLDINGS_TOP_N]: 30,
  [CONFIG_KEYS.HOLDINGS_REFRESH_DAYS]: 30,
  [CONFIG_KEYS.PRICE_LOOKBACK_DAYS]: 140,

  // Original breadth settings
  [CONFIG_KEYS.BREADTH_Z_WINDOW]: 252,
  [CONFIG_KEYS.SUPPORT_LOOKBACK_DAYS]: 252,
  [CONFIG_KEYS.SUPPORT_NEAR_PCT]: 0.015,
  [CONFIG_KEYS.EXTREME_Z]: -1.5,
  [CONFIG_KEYS.EXTREME_PCT_ABOVE20]: 10,
  [CONFIG_KEYS.EXTREME_PCT_ABOVE50]: 25,
  [CONFIG_KEYS.REQUIRE_GIRO]: true,

  // Vision
  [CONFIG_KEYS.VISION_ENABLED]: false,
  [CONFIG_KEYS.IMAGE_PROVIDER]: 'FINVIZ',
  [CONFIG_KEYS.IMAGE_TIMEFRAMES]: 'D,W,M',

  // HTTP
  [CONFIG_KEYS.MAX_HTTP_RETRIES]: 3,
  [CONFIG_KEYS.HTTP_COOLDOWN_MS]: 800,
  [CONFIG_KEYS.RATE_LIMIT_PER_DOMAIN_MS]: 1200,

  // Budget
  [CONFIG_KEYS.MAX_DAILY_HTTP]: 500,
  [CONFIG_KEYS.MAX_DAILY_VISION]: 20,

  // Provider flags (to be auto-detected)
  [CONFIG_KEYS.FINNHUB_HOLDINGS_OK]: null,
  [CONFIG_KEYS.FINNHUB_CANDLES_OK]: null,
  [CONFIG_KEYS.YAHOO_OK]: null,
  [CONFIG_KEYS.FMP_OK]: null,

  // ==================================================
  // ADVANCED STATISTICS DEFAULTS (Section 11 & 12)
  // ==================================================

  [CONFIG_KEYS.Z_METHOD]: 'ROBUST',
  [CONFIG_KEYS.Z_WINDOW_DAYS]: 252,
  [CONFIG_KEYS.Z_MIN_OBS]: 126,
  [CONFIG_KEYS.Z_WINSORIZE]: true,
  [CONFIG_KEYS.Z_WINSOR_PCT]: 0.02,

  [CONFIG_KEYS.EXTREME_Z20]: -1.8,
  [CONFIG_KEYS.EXTREME_Z50]: -1.8,
  [CONFIG_KEYS.EXTREME_COMBINER]: 'ANY',

  [CONFIG_KEYS.EXTREME_PCTL20]: 0.05,
  [CONFIG_KEYS.EXTREME_PCTL50]: 0.10,
  [CONFIG_KEYS.EXTREME_USE_PCTL]: true,

  [CONFIG_KEYS.EXTREME_REQUIRE_PERSISTENCE]: false,
  [CONFIG_KEYS.EXTREME_PERSIST_DAYS]: 2,

  [CONFIG_KEYS.EXTREME_REQUIRE_REVERSION]: true,
  [CONFIG_KEYS.REVERSION_MIN_UPTICK]: 2.0,
  [CONFIG_KEYS.REVERSION_CROSS_LEVEL20]: 12.5,

  [CONFIG_KEYS.HOLDINGS_STABILITY_REQUIRED]: true,
  [CONFIG_KEYS.HOLDINGS_STABILITY_DAYS]: 10,

  [CONFIG_KEYS.Z_COMBO_W20]: 0.65,
  [CONFIG_KEYS.Z_COMBO_W50]: 0.35,

  [CONFIG_KEYS.TREND_METHOD]: 'SMA200',
  [CONFIG_KEYS.TREND_SMA50_SLOPE_WINDOW]: 20
};

// ==================================================
// TIMEOUTS AND LIMITS
// ==================================================

const TIMEOUTS = {
  HTTP_DEFAULT_MS: 30000,
  HTTP_MAX_MS: 60000,
  FETCH_TIMEOUT_MS: 30000
};

const LIMITS = {
  MAX_BATCH_SIZE: 100,
  MAX_TICKERS_PER_REQUEST: 50,
  YAHOO_MAX_RANGE_DAYS: 730,
  FMP_FREE_DAILY_CALLS: 250,
  LOG_MAX_ROWS: 10000,
  PRICES_MAX_ROWS: 500000
};

// ==================================================
// DATA SOURCES
// ==================================================

const DATA_SOURCES = {
  PRICES: {
    YAHOO_CHART: 'YAHOO_CHART',
    FINNHUB_CANDLES: 'FINNHUB_CANDLES',
    FMP_EOD: 'FMP_EOD'
  },
  HOLDINGS: {
    FINNHUB: 'FINNHUB',
    ISSUER_FILE: 'ISSUER_FILE',
    SEC_NPORT: 'SEC_NPORT',
    MANUAL: 'MANUAL'
  },
  IMAGES: {
    FINVIZ: 'FINVIZ',
    FINBIT: 'FINBIT',
    INTERNAL_CHARTS: 'INTERNAL_CHARTS'
  }
};

// ==================================================
// SIGNAL TYPES
// ==================================================

const SIGNAL_TYPES = {
  ENTER: 'ENTER',
  WATCH: 'WATCH',
  NONE: 'NONE'
};

const VISION_VERDICTS = {
  BULLISH: 'BULLISH',
  NEUTRAL: 'NEUTRAL',
  BEARISH: 'BEARISH'
};

const DATA_QUALITY = {
  OK: 'OK',
  PARTIAL: 'PARTIAL',
  BAD: 'BAD'
};

// ==================================================
// ETF UNIVERSE - 31 ETFs
// ==================================================

const ETF_UNIVERSE = [
  // Technology
  { etf: 'XLK', nombre: 'Technology Select Sector SPDR', sector: 'Technology' },
  { etf: 'XSW', nombre: 'SPDR S&P Software & Services ETF', sector: 'Technology' },
  { etf: 'XSD', nombre: 'SPDR S&P Semiconductor ETF', sector: 'Technology' },

  // Utilities & Materials
  { etf: 'XLU', nombre: 'Utilities Select Sector SPDR', sector: 'Utilities' },
  { etf: 'XLB', nombre: 'Materials Select Sector SPDR', sector: 'Materials' },
  { etf: 'XME', nombre: 'SPDR S&P Metals & Mining ETF', sector: 'Materials' },

  // Real Estate
  { etf: 'XLRE', nombre: 'Real Estate Select Sector SPDR', sector: 'Real Estate' },

  // Industrials & Infrastructure
  { etf: 'XAR', nombre: 'SPDR S&P Aerospace & Defense ETF', sector: 'Industrials' },
  { etf: 'XTN', nombre: 'SPDR S&P Transportation ETF', sector: 'Industrials' },
  { etf: 'IFRA', nombre: 'iShares U.S. Infrastructure ETF', sector: 'Industrials' },
  { etf: 'XLI', nombre: 'Industrial Select Sector SPDR', sector: 'Industrials' },

  // Healthcare
  { etf: 'XHS', nombre: 'SPDR S&P Health Care Services ETF', sector: 'Healthcare' },
  { etf: 'IHF', nombre: 'iShares U.S. Healthcare Providers ETF', sector: 'Healthcare' },
  { etf: 'XBI', nombre: 'SPDR S&P Biotech ETF', sector: 'Healthcare' },
  { etf: 'XPH', nombre: 'SPDR S&P Pharmaceuticals ETF', sector: 'Healthcare' },
  { etf: 'XHE', nombre: 'SPDR S&P Health Care Equipment ETF', sector: 'Healthcare' },
  { etf: 'XLV', nombre: 'Health Care Select Sector SPDR', sector: 'Healthcare' },

  // Financials
  { etf: 'KCE', nombre: 'SPDR S&P Capital Markets ETF', sector: 'Financials' },
  { etf: 'KIE', nombre: 'SPDR S&P Insurance ETF', sector: 'Financials' },
  { etf: 'XLF', nombre: 'Financial Select Sector SPDR', sector: 'Financials' },
  { etf: 'KBE', nombre: 'SPDR S&P Bank ETF', sector: 'Financials' },
  { etf: 'KRE', nombre: 'SPDR S&P Regional Banking ETF', sector: 'Financials' },

  // Energy
  { etf: 'XLE', nombre: 'Energy Select Sector SPDR', sector: 'Energy' },
  { etf: 'XOP', nombre: 'SPDR S&P Oil & Gas Exploration & Production ETF', sector: 'Energy' },
  { etf: 'XES', nombre: 'SPDR S&P Oil & Gas Equipment & Services ETF', sector: 'Energy' },

  // Consumer Discretionary
  { etf: 'XLY', nombre: 'Consumer Discretionary Select Sector SPDR', sector: 'Consumer Discretionary' },
  { etf: 'XRT', nombre: 'SPDR S&P Retail ETF', sector: 'Consumer Discretionary' },
  { etf: 'XHB', nombre: 'SPDR S&P Homebuilders ETF', sector: 'Consumer Discretionary' },

  // Communication Services
  { etf: 'XLC', nombre: 'Communication Services Select Sector SPDR', sector: 'Communication Services' },
  { etf: 'XTL', nombre: 'SPDR S&P Telecom ETF', sector: 'Communication Services' },

  // Consumer Staples
  { etf: 'XLP', nombre: 'Consumer Staples Select Sector SPDR', sector: 'Consumer Staples' }
];

// ==================================================
// ETF ISSUER MAPPINGS
// ==================================================

const ETF_ISSUERS = {
  // State Street / SPDR ETFs
  SPDR: {
    prefix: ['XL', 'XS', 'XM', 'XA', 'XT', 'XH', 'XB', 'XP', 'KC', 'KI', 'KB', 'KR', 'XO', 'XE', 'XR'],
    holdings_base_url: 'https://www.ssga.com/us/en/intermediary/etfs/funds/',
    holdings_pattern: '{ETF_LOWER}/holdings-daily.xlsx'
  },
  // iShares ETFs
  ISHARES: {
    prefix: ['I', 'IH', 'IF'],
    holdings_base_url: 'https://www.ishares.com/us/products/',
    holdings_pattern: '{PRODUCT_ID}/fund-download.dl'
  }
};

// ==================================================
// API ENDPOINTS
// ==================================================

const API_ENDPOINTS = {
  YAHOO_CHART: 'https://query1.finance.yahoo.com/v8/finance/chart/{TICKER}?range={RANGE}&interval={INTERVAL}&includePrePost=false&events=div%7Csplit&corsDomain=finance.yahoo.com',
  FINNHUB_CANDLES: 'https://finnhub.io/api/v1/stock/candle?symbol={TICKER}&resolution=D&from={FROM}&to={TO}&token={TOKEN}',
  FINNHUB_HOLDINGS: 'https://finnhub.io/api/v1/etf/holdings?symbol={ETF}&token={TOKEN}',
  FMP_EOD: 'https://financialmodelingprep.com/api/v3/historical-price-full/{TICKER}?from={FROM}&to={TO}&apikey={KEY}',
  GOOGLE_VISION: 'https://vision.googleapis.com/v1/images:annotate?key={KEY}',
  FINVIZ_CHART: 'https://finviz.com/chart.ashx?t={TICKER}&ty=c&ta=1&p={PERIOD}&s=l'
};

// ==================================================
// DRIVE FOLDER STRUCTURE
// ==================================================

const DRIVE_FOLDERS = {
  ROOT: 'IndustryBreadthCharts',
  PATTERN: '{ROOT}/{DATE}/{TICKER}'
};

// ==================================================
// COLUMN DEFINITIONS FOR SHEETS
// ==================================================

const COLUMNS = {
  CONFIG: ['key', 'value', 'notes'],

  ETFS: [
    'etf', 'nombre', 'enabled',
    'holdings_source_primary', 'holdings_source_fallback',
    'price_source_primary', 'price_source_fallback',
    'notes'
  ],

  HOLDINGS_SNAPSHOT: [
    'asof_date', 'etf', 'holding_ticker', 'weight', 'rank', 'source', 'is_stale'
  ],

  PRICES_DAILY: [
    'date', 'ticker', 'open', 'high', 'low', 'close', 'adjclose', 'volume',
    'sma20', 'sma50', 'sma200', 'source'
  ],

  // Updated BREADTH_DAILY columns including Section 11 additions
  BREADTH_DAILY: [
    'date', 'etf', 'n_holdings',
    'pct_above_sma20', 'pct_above_sma50',
    'z_pct_above_sma20', 'z_pct_above_sma50',
    // New advanced stats columns (Section 11.2)
    'pct_above_sma20_pctl', 'pct_above_sma50_pctl',
    'z20_method', 'z50_method',
    'z20_window_used', 'z50_window_used',
    'extreme_by_z', 'extreme_by_pctl',
    'extreme_score',
    'regime_change_flag', 'data_quality_flag',
    // Original columns
    'extreme_flag', 'giro_flag', 'source'
  ],

  ETF_TECH_DAILY: [
    'date', 'etf', 'close', 'sma50', 'sma200',
    'support_level', 'support_method', 'near_support_flag', 'trend_flag', 'notes_json'
  ],

  IMAGES: [
    'date', 'ticker', 'timeframe', 'provider', 'image_url',
    'drive_file_id', 'sha1', 'status', 'source_notes'
  ],

  VISION_SIGNALS: [
    'date', 'ticker', 'timeframe', 'ocr_text', 'pattern_labels',
    'pattern_score', 'verdict', 'notes_json'
  ],

  SIGNALS: [
    'date', 'etf', 'breadth_extreme', 'near_support', 'trend_ok', 'vision_ok',
    'final_signal', 'reason', 'score', 'debug_json'
  ],

  LOG: ['timestamp', 'level', 'module', 'message', 'meta_json'],

  MANUAL_HOLDINGS: ['etf', 'holding_ticker', 'weight', 'rank', 'notes']
};

// ==================================================
// LOG LEVELS
// ==================================================

const LOG_LEVELS = {
  DEBUG: 'DEBUG',
  INFO: 'INFO',
  WARN: 'WARN',
  ERROR: 'ERROR'
};

// ==================================================
// HELPER: Get spreadsheet reference
// ==================================================

/**
 * Returns the active spreadsheet. Can be overridden for testing.
 * @returns {GoogleAppsScript.Spreadsheet.Spreadsheet}
 */
function getSpreadsheet() {
  return SpreadsheetApp.getActiveSpreadsheet();
}

/**
 * Returns a sheet by name, creating it if it doesn't exist.
 * @param {string} sheetName
 * @returns {GoogleAppsScript.Spreadsheet.Sheet}
 */
function getOrCreateSheet(sheetName) {
  const ss = getSpreadsheet();
  let sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
  }
  return sheet;
}

// ==================================================
// GLOBAL STATE (in-memory cache during execution)
// ==================================================

const RUNTIME_CACHE = {
  config: null,
  rateLimits: {},
  circuitBreakers: {},
  budgetCounters: {
    http_requests_total: 0,
    provider_requests_yahoo: 0,
    provider_requests_finnhub: 0,
    provider_requests_fmp: 0,
    vision_requests: 0
  }
};
