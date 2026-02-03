/**
 * ==================================================
 * 13_signals.gs - Trading Signal Generation
 * ==================================================
 *
 * Combines breadth, technical, and vision data to generate trading signals.
 *
 * Signal Logic:
 * - ENTER: near_support AND breadth_extreme AND giro_ok AND trend_ok
 * - WATCH: One condition missing or failed giro only
 * - NONE: No significant conditions met
 *
 * Usage:
 *   const signal = computeSignalForEtf('XLK');
 *   computeAndStoreSignalsForAllEtfs();
 */

/**
 * Computes trading signal for a single ETF.
 * @param {string} etf - The ETF symbol
 * @param {string} [date] - Date to compute for (default: today)
 * @returns {Object} Signal object
 */
function computeSignalForEtf(etf, date) {
  date = date || getTodayDateStr();
  etf = etf.toUpperCase();

  logDebug('signals', `Computing signal for ${etf} on ${date}`);

  // Get breadth data
  const breadthRows = getSheetDataFiltered(SHEET_NAMES.BREADTH_DAILY, { etf: etf, date: date });
  const breadth = breadthRows.length > 0 ? breadthRows[0] : null;

  // Get technical data
  const techRows = getSheetDataFiltered(SHEET_NAMES.ETF_TECH_DAILY, { etf: etf, date: date });
  const tech = techRows.length > 0 ? techRows[0] : null;

  // Get vision data if enabled
  const visionEnabled = getConfigValue(CONFIG_KEYS.VISION_ENABLED, false);
  let vision = null;
  if (visionEnabled) {
    const visionRows = getSheetDataFiltered(SHEET_NAMES.VISION_SIGNALS, { ticker: etf, date: date });
    vision = visionRows.length > 0 ? visionRows[0] : null;
  }

  // Compute signal
  return computeSignalRow_(etf, date, breadth, tech, vision);
}

/**
 * Computes signal row from components.
 * @private
 */
