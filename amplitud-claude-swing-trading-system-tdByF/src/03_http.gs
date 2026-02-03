/**
 * ==================================================
 * 03_http.gs - HTTP Client with Retries, Rate Limiting, and Circuit Breaker
 * ==================================================
 *
 * Provides a robust HTTP client for API calls with:
 * - Automatic retries with exponential backoff
 * - Rate limiting per domain
 * - Circuit breaker pattern for failing endpoints
 * - Response caching
 * - Budget tracking
 *
 * Usage:
 *   const response = httpGet(url);
 *   const data = httpGetJson(url);
 */

// ==================================================
// IN-MEMORY CACHE (per execution)
// ==================================================

const HTTP_CACHE = {};

// ==================================================
// MAIN HTTP FUNCTIONS
// ==================================================

/**
 * Performs an HTTP GET request with retry, rate limiting, and caching.
 * @param {string} url - The URL to fetch
 * @param {Object} [options] - Options: { useCache, cacheKey, headers, timeout, skipRateLimit }
 * @returns {Object} Response object { success, statusCode, body, error, fromCache }
 */
function httpGet(url, options) {
  options = options || {};

  // Check cache first
  const cacheKey = options.cacheKey || url;
  if (options.useCache !== false && HTTP_CACHE[cacheKey]) {
    logDebug('http', 'Cache hit', { url: url.substring(0, 80) });
    return { ...HTTP_CACHE[cacheKey], fromCache: true };
  }

  // Extract domain for rate limiting
  const domain = extractDomain_(url);

  // Check circuit breaker
  if (isCircuitOpen_(domain)) {
    logWarn('http', 'Circuit breaker open', { domain: domain });
    return {
      success: false,
      statusCode: 0,
      body: null,
      error: `Circuit breaker open for domain: ${domain}`,
      fromCache: false
    };
  }

  // Apply rate limiting
  if (!options.skipRateLimit) {
    applyRateLimit_(domain);
  }

  // Increment budget counter
  incrementBudgetCounter_('http_requests_total');

  // Get retry settings
  const maxRetries = getConfigValue(CONFIG_KEYS.MAX_HTTP_RETRIES, 3);
  const cooldownMs = getConfigValue(CONFIG_KEYS.HTTP_COOLDOWN_MS, 800);
  const timeout = options.timeout || TIMEOUTS.HTTP_DEFAULT_MS;

  let lastError = null;
  let lastStatusCode = 0;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      if (attempt > 0) {
        const backoffMs = cooldownMs * Math.pow(2, attempt - 1);
        logDebug('http', `Retry ${attempt}/${maxRetries}, waiting ${backoffMs}ms`, { url: url.substring(0, 80) });
        Utilities.sleep(backoffMs);
      }

      const startTime = Date.now();

      const fetchOptions = {
        method: 'get',
        muteHttpExceptions: true,
        followRedirects: true,
        timeout: timeout
      };

      if (options.headers) {
        fetchOptions.headers = options.headers;
      }

      const response = UrlFetchApp.fetch(url, fetchOptions);
      const statusCode = response.getResponseCode();
      const body = response.getContentText();

      const durationMs = Date.now() - startTime;
      logApiCall(domain, url, statusCode, durationMs);

      // Handle response
      if (statusCode >= 200 && statusCode < 300) {
        // Success
        recordCircuitSuccess_(domain);

        const result = {
          success: true,
          statusCode: statusCode,
          body: body,
          error: null,
          fromCache: false
        };

        // Cache successful response
        if (options.useCache !== false) {
          HTTP_CACHE[cacheKey] = result;
        }

        return result;
      }

      // Handle specific error codes
      lastStatusCode = statusCode;

      if (statusCode === 429) {
        // Rate limited - wait longer and retry
        logWarn('http', 'Rate limited (429)', { url: url.substring(0, 80) });
        Utilities.sleep(cooldownMs * 2);
        continue;
      }

      if (statusCode === 401 || statusCode === 402 || statusCode === 403) {
        // Auth/payment errors - don't retry, mark circuit
        recordCircuitFailure_(domain, `HTTP ${statusCode}`);
        return {
          success: false,
          statusCode: statusCode,
          body: body,
          error: `HTTP ${statusCode}: Authorization/payment error`,
          fromCache: false
        };
      }

      if (statusCode >= 500) {
        // Server error - retry
        lastError = `HTTP ${statusCode}`;
        continue;
      }

      // Other client errors (4xx) - don't retry
      return {
        success: false,
        statusCode: statusCode,
        body: body,
        error: `HTTP ${statusCode}`,
        fromCache: false
      };

    } catch (e) {
      lastError = e.message;
      logWarn('http', `Request error: ${e.message}`, { url: url.substring(0, 80), attempt: attempt });
    }
  }

  // All retries exhausted
  recordCircuitFailure_(domain, lastError || `HTTP ${lastStatusCode}`);

  return {
    success: false,
    statusCode: lastStatusCode,
    body: null,
    error: lastError || `Failed after ${maxRetries} retries`,
    fromCache: false
  };
}

