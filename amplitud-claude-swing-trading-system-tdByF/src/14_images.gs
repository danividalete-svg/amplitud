/**
 * ==================================================
 * 14_images.gs - Chart Image Management
 * ==================================================
 *
 * Downloads and manages chart images for vision analysis.
 * Supports multiple image providers: FINVIZ, FINBIT, INTERNAL_CHARTS.
 *
 * Usage:
 *   downloadChartImage('XLK', 'D', 'FINVIZ');
 *   downloadImagesForCandidates();
 */

/**
 * Downloads a chart image for a ticker.
 * @param {string} ticker - The ticker symbol
 * @param {string} timeframe - Timeframe: D (daily), W (weekly), M (monthly)
 * @param {string} [provider] - Image provider (default from config)
 * @returns {Object} { success, driveFileId, sha1, error }
 */
function downloadChartImage(ticker, timeframe, provider) {
  ticker = ticker.toUpperCase();
  provider = provider || getConfigValue(CONFIG_KEYS.IMAGE_PROVIDER, 'FINVIZ');
  const date = getTodayDateStr();

  logDebug('images', `Downloading ${ticker} ${timeframe} from ${provider}`);

  // Check budget
  if (isBudgetLimitReached(CONFIG_KEYS.MAX_DAILY_HTTP, 'http_requests_total')) {
    return {
      success: false,
      driveFileId: null,
      sha1: null,
      error: 'HTTP budget exceeded'
    };
  }

  // Get image URL based on provider
  const imageUrl = getImageUrl_(ticker, timeframe, provider);

  if (!imageUrl) {
    return {
      success: false,
      driveFileId: null,
      sha1: null,
      error: `No image URL for provider: ${provider}`
    };
  }

  try {
    // Fetch the image
    const response = UrlFetchApp.fetch(imageUrl, {
      muteHttpExceptions: true,
      followRedirects: true
    });

    if (response.getResponseCode() !== 200) {
      logWarn('images', `Failed to fetch image for ${ticker}`, {
        statusCode: response.getResponseCode()
      });
      return {
        success: false,
        driveFileId: null,
        sha1: null,
        error: `HTTP ${response.getResponseCode()}`
      };
    }

    // Get the image blob
    const blob = response.getBlob();
    const sha1 = computeSha1_(blob.getBytes());

    // Check if we already have this exact image
    const existing = checkExistingImage_(ticker, timeframe, sha1);
    if (existing) {
      logDebug('images', `Image already exists for ${ticker} ${timeframe}`);
      return {
        success: true,
        driveFileId: existing.drive_file_id,
        sha1: sha1,
        error: null,
        fromCache: true
      };
    }

    // Save to Drive
    const driveFileId = saveImageToDrive_(blob, ticker, timeframe, date);

    // Record in IMAGES sheet
    const imageRow = {
      date: date,
      ticker: ticker,
      timeframe: timeframe,
      provider: provider,
      image_url: imageUrl,
      drive_file_id: driveFileId,
      sha1: sha1,
      status: 'OK',
      source_notes: ''
    };

    upsertRows(SHEET_NAMES.IMAGES, [imageRow], ['date', 'ticker', 'timeframe']);

    logInfo('images', `Downloaded ${ticker} ${timeframe} to Drive: ${driveFileId}`);

    return {
      success: true,
      driveFileId: driveFileId,
      sha1: sha1,
      error: null
    };

  } catch (e) {
    logException('images', `downloadChartImage(${ticker}, ${timeframe})`, e);

    // Record failure
    const imageRow = {
      date: date,
      ticker: ticker,
      timeframe: timeframe,
      provider: provider,
      image_url: imageUrl,
      drive_file_id: '',
      sha1: '',
      status: 'FAIL',
      source_notes: e.message
    };

    upsertRows(SHEET_NAMES.IMAGES, [imageRow], ['date', 'ticker', 'timeframe']);

    return {
      success: false,
      driveFileId: null,
      sha1: null,
      error: e.message
    };
  }
}