function computeSignalRow_(etf, date, breadth, tech, vision) {
  // Initialize flags
  let breadthExtreme = false;
  let nearSupport = false;
  let trendOk = false;
  let visionOk = true; // Default to true if vision disabled
  let giroOk = false;

  // Debug info
  const debug = {
    etf: etf,
    date: date,
    breadth: null,
    tech: null,
    vision: null,
    flags: {}
  };

  // Process breadth
  if (breadth) {
    debug.breadth = {
      pct_above_sma20: breadth.pct_above_sma20,
      pct_above_sma50: breadth.pct_above_sma50,
      z20: breadth.z_pct_above_sma20,
      z50: breadth.z_pct_above_sma50,
      extreme_by_z: breadth.extreme_by_z,
      extreme_by_pctl: breadth.extreme_by_pctl,
      extreme_score: breadth.extreme_score,
      giro_flag: breadth.giro_flag,
      data_quality: breadth.data_quality_flag,
      regime_change: breadth.regime_change_flag
    };

    // Determine breadth extreme (Section 11.8)
    const extremeByThreshold = isExtremeByThresholdValues_(
      breadth.pct_above_sma20,
      breadth.pct_above_sma50
    );

    breadthExtreme = breadth.extreme_flag === true ||
                     breadth.extreme_flag === 'TRUE' ||
                     breadth.extreme_by_z === true ||
                     breadth.extreme_by_z === 'TRUE' ||
                     breadth.extreme_by_pctl === true ||
                     breadth.extreme_by_pctl === 'TRUE' ||
                     extremeByThreshold;

    // Check giro
    const requireGiro = getConfigValue(CONFIG_KEYS.REQUIRE_GIRO, true);
    if (requireGiro) {
      giroOk = breadth.giro_flag === true || breadth.giro_flag === 'TRUE';
    } else {
      giroOk = true;
    }

    // Check data quality - if BAD, don't allow ENTER
    if (breadth.data_quality_flag === DATA_QUALITY.BAD) {
      debug.flags.dataQualityBlock = true;
    }

    // Check regime change - may affect ENTER by z-score
    const holdingsStabilityRequired = getConfigValue(CONFIG_KEYS.HOLDINGS_STABILITY_REQUIRED, true);
    if (holdingsStabilityRequired && (breadth.regime_change_flag === true || breadth.regime_change_flag === 'TRUE')) {
      // If regime changed and extreme only by z-score (not by threshold), degrade
      if (breadth.extreme_by_z && !extremeByThreshold) {
        debug.flags.regimeChangeBlock = true;
      }
    }
  }

  // Process technicals
  if (tech) {
    debug.tech = {
      close: tech.close,
      sma50: tech.sma50,
      sma200: tech.sma200,
      support_level: tech.support_level,
      near_support_flag: tech.near_support_flag,
      trend_flag: tech.trend_flag
    };

    nearSupport = tech.near_support_flag === true || tech.near_support_flag === 'TRUE';
    trendOk = tech.trend_flag === true || tech.trend_flag === 'TRUE';

    // Calculate distance to support for reason
    if (tech.support_level && tech.close) {
      debug.tech.distanceToSupportPct = Math.round(((tech.close - tech.support_level) / tech.support_level) * 10000) / 100;
    }
  }

  // Process vision (if enabled)
  const visionEnabled = getConfigValue(CONFIG_KEYS.VISION_ENABLED, false);
  if (visionEnabled) {
    if (vision) {
      debug.vision = {
        verdict: vision.verdict,
        pattern_score: vision.pattern_score,
        pattern_labels: vision.pattern_labels
      };

      // Vision OK if not BEARISH
      visionOk = vision.verdict !== VISION_VERDICTS.BEARISH;
    } else {
      // No vision data - default to OK (don't block)
      visionOk = true;
      debug.vision = { missing: true };
    }
  }

  // Record flags
  debug.flags.breadthExtreme = breadthExtreme;
  debug.flags.nearSupport = nearSupport;
  debug.flags.trendOk = trendOk;
  debug.flags.visionOk = visionOk;
  debug.flags.giroOk = giroOk;

  // Determine final signal
  let finalSignal = SIGNAL_TYPES.NONE;
  let reason = '';

  const allConditionsMet = nearSupport && breadthExtreme && giroOk && trendOk;
  const allConditionsMetWithVision = allConditionsMet && (visionEnabled ? visionOk : true);

  // Check for blocks
  const dataQualityBlock = breadth && breadth.data_quality_flag === DATA_QUALITY.BAD;
  const regimeChangeBlock = debug.flags.regimeChangeBlock === true;

  if (allConditionsMetWithVision && !dataQualityBlock && !regimeChangeBlock) {
    finalSignal = SIGNAL_TYPES.ENTER;
    reason = buildEnterReason_(breadth, tech, vision);
  } else if (dataQualityBlock) {
    finalSignal = SIGNAL_TYPES.WATCH;
    reason = 'Data quality: insufficient holdings data';
  } else if (regimeChangeBlock && nearSupport && trendOk) {
    finalSignal = SIGNAL_TYPES.WATCH;
    reason = 'Holdings recently changed, waiting for stability';
  } else if (nearSupport && breadthExtreme && !giroOk) {
    finalSignal = SIGNAL_TYPES.WATCH;
    reason = 'Waiting for giro (breadth uptick)';
  } else if ((nearSupport || breadthExtreme) && !allConditionsMet) {
    finalSignal = SIGNAL_TYPES.WATCH;
    reason = buildWatchReason_(breadthExtreme, nearSupport, giroOk, trendOk);
  } else if (allConditionsMet && visionEnabled && !visionOk) {
    finalSignal = SIGNAL_TYPES.WATCH;
    reason = 'Vision verdict bearish, degraded from ENTER';
  } else {
    finalSignal = SIGNAL_TYPES.NONE;
    reason = 'No significant conditions met';
  }

  // Calculate score for ranking
  const score = calculateSignalScore_(breadth, tech, vision);

  const signalRow = {
    date: date,
    etf: etf,
    breadth_extreme: breadthExtreme,
    near_support: nearSupport,
    trend_ok: trendOk,
    vision_ok: visionEnabled ? visionOk : '',
    final_signal: finalSignal,
    reason: reason,
    score: score,
    debug_json: JSON.stringify(debug)
  };

  logDebug('signals', `Signal for ${etf}: ${finalSignal} (score=${score})`);

  return signalRow;
}