/**
 * Performs an HTTP GET and parses the response as JSON.
 * @param {string} url - The URL to fetch
 * @param {Object} [options] - Same options as httpGet
 * @returns {Object} Response object with parsed 'data' field
 */
function httpGetJson(url, options) {
  const response = httpGet(url, options);

  if (!response.success) {
    return {
      success: false,
      statusCode: response.statusCode,
      data: null,
      error: response.error,
      fromCache: response.fromCache
    };
  }

  try {
    const data = JSON.parse(response.body);
    return {
      success: true,
      statusCode: response.statusCode,
      data: data,
      error: null,
      fromCache: response.fromCache
    };
  } catch (e) {
    return {
      success: false,
      statusCode: response.statusCode,
      data: null,
      error: `JSON parse error: ${e.message}`,
      fromCache: response.fromCache
    };
  }
}

/**
 * Performs an HTTP POST request.
 * @param {string} url - The URL to post to
 * @param {Object|string} payload - The request body
 * @param {Object} [options] - Options: { contentType, headers, timeout }
 * @returns {Object} Response object
 */
function httpPost(url, payload, options) {
  options = options || {};

  const domain = extractDomain_(url);

  if (isCircuitOpen_(domain)) {
    return {
      success: false,
      statusCode: 0,
      body: null,
      error: `Circuit breaker open for domain: ${domain}`
    };
  }

  applyRateLimit_(domain);
  incrementBudgetCounter_('http_requests_total');

  const maxRetries = getConfigValue(CONFIG_KEYS.MAX_HTTP_RETRIES, 3);
  const cooldownMs = getConfigValue(CONFIG_KEYS.HTTP_COOLDOWN_MS, 800);

  let lastError = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      if (attempt > 0) {
        Utilities.sleep(cooldownMs * Math.pow(2, attempt - 1));
      }

      const fetchOptions = {
        method: 'post',
        muteHttpExceptions: true,
        payload: typeof payload === 'string' ? payload : JSON.stringify(payload),
        contentType: options.contentType || 'application/json'
      };

      if (options.headers) {
        fetchOptions.headers = options.headers;
      }

      const response = UrlFetchApp.fetch(url, fetchOptions);
      const statusCode = response.getResponseCode();
      const body = response.getContentText();

      logApiCall(domain, url, statusCode, 0);

      if (statusCode >= 200 && statusCode < 300) {
        recordCircuitSuccess_(domain);
        return { success: true, statusCode: statusCode, body: body, error: null };
      }

      if (statusCode === 429 || statusCode >= 500) {
        lastError = `HTTP ${statusCode}`;
        continue;
      }

      return { success: false, statusCode: statusCode, body: body, error: `HTTP ${statusCode}` };

    } catch (e) {
      lastError = e.message;
    }
  }

  recordCircuitFailure_(domain, lastError);
  return { success: false, statusCode: 0, body: null, error: lastError };
}

