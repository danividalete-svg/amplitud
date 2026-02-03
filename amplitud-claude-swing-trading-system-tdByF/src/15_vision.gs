/**
 * ==================================================
 * 15_vision.gs - Vision and Pattern Recognition
 * ==================================================
 *
 * Implements vision analysis using:
 * 1. Google Cloud Vision API for OCR
 * 2. OHLC-based pattern recognition (more robust)
 *
 * The vision layer is optional and controlled by VISION_ENABLED config.
 * It's designed as a confirmation layer, not the primary signal source.
 *
 * Usage:
 *   const result = analyzeImageWithVision('XLK', 'D');
 *   runVisionForNewImages();
 */

/**
 * Analyzes a chart image for a ticker using Vision API and pattern recognition.
 * @param {string} ticker - The ticker symbol
 * @param {string} timeframe - The timeframe (D, W, M)
 * @param {string} [date] - The date (default: today)
 * @returns {Object} Vision analysis result
 */
function analyzeImageWithVision(ticker, timeframe, date) {
  date = date || getTodayDateStr();
  ticker = ticker.toUpperCase();

  logDebug('vision', `Analyzing ${ticker} ${timeframe} for ${date}`);

  // Check if vision is enabled
  const visionEnabled = getConfigValue(CONFIG_KEYS.VISION_ENABLED, false);
  if (!visionEnabled) {
    return {
      success: false,
      error: 'Vision is disabled in config'
    };
  }

  // Check budget
  if (isBudgetLimitReached(CONFIG_KEYS.MAX_DAILY_VISION, 'vision_requests')) {
    return {
      success: false,
      error: 'Vision budget exceeded'
    };
  }

  // Get the Drive file ID for the image
  const driveFileId = getImageDriveId(ticker, timeframe, date);

  // Initialize result
  let ocrText = '';
  let ocrSuccess = false;

  // Perform OCR if we have an image
  if (driveFileId) {
    const ocrResult = callGoogleVisionOCR(driveFileId);
    if (ocrResult.success) {
      ocrText = ocrResult.text;
      ocrSuccess = true;
    }
  }

  // Perform OHLC-based pattern recognition (more reliable)
  const patternResult = computePatternHeuristicsFromOHLC(ticker, timeframe);

  // Combine results
  const combinedResult = combineVisionResults_(ocrText, ocrSuccess, patternResult);

  // Save to VISION_SIGNALS
  const visionRow = {
    date: date,
    ticker: ticker,
    timeframe: timeframe,
    ocr_text: ocrText.substring(0, 500), // Truncate long text
    pattern_labels: JSON.stringify(combinedResult.patterns),
    pattern_score: combinedResult.score,
    verdict: combinedResult.verdict,
    notes_json: JSON.stringify({
      ocrSuccess: ocrSuccess,
      patternCount: combinedResult.patterns.length,
      driveFileId: driveFileId
    })
  };

  upsertRows(SHEET_NAMES.VISION_SIGNALS, [visionRow], ['date', 'ticker', 'timeframe']);

  logInfo('vision', `Vision result for ${ticker} ${timeframe}: ${combinedResult.verdict} (score=${combinedResult.score})`);

  return {
    success: true,
    ticker: ticker,
    timeframe: timeframe,
    verdict: combinedResult.verdict,
    score: combinedResult.score,
    patterns: combinedResult.patterns,
    ocrText: ocrText
  };
}

/**
 * Calls Google Cloud Vision API for OCR.
 * @param {string} driveFileId - Google Drive file ID
 * @returns {Object} { success, text, error }
 */
function callGoogleVisionOCR(driveFileId) {
  const apiKey = getConfigValue(CONFIG_KEYS.GCV_API_KEY, '');

  if (!apiKey) {
    return {
      success: false,
      text: '',
      error: 'GCV_API_KEY not configured'
    };
  }

  try {
    // Get image as base64
    const base64Image = getImageBase64(driveFileId);

    if (!base64Image) {
      return {
        success: false,
        text: '',
        error: 'Could not read image from Drive'
      };
    }

    // Increment vision counter
    incrementBudgetCounter_('vision_requests');

    // Prepare request
    const requestBody = {
      requests: [{
        image: {
          content: base64Image
        },
        features: [{
          type: 'TEXT_DETECTION',
          maxResults: 10
        }]
      }]
    };

    const url = fillUrlTemplate(API_ENDPOINTS.GOOGLE_VISION, { KEY: apiKey });

    const response = httpPost(url, requestBody);

    if (!response.success) {
      return {
        success: false,
        text: '',
        error: response.error
      };
    }

    // Parse response
    const json = JSON.parse(response.body);

    if (json.responses && json.responses[0] && json.responses[0].fullTextAnnotation) {
      return {
        success: true,
        text: json.responses[0].fullTextAnnotation.text || '',
        error: null
      };
    }

    // No text found is not an error
    return {
      success: true,
      text: '',
      error: null
    };

  } catch (e) {
    logException('vision', 'callGoogleVisionOCR', e);
    return {
      success: false,
      text: '',
      error: e.message
    };
  }
}