/**
 * Downloads images for candidate ETFs (WATCH or ENTER signals).
 * @param {string} [date] - Date to process
 * @param {number} [maxImages] - Maximum images to download
 * @returns {Object} Summary of downloads
 */
function downloadImagesForCandidates(date, maxImages) {
  date = date || getTodayDateStr();
  maxImages = maxImages || 10;

  logOperationStart('downloadImagesForCandidates', { date, maxImages });

  // Get candidates (ENTER and WATCH signals)
  const signals = getRankedSignals(date);
  const candidates = signals.filter(s =>
    s.final_signal === SIGNAL_TYPES.ENTER ||
    s.final_signal === SIGNAL_TYPES.WATCH
  ).slice(0, maxImages);

  if (candidates.length === 0) {
    logInfo('images', 'No candidates for image download');
    return { downloaded: 0, failed: 0, skipped: 0 };
  }

  const timeframes = getConfigValue(CONFIG_KEYS.IMAGE_TIMEFRAMES, 'D,W,M').split(',');
  let downloaded = 0;
  let failed = 0;
  let skipped = 0;

  for (const signal of candidates) {
    const ticker = signal.etf;

    for (const tf of timeframes) {
      const trimmedTf = tf.trim().toUpperCase();

      // Check if already downloaded today
      const existing = getSheetDataFiltered(SHEET_NAMES.IMAGES, {
        date: date,
        ticker: ticker,
        timeframe: trimmedTf
      });

      if (existing.length > 0 && existing[0].status === 'OK') {
        skipped++;
        continue;
      }

      // Check budget
      if (isBudgetLimitReached(CONFIG_KEYS.MAX_DAILY_HTTP, 'http_requests_total')) {
        logWarn('images', 'Budget limit reached, stopping downloads');
        break;
      }

      const result = downloadChartImage(ticker, trimmedTf);

      if (result.success) {
        downloaded++;
      } else {
        failed++;
      }

      // Rate limit between downloads
      Utilities.sleep(500);
    }
  }

  const summary = { downloaded, failed, skipped };
  logOperationEnd('downloadImagesForCandidates', summary);

  return summary;
}

/**
 * Gets the image URL for a ticker based on provider.
 * @private
 */
function getImageUrl_(ticker, timeframe, provider) {
  const tfMap = {
    'D': 'd',
    'W': 'w',
    'M': 'm'
  };

  const period = tfMap[timeframe.toUpperCase()] || 'd';

  switch (provider.toUpperCase()) {
    case 'FINVIZ':
      return fillUrlTemplate(API_ENDPOINTS.FINVIZ_CHART, {
        TICKER: ticker,
        PERIOD: period
      });

    case 'FINBIT':
      // Use configurable template
      const template = getConfigValue(CONFIG_KEYS.FINBIT_IMAGE_URL_TEMPLATE, '');
      if (!template) {
        return null;
      }
      return template
        .replace('{TICKER}', ticker)
        .replace('{PERIOD}', period)
        .replace('{TIMEFRAME}', timeframe);

    case 'INTERNAL_CHARTS':
      // Internal charts would be generated from OHLC data
      // This would require a chart generation service
      logWarn('images', 'INTERNAL_CHARTS not implemented');
      return null;

    default:
      return null;
  }
}

/**
 * Saves an image blob to Google Drive.
 * @private
 */
function saveImageToDrive_(blob, ticker, timeframe, date) {
  // Create folder structure: IndustryBreadthCharts/YYYY-MM-DD/TICKER/
  const rootFolderName = DRIVE_FOLDERS.ROOT;
  const dateFolderName = date;
  const tickerFolderName = ticker;

  // Get or create root folder
  let rootFolder = getOrCreateFolder_(null, rootFolderName);

  // Get or create date folder
  let dateFolder = getOrCreateFolder_(rootFolder, dateFolderName);

  // Get or create ticker folder
  let tickerFolder = getOrCreateFolder_(dateFolder, tickerFolderName);

  // Set filename
  const filename = `${timeframe}.png`;

  // Check if file exists
  const existingFiles = tickerFolder.getFilesByName(filename);
  if (existingFiles.hasNext()) {
    const existingFile = existingFiles.next();
    existingFile.setTrashed(true); // Trash old version
  }

  // Create new file
  blob.setName(filename);
  const file = tickerFolder.createFile(blob);

  return file.getId();
}