// ==================================================
// RATE LIMITING
// ==================================================

/**
 * Applies rate limiting for a domain.
 * @private
 */
function applyRateLimit_(domain) {
  const rateLimitMs = getConfigValue(CONFIG_KEYS.RATE_LIMIT_PER_DOMAIN_MS, 1200);

  const lastRequest = RUNTIME_CACHE.rateLimits[domain] || 0;
  const now = Date.now();
  const elapsed = now - lastRequest;

  if (elapsed < rateLimitMs) {
    const waitMs = rateLimitMs - elapsed;
    Utilities.sleep(waitMs);
  }

  RUNTIME_CACHE.rateLimits[domain] = Date.now();
}

// ==================================================
// CIRCUIT BREAKER
// ==================================================

const CIRCUIT_STATES = {
  CLOSED: 'closed',
  OPEN: 'open',
  HALF_OPEN: 'half_open'
};

const CIRCUIT_CONFIG = {
  FAILURE_THRESHOLD: 3,
  RECOVERY_TIMEOUT_MS: 60000, // 1 minute
  HALF_OPEN_SUCCESS_THRESHOLD: 2
};

/**
 * Checks if the circuit breaker is open for a domain.
 * @private
 */
function isCircuitOpen_(domain) {
  const circuit = RUNTIME_CACHE.circuitBreakers[domain];

  if (!circuit || circuit.state === CIRCUIT_STATES.CLOSED) {
    return false;
  }

  if (circuit.state === CIRCUIT_STATES.OPEN) {
    // Check if recovery timeout has passed
    const now = Date.now();
    if (now - circuit.openedAt > CIRCUIT_CONFIG.RECOVERY_TIMEOUT_MS) {
      // Transition to half-open
      circuit.state = CIRCUIT_STATES.HALF_OPEN;
      circuit.halfOpenSuccesses = 0;
      logCircuitBreaker(domain, CIRCUIT_STATES.HALF_OPEN, 'Recovery timeout elapsed');
      return false;
    }
    return true;
  }

  // Half-open state allows requests
  return false;
}

/**
 * Records a successful request for circuit breaker.
 * @private
 */
function recordCircuitSuccess_(domain) {
  const circuit = RUNTIME_CACHE.circuitBreakers[domain];

  if (!circuit) {
    return;
  }

  if (circuit.state === CIRCUIT_STATES.HALF_OPEN) {
    circuit.halfOpenSuccesses = (circuit.halfOpenSuccesses || 0) + 1;
    if (circuit.halfOpenSuccesses >= CIRCUIT_CONFIG.HALF_OPEN_SUCCESS_THRESHOLD) {
      // Close the circuit
      circuit.state = CIRCUIT_STATES.CLOSED;
      circuit.failures = 0;
      logCircuitBreaker(domain, CIRCUIT_STATES.CLOSED, 'Successful requests in half-open state');
    }
  } else if (circuit.state === CIRCUIT_STATES.CLOSED) {
    // Reset failure count on success
    circuit.failures = 0;
  }
}

/**
 * Records a failed request for circuit breaker.
 * @private
 */
function recordCircuitFailure_(domain, reason) {
  if (!RUNTIME_CACHE.circuitBreakers[domain]) {
    RUNTIME_CACHE.circuitBreakers[domain] = {
      state: CIRCUIT_STATES.CLOSED,
      failures: 0,
      openedAt: null
    };
  }

  const circuit = RUNTIME_CACHE.circuitBreakers[domain];

  if (circuit.state === CIRCUIT_STATES.HALF_OPEN) {
    // Go back to open
    circuit.state = CIRCUIT_STATES.OPEN;
    circuit.openedAt = Date.now();
    logCircuitBreaker(domain, CIRCUIT_STATES.OPEN, `Failed in half-open: ${reason}`);
  } else if (circuit.state === CIRCUIT_STATES.CLOSED) {
    circuit.failures = (circuit.failures || 0) + 1;
    if (circuit.failures >= CIRCUIT_CONFIG.FAILURE_THRESHOLD) {
      circuit.state = CIRCUIT_STATES.OPEN;
      circuit.openedAt = Date.now();
      logCircuitBreaker(domain, CIRCUIT_STATES.OPEN, `Failure threshold reached: ${reason}`);
    }
  }
}