/**
 * Computes pattern recognition heuristics from OHLC data.
 * This is more robust than relying on OCR.
 * @param {string} ticker - The ticker symbol
 * @param {string} timeframe - The timeframe
 * @returns {Object} { patterns: Array, score: number, bullishCount: number, bearishCount: number }
 */
function computePatternHeuristicsFromOHLC(ticker, timeframe) {
  // Determine lookback based on timeframe
  const lookbacks = { 'D': 60, 'W': 52, 'M': 24 };
  const lookback = lookbacks[timeframe.toUpperCase()] || 60;

  const priceHistory = getPriceHistory(ticker, lookback);

  if (!priceHistory || priceHistory.length < 10) {
    return {
      patterns: [],
      score: 0.5,
      bullishCount: 0,
      bearishCount: 0
    };
  }

  const patterns = [];
  let bullishCount = 0;
  let bearishCount = 0;

  // Get recent data
  const recent = priceHistory.slice(-20);
  const latest = recent[recent.length - 1];
  const prev = recent.length > 1 ? recent[recent.length - 2] : null;

  // Calculate SMAs
  const enhancedPrices = attachSMAs(priceHistory, [20, 50, 200]);
  const latestEnhanced = enhancedPrices[enhancedPrices.length - 1];

  // --- Candlestick Patterns ---
  const candlePatterns = detectCandlePatterns(recent);
  if (candlePatterns.length > 0) {
    const lastPatterns = candlePatterns[candlePatterns.length - 1].patterns;

    for (const pattern of lastPatterns) {
      patterns.push(pattern);

      if (['hammer', 'bullish_engulfing', 'morning_star', 'doji'].includes(pattern)) {
        bullishCount++;
      } else if (['shooting_star', 'bearish_engulfing'].includes(pattern)) {
        bearishCount++;
      } else if (pattern === 'gap_up') {
        bullishCount++;
      } else if (pattern === 'gap_down') {
        bearishCount++;
      }
    }
  }

  // --- Price vs SMA Patterns ---
  if (latestEnhanced.sma50 !== null) {
    // Close above SMA50
    if (latest.close > latestEnhanced.sma50) {
      patterns.push('above_sma50');
      bullishCount += 0.5;
    } else {
      patterns.push('below_sma50');
      bearishCount += 0.5;
    }

    // Cross above SMA50
    if (prev && enhancedPrices.length >= 2) {
      const prevEnhanced = enhancedPrices[enhancedPrices.length - 2];
      if (prev.close < prevEnhanced.sma50 && latest.close > latestEnhanced.sma50) {
        patterns.push('crossed_above_sma50');
        bullishCount++;
      } else if (prev.close > prevEnhanced.sma50 && latest.close < latestEnhanced.sma50) {
        patterns.push('crossed_below_sma50');
        bearishCount++;
      }
    }
  }

  if (latestEnhanced.sma200 !== null) {
    if (latest.close > latestEnhanced.sma200) {
      patterns.push('above_sma200');
      bullishCount += 0.5;
    } else {
      patterns.push('below_sma200');
      bearishCount += 0.5;
    }
  }

  // --- Support/Bounce Patterns ---
  const pivotLows = detectPivotLows(priceHistory, 3);
  if (pivotLows.length > 0) {
    // Check if recent low touched a pivot cluster
    const recentLow = Math.min(...recent.map(b => b.low));
    const clusterResult = clusterPivotsToSupportLevel(pivotLows, latest.close, null);

    if (clusterResult.supportLevel !== null) {
      const distanceToSupport = (latest.close - clusterResult.supportLevel) / clusterResult.supportLevel;

      if (distanceToSupport <= 0.02 && latest.close > latest.open) {
        patterns.push('bounce_from_support');
        bullishCount++;
      } else if (distanceToSupport <= 0.02) {
        patterns.push('near_support');
        bullishCount += 0.5;
      }
    }
  }

  // --- Momentum Patterns ---
  const closes = extractCloses(priceHistory);
  const rsi = computeRSI(closes, 14);
  const latestRSI = rsi[rsi.length - 1];

  if (latestRSI !== null) {
    if (latestRSI < 30) {
      patterns.push('rsi_oversold');
      bullishCount++; // Potential reversal
    } else if (latestRSI > 70) {
      patterns.push('rsi_overbought');
      bearishCount++; // Potential reversal
    }
  }

  // --- Volume Patterns ---
  if (recent.length >= 5) {
    const avgVolume = recent.slice(0, -1).reduce((sum, b) => sum + (b.volume || 0), 0) / (recent.length - 1);
    const latestVolume = latest.volume || 0;

    if (latestVolume > avgVolume * 1.5 && latest.close > latest.open) {
      patterns.push('high_volume_bullish');
      bullishCount++;
    } else if (latestVolume > avgVolume * 1.5 && latest.close < latest.open) {
      patterns.push('high_volume_bearish');
      bearishCount++;
    }
  }

  // Calculate score
  const totalSignals = bullishCount + bearishCount;
  let score = 0.5; // Neutral

  if (totalSignals > 0) {
    score = bullishCount / totalSignals;
    // Scale to 0..1 with some smoothing
    score = 0.3 + score * 0.4; // Range: 0.3 to 0.7 typically
  }

  // Boost score if multiple bullish patterns
  if (bullishCount >= 3 && bearishCount <= 1) {
    score = Math.min(1, score + 0.15);
  }

  // Penalize if multiple bearish patterns
  if (bearishCount >= 3 && bullishCount <= 1) {
    score = Math.max(0, score - 0.15);
  }

  return {
    patterns: patterns,
    score: Math.round(score * 1000) / 1000,
    bullishCount: bullishCount,
    bearishCount: bearishCount
  };
}