/**
 * Gets or creates a folder.
 * @private
 */
function getOrCreateFolder_(parentFolder, folderName) {
  let folder;

  if (parentFolder) {
    const folders = parentFolder.getFoldersByName(folderName);
    if (folders.hasNext()) {
      folder = folders.next();
    } else {
      folder = parentFolder.createFolder(folderName);
    }
  } else {
    // Root level in Drive
    const rootFolders = DriveApp.getFoldersByName(folderName);
    if (rootFolders.hasNext()) {
      folder = rootFolders.next();
    } else {
      folder = DriveApp.createFolder(folderName);
    }
  }

  return folder;
}

/**
 * Computes SHA1 hash of bytes.
 * @private
 */
function computeSha1_(bytes) {
  const digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_1, bytes);
  return digest.map(b => ('0' + (b & 0xFF).toString(16)).slice(-2)).join('');
}

/**
 * Checks if an image with the same SHA1 already exists.
 * @private
 */
function checkExistingImage_(ticker, timeframe, sha1) {
  const images = getSheetDataFiltered(SHEET_NAMES.IMAGES, {
    ticker: ticker,
    timeframe: timeframe,
    sha1: sha1
  });

  if (images.length > 0 && images[0].status === 'OK') {
    return images[0];
  }

  return null;
}

/**
 * Gets the Drive file ID for a ticker's image.
 * @param {string} ticker - The ticker symbol
 * @param {string} timeframe - The timeframe
 * @param {string} [date] - The date (default: today)
 * @returns {string|null} Drive file ID or null
 */
function getImageDriveId(ticker, timeframe, date) {
  date = date || getTodayDateStr();

  const images = getSheetDataFiltered(SHEET_NAMES.IMAGES, {
    date: date,
    ticker: ticker,
    timeframe: timeframe
  });

  if (images.length > 0 && images[0].status === 'OK') {
    return images[0].drive_file_id;
  }

  return null;
}

/**
 * Gets image as base64 for Vision API.
 * @param {string} driveFileId - The Drive file ID
 * @returns {string|null} Base64 encoded image or null
 */
function getImageBase64(driveFileId) {
  if (!driveFileId) {
    return null;
  }

  try {
    const file = DriveApp.getFileById(driveFileId);
    const blob = file.getBlob();
    const base64 = Utilities.base64Encode(blob.getBytes());
    return base64;
  } catch (e) {
    logException('images', 'getImageBase64', e, { driveFileId });
    return null;
  }
}

/**
 * Cleans up old images from Drive.
 * @param {number} [daysToKeep=30] - Number of days to keep
 */
function cleanupOldImages(daysToKeep) {
  daysToKeep = daysToKeep || 30;

  logOperationStart('cleanupOldImages', { daysToKeep });

  const cutoffDate = formatDateYMD_(subtractDays_(new Date(), daysToKeep));
  let deletedCount = 0;

  try {
    const rootFolders = DriveApp.getFoldersByName(DRIVE_FOLDERS.ROOT);
    if (!rootFolders.hasNext()) {
      logInfo('images', 'No image folder found');
      return { deleted: 0 };
    }

    const rootFolder = rootFolders.next();
    const dateFolders = rootFolder.getFolders();

    while (dateFolders.hasNext()) {
      const dateFolder = dateFolders.next();
      const folderName = dateFolder.getName();

      // Check if folder name is a date and older than cutoff
      if (folderName.match(/^\d{4}-\d{2}-\d{2}$/) && folderName < cutoffDate) {
        dateFolder.setTrashed(true);
        deletedCount++;
        logDebug('images', `Trashed old folder: ${folderName}`);
      }
    }
  } catch (e) {
    logException('images', 'cleanupOldImages', e);
  }

  logOperationEnd('cleanupOldImages', { deleted: deletedCount });
  return { deleted: deletedCount };
}