/**
 * Resets the circuit breaker for a domain.
 * @param {string} domain - The domain
 */
function resetCircuitBreaker(domain) {
  delete RUNTIME_CACHE.circuitBreakers[domain];
  logCircuitBreaker(domain, CIRCUIT_STATES.CLOSED, 'Manual reset');
}

/**
 * Gets the current state of all circuit breakers.
 * @returns {Object} Map of domain -> circuit state
 */
function getCircuitBreakerStates() {
  return { ...RUNTIME_CACHE.circuitBreakers };
}

// ==================================================
// BUDGET TRACKING
// ==================================================

/**
 * Increments a budget counter.
 * @private
 */
function incrementBudgetCounter_(counterName) {
  RUNTIME_CACHE.budgetCounters[counterName] =
    (RUNTIME_CACHE.budgetCounters[counterName] || 0) + 1;
}

/**
 * Increments a provider-specific counter.
 * @param {string} provider - Provider name (yahoo, finnhub, fmp)
 */
function incrementProviderCounter(provider) {
  const counterName = `provider_requests_${provider.toLowerCase()}`;
  incrementBudgetCounter_(counterName);
}

/**
 * Gets current budget counters.
 * @returns {Object} Budget counter values
 */
function getBudgetCounters() {
  return { ...RUNTIME_CACHE.budgetCounters };
}

/**
 * Checks if a budget limit has been reached.
 * @param {string} limitKey - The limit config key
 * @param {string} counterName - The counter name
 * @returns {boolean} True if limit reached
 */
function isBudgetLimitReached(limitKey, counterName) {
  const limit = getConfigValue(limitKey, Infinity);
  const used = RUNTIME_CACHE.budgetCounters[counterName] || 0;

  if (used >= limit) {
    logQuotaWarning(counterName, used, limit);
    return true;
  }

  // Warn at 80%
  if (used >= limit * 0.8) {
    logQuotaWarning(counterName, used, limit);
  }

  return false;
}

// ==================================================
// UTILITY FUNCTIONS
// ==================================================

/**
 * Extracts the domain from a URL.
 * @private
 */
function extractDomain_(url) {
  const match = url.match(/^https?:\/\/([^\/]+)/);
  return match ? match[1] : 'unknown';
}

/**
 * Clears the HTTP cache.
 */
function clearHttpCache() {
  for (const key in HTTP_CACHE) {
    delete HTTP_CACHE[key];
  }
  logDebug('http', 'HTTP cache cleared');
}

/**
 * Gets the size of the HTTP cache.
 * @returns {number} Number of cached entries
 */
function getHttpCacheSize() {
  return Object.keys(HTTP_CACHE).length;
}

/**
 * Builds a URL with query parameters.
 * @param {string} baseUrl - The base URL
 * @param {Object} params - Query parameters
 * @returns {string} Complete URL
 */
function buildUrl(baseUrl, params) {
  const queryString = Object.entries(params)
    .filter(([k, v]) => v !== null && v !== undefined)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');

  return queryString ? `${baseUrl}?${queryString}` : baseUrl;
}

/**
 * Replaces placeholders in a URL template.
 * @param {string} template - URL template with {PLACEHOLDERS}
 * @param {Object} values - Values to substitute
 * @returns {string} Completed URL
 */
function fillUrlTemplate(template, values) {
  let url = template;
  for (const [key, value] of Object.entries(values)) {
    url = url.replace(new RegExp(`\\{${key}\\}`, 'g'), encodeURIComponent(value));
  }
  return url;
}