/**
 * Combines OCR and pattern results into a final verdict.
 * @private
 */
function combineVisionResults_(ocrText, ocrSuccess, patternResult) {
  let score = patternResult.score;
  const patterns = [...patternResult.patterns];

  // If OCR found any relevant text, adjust score slightly
  if (ocrSuccess && ocrText) {
    const lowerText = ocrText.toLowerCase();

    // Look for bullish keywords
    const bullishWords = ['support', 'breakout', 'bullish', 'buy', 'accumulation'];
    const bearishWords = ['resistance', 'breakdown', 'bearish', 'sell', 'distribution'];

    let bullishHits = 0;
    let bearishHits = 0;

    for (const word of bullishWords) {
      if (lowerText.includes(word)) {
        bullishHits++;
        patterns.push(`ocr_${word}`);
      }
    }

    for (const word of bearishWords) {
      if (lowerText.includes(word)) {
        bearishHits++;
        patterns.push(`ocr_${word}`);
      }
    }

    // Small adjustment based on OCR
    if (bullishHits > bearishHits) {
      score = Math.min(1, score + 0.05 * (bullishHits - bearishHits));
    } else if (bearishHits > bullishHits) {
      score = Math.max(0, score - 0.05 * (bearishHits - bullishHits));
    }
  }

  // Determine verdict
  let verdict;
  if (score >= 0.65) {
    verdict = VISION_VERDICTS.BULLISH;
  } else if (score >= 0.45) {
    verdict = VISION_VERDICTS.NEUTRAL;
  } else {
    verdict = VISION_VERDICTS.BEARISH;
  }

  return {
    patterns: patterns,
    score: Math.round(score * 1000) / 1000,
    verdict: verdict
  };
}

/**
 * Runs vision analysis for all new images that haven't been analyzed.
 * @param {string} [date] - Date to process
 * @returns {Object} Summary of analysis
 */
function runVisionForNewImages(date) {
  date = date || getTodayDateStr();

  logOperationStart('runVisionForNewImages', { date });

  // Get images from today that haven't been analyzed
  const images = getSheetDataFiltered(SHEET_NAMES.IMAGES, { date: date, status: 'OK' });

  let analyzed = 0;
  let skipped = 0;
  let failed = 0;

  for (const img of images) {
    // Check if already analyzed
    const existing = getSheetDataFiltered(SHEET_NAMES.VISION_SIGNALS, {
      date: date,
      ticker: img.ticker,
      timeframe: img.timeframe
    });

    if (existing.length > 0) {
      skipped++;
      continue;
    }

    // Check budget
    if (isBudgetLimitReached(CONFIG_KEYS.MAX_DAILY_VISION, 'vision_requests')) {
      logWarn('vision', 'Vision budget exceeded');
      break;
    }

    try {
      const result = analyzeImageWithVision(img.ticker, img.timeframe, date);

      if (result.success) {
        analyzed++;
      } else {
        failed++;
      }
    } catch (e) {
      logException('vision', 'analyzeImageWithVision', e, { ticker: img.ticker });
      failed++;
    }

    // Small delay between analyses
    Utilities.sleep(200);
  }

  const summary = { analyzed, skipped, failed };
  logOperationEnd('runVisionForNewImages', summary);

  return summary;
}

/**
 * Gets the latest vision signal for a ticker.
 * @param {string} ticker - The ticker symbol
 * @param {string} [date] - Date to get signal for
 * @returns {Object|null} Vision signal or null
 */
function getLatestVisionSignal(ticker, date) {
  date = date || getTodayDateStr();

  const signals = getSheetDataFiltered(SHEET_NAMES.VISION_SIGNALS, {
    ticker: ticker,
    date: date
  });

  if (signals.length === 0) {
    return null;
  }

  // Return the daily timeframe signal if available, otherwise first found
  const dailySignal = signals.find(s => s.timeframe === 'D');
  return dailySignal || signals[0];
}