/**
 * Computes and stores signals for all enabled ETFs.
 * @param {string} [date] - Date to compute for
 * @returns {Object} Summary of results
 */
function computeAndStoreSignalsForAllEtfs(date) {
  date = date || getTodayDateStr();

  logOperationStart('computeAndStoreSignals', { date });

  const enabledEtfs = getEnabledEtfs();
  const signalRows = [];

  let enterCount = 0;
  let watchCount = 0;
  let noneCount = 0;

  for (const etfConfig of enabledEtfs) {
    try {
      const signal = computeSignalForEtf(etfConfig.etf, date);
      signalRows.push(signal);

      if (signal.final_signal === SIGNAL_TYPES.ENTER) enterCount++;
      else if (signal.final_signal === SIGNAL_TYPES.WATCH) watchCount++;
      else noneCount++;

    } catch (e) {
      logException('signals', `computeSignalForEtf(${etfConfig.etf})`, e);
    }
  }

  // Save all signals
  if (signalRows.length > 0) {
    upsertRows(SHEET_NAMES.SIGNALS, signalRows, ['date', 'etf']);
  }

  const summary = {
    date,
    total: enabledEtfs.length,
    enter: enterCount,
    watch: watchCount,
    none: noneCount
  };

  logOperationEnd('computeAndStoreSignals', summary);

  return summary;
}

/**
 * Gets signals ranked by score for a date.
 * @param {string} [date] - Date to get signals for
 * @param {string} [signalType] - Filter by signal type (ENTER, WATCH, NONE)
 * @returns {Array<Object>} Signals sorted by score descending
 */
function getRankedSignals(date, signalType) {
  date = date || getTodayDateStr();

  let signals = getSheetDataFiltered(SHEET_NAMES.SIGNALS, { date: date });

  if (signalType) {
    signals = signals.filter(s => s.final_signal === signalType);
  }

  // Sort by score descending
  signals.sort((a, b) => (b.score || 0) - (a.score || 0));

  return signals;
}

/**
 * Gets today's ENTER signals.
 * @returns {Array<Object>} ENTER signals
 */
function getTodayEnterSignals() {
  return getRankedSignals(getTodayDateStr(), SIGNAL_TYPES.ENTER);
}

/**
 * Gets today's WATCH signals.
 * @returns {Array<Object>} WATCH signals
 */
function getTodayWatchSignals() {
  return getRankedSignals(getTodayDateStr(), SIGNAL_TYPES.WATCH);
}

// ==================================================
// HELPER FUNCTIONS
// ==================================================

/**
 * Checks if extreme by threshold values.
 * @private
 */
function isExtremeByThresholdValues_(pctAbove20, pctAbove50) {
  const threshold20 = getConfigValue(CONFIG_KEYS.EXTREME_PCT_ABOVE20, 10);
  const threshold50 = getConfigValue(CONFIG_KEYS.EXTREME_PCT_ABOVE50, 25);

  return (pctAbove20 !== null && pctAbove20 <= threshold20) ||
         (pctAbove50 !== null && pctAbove50 <= threshold50);
}

/**
 * Builds ENTER reason string.
 * @private
 */
function buildEnterReason_(breadth, tech, vision) {
  const parts = [];

  if (breadth) {
    parts.push(`SMA20: ${breadth.pct_above_sma20}%`);
    parts.push(`SMA50: ${breadth.pct_above_sma50}%`);
    if (breadth.z_pct_above_sma20 !== null) {
      parts.push(`z20: ${breadth.z_pct_above_sma20}`);
    }
    if (breadth.extreme_score !== null) {
      parts.push(`score: ${breadth.extreme_score}`);
    }
  }

  if (tech && tech.support_level) {
    const distPct = tech.close ?
      Math.round(((tech.close - tech.support_level) / tech.support_level) * 100) / 100 :
      null;
    parts.push(`support: ${tech.support_level} (${distPct}%)`);
  }

  if (vision && vision.verdict) {
    parts.push(`vision: ${vision.verdict}`);
  }

  return parts.join(', ');
}

/**
 * Builds WATCH reason string.
 * @private
 */
function buildWatchReason_(breadthExtreme, nearSupport, giroOk, trendOk) {
  const missing = [];

  if (!breadthExtreme) missing.push('breadth not extreme');
  if (!nearSupport) missing.push('not near support');
  if (!giroOk) missing.push('no giro');
  if (!trendOk) missing.push('trend not OK');

  return `Missing: ${missing.join(', ')}`;
}

/**
 * Calculates signal score for ranking.
 * @private
 */
function calculateSignalScore_(breadth, tech, vision) {
  let score = 0;

  // Base score from breadth extreme score (0-1)
  if (breadth && breadth.extreme_score !== null) {
    score += breadth.extreme_score * 0.6;
  } else if (breadth) {
    // Fallback: calculate from z-scores
    const z20 = breadth.z_pct_above_sma20 || 0;
    const z50 = breadth.z_pct_above_sma50 || 0;
    const zCombo = 0.65 * z20 + 0.35 * z50;
    const extremeScoreBase = Math.max(0, Math.min(1, -zCombo / 6));
    score += extremeScoreBase * 0.6;
  }

  // Support score (closer to support = higher score)
  if (tech && tech.support_level && tech.close) {
    const distancePct = Math.abs(tech.close - tech.support_level) / tech.close;
    const supportScore = 1 / (1 + distancePct * 100); // Normalize
    score += supportScore * 0.4;
  }

  // Vision adjustment
  const visionEnabled = getConfigValue(CONFIG_KEYS.VISION_ENABLED, false);
  if (visionEnabled && vision && vision.pattern_score !== null) {
    // Adjust: 0.8 + 0.2 * pattern_score
    score = score * (0.8 + 0.2 * vision.pattern_score);
  }

  return Math.round(score * 1000) / 1000;
}

/**
 * Recomputes signals with vision data.
 * Called after vision analysis is complete.
 * @param {string} [date] - Date to recompute for
 */
function recomputeSignalsWithVision(date) {
  date = date || getTodayDateStr();

  const visionEnabled = getConfigValue(CONFIG_KEYS.VISION_ENABLED, false);
  if (!visionEnabled) {
    logDebug('signals', 'Vision not enabled, skipping recompute');
    return;
  }

  logInfo('signals', 'Recomputing signals with vision data');

  // Get ETFs with vision data
  const visionData = getSheetDataFiltered(SHEET_NAMES.VISION_SIGNALS, { date: date });
  const etfsWithVision = [...new Set(visionData.map(v => v.ticker))];

  for (const etf of etfsWithVision) {
    try {
      const signal = computeSignalForEtf(etf, date);
      upsertRows(SHEET_NAMES.SIGNALS, [signal], ['date', 'etf']);
    } catch (e) {
      logException('signals', `recomputeSignalsWithVision(${etf})`, e);
    }
  }
}

/**
 * Exports daily report to a new sheet.
 * @param {string} [date] - Date for the report
 */
function exportDailyReport(date) {
  date = date || getTodayDateStr();

  const reportName = `DAILY_REPORT_${date.replace(/-/g, '')}`;
  const signals = getRankedSignals(date);

  if (signals.length === 0) {
    logWarn('signals', 'No signals to export');
    return;
  }

  // Create or clear report sheet
  const ss = getSpreadsheet();
  let reportSheet = ss.getSheetByName(reportName);
  if (reportSheet) {
    reportSheet.clear();
  } else {
    reportSheet = ss.insertSheet(reportName);
  }

  // Headers
  const headers = [
    'Rank', 'ETF', 'Signal', 'Score', 'Near Support', 'Breadth Extreme',
    'Trend OK', 'Vision OK', 'Reason'
  ];
  reportSheet.appendRow(headers);

  // Data rows
  signals.forEach((sig, index) => {
    reportSheet.appendRow([
      index + 1,
      sig.etf,
      sig.final_signal,
      sig.score,
      sig.near_support,
      sig.breadth_extreme,
      sig.trend_ok,
      sig.vision_ok,
      sig.reason
    ]);
  });

  // Format
  reportSheet.setFrozenRows(1);
  reportSheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');

  logInfo('signals', `Exported daily report to ${reportName}`);
}
