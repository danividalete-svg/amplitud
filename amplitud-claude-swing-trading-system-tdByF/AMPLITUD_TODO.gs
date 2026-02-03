/**
 * ====================================================================================================
 * AMPLITUD_TODO.gs - Sistema Completo de Swing Trading por Industrias basado en Amplitud de Mercado
 * ====================================================================================================
 *
 * Este archivo contiene todo el codigo del sistema consolidado para Google Apps Script.
 * Copia y pega este archivo completo en tu proyecto de Google Apps Script.
 *
 * INSTRUCCIONES:
 * 1. Crea un nuevo proyecto en Google Apps Script (script.google.com)
 * 2. Enlaza el proyecto a una hoja de Google Sheets
 * 3. Copia y pega todo este codigo
 * 4. Recarga la hoja de Sheets (F5) para ver el menu "AMPLITUD"
 * 5. Usa el menu AMPLITUD > Configuracion > Inicializar Sistema
 * 6. Configura tus API keys en la hoja CONFIG
 *
 * FUNCIONES PRINCIPALES:
 * - setupAll(): Inicializa todo el sistema
 * - runDaily(): Ejecuta el pipeline diario
 * - runHoldingsRefresh(): Actualiza holdings mensualmente
 * - testSingleEtf(etf): Prueba con un solo ETF
 */

// ==================================================
// SECCION 0: MENU PERSONALIZADO DE GOOGLE SHEETS
// ==================================================

/**
 * Se ejecuta automaticamente al abrir la hoja de calculo.
 * Crea el menu personalizado "AMPLITUD" en la barra de menus.
 */
function onOpen() {
  const ui = SpreadsheetApp.getUi();

  ui.createMenu('📊 AMPLITUD')

    // --- SUBMENU: CONFIGURACION ---
    .addSubMenu(ui.createMenu('⚙️ Configuracion')
      .addItem('🚀 Inicializar Sistema Completo', 'menuSetupAll')
      .addSeparator()
      .addItem('📋 Crear/Verificar Hojas', 'menuSetupSheets')
      .addItem('🔧 Cargar Config por Defecto', 'menuSetupConfig')
      .addItem('📈 Cargar ETFs Universo', 'menuSeedEtfs')
      .addItem('📁 Crear Carpetas en Drive', 'menuSetupDrive')
      .addItem('⏰ Configurar Triggers Automaticos', 'menuSetupTriggers')
      .addSeparator()
      .addItem('🔌 Probar Conexiones API', 'menuTestApis'))

    .addSeparator()

    // --- SUBMENU: EJECUCION ---
    .addSubMenu(ui.createMenu('▶️ Ejecutar')
      .addItem('🔄 Pipeline Diario Completo', 'menuRunDaily')
      .addItem('🔒 Pipeline Diario (con bloqueo)', 'menuRunDailySafe')
      .addSeparator()
      .addItem('📊 Solo Calcular Breadth', 'menuComputeBreadth')
      .addItem('📉 Solo Calcular Tecnicos', 'menuComputeTech')
      .addItem('🎯 Solo Generar Senales', 'menuComputeSignals')
      .addSeparator()
      .addItem('📅 Ejecutar para Fecha Especifica...', 'menuRunForDate'))

    .addSeparator()

    // --- SUBMENU: HOLDINGS ---
    .addSubMenu(ui.createMenu('🏢 Holdings')
      .addItem('🔄 Actualizar Todos los Holdings', 'menuRefreshAllHoldings')
      .addItem('📥 Actualizar Holdings de un ETF...', 'menuRefreshSingleHolding'))

    // --- SUBMENU: PRECIOS ---
    .addSubMenu(ui.createMenu('💹 Precios')
      .addItem('📥 Descargar Precios (Todos)', 'menuFetchAllPrices')
      .addItem('📥 Descargar Precio de un Ticker...', 'menuFetchSinglePrice'))

    .addSeparator()

    // --- SUBMENU: VISION (si esta habilitado) ---
    .addSubMenu(ui.createMenu('👁️ Vision/Charts')
      .addItem('📸 Descargar Imagenes Candidatos', 'menuDownloadImages')
      .addItem('🔍 Analizar Imagenes con Vision', 'menuRunVision')
      .addItem('🔄 Recalcular Senales con Vision', 'menuRecomputeWithVision'))

    .addSeparator()

    // --- SUBMENU: REPORTES ---
    .addSubMenu(ui.createMenu('📋 Reportes')
      .addItem('📊 Exportar Reporte Diario', 'menuExportReport')
      .addItem('📈 Ver Senales ENTER de Hoy', 'menuShowEnterSignals')
      .addItem('👀 Ver Senales WATCH de Hoy', 'menuShowWatchSignals')
      .addSeparator()
      .addItem('💰 Ver Estado del Budget', 'menuShowBudget')
      .addItem('🏥 Ver Estado del Sistema', 'menuShowHealth'))

    .addSeparator()

    // --- SUBMENU: PRUEBAS ---
    .addSubMenu(ui.createMenu('🧪 Pruebas')
      .addItem('🔬 Probar ETF Individual...', 'menuTestSingleEtf')
      .addItem('🏃 Dry Run (sin API calls)', 'menuRunDryRun'))

    .addSeparator()

    // --- SUBMENU: MANTENIMIENTO ---
    .addSubMenu(ui.createMenu('🛠️ Mantenimiento')
      .addItem('🗑️ Limpiar Logs', 'menuClearLogs')
      .addItem('🧹 Limpiar Cache HTTP', 'menuClearCache')
      .addItem('🔓 Liberar Lock de Ejecucion', 'menuReleaseLock')
      .addSeparator()
      .addItem('⚠️ Resetear TODAS las Hojas de Datos', 'menuResetDataSheets')
      .addItem('🗑️ Eliminar Todos los Triggers', 'menuRemoveTriggers'))

    // --- AYUDA ---
    .addSeparator()
    .addItem('❓ Ayuda / Instrucciones', 'menuShowHelp')
    .addItem('ℹ️ Acerca de...', 'menuShowAbout')

    .addToUi();
}

// ==================================================
// FUNCIONES DEL MENU - CONFIGURACION
// ==================================================

function menuSetupAll() {
  const ui = SpreadsheetApp.getUi();
  const response = ui.alert(
    '🚀 Inicializar Sistema',
    '¿Deseas inicializar el sistema completo?\\n\\nEsto creara todas las hojas, configuracion por defecto, y probara las APIs.',
    ui.ButtonSet.YES_NO
  );

  if (response === ui.Button.YES) {
    ui.alert('⏳ Procesando...', 'Esto puede tardar unos segundos. Espera el mensaje de confirmacion.', ui.ButtonSet.OK);

    try {
      const result = setupAll();

      if (result.success) {
        ui.alert('✅ Exito', 'Sistema inicializado correctamente.\\n\\nAhora configura tus API keys en la hoja CONFIG.', ui.ButtonSet.OK);
      } else {
        ui.alert('❌ Error', 'Hubo un problema: ' + result.error, ui.ButtonSet.OK);
      }
    } catch (e) {
      ui.alert('❌ Error', 'Excepcion: ' + e.message, ui.ButtonSet.OK);
    }
  }
}

function menuSetupSheets() {
  showProcessingAndRun('Creando hojas...', function() {
    setupSheets();
    return 'Hojas creadas/verificadas correctamente.';
  });
}

function menuSetupConfig() {
  showProcessingAndRun('Cargando configuracion...', function() {
    setupDefaultConfig();
    return 'Configuracion por defecto cargada.';
  });
}

function menuSeedEtfs() {
  showProcessingAndRun('Cargando ETFs...', function() {
    seedEtfsUniverse();
    return 'Universo de ETFs cargado.';
  });
}

function menuSetupDrive() {
  showProcessingAndRun('Creando carpetas en Drive...', function() {
    setupDriveFolders();
    return 'Carpetas de Drive creadas.';
  });
}

function menuSetupTriggers() {
  const ui = SpreadsheetApp.getUi();
  const response = ui.alert(
    '⏰ Configurar Triggers',
    '¿Deseas configurar los triggers automaticos?\\n\\n- runDaily: Diario a las 17:30\\n- runHoldingsRefresh: Mensual dia 1',
    ui.ButtonSet.YES_NO
  );

  if (response === ui.Button.YES) {
    setupTriggers();
    ui.alert('✅ Exito', 'Triggers configurados correctamente.', ui.ButtonSet.OK);
  }
}

function menuTestApis() {
  showProcessingAndRun('Probando conexiones API...', function() {
    const results = warmUpTestCalls();
    let msg = 'Resultados de las pruebas:\\n\\n';
    msg += '• Yahoo Finance: ' + (results.yahoo.available ? '✅ OK' : '❌ ' + results.yahoo.message) + '\\n';
    msg += '• Finnhub Candles: ' + (results.finnhubCandles.available ? '✅ OK' : '❌ ' + results.finnhubCandles.message) + '\\n';
    msg += '• Finnhub Holdings: ' + (results.finnhubHoldings.available ? '✅ OK' : '❌ ' + results.finnhubHoldings.message) + '\\n';
    msg += '• FMP: ' + (results.fmp.available ? '✅ OK' : '❌ ' + results.fmp.message);
    return msg;
  });
}

// ==================================================
// FUNCIONES DEL MENU - EJECUCION
// ==================================================

function menuRunDaily() {
  const ui = SpreadsheetApp.getUi();
  const response = ui.alert(
    '▶️ Ejecutar Pipeline Diario',
    '¿Ejecutar el pipeline diario completo?\\n\\nEsto puede tardar varios minutos.',
    ui.ButtonSet.YES_NO
  );

  if (response === ui.Button.YES) {
    ui.alert('⏳ Ejecutando...', 'El pipeline esta corriendo. Por favor espera...\\n\\nPuedes ver el progreso en la hoja LOG.', ui.ButtonSet.OK);

    try {
      const result = runDaily();

      let msg = '📊 Resultado del Pipeline Diario:\\n\\n';
      msg += '• Fecha: ' + result.date + '\\n';
      msg += '• Holdings actualizados: ' + result.holdingsRefreshed + '\\n';
      msg += '• Precios obtenidos: ' + result.pricesFetched + '\\n';
      msg += '• Breadth calculado: ' + result.breadthComputed + '\\n';
      msg += '• Tecnicos calculados: ' + result.techComputed + '\\n';
      msg += '• Senales generadas: ' + result.signalsGenerated + '\\n';

      if (result.errors.length > 0) {
        msg += '\\n⚠️ Errores: ' + result.errors.join(', ');
      }

      ui.alert('✅ Completado', msg, ui.ButtonSet.OK);

    } catch (e) {
      ui.alert('❌ Error', 'Excepcion: ' + e.message, ui.ButtonSet.OK);
    }
  }
}

function menuRunDailySafe() {
  const ui = SpreadsheetApp.getUi();

  try {
    const result = runDailySafe();

    if (result.success === false && result.error === 'Lock not acquired') {
      ui.alert('🔒 Bloqueado', 'Ya hay una ejecucion en curso. Intenta mas tarde.', ui.ButtonSet.OK);
    } else {
      ui.alert('✅ Completado', 'Pipeline ejecutado con bloqueo.', ui.ButtonSet.OK);
    }
  } catch (e) {
    ui.alert('❌ Error', 'Excepcion: ' + e.message, ui.ButtonSet.OK);
  }
}

function menuComputeBreadth() {
  showProcessingAndRun('Calculando breadth...', function() {
    const date = getTodayDateStr();
    const result = computeAndStoreBreadthForAllEtfs(date);
    return 'Breadth calculado para ' + result.success + ' ETFs.';
  });
}

function menuComputeTech() {
  showProcessingAndRun('Calculando tecnicos...', function() {
    const date = getTodayDateStr();
    const result = computeAndStoreEtfTechForAllEtfs(date);
    return 'Tecnicos calculados para ' + result.success + ' ETFs.';
  });
}

function menuComputeSignals() {
  showProcessingAndRun('Generando senales...', function() {
    const date = getTodayDateStr();
    const result = computeAndStoreSignalsForAllEtfs(date);
    return 'Senales generadas:\\n• ENTER: ' + result.enter + '\\n• WATCH: ' + result.watch + '\\n• NONE: ' + result.none;
  });
}

function menuRunForDate() {
  const ui = SpreadsheetApp.getUi();
  const response = ui.prompt(
    '📅 Ejecutar para Fecha',
    'Introduce la fecha en formato YYYY-MM-DD:',
    ui.ButtonSet.OK_CANCEL
  );

  if (response.getSelectedButton() === ui.Button.OK) {
    const date = response.getResponseText().trim();

    if (!date.match(/^\d{4}-\d{2}-\d{2}$/)) {
      ui.alert('❌ Error', 'Formato de fecha invalido. Usa YYYY-MM-DD.', ui.ButtonSet.OK);
      return;
    }

    showProcessingAndRun('Ejecutando para ' + date + '...', function() {
      const result = runForDate(date);
      return 'Pipeline ejecutado para ' + date + ':\\n• Breadth: ' + result.breadth.success + '\\n• Tech: ' + result.tech.success + '\\n• Signals: ' + result.signals.enter + ' ENTER, ' + result.signals.watch + ' WATCH';
    });
  }
}

// ==================================================
// FUNCIONES DEL MENU - HOLDINGS
// ==================================================

function menuRefreshAllHoldings() {
  const ui = SpreadsheetApp.getUi();
  const response = ui.alert(
    '🏢 Actualizar Holdings',
    '¿Actualizar holdings de TODOS los ETFs?\\n\\nEsto puede consumir bastante cuota de API.',
    ui.ButtonSet.YES_NO
  );

  if (response === ui.Button.YES) {
    showProcessingAndRun('Actualizando holdings...', function() {
      const result = refreshAllHoldings();
      return 'Holdings actualizados:\\n• Exito: ' + result.success + '\\n• Fallidos: ' + result.failed + '\\n• Total: ' + result.total;
    });
  }
}

function menuRefreshSingleHolding() {
  const ui = SpreadsheetApp.getUi();
  const response = ui.prompt(
    '📥 Actualizar Holdings de ETF',
    'Introduce el simbolo del ETF (ej: XLK):',
    ui.ButtonSet.OK_CANCEL
  );

  if (response.getSelectedButton() === ui.Button.OK) {
    const etf = response.getResponseText().trim().toUpperCase();

    if (!etf) {
      ui.alert('❌ Error', 'Debes introducir un simbolo de ETF.', ui.ButtonSet.OK);
      return;
    }

    showProcessingAndRun('Actualizando holdings de ' + etf + '...', function() {
      const result = refreshHoldings(etf);
      if (result.success) {
        return 'Holdings de ' + etf + ' actualizados: ' + result.holdings.length + ' posiciones.';
      } else {
        return 'Error: ' + result.error;
      }
    });
  }
}

// ==================================================
// FUNCIONES DEL MENU - PRECIOS
// ==================================================

function menuFetchAllPrices() {
  const ui = SpreadsheetApp.getUi();
  const response = ui.alert(
    '💹 Descargar Precios',
    '¿Descargar precios de todos los tickers?\\n\\nEsto puede tardar varios minutos y consume cuota de API.',
    ui.ButtonSet.YES_NO
  );

  if (response === ui.Button.YES) {
    showProcessingAndRun('Descargando precios...', function() {
      const tickers = buildTickerUniverse_();
      const result = fetchAndStorePrices(tickers);
      return 'Precios descargados:\\n• Exito: ' + result.success + '\\n• Fallidos: ' + result.failed + '\\n• Total: ' + result.total;
    });
  }
}

function menuFetchSinglePrice() {
  const ui = SpreadsheetApp.getUi();
  const response = ui.prompt(
    '📥 Descargar Precio',
    'Introduce el simbolo del ticker (ej: AAPL):',
    ui.ButtonSet.OK_CANCEL
  );

  if (response.getSelectedButton() === ui.Button.OK) {
    const ticker = response.getResponseText().trim().toUpperCase();

    if (!ticker) {
      ui.alert('❌ Error', 'Debes introducir un ticker.', ui.ButtonSet.OK);
      return;
    }

    showProcessingAndRun('Descargando precio de ' + ticker + '...', function() {
      const lookbackDays = getConfigValue(CONFIG_KEYS.PRICE_LOOKBACK_DAYS, 140);
      const range = getYahooRangeForDays(lookbackDays);
      const result = fetchPriceWithFallback_(ticker, range);

      if (result.success && result.data && result.data.length > 0) {
        const enhancedData = attachSMAs(result.data, [20, 50, 200]);
        upsertRows(SHEET_NAMES.PRICES_DAILY, enhancedData, ['date', 'ticker']);
        return 'Precio de ' + ticker + ' descargado: ' + result.data.length + ' barras.';
      } else {
        return 'Error descargando ' + ticker + ': ' + (result.error || 'Sin datos');
      }
    });
  }
}

// ==================================================
// FUNCIONES DEL MENU - VISION
// ==================================================

function menuDownloadImages() {
  showProcessingAndRun('Descargando imagenes...', function() {
    const date = getTodayDateStr();
    const result = downloadImagesForCandidates(date);
    return 'Imagenes descargadas:\\n• Descargadas: ' + result.downloaded + '\\n• Fallidas: ' + result.failed + '\\n• Omitidas: ' + result.skipped;
  });
}

function menuRunVision() {
  showProcessingAndRun('Analizando imagenes...', function() {
    const date = getTodayDateStr();
    const result = runVisionForNewImages(date);
    return 'Vision completado:\\n• Analizadas: ' + result.analyzed + '\\n• Fallidas: ' + result.failed + '\\n• Omitidas: ' + result.skipped;
  });
}

function menuRecomputeWithVision() {
  showProcessingAndRun('Recalculando senales...', function() {
    const date = getTodayDateStr();
    recomputeSignalsWithVision(date);
    return 'Senales recalculadas con datos de vision.';
  });
}

// ==================================================
// FUNCIONES DEL MENU - REPORTES
// ==================================================

function menuExportReport() {
  showProcessingAndRun('Exportando reporte...', function() {
    const date = getTodayDateStr();
    exportDailyReport(date);
    return 'Reporte exportado a hoja DAILY_REPORT_' + date.replace(/-/g, '');
  });
}

function menuShowEnterSignals() {
  const ui = SpreadsheetApp.getUi();
  const signals = getTodayEnterSignals();

  if (signals.length === 0) {
    ui.alert('📈 Senales ENTER', 'No hay senales ENTER para hoy.', ui.ButtonSet.OK);
    return;
  }

  let msg = '📈 Senales ENTER de Hoy (' + signals.length + '):\\n\\n';

  for (let i = 0; i < Math.min(signals.length, 10); i++) {
    const sig = signals[i];
    msg += (i + 1) + '. ' + sig.etf + ' - Score: ' + sig.score + '\\n   ' + sig.reason + '\\n\\n';
  }

  if (signals.length > 10) {
    msg += '... y ' + (signals.length - 10) + ' mas.';
  }

  ui.alert('📈 Senales ENTER', msg, ui.ButtonSet.OK);
}

function menuShowWatchSignals() {
  const ui = SpreadsheetApp.getUi();
  const signals = getTodayWatchSignals();

  if (signals.length === 0) {
    ui.alert('👀 Senales WATCH', 'No hay senales WATCH para hoy.', ui.ButtonSet.OK);
    return;
  }

  let msg = '👀 Senales WATCH de Hoy (' + signals.length + '):\\n\\n';

  for (let i = 0; i < Math.min(signals.length, 10); i++) {
    const sig = signals[i];
    msg += (i + 1) + '. ' + sig.etf + ' - Score: ' + sig.score + '\\n   ' + sig.reason + '\\n\\n';
  }

  if (signals.length > 10) {
    msg += '... y ' + (signals.length - 10) + ' mas.';
  }

  ui.alert('👀 Senales WATCH', msg, ui.ButtonSet.OK);
}

function menuShowBudget() {
  const ui = SpreadsheetApp.getUi();
  const status = checkBudgetStatus();

  let msg = '💰 Estado del Budget:\\n\\n';
  msg += '📅 Fecha: ' + status.date + '\\n\\n';
  msg += '📊 Uso de HTTP: ' + (status.counters.http_requests_total || 0) + '/' + status.limits.http_total + ' (' + status.percentUsed.http + '%)\\n';
  msg += '   • Yahoo: ' + (status.counters.provider_requests_yahoo || 0) + '\\n';
  msg += '   • Finnhub: ' + (status.counters.provider_requests_finnhub || 0) + '\\n';
  msg += '   • FMP: ' + (status.counters.provider_requests_fmp || 0) + '/' + status.limits.fmp + ' (' + status.percentUsed.fmp + '%)\\n';
  msg += '\\n👁️ Vision: ' + (status.counters.vision_requests || 0) + '/' + status.limits.vision + ' (' + status.percentUsed.vision + '%)\\n';

  if (status.warnings.length > 0) {
    msg += '\\n⚠️ Advertencias:\\n';
    for (const warning of status.warnings) {
      msg += '   • ' + warning + '\\n';
    }
  }

  ui.alert('💰 Budget', msg, ui.ButtonSet.OK);
}

function menuShowHealth() {
  const ui = SpreadsheetApp.getUi();
  const health = verifySystemHealth();
  const summary = getSystemSummary();

  let msg = '🏥 Estado del Sistema:\\n\\n';
  msg += '📅 ' + summary.timestamp + '\\n\\n';
  msg += '📈 ETFs habilitados: ' + summary.etfsEnabled + '\\n';
  msg += '🎯 Senales generadas: ' + summary.signalsGenerated + '\\n';
  msg += '   • ENTER: ' + summary.currentEnter + '\\n';
  msg += '   • WATCH: ' + summary.currentWatch + '\\n\\n';

  msg += '🔌 APIs disponibles:\\n';
  msg += '   • Yahoo: ' + (health.apiAvailability.yahoo === true ? '✅' : (health.apiAvailability.yahoo === false ? '❌' : '❓')) + '\\n';
  msg += '   • Finnhub Candles: ' + (health.apiAvailability.finnhubCandles === true ? '✅' : (health.apiAvailability.finnhubCandles === false ? '❌' : '❓')) + '\\n';
  msg += '   • Finnhub Holdings: ' + (health.apiAvailability.finnhubHoldings === true ? '✅' : (health.apiAvailability.finnhubHoldings === false ? '❌' : '❓')) + '\\n';
  msg += '   • FMP: ' + (health.apiAvailability.fmp === true ? '✅' : (health.apiAvailability.fmp === false ? '❌' : '❓')) + '\\n\\n';

  msg += '🔑 Configuracion:\\n';
  msg += '   • Finnhub Token: ' + (health.config.hasFinnhubToken ? '✅' : '❌') + '\\n';
  msg += '   • FMP Key: ' + (health.config.hasFmpKey ? '✅' : '❌') + '\\n';

  ui.alert('🏥 Estado del Sistema', msg, ui.ButtonSet.OK);
}

// ==================================================
// FUNCIONES DEL MENU - PRUEBAS
// ==================================================

function menuTestSingleEtf() {
  const ui = SpreadsheetApp.getUi();
  const response = ui.prompt(
    '🔬 Probar ETF',
    'Introduce el simbolo del ETF a probar (ej: XLK):',
    ui.ButtonSet.OK_CANCEL
  );

  if (response.getSelectedButton() === ui.Button.OK) {
    const etf = response.getResponseText().trim().toUpperCase() || 'XLK';

    showProcessingAndRun('Probando ' + etf + '...', function() {
      const result = testSingleEtf(etf);

      let msg = '🔬 Resultado de prueba para ' + etf + ':\\n\\n';
      msg += '🏢 Holdings: ' + (result.holdings.holdings ? result.holdings.holdings.length : 0) + ' posiciones\\n';
      msg += '\\n📊 Breadth:\\n';
      msg += '   • % > SMA20: ' + (result.breadth.pct_above_sma20 || 'N/A') + '%\\n';
      msg += '   • % > SMA50: ' + (result.breadth.pct_above_sma50 || 'N/A') + '%\\n';
      msg += '   • Z-score 20: ' + (result.breadth.z_pct_above_sma20 || 'N/A') + '\\n';
      msg += '   • Extreme: ' + (result.breadth.extreme_flag ? '✅' : '❌') + '\\n';
      msg += '   • Giro: ' + (result.breadth.giro_flag ? '✅' : '❌') + '\\n';
      msg += '\\n📉 Tecnicos:\\n';
      msg += '   • Soporte: ' + (result.tech.support_level || 'N/A') + '\\n';
      msg += '   • Cerca de soporte: ' + (result.tech.near_support_flag ? '✅' : '❌') + '\\n';
      msg += '   • Tendencia OK: ' + (result.tech.trend_flag ? '✅' : '❌') + '\\n';
      msg += '\\n🎯 Senal: ' + result.signal.final_signal + ' (score: ' + result.signal.score + ')\\n';
      msg += '   Razon: ' + result.signal.reason;

      return msg;
    });
  }
}

function menuRunDryRun() {
  showProcessingAndRun('Ejecutando Dry Run...', function() {
    const result = runDryRun();
    return 'Dry Run completado (sin llamadas API externas):\\n• Breadth: ' + result.breadth.success + '\\n• Tech: ' + result.tech.success + '\\n• Signals: ' + result.signals.enter + ' ENTER, ' + result.signals.watch + ' WATCH';
  });
}

// ==================================================
// FUNCIONES DEL MENU - MANTENIMIENTO
// ==================================================

function menuClearLogs() {
  const ui = SpreadsheetApp.getUi();
  const response = ui.alert(
    '🗑️ Limpiar Logs',
    '¿Deseas limpiar todos los logs?',
    ui.ButtonSet.YES_NO
  );

  if (response === ui.Button.YES) {
    clearLogs();
    ui.alert('✅ Exito', 'Logs limpiados.', ui.ButtonSet.OK);
  }
}

function menuClearCache() {
  clearHttpCache();
  SpreadsheetApp.getUi().alert('✅ Exito', 'Cache HTTP limpiado.', SpreadsheetApp.getUi().ButtonSet.OK);
}

function menuReleaseLock() {
  releaseLock_();
  SpreadsheetApp.getUi().alert('✅ Exito', 'Lock de ejecucion liberado.', SpreadsheetApp.getUi().ButtonSet.OK);
}

function menuResetDataSheets() {
  const ui = SpreadsheetApp.getUi();
  const response = ui.alert(
    '⚠️ ATENCION - Resetear Datos',
    '¿Estas SEGURO de que quieres eliminar TODOS los datos de las hojas?\\n\\nEsta accion NO se puede deshacer.\\n\\nSe eliminaran: Holdings, Precios, Breadth, Tecnicos, Imagenes, Vision, Senales y Logs.',
    ui.ButtonSet.YES_NO
  );

  if (response === ui.Button.YES) {
    const confirm = ui.alert(
      '⚠️ CONFIRMAR',
      'Escribe "CONFIRMAR" en el cuadro de texto para proceder.',
      ui.ButtonSet.OK_CANCEL
    );

    // Por seguridad, pedimos doble confirmacion
    if (confirm === ui.Button.OK) {
      resetDataSheets();
      ui.alert('✅ Completado', 'Todas las hojas de datos han sido reseteadas.', ui.ButtonSet.OK);
    }
  }
}

function menuRemoveTriggers() {
  const ui = SpreadsheetApp.getUi();
  const response = ui.alert(
    '🗑️ Eliminar Triggers',
    '¿Deseas eliminar todos los triggers automaticos?',
    ui.ButtonSet.YES_NO
  );

  if (response === ui.Button.YES) {
    removeTriggers();
    ui.alert('✅ Exito', 'Triggers eliminados.', ui.ButtonSet.OK);
  }
}

// ==================================================
// FUNCIONES DEL MENU - AYUDA
// ==================================================

function menuShowHelp() {
  const ui = SpreadsheetApp.getUi();

  const msg = `📖 AMPLITUD - Sistema de Swing Trading por Industrias

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🚀 PRIMEROS PASOS:
1. Usa "Configuracion > Inicializar Sistema"
2. Configura tus API keys en la hoja CONFIG
3. Ejecuta "Ejecutar > Pipeline Diario"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📊 HOJAS DEL SISTEMA:
• CONFIG: Parametros de configuracion
• ETFS: Lista de ETFs a monitorear
• HOLDINGS_SNAPSHOT: Holdings de cada ETF
• PRICES_DAILY: Precios con SMAs
• BREADTH_DAILY: Metricas de amplitud
• ETF_TECH_DAILY: Soportes y tendencias
• SIGNALS: Senales de trading
• LOG: Registro de operaciones

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🎯 TIPOS DE SENALES:
• ENTER: Todas las condiciones cumplidas
• WATCH: Algunas condiciones, vigilar
• NONE: No hay senal

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔑 API KEYS NECESARIAS:
• FINNHUB_TOKEN: https://finnhub.io
• FMP_KEY: https://financialmodelingprep.com
• GCV_API_KEY: Google Cloud Vision (opcional)`;

  ui.alert('❓ Ayuda', msg, ui.ButtonSet.OK);
}

function menuShowAbout() {
  const ui = SpreadsheetApp.getUi();

  const msg = `📊 AMPLITUD
Sistema de Swing Trading por Industrias
basado en Amplitud de Mercado

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Version: 1.0.0
Fecha: 2026

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

El sistema analiza 31 ETFs sectoriales
y sus holdings para detectar:

• Extremos de amplitud (breadth)
• Zonas de soporte tecnico
• Senales de entrada potenciales

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Desarrollado con Google Apps Script`;

  ui.alert('ℹ️ Acerca de', msg, ui.ButtonSet.OK);
}

// ==================================================
// FUNCIONES AUXILIARES DEL MENU
// ==================================================

/**
 * Muestra un mensaje de procesamiento y ejecuta una funcion.
 * @param {string} processingMsg - Mensaje a mostrar
 * @param {function} fn - Funcion a ejecutar
 */
function showProcessingAndRun(processingMsg, fn) {
  const ui = SpreadsheetApp.getUi();

  try {
    const result = fn();
    ui.alert('✅ Completado', result, ui.ButtonSet.OK);
  } catch (e) {
    ui.alert('❌ Error', 'Excepcion: ' + e.message, ui.ButtonSet.OK);
  }
}

// ==================================================
// SECCION 1: CONSTANTES Y CONFIGURACION
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

const CONFIG_KEYS = {
  TIMEZONE: 'TIMEZONE',
  HOLDINGS_TOP_N: 'HOLDINGS_TOP_N',
  HOLDINGS_REFRESH_DAYS: 'HOLDINGS_REFRESH_DAYS',
  PRICE_LOOKBACK_DAYS: 'PRICE_LOOKBACK_DAYS',
  BREADTH_Z_WINDOW: 'BREADTH_Z_WINDOW',
  SUPPORT_LOOKBACK_DAYS: 'SUPPORT_LOOKBACK_DAYS',
  SUPPORT_NEAR_PCT: 'SUPPORT_NEAR_PCT',
  EXTREME_Z: 'EXTREME_Z',
  EXTREME_PCT_ABOVE20: 'EXTREME_PCT_ABOVE20',
  EXTREME_PCT_ABOVE50: 'EXTREME_PCT_ABOVE50',
  REQUIRE_GIRO: 'REQUIRE_GIRO',
  VISION_ENABLED: 'VISION_ENABLED',
  IMAGE_PROVIDER: 'IMAGE_PROVIDER',
  IMAGE_TIMEFRAMES: 'IMAGE_TIMEFRAMES',
  FINBIT_IMAGE_URL_TEMPLATE: 'FINBIT_IMAGE_URL_TEMPLATE',
  MAX_HTTP_RETRIES: 'MAX_HTTP_RETRIES',
  HTTP_COOLDOWN_MS: 'HTTP_COOLDOWN_MS',
  RATE_LIMIT_PER_DOMAIN_MS: 'RATE_LIMIT_PER_DOMAIN_MS',
  FINNHUB_TOKEN: 'FINNHUB_TOKEN',
  FMP_KEY: 'FMP_KEY',
  GCV_API_KEY: 'GCV_API_KEY',
  MAX_DAILY_HTTP: 'MAX_DAILY_HTTP',
  MAX_DAILY_VISION: 'MAX_DAILY_VISION',
  FINNHUB_HOLDINGS_OK: 'FINNHUB_HOLDINGS_OK',
  FINNHUB_CANDLES_OK: 'FINNHUB_CANDLES_OK',
  YAHOO_OK: 'YAHOO_OK',
  FMP_OK: 'FMP_OK',
  Z_METHOD: 'Z_METHOD',
  Z_WINDOW_DAYS: 'Z_WINDOW_DAYS',
  Z_MIN_OBS: 'Z_MIN_OBS',
  Z_WINSORIZE: 'Z_WINSORIZE',
  Z_WINSOR_PCT: 'Z_WINSOR_PCT',
  EXTREME_Z20: 'EXTREME_Z20',
  EXTREME_Z50: 'EXTREME_Z50',
  EXTREME_COMBINER: 'EXTREME_COMBINER',
  EXTREME_PCTL20: 'EXTREME_PCTL20',
  EXTREME_PCTL50: 'EXTREME_PCTL50',
  EXTREME_USE_PCTL: 'EXTREME_USE_PCTL',
  EXTREME_REQUIRE_PERSISTENCE: 'EXTREME_REQUIRE_PERSISTENCE',
  EXTREME_PERSIST_DAYS: 'EXTREME_PERSIST_DAYS',
  EXTREME_REQUIRE_REVERSION: 'EXTREME_REQUIRE_REVERSION',
  REVERSION_MIN_UPTICK: 'REVERSION_MIN_UPTICK',
  REVERSION_CROSS_LEVEL20: 'REVERSION_CROSS_LEVEL20',
  HOLDINGS_STABILITY_REQUIRED: 'HOLDINGS_STABILITY_REQUIRED',
  HOLDINGS_STABILITY_DAYS: 'HOLDINGS_STABILITY_DAYS',
  Z_COMBO_W20: 'Z_COMBO_W20',
  Z_COMBO_W50: 'Z_COMBO_W50',
  TREND_METHOD: 'TREND_METHOD',
  TREND_SMA50_SLOPE_WINDOW: 'TREND_SMA50_SLOPE_WINDOW'
};

const DEFAULT_CONFIG = {
  [CONFIG_KEYS.TIMEZONE]: 'America/New_York',
  [CONFIG_KEYS.HOLDINGS_TOP_N]: 30,
  [CONFIG_KEYS.HOLDINGS_REFRESH_DAYS]: 30,
  [CONFIG_KEYS.PRICE_LOOKBACK_DAYS]: 140,
  [CONFIG_KEYS.BREADTH_Z_WINDOW]: 252,
  [CONFIG_KEYS.SUPPORT_LOOKBACK_DAYS]: 252,
  [CONFIG_KEYS.SUPPORT_NEAR_PCT]: 0.015,
  [CONFIG_KEYS.EXTREME_Z]: -1.5,
  [CONFIG_KEYS.EXTREME_PCT_ABOVE20]: 10,
  [CONFIG_KEYS.EXTREME_PCT_ABOVE50]: 25,
  [CONFIG_KEYS.REQUIRE_GIRO]: true,
  [CONFIG_KEYS.VISION_ENABLED]: false,
  [CONFIG_KEYS.IMAGE_PROVIDER]: 'FINVIZ',
  [CONFIG_KEYS.IMAGE_TIMEFRAMES]: 'D,W,M',
  [CONFIG_KEYS.MAX_HTTP_RETRIES]: 3,
  [CONFIG_KEYS.HTTP_COOLDOWN_MS]: 800,
  [CONFIG_KEYS.RATE_LIMIT_PER_DOMAIN_MS]: 1200,
  [CONFIG_KEYS.MAX_DAILY_HTTP]: 500,
  [CONFIG_KEYS.MAX_DAILY_VISION]: 20,
  [CONFIG_KEYS.FINNHUB_HOLDINGS_OK]: null,
  [CONFIG_KEYS.FINNHUB_CANDLES_OK]: null,
  [CONFIG_KEYS.YAHOO_OK]: null,
  [CONFIG_KEYS.FMP_OK]: null,
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

const ETF_UNIVERSE = [
  { etf: 'XLK', nombre: 'Technology Select Sector SPDR', sector: 'Technology' },
  { etf: 'XSW', nombre: 'SPDR S&P Software & Services ETF', sector: 'Technology' },
  { etf: 'XSD', nombre: 'SPDR S&P Semiconductor ETF', sector: 'Technology' },
  { etf: 'XLU', nombre: 'Utilities Select Sector SPDR', sector: 'Utilities' },
  { etf: 'XLB', nombre: 'Materials Select Sector SPDR', sector: 'Materials' },
  { etf: 'XME', nombre: 'SPDR S&P Metals & Mining ETF', sector: 'Materials' },
  { etf: 'XLRE', nombre: 'Real Estate Select Sector SPDR', sector: 'Real Estate' },
  { etf: 'XAR', nombre: 'SPDR S&P Aerospace & Defense ETF', sector: 'Industrials' },
  { etf: 'XTN', nombre: 'SPDR S&P Transportation ETF', sector: 'Industrials' },
  { etf: 'IFRA', nombre: 'iShares U.S. Infrastructure ETF', sector: 'Industrials' },
  { etf: 'XLI', nombre: 'Industrial Select Sector SPDR', sector: 'Industrials' },
  { etf: 'XHS', nombre: 'SPDR S&P Health Care Services ETF', sector: 'Healthcare' },
  { etf: 'IHF', nombre: 'iShares U.S. Healthcare Providers ETF', sector: 'Healthcare' },
  { etf: 'XBI', nombre: 'SPDR S&P Biotech ETF', sector: 'Healthcare' },
  { etf: 'XPH', nombre: 'SPDR S&P Pharmaceuticals ETF', sector: 'Healthcare' },
  { etf: 'XHE', nombre: 'SPDR S&P Health Care Equipment ETF', sector: 'Healthcare' },
  { etf: 'XLV', nombre: 'Health Care Select Sector SPDR', sector: 'Healthcare' },
  { etf: 'KCE', nombre: 'SPDR S&P Capital Markets ETF', sector: 'Financials' },
  { etf: 'KIE', nombre: 'SPDR S&P Insurance ETF', sector: 'Financials' },
  { etf: 'XLF', nombre: 'Financial Select Sector SPDR', sector: 'Financials' },
  { etf: 'KBE', nombre: 'SPDR S&P Bank ETF', sector: 'Financials' },
  { etf: 'KRE', nombre: 'SPDR S&P Regional Banking ETF', sector: 'Financials' },
  { etf: 'XLE', nombre: 'Energy Select Sector SPDR', sector: 'Energy' },
  { etf: 'XOP', nombre: 'SPDR S&P Oil & Gas Exploration & Production ETF', sector: 'Energy' },
  { etf: 'XES', nombre: 'SPDR S&P Oil & Gas Equipment & Services ETF', sector: 'Energy' },
  { etf: 'XLY', nombre: 'Consumer Discretionary Select Sector SPDR', sector: 'Consumer Discretionary' },
  { etf: 'XRT', nombre: 'SPDR S&P Retail ETF', sector: 'Consumer Discretionary' },
  { etf: 'XHB', nombre: 'SPDR S&P Homebuilders ETF', sector: 'Consumer Discretionary' },
  { etf: 'XLC', nombre: 'Communication Services Select Sector SPDR', sector: 'Communication Services' },
  { etf: 'XTL', nombre: 'SPDR S&P Telecom ETF', sector: 'Communication Services' },
  { etf: 'XLP', nombre: 'Consumer Staples Select Sector SPDR', sector: 'Consumer Staples' }
];

const ETF_ISSUERS = {
  SPDR: {
    prefix: ['XL', 'XS', 'XM', 'XA', 'XT', 'XH', 'XB', 'XP', 'KC', 'KI', 'KB', 'KR', 'XO', 'XE', 'XR'],
    holdings_base_url: 'https://www.ssga.com/us/en/intermediary/etfs/funds/',
    holdings_pattern: '{ETF_LOWER}/holdings-daily.xlsx'
  },
  ISHARES: {
    prefix: ['I', 'IH', 'IF'],
    holdings_base_url: 'https://www.ishares.com/us/products/',
    holdings_pattern: '{PRODUCT_ID}/fund-download.dl'
  }
};

const API_ENDPOINTS = {
  YAHOO_CHART: 'https://query1.finance.yahoo.com/v8/finance/chart/{TICKER}?range={RANGE}&interval={INTERVAL}&includePrePost=false&events=div%7Csplit&corsDomain=finance.yahoo.com',
  FINNHUB_CANDLES: 'https://finnhub.io/api/v1/stock/candle?symbol={TICKER}&resolution=D&from={FROM}&to={TO}&token={TOKEN}',
  FINNHUB_HOLDINGS: 'https://finnhub.io/api/v1/etf/holdings?symbol={ETF}&token={TOKEN}',
  FMP_EOD: 'https://financialmodelingprep.com/api/v3/historical-price-full/{TICKER}?from={FROM}&to={TO}&apikey={KEY}',
  GOOGLE_VISION: 'https://vision.googleapis.com/v1/images:annotate?key={KEY}',
  FINVIZ_CHART: 'https://finviz.com/chart.ashx?t={TICKER}&ty=c&ta=1&p={PERIOD}&s=l'
};

const DRIVE_FOLDERS = {
  ROOT: 'IndustryBreadthCharts',
  PATTERN: '{ROOT}/{DATE}/{TICKER}'
};

const COLUMNS = {
  CONFIG: ['key', 'value', 'notes'],
  ETFS: ['etf', 'nombre', 'enabled', 'holdings_source_primary', 'holdings_source_fallback', 'price_source_primary', 'price_source_fallback', 'notes'],
  HOLDINGS_SNAPSHOT: ['asof_date', 'etf', 'holding_ticker', 'weight', 'rank', 'source', 'is_stale'],
  PRICES_DAILY: ['date', 'ticker', 'open', 'high', 'low', 'close', 'adjclose', 'volume', 'sma20', 'sma50', 'sma200', 'source'],
  BREADTH_DAILY: ['date', 'etf', 'n_holdings', 'pct_above_sma20', 'pct_above_sma50', 'z_pct_above_sma20', 'z_pct_above_sma50', 'pct_above_sma20_pctl', 'pct_above_sma50_pctl', 'z20_method', 'z50_method', 'z20_window_used', 'z50_window_used', 'extreme_by_z', 'extreme_by_pctl', 'extreme_score', 'regime_change_flag', 'data_quality_flag', 'extreme_flag', 'giro_flag', 'source'],
  ETF_TECH_DAILY: ['date', 'etf', 'close', 'sma50', 'sma200', 'support_level', 'support_method', 'near_support_flag', 'trend_flag', 'notes_json'],
  IMAGES: ['date', 'ticker', 'timeframe', 'provider', 'image_url', 'drive_file_id', 'sha1', 'status', 'source_notes'],
  VISION_SIGNALS: ['date', 'ticker', 'timeframe', 'ocr_text', 'pattern_labels', 'pattern_score', 'verdict', 'notes_json'],
  SIGNALS: ['date', 'etf', 'breadth_extreme', 'near_support', 'trend_ok', 'vision_ok', 'final_signal', 'reason', 'score', 'debug_json'],
  LOG: ['timestamp', 'level', 'module', 'message', 'meta_json'],
  MANUAL_HOLDINGS: ['etf', 'holding_ticker', 'weight', 'rank', 'notes']
};

const LOG_LEVELS = {
  DEBUG: 'DEBUG',
  INFO: 'INFO',
  WARN: 'WARN',
  ERROR: 'ERROR'
};

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

const HTTP_CACHE = {};

const CIRCUIT_STATES = {
  CLOSED: 'closed',
  OPEN: 'open',
  HALF_OPEN: 'half_open'
};

const CIRCUIT_CONFIG = {
  FAILURE_THRESHOLD: 3,
  RECOVERY_TIMEOUT_MS: 60000,
  HALF_OPEN_SUCCESS_THRESHOLD: 2
};

const BUDGET_PROPERTY_KEY = 'DAILY_BUDGET_COUNTERS';
const BUDGET_DATE_KEY = 'BUDGET_DATE';
const LOCK_KEY = 'RUNNING_LOCK';
const LOCK_TIMEOUT_MS = 10 * 60 * 1000;

const ISSUER_ETF_MAP = {
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
  IFRA: { issuer: 'ISHARES', fundId: '284618', name: 'IFRA' },
  IHF: { issuer: 'ISHARES', fundId: '239522', name: 'IHF' }
};

// ==================================================
// SECCION 2: FUNCIONES BASE (SPREADSHEET/HELPERS)
// ==================================================

function getSpreadsheet() {
  return SpreadsheetApp.getActiveSpreadsheet();
}

function getOrCreateSheet(sheetName) {
  const ss = getSpreadsheet();
  let sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
  }
  return sheet;
}

// ==================================================
// SECCION 3: LOGGING
// ==================================================

function logInfo(module, message, meta) {
  writeLog_(LOG_LEVELS.INFO, module, message, meta);
}

function logWarn(module, message, meta) {
  writeLog_(LOG_LEVELS.WARN, module, message, meta);
}

function logError(module, message, meta) {
  writeLog_(LOG_LEVELS.ERROR, module, message, meta);
}

function logDebug(module, message, meta) {
  writeLog_(LOG_LEVELS.DEBUG, module, message, meta);
}

function writeLog_(level, module, message, meta) {
  const timestamp = new Date().toISOString();
  const metaJson = meta ? JSON.stringify(meta) : '';
  const consoleMsg = `[${level}] [${module}] ${message}${meta ? ' ' + metaJson : ''}`;

  if (level === LOG_LEVELS.ERROR) {
    console.error(consoleMsg);
  } else if (level === LOG_LEVELS.WARN) {
    console.warn(consoleMsg);
  } else {
    console.log(consoleMsg);
  }

  try {
    const logSheet = getOrCreateSheet(SHEET_NAMES.LOG);
    const row = [timestamp, level, module, message, metaJson];
    if (logSheet.getLastRow() === 0) {
      logSheet.appendRow(COLUMNS.LOG);
    }
    logSheet.appendRow(row);
    trimLogSheet_(logSheet);
  } catch (e) {
    console.error('Failed to write to LOG sheet: ' + e.message);
  }
}

function trimLogSheet_(logSheet) {
  const maxRows = LIMITS.LOG_MAX_ROWS;
  const currentRows = logSheet.getLastRow();
  if (currentRows > maxRows) {
    const rowsToDelete = currentRows - maxRows + 100;
    logSheet.deleteRows(2, rowsToDelete);
  }
}

function logOperationStart(operation, params) {
  logInfo('system', `Starting: ${operation}`, params);
}

function logOperationEnd(operation, result) {
  logInfo('system', `Completed: ${operation}`, result);
}

function logApiCall(provider, endpoint, statusCode, durationMs) {
  logDebug('api', `${provider}: ${statusCode} in ${durationMs}ms`, {
    provider: provider,
    endpoint: endpoint.substring(0, 100),
    statusCode: statusCode,
    durationMs: durationMs
  });
}

function logException(module, operation, error, context) {
  const meta = {
    operation: operation,
    errorMessage: error.message,
    errorStack: error.stack,
    ...context
  };
  logError(module, `Exception in ${operation}`, meta);
}

function logCircuitBreaker(domain, newState, reason) {
  logWarn('circuit_breaker', `${domain}: ${newState}`, { reason: reason });
}

function logQuotaWarning(resource, used, limit) {
  const pct = ((used / limit) * 100).toFixed(1);
  logWarn('budget', `${resource}: ${used}/${limit} (${pct}%)`, {
    resource: resource,
    used: used,
    limit: limit
  });
}

function clearLogs() {
  const logSheet = getOrCreateSheet(SHEET_NAMES.LOG);
  const lastRow = logSheet.getLastRow();
  if (lastRow > 1) {
    logSheet.deleteRows(2, lastRow - 1);
  }
  logInfo('system', 'Logs cleared');
}

function getRecentLogs(count, levelFilter) {
  count = count || 100;
  const logSheet = getOrCreateSheet(SHEET_NAMES.LOG);
  const lastRow = logSheet.getLastRow();
  if (lastRow <= 1) return [];

  const startRow = Math.max(2, lastRow - count + 1);
  const numRows = lastRow - startRow + 1;
  const data = logSheet.getRange(startRow, 1, numRows, COLUMNS.LOG.length).getValues();

  const logs = data.map(row => ({
    timestamp: row[0],
    level: row[1],
    module: row[2],
    message: row[3],
    meta: row[4] ? tryParseJson_(row[4]) : null
  }));

  if (levelFilter) {
    return logs.filter(log => log.level === levelFilter);
  }
  return logs.reverse();
}

function tryParseJson_(str) {
  try {
    return JSON.parse(str);
  } catch (e) {
    return str;
  }
}

function logDryRun(module, action, details) {
  logInfo(module, `[DRY-RUN] Would: ${action}`, details);
}

// ==================================================
// SECCION 4: STORAGE Y CONFIGURACION
// ==================================================

function getAllConfig() {
  if (RUNTIME_CACHE.config) {
    return RUNTIME_CACHE.config;
  }
  const sheet = getOrCreateSheet(SHEET_NAMES.CONFIG);
  const data = sheet.getDataRange().getValues();
  const config = { ...DEFAULT_CONFIG };

  for (let i = 1; i < data.length; i++) {
    const key = data[i][0];
    const value = data[i][1];
    if (key && value !== '' && value !== null && value !== undefined) {
      config[key] = parseConfigValue_(value);
    }
  }
  RUNTIME_CACHE.config = config;
  return config;
}

function getConfigValue(key, defaultValue) {
  const config = getAllConfig();
  const value = config[key];
  return value !== undefined && value !== null ? value : defaultValue;
}

function setConfigValue(key, value, notes) {
  const sheet = getOrCreateSheet(SHEET_NAMES.CONFIG);
  const data = sheet.getDataRange().getValues();
  let rowIndex = -1;

  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === key) {
      rowIndex = i + 1;
      break;
    }
  }

  if (rowIndex > 0) {
    sheet.getRange(rowIndex, 2).setValue(value);
    if (notes !== undefined) {
      sheet.getRange(rowIndex, 3).setValue(notes);
    }
  } else {
    sheet.appendRow([key, value, notes || '']);
  }

  if (RUNTIME_CACHE.config) {
    RUNTIME_CACHE.config[key] = parseConfigValue_(value);
  }
}

function parseConfigValue_(value) {
  if (typeof value === 'string') {
    const lower = value.toLowerCase();
    if (lower === 'true') return true;
    if (lower === 'false') return false;
    if (!isNaN(value) && value !== '') return Number(value);
  }
  return value;
}

function clearConfigCache() {
  RUNTIME_CACHE.config = null;
}

function getSheetData(sheetName, options) {
  options = options || {};
  const sheet = getOrCreateSheet(sheetName);
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];

  const headers = data[0];
  const rows = [];

  for (let i = 1; i < data.length; i++) {
    if (options.limit && rows.length >= options.limit) break;
    const row = data[i];
    if (!options.includeEmpty && isEmptyRow_(row)) continue;

    const obj = {};
    for (let j = 0; j < headers.length; j++) {
      obj[headers[j]] = row[j];
    }
    rows.push(obj);
  }
  return rows;
}

function getSheetDataFiltered(sheetName, filters) {
  const data = getSheetData(sheetName);
  return data.filter(row => {
    for (const col in filters) {
      if (row[col] !== filters[col]) return false;
    }
    return true;
  });
}

function getSheetDataByDateRange(sheetName, dateColumn, startDate, endDate) {
  const data = getSheetData(sheetName);
  return data.filter(row => {
    const rowDate = formatDateYMD_(row[dateColumn]);
    return rowDate >= startDate && rowDate <= endDate;
  });
}

function getLatestByKey(sheetName, keyColumn, dateColumn) {
  const data = getSheetData(sheetName);
  const result = {};

  for (const row of data) {
    const key = row[keyColumn];
    if (!key) continue;
    const existing = result[key];
    if (!existing) {
      result[key] = row;
    } else if (dateColumn) {
      const existingDate = formatDateYMD_(existing[dateColumn]);
      const rowDate = formatDateYMD_(row[dateColumn]);
      if (rowDate > existingDate) {
        result[key] = row;
      }
    }
  }
  return result;
}

function appendRow(sheetName, rowObj, columns) {
  columns = columns || COLUMNS[sheetName];
  if (!columns) throw new Error(`No column definition for sheet: ${sheetName}`);

  const sheet = getOrCreateSheet(sheetName);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(columns);
  }
  const rowArray = columns.map(col => rowObj[col] !== undefined ? rowObj[col] : '');
  sheet.appendRow(rowArray);
}

function batchWrite(sheetName, rowObjs, columns) {
  if (!rowObjs || rowObjs.length === 0) return;
  columns = columns || COLUMNS[sheetName];
  if (!columns) throw new Error(`No column definition for sheet: ${sheetName}`);

  const sheet = getOrCreateSheet(sheetName);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(columns);
  }

  const rowArrays = rowObjs.map(obj =>
    columns.map(col => obj[col] !== undefined ? obj[col] : '')
  );
  const startRow = sheet.getLastRow() + 1;
  sheet.getRange(startRow, 1, rowArrays.length, columns.length).setValues(rowArrays);
  logDebug('storage', `Batch wrote ${rowArrays.length} rows to ${sheetName}`);
}

function upsertRows(sheetName, rowObjs, keyColumns, columns) {
  if (!rowObjs || rowObjs.length === 0) return;
  columns = columns || COLUMNS[sheetName];
  if (!columns) throw new Error(`No column definition for sheet: ${sheetName}`);

  const sheet = getOrCreateSheet(sheetName);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(columns);
    batchWrite(sheetName, rowObjs, columns);
    return;
  }

  const existingData = sheet.getDataRange().getValues();
  const headers = existingData[0];
  const keyIndices = keyColumns.map(col => headers.indexOf(col));
  const existingKeyToRow = {};

  for (let i = 1; i < existingData.length; i++) {
    const key = keyIndices.map(idx => existingData[i][idx]).join('|');
    existingKeyToRow[key] = i + 1;
  }

  const toInsert = [];
  const toUpdate = [];

  for (const obj of rowObjs) {
    const key = keyColumns.map(col => obj[col]).join('|');
    const existingRow = existingKeyToRow[key];
    if (existingRow) {
      toUpdate.push({ rowNum: existingRow, obj: obj });
    } else {
      toInsert.push(obj);
    }
  }

  for (const update of toUpdate) {
    const rowArray = columns.map(col => update.obj[col] !== undefined ? update.obj[col] : '');
    sheet.getRange(update.rowNum, 1, 1, columns.length).setValues([rowArray]);
  }

  if (toInsert.length > 0) {
    batchWrite(sheetName, toInsert, columns);
  }
  logDebug('storage', `Upserted to ${sheetName}: ${toUpdate.length} updated, ${toInsert.length} inserted`);
}

function deleteRowsFiltered(sheetName, filters) {
  const sheet = getOrCreateSheet(sheetName);
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return 0;

  const headers = data[0];
  const filterIndices = {};
  for (const col in filters) {
    filterIndices[col] = headers.indexOf(col);
  }

  const rowsToDelete = [];
  for (let i = data.length - 1; i >= 1; i--) {
    let match = true;
    for (const col in filters) {
      if (data[i][filterIndices[col]] !== filters[col]) {
        match = false;
        break;
      }
    }
    if (match) rowsToDelete.push(i + 1);
  }

  for (const rowNum of rowsToDelete) {
    sheet.deleteRow(rowNum);
  }
  return rowsToDelete.length;
}

function clearSheetData(sheetName) {
  const sheet = getOrCreateSheet(sheetName);
  const lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    sheet.deleteRows(2, lastRow - 1);
  }
}

function getEnabledEtfs() {
  return getSheetDataFiltered(SHEET_NAMES.ETFS, { enabled: true });
}

function getLatestHoldingsForEtf(etf) {
  const allHoldings = getSheetDataFiltered(SHEET_NAMES.HOLDINGS_SNAPSHOT, { etf: etf });
  if (allHoldings.length === 0) return [];

  let latestDate = '';
  for (const h of allHoldings) {
    const date = formatDateYMD_(h.asof_date);
    if (date > latestDate) latestDate = date;
  }
  return allHoldings.filter(h => formatDateYMD_(h.asof_date) === latestDate);
}

function getPriceHistory(ticker, days) {
  days = days || getConfigValue(CONFIG_KEYS.PRICE_LOOKBACK_DAYS, 140);
  const startDate = subtractDays_(new Date(), days);
  const startDateStr = formatDateYMD_(startDate);
  const prices = getSheetDataFiltered(SHEET_NAMES.PRICES_DAILY, { ticker: ticker });

  return prices
    .filter(p => formatDateYMD_(p.date) >= startDateStr)
    .sort((a, b) => formatDateYMD_(a.date).localeCompare(formatDateYMD_(b.date)));
}

function getBreadthHistory(etf, days) {
  days = days || getConfigValue(CONFIG_KEYS.BREADTH_Z_WINDOW, 252);
  const startDate = subtractDays_(new Date(), days);
  const startDateStr = formatDateYMD_(startDate);
  const breadth = getSheetDataFiltered(SHEET_NAMES.BREADTH_DAILY, { etf: etf });

  return breadth
    .filter(b => formatDateYMD_(b.date) >= startDateStr)
    .sort((a, b) => formatDateYMD_(a.date).localeCompare(formatDateYMD_(b.date)));
}

function getLatestSignals() {
  return getLatestByKey(SHEET_NAMES.SIGNALS, 'etf', 'date');
}

function isEmptyRow_(row) {
  return row.every(cell => cell === '' || cell === null || cell === undefined);
}

function formatDateYMD_(date) {
  if (!date) return '';
  if (typeof date === 'string') {
    if (date.match(/^\d{4}-\d{2}-\d{2}$/)) return date;
    date = new Date(date);
  }
  if (!(date instanceof Date) || isNaN(date)) return '';

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function subtractDays_(date, days) {
  const result = new Date(date);
  result.setDate(result.getDate() - days);
  return result;
}

function getTodayDateStr() {
  const tz = getConfigValue(CONFIG_KEYS.TIMEZONE, 'America/New_York');
  const now = new Date();
  const formatted = Utilities.formatDate(now, tz, 'yyyy-MM-dd');
  return formatted;
}

function unixToDate(unixTimestamp) {
  return new Date(unixTimestamp * 1000);
}

function dateToUnix(date) {
  return Math.floor(date.getTime() / 1000);
}

function safeParseJson(jsonStr, defaultValue) {
  if (!jsonStr) return defaultValue;
  try {
    return JSON.parse(jsonStr);
  } catch (e) {
    return defaultValue;
  }
}

function daysBetween_(date1, date2) {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  const diffMs = Math.abs(d2 - d1);
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

// ==================================================
// SECCION 5: HTTP CLIENT
// ==================================================

function httpGet(url, options) {
  options = options || {};
  const cacheKey = options.cacheKey || url;

  if (options.useCache !== false && HTTP_CACHE[cacheKey]) {
    logDebug('http', 'Cache hit', { url: url.substring(0, 80) });
    return { ...HTTP_CACHE[cacheKey], fromCache: true };
  }

  const domain = extractDomain_(url);

  if (isCircuitOpen_(domain)) {
    logWarn('http', 'Circuit breaker open', { domain: domain });
    return { success: false, statusCode: 0, body: null, error: `Circuit breaker open for domain: ${domain}`, fromCache: false };
  }

  if (!options.skipRateLimit) {
    applyRateLimit_(domain);
  }

  incrementBudgetCounter_('http_requests_total');

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

      if (statusCode >= 200 && statusCode < 300) {
        recordCircuitSuccess_(domain);
        const result = { success: true, statusCode: statusCode, body: body, error: null, fromCache: false };
        if (options.useCache !== false) {
          HTTP_CACHE[cacheKey] = result;
        }
        return result;
      }

      lastStatusCode = statusCode;

      if (statusCode === 429) {
        logWarn('http', 'Rate limited (429)', { url: url.substring(0, 80) });
        Utilities.sleep(cooldownMs * 2);
        continue;
      }

      if (statusCode === 401 || statusCode === 402 || statusCode === 403) {
        recordCircuitFailure_(domain, `HTTP ${statusCode}`);
        return { success: false, statusCode: statusCode, body: body, error: `HTTP ${statusCode}: Authorization/payment error`, fromCache: false };
      }

      if (statusCode >= 500) {
        lastError = `HTTP ${statusCode}`;
        continue;
      }

      return { success: false, statusCode: statusCode, body: body, error: `HTTP ${statusCode}`, fromCache: false };

    } catch (e) {
      lastError = e.message;
      logWarn('http', `Request error: ${e.message}`, { url: url.substring(0, 80), attempt: attempt });
    }
  }

  recordCircuitFailure_(domain, lastError || `HTTP ${lastStatusCode}`);
  return { success: false, statusCode: lastStatusCode, body: null, error: lastError || `Failed after ${maxRetries} retries`, fromCache: false };
}

function httpGetJson(url, options) {
  const response = httpGet(url, options);
  if (!response.success) {
    return { success: false, statusCode: response.statusCode, data: null, error: response.error, fromCache: response.fromCache };
  }

  try {
    const data = JSON.parse(response.body);
    return { success: true, statusCode: response.statusCode, data: data, error: null, fromCache: response.fromCache };
  } catch (e) {
    return { success: false, statusCode: response.statusCode, data: null, error: `JSON parse error: ${e.message}`, fromCache: response.fromCache };
  }
}

function httpPost(url, payload, options) {
  options = options || {};
  const domain = extractDomain_(url);

  if (isCircuitOpen_(domain)) {
    return { success: false, statusCode: 0, body: null, error: `Circuit breaker open for domain: ${domain}` };
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

function isCircuitOpen_(domain) {
  const circuit = RUNTIME_CACHE.circuitBreakers[domain];
  if (!circuit || circuit.state === CIRCUIT_STATES.CLOSED) return false;

  if (circuit.state === CIRCUIT_STATES.OPEN) {
    const now = Date.now();
    if (now - circuit.openedAt > CIRCUIT_CONFIG.RECOVERY_TIMEOUT_MS) {
      circuit.state = CIRCUIT_STATES.HALF_OPEN;
      circuit.halfOpenSuccesses = 0;
      logCircuitBreaker(domain, CIRCUIT_STATES.HALF_OPEN, 'Recovery timeout elapsed');
      return false;
    }
    return true;
  }
  return false;
}

function recordCircuitSuccess_(domain) {
  const circuit = RUNTIME_CACHE.circuitBreakers[domain];
  if (!circuit) return;

  if (circuit.state === CIRCUIT_STATES.HALF_OPEN) {
    circuit.halfOpenSuccesses = (circuit.halfOpenSuccesses || 0) + 1;
    if (circuit.halfOpenSuccesses >= CIRCUIT_CONFIG.HALF_OPEN_SUCCESS_THRESHOLD) {
      circuit.state = CIRCUIT_STATES.CLOSED;
      circuit.failures = 0;
      logCircuitBreaker(domain, CIRCUIT_STATES.CLOSED, 'Successful requests in half-open state');
    }
  } else if (circuit.state === CIRCUIT_STATES.CLOSED) {
    circuit.failures = 0;
  }
}

function recordCircuitFailure_(domain, reason) {
  if (!RUNTIME_CACHE.circuitBreakers[domain]) {
    RUNTIME_CACHE.circuitBreakers[domain] = { state: CIRCUIT_STATES.CLOSED, failures: 0, openedAt: null };
  }

  const circuit = RUNTIME_CACHE.circuitBreakers[domain];

  if (circuit.state === CIRCUIT_STATES.HALF_OPEN) {
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

function resetCircuitBreaker(domain) {
  delete RUNTIME_CACHE.circuitBreakers[domain];
  logCircuitBreaker(domain, CIRCUIT_STATES.CLOSED, 'Manual reset');
}

function getCircuitBreakerStates() {
  return { ...RUNTIME_CACHE.circuitBreakers };
}

function incrementBudgetCounter_(counterName) {
  RUNTIME_CACHE.budgetCounters[counterName] = (RUNTIME_CACHE.budgetCounters[counterName] || 0) + 1;
}

function incrementProviderCounter(provider) {
  const counterName = `provider_requests_${provider.toLowerCase()}`;
  incrementBudgetCounter_(counterName);
}

function getBudgetCounters() {
  return { ...RUNTIME_CACHE.budgetCounters };
}

function isBudgetLimitReached(limitKey, counterName) {
  const limit = getConfigValue(limitKey, Infinity);
  const used = RUNTIME_CACHE.budgetCounters[counterName] || 0;

  if (used >= limit) {
    logQuotaWarning(counterName, used, limit);
    return true;
  }
  if (used >= limit * 0.8) {
    logQuotaWarning(counterName, used, limit);
  }
  return false;
}

function extractDomain_(url) {
  const match = url.match(/^https?:\/\/([^\/]+)/);
  return match ? match[1] : 'unknown';
}

function clearHttpCache() {
  for (const key in HTTP_CACHE) {
    delete HTTP_CACHE[key];
  }
  logDebug('http', 'HTTP cache cleared');
}

function getHttpCacheSize() {
  return Object.keys(HTTP_CACHE).length;
}

function buildUrl(baseUrl, params) {
  const queryString = Object.entries(params)
    .filter(([k, v]) => v !== null && v !== undefined)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');
  return queryString ? `${baseUrl}?${queryString}` : baseUrl;
}

function fillUrlTemplate(template, values) {
  let url = template;
  for (const [key, value] of Object.entries(values)) {
    url = url.replace(new RegExp(`\\{${key}\\}`, 'g'), encodeURIComponent(value));
  }
  return url;
}

// ==================================================
// SECCION 6: PRECIOS - YAHOO FINANCE
// ==================================================

function fetchYahooChart(ticker, range, interval) {
  range = range || '6mo';
  interval = interval || '1d';

  const yahooOk = getConfigValue(CONFIG_KEYS.YAHOO_OK, null);
  if (yahooOk === false) {
    return { success: false, data: null, error: 'Yahoo Finance is marked as unavailable in CONFIG' };
  }

  if (isBudgetLimitReached(CONFIG_KEYS.MAX_DAILY_HTTP, 'http_requests_total')) {
    return { success: false, data: null, error: 'Daily HTTP budget exceeded' };
  }

  incrementProviderCounter('yahoo');

  const url = fillUrlTemplate(API_ENDPOINTS.YAHOO_CHART, { TICKER: ticker, RANGE: range, INTERVAL: interval });
  logDebug('prices_yahoo', `Fetching ${ticker} (${range}/${interval})`);

  const response = httpGetJson(url);

  if (!response.success) {
    logWarn('prices_yahoo', `Failed to fetch ${ticker}`, { error: response.error });
    return { success: false, data: null, error: response.error };
  }

  const parsed = parseYahooChartResponse_(response.data, ticker);

  if (!parsed.success) {
    logWarn('prices_yahoo', `Failed to parse ${ticker}`, { error: parsed.error });
  } else {
    logDebug('prices_yahoo', `Fetched ${parsed.data.length} bars for ${ticker}`);
  }

  return parsed;
}

function parseYahooChartResponse_(json, ticker) {
  try {
    if (json.chart && json.chart.error) {
      return { success: false, data: null, error: json.chart.error.description || 'Yahoo API error' };
    }

    const result = json.chart && json.chart.result && json.chart.result[0];
    if (!result) {
      return { success: false, data: null, error: 'No data in Yahoo response' };
    }

    const timestamps = result.timestamp;
    const quote = result.indicators && result.indicators.quote && result.indicators.quote[0];
    const adjClose = result.indicators && result.indicators.adjclose && result.indicators.adjclose[0] && result.indicators.adjclose[0].adjclose;

    if (!timestamps || !quote) {
      return { success: false, data: null, error: 'Missing timestamp or quote data' };
    }

    const bars = [];

    for (let i = 0; i < timestamps.length; i++) {
      if (quote.open[i] == null || quote.high[i] == null || quote.low[i] == null || quote.close[i] == null) {
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

    bars.sort((a, b) => a.date.localeCompare(b.date));
    return { success: true, data: bars, error: null };

  } catch (e) {
    return { success: false, data: null, error: `Parse error: ${e.message}` };
  }
}

function fetchYahooChartBatch(tickers, range, interval) {
  const results = {};
  for (const ticker of tickers) {
    if (isBudgetLimitReached(CONFIG_KEYS.MAX_DAILY_HTTP, 'http_requests_total')) {
      logWarn('prices_yahoo', 'Budget limit reached, stopping batch');
      break;
    }
    results[ticker] = fetchYahooChart(ticker, range, interval);
    Utilities.sleep(200);
  }
  return results;
}

function testYahooAvailability() {
  const testTicker = 'SPY';
  try {
    const result = fetchYahooChart(testTicker, '5d', '1d');
    if (result.success && result.data && result.data.length > 0) {
      return { available: true, message: `Yahoo Finance OK, fetched ${result.data.length} bars for ${testTicker}` };
    }
    return { available: false, message: result.error || 'No data returned' };
  } catch (e) {
    return { available: false, message: `Exception: ${e.message}` };
  }
}

function getYahooRangeForDays(days) {
  if (days <= 5) return '5d';
  if (days <= 30) return '1mo';
  if (days <= 90) return '3mo';
  if (days <= 180) return '6mo';
  if (days <= 365) return '1y';
  if (days <= 730) return '2y';
  return '5y';
}

function roundPrice_(price) {
  return Math.round(price * 100) / 100;
}

function saveYahooPricesToSheet(bars) {
  if (!bars || bars.length === 0) return;
  upsertRows(SHEET_NAMES.PRICES_DAILY, bars, ['date', 'ticker']);
}

// ==================================================
// SECCION 7: PRECIOS - FINNHUB
// ==================================================

function fetchFinnhubCandles(ticker, fromDate, toDate) {
  const finnhubOk = getConfigValue(CONFIG_KEYS.FINNHUB_CANDLES_OK, null);
  if (finnhubOk === false) {
    return { success: false, data: null, error: 'Finnhub candles marked as unavailable in CONFIG' };
  }

  const token = getConfigValue(CONFIG_KEYS.FINNHUB_TOKEN, '');
  if (!token) {
    return { success: false, data: null, error: 'FINNHUB_TOKEN not configured' };
  }

  if (isBudgetLimitReached(CONFIG_KEYS.MAX_DAILY_HTTP, 'http_requests_total')) {
    return { success: false, data: null, error: 'Daily HTTP budget exceeded' };
  }

  incrementProviderCounter('finnhub');

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
    return { success: false, data: null, error: response.error };
  }

  const parsed = parseFinnhubCandlesResponse_(response.data, ticker);

  if (!parsed.success) {
    logWarn('prices_finnhub', `Failed to parse ${ticker}`, { error: parsed.error });
  } else {
    logDebug('prices_finnhub', `Fetched ${parsed.data.length} candles for ${ticker}`);
  }

  return parsed;
}

function parseFinnhubCandlesResponse_(json, ticker) {
  try {
    if (json.s === 'no_data') {
      return { success: false, data: null, error: 'No data available for this ticker/range' };
    }

    if (json.s !== 'ok') {
      return { success: false, data: null, error: `Finnhub status: ${json.s}` };
    }

    const timestamps = json.t;
    const opens = json.o;
    const highs = json.h;
    const lows = json.l;
    const closes = json.c;
    const volumes = json.v;

    if (!timestamps || !opens || !highs || !lows || !closes) {
      return { success: false, data: null, error: 'Missing OHLC data in response' };
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
        adjclose: roundPrice_(closes[i]),
        volume: volumes[i] || 0,
        source: DATA_SOURCES.PRICES.FINNHUB_CANDLES
      });
    }

    bars.sort((a, b) => a.date.localeCompare(b.date));
    return { success: true, data: bars, error: null };

  } catch (e) {
    return { success: false, data: null, error: `Parse error: ${e.message}` };
  }
}

function fetchFinnhubCandlesBatch(tickers, fromDate, toDate) {
  const results = {};
  for (const ticker of tickers) {
    if (isBudgetLimitReached(CONFIG_KEYS.MAX_DAILY_HTTP, 'http_requests_total')) {
      logWarn('prices_finnhub', 'Budget limit reached, stopping batch');
      break;
    }
    results[ticker] = fetchFinnhubCandles(ticker, fromDate, toDate);
    Utilities.sleep(300);
  }
  return results;
}

function testFinnhubCandlesAvailability() {
  const token = getConfigValue(CONFIG_KEYS.FINNHUB_TOKEN, '');
  if (!token) {
    return { available: false, message: 'FINNHUB_TOKEN not configured' };
  }

  const testTicker = 'AAPL';
  const toDate = new Date();
  const fromDate = subtractDays_(toDate, 7);

  try {
    const result = fetchFinnhubCandles(testTicker, fromDate, toDate);
    if (result.success && result.data && result.data.length > 0) {
      return { available: true, message: `Finnhub candles OK, fetched ${result.data.length} bars for ${testTicker}` };
    }
    if (result.error && (result.error.includes('403') || result.error.includes('402'))) {
      return { available: false, message: `Finnhub candles not available on current plan: ${result.error}` };
    }
    return { available: false, message: result.error || 'No data returned' };
  } catch (e) {
    return { available: false, message: `Exception: ${e.message}` };
  }
}

function saveFinnhubPricesToSheet(bars) {
  if (!bars || bars.length === 0) return;
  upsertRows(SHEET_NAMES.PRICES_DAILY, bars, ['date', 'ticker']);
}

function normalizeToDate_(dateValue) {
  if (dateValue instanceof Date) return dateValue;
  if (typeof dateValue === 'string') return new Date(dateValue);
  return new Date(dateValue);
}

// ==================================================
// SECCION 8: PRECIOS - FMP
// ==================================================

function fetchFmpEod(ticker, fromDate, toDate) {
  const fmpOk = getConfigValue(CONFIG_KEYS.FMP_OK, null);
  if (fmpOk === false) {
    return { success: false, data: null, error: 'FMP marked as unavailable in CONFIG' };
  }

  const apiKey = getConfigValue(CONFIG_KEYS.FMP_KEY, '');
  if (!apiKey) {
    return { success: false, data: null, error: 'FMP_KEY not configured' };
  }

  if (isBudgetLimitReached(CONFIG_KEYS.MAX_DAILY_HTTP, 'http_requests_total')) {
    return { success: false, data: null, error: 'Daily HTTP budget exceeded' };
  }

  incrementProviderCounter('fmp');

  fromDate = formatDateYMD_(fromDate);
  toDate = formatDateYMD_(toDate);

  const url = fillUrlTemplate(API_ENDPOINTS.FMP_EOD, { TICKER: ticker, FROM: fromDate, TO: toDate, KEY: apiKey });

  logDebug('prices_fmp', `Fetching ${ticker} (${fromDate} to ${toDate})`);

  const response = httpGetJson(url);

  if (!response.success) {
    logWarn('prices_fmp', `Failed to fetch ${ticker}`, { error: response.error });
    return { success: false, data: null, error: response.error };
  }

  const parsed = parseFmpEodResponse_(response.data, ticker);

  if (!parsed.success) {
    logWarn('prices_fmp', `Failed to parse ${ticker}`, { error: parsed.error });
  } else {
    logDebug('prices_fmp', `Fetched ${parsed.data.length} bars for ${ticker}`);
  }

  return parsed;
}

function parseFmpEodResponse_(json, ticker) {
  try {
    if (json.Error || json['Error Message']) {
      return { success: false, data: null, error: json.Error || json['Error Message'] };
    }

    let historical = json.historical;
    if (Array.isArray(json)) {
      historical = json;
    }

    if (!historical || historical.length === 0) {
      return { success: false, data: null, error: 'No historical data in response' };
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

    bars.sort((a, b) => a.date.localeCompare(b.date));
    return { success: true, data: bars, error: null };

  } catch (e) {
    return { success: false, data: null, error: `Parse error: ${e.message}` };
  }
}

function fetchFmpEodBatch(tickers, fromDate, toDate) {
  const results = {};
  let fmpCalls = RUNTIME_CACHE.budgetCounters.provider_requests_fmp || 0;
  const fmpLimit = LIMITS.FMP_FREE_DAILY_CALLS;

  for (const ticker of tickers) {
    if (fmpCalls >= fmpLimit * 0.9) {
      logWarn('prices_fmp', `Approaching FMP daily limit (${fmpCalls}/${fmpLimit}), stopping batch`);
      break;
    }

    if (isBudgetLimitReached(CONFIG_KEYS.MAX_DAILY_HTTP, 'http_requests_total')) {
      break;
    }

    results[ticker] = fetchFmpEod(ticker, fromDate, toDate);
    fmpCalls++;
    Utilities.sleep(400);
  }
  return results;
}

function testFmpAvailability() {
  const apiKey = getConfigValue(CONFIG_KEYS.FMP_KEY, '');
  if (!apiKey) {
    return { available: false, message: 'FMP_KEY not configured' };
  }

  const testTicker = 'AAPL';
  const toDate = formatDateYMD_(new Date());
  const fromDate = formatDateYMD_(subtractDays_(new Date(), 7));

  try {
    const result = fetchFmpEod(testTicker, fromDate, toDate);
    if (result.success && result.data && result.data.length > 0) {
      return { available: true, message: `FMP OK, fetched ${result.data.length} bars for ${testTicker}` };
    }
    if (result.error && (result.error.includes('limit') || result.error.includes('Limit'))) {
      return { available: false, message: `FMP limit reached: ${result.error}` };
    }
    return { available: false, message: result.error || 'No data returned' };
  } catch (e) {
    return { available: false, message: `Exception: ${e.message}` };
  }
}

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

function saveFmpPricesToSheet(bars) {
  if (!bars || bars.length === 0) return;
  upsertRows(SHEET_NAMES.PRICES_DAILY, bars, ['date', 'ticker']);
}

// ==================================================
// SECCION 9: INDICADORES TECNICOS
// ==================================================

function computeSMA(series, period) {
  if (!series || series.length === 0) return [];

  const result = [];
  for (let i = 0; i < series.length; i++) {
    if (i < period - 1) {
      result.push(null);
    } else {
      let sum = 0;
      for (let j = 0; j < period; j++) {
        sum += series[i - j];
      }
      result.push(roundPrice_(sum / period));
    }
  }
  return result;
}

function attachSMAs(ohlc, periods) {
  periods = periods || [20, 50, 200];
  if (!ohlc || ohlc.length === 0) return ohlc;

  const closes = ohlc.map(bar => bar.close);
  const smaResults = {};

  for (const period of periods) {
    smaResults[period] = computeSMA(closes, period);
  }

  return ohlc.map((bar, i) => {
    const enhanced = { ...bar };
    for (const period of periods) {
      const smaValue = smaResults[period][i];
      if (period === 20) enhanced.sma20 = smaValue;
      else if (period === 50) enhanced.sma50 = smaValue;
      else if (period === 200) enhanced.sma200 = smaValue;
    }
    return enhanced;
  });
}

function computeSMASlope(smaValues, window) {
  const result = [];
  for (let i = 0; i < smaValues.length; i++) {
    if (i < window - 1 || smaValues[i] === null || smaValues[i - window + 1] === null) {
      result.push(null);
    } else {
      const startVal = smaValues[i - window + 1];
      const endVal = smaValues[i];
      const slope = ((endVal - startVal) / startVal) * 100;
      result.push(Math.round(slope * 1000) / 1000);
    }
  }
  return result;
}

function isAboveSMA(value, sma) {
  if (value === null || value === undefined || sma === null || sma === undefined) return false;
  return value > sma;
}

function computeATR(ohlc, period) {
  period = period || 14;
  if (!ohlc || ohlc.length < 2) return [];

  const tr = [];
  for (let i = 0; i < ohlc.length; i++) {
    if (i === 0) {
      tr.push(ohlc[i].high - ohlc[i].low);
    } else {
      const hl = ohlc[i].high - ohlc[i].low;
      const hc = Math.abs(ohlc[i].high - ohlc[i - 1].close);
      const lc = Math.abs(ohlc[i].low - ohlc[i - 1].close);
      tr.push(Math.max(hl, hc, lc));
    }
  }
  return computeSMA(tr, period);
}

function detectCandlePatterns(ohlc) {
  if (!ohlc || ohlc.length < 3) return [];

  const results = [];

  for (let i = 1; i < ohlc.length; i++) {
    const patterns = [];
    const curr = ohlc[i];
    const prev = ohlc[i - 1];
    const prev2 = i >= 2 ? ohlc[i - 2] : null;

    const body = Math.abs(curr.close - curr.open);
    const upperWick = curr.high - Math.max(curr.open, curr.close);
    const lowerWick = Math.min(curr.open, curr.close) - curr.low;
    const range = curr.high - curr.low;

    const isBullish = curr.close > curr.open;
    const isBearish = curr.close < curr.open;

    if (body / range < 0.3 && lowerWick > body * 2 && upperWick < body * 0.5) {
      patterns.push('hammer');
    }

    if (body / range < 0.3 && upperWick > body * 2 && lowerWick < body * 0.5) {
      patterns.push('shooting_star');
    }

    if (prev && isBullish && prev.close < prev.open && curr.open < prev.close && curr.close > prev.open) {
      patterns.push('bullish_engulfing');
    }

    if (prev && isBearish && prev.close > prev.open && curr.open > prev.close && curr.close < prev.open) {
      patterns.push('bearish_engulfing');
    }

    if (body / range < 0.1 && range > 0) {
      patterns.push('doji');
    }

    if (prev && curr.high < prev.high && curr.low > prev.low) {
      patterns.push('inside_bar');
    }

    if (prev && curr.low > prev.high) {
      patterns.push('gap_up');
    }

    if (prev && curr.high < prev.low) {
      patterns.push('gap_down');
    }

    if (prev2 && prev && isBullish &&
        prev2.close < prev2.open &&
        Math.abs(prev.close - prev.open) / (prev.high - prev.low || 1) < 0.3 &&
        curr.close > (prev2.open + prev2.close) / 2) {
      patterns.push('morning_star');
    }

    results.push({ date: curr.date, patterns: patterns });
  }

  return results;
}

function computeRSI(closes, period) {
  period = period || 14;
  if (!closes || closes.length < period + 1) {
    return closes.map(() => null);
  }

  const result = [];
  const gains = [];
  const losses = [];

  for (let i = 1; i < closes.length; i++) {
    const change = closes[i] - closes[i - 1];
    gains.push(change > 0 ? change : 0);
    losses.push(change < 0 ? -change : 0);
  }

  for (let i = 0; i < closes.length; i++) {
    if (i < period) {
      result.push(null);
    } else {
      let avgGain = 0;
      let avgLoss = 0;

      for (let j = i - period; j < i; j++) {
        avgGain += gains[j];
        avgLoss += losses[j];
      }
      avgGain /= period;
      avgLoss /= period;

      if (avgLoss === 0) {
        result.push(100);
      } else {
        const rs = avgGain / avgLoss;
        const rsi = 100 - (100 / (1 + rs));
        result.push(Math.round(rsi * 100) / 100);
      }
    }
  }

  return result;
}

function percentDistance(value, reference) {
  if (!value || !reference || reference === 0) return null;
  return ((value - reference) / reference) * 100;
}

function isNearLevel(price, level, thresholdPct) {
  if (!price || !level || level === 0) return false;
  const distance = Math.abs(price - level) / level;
  return distance <= thresholdPct;
}

function getLatestSMA(priceHistory, smaField) {
  if (!priceHistory || priceHistory.length === 0) return null;

  for (let i = priceHistory.length - 1; i >= 0; i--) {
    const val = priceHistory[i][smaField];
    if (val !== null && val !== undefined) {
      return val;
    }
  }
  return null;
}

function extractCloses(ohlc) {
  return ohlc.map(bar => bar.close).filter(c => c !== null && c !== undefined);
}

function extractField(ohlc, field) {
  return ohlc.map(bar => bar[field]).filter(v => v !== null && v !== undefined);
}

// ==================================================
// SECCION 10: HOLDINGS - FINNHUB
// ==================================================

function fetchFinnhubHoldings(etf) {
  const finnhubOk = getConfigValue(CONFIG_KEYS.FINNHUB_HOLDINGS_OK, null);
  if (finnhubOk === false) {
    return { success: false, holdings: null, error: 'Finnhub holdings marked as unavailable' };
  }

  const token = getConfigValue(CONFIG_KEYS.FINNHUB_TOKEN, '');
  if (!token) {
    return { success: false, holdings: null, error: 'FINNHUB_TOKEN not configured' };
  }

  if (isBudgetLimitReached(CONFIG_KEYS.MAX_DAILY_HTTP, 'http_requests_total')) {
    return { success: false, holdings: null, error: 'Budget exceeded' };
  }

  incrementProviderCounter('finnhub');

  const url = fillUrlTemplate(API_ENDPOINTS.FINNHUB_HOLDINGS, { ETF: etf, TOKEN: token });
  logDebug('holdings_finnhub', `Fetching holdings for ${etf}`);

  const response = httpGetJson(url);

  if (!response.success) {
    logWarn('holdings_finnhub', `Failed to fetch ${etf}`, { error: response.error });
    return { success: false, holdings: null, error: response.error };
  }

  return parseFinnhubHoldingsResponse_(response.data, etf);
}

function parseFinnhubHoldingsResponse_(json, etf) {
  try {
    if (json.error) {
      return { success: false, holdings: null, error: json.error };
    }

    const holdingsData = json.holdings;
    if (!holdingsData || !Array.isArray(holdingsData) || holdingsData.length === 0) {
      return { success: false, holdings: null, error: 'No holdings data in response' };
    }

    const topN = getConfigValue(CONFIG_KEYS.HOLDINGS_TOP_N, 30);
    const asofDate = json.atDate || getTodayDateStr();

    const sorted = holdingsData
      .filter(h => h.symbol && h.percent != null)
      .map(h => ({
        ticker: normalizeHoldingTicker_(h.symbol),
        weight: h.percent,
        name: h.name || ''
      }))
      .sort((a, b) => b.weight - a.weight)
      .slice(0, topN);

    const holdings = sorted.map((h, idx) => ({
      asof_date: asofDate,
      etf: etf,
      holding_ticker: h.ticker,
      weight: roundWeight_(h.weight),
      rank: idx + 1,
      source: DATA_SOURCES.HOLDINGS.FINNHUB,
      is_stale: false
    }));

    logDebug('holdings_finnhub', `Parsed ${holdings.length} holdings for ${etf}`);
    return { success: true, holdings: holdings, error: null, asofDate: asofDate };

  } catch (e) {
    return { success: false, holdings: null, error: `Parse error: ${e.message}` };
  }
}

function testFinnhubHoldingsAvailability() {
  const token = getConfigValue(CONFIG_KEYS.FINNHUB_TOKEN, '');
  if (!token) {
    return { available: false, message: 'FINNHUB_TOKEN not configured' };
  }

  const testEtf = 'SPY';
  try {
    const result = fetchFinnhubHoldings(testEtf);
    if (result.success && result.holdings && result.holdings.length > 0) {
      return { available: true, message: `Finnhub holdings OK, fetched ${result.holdings.length} for ${testEtf}` };
    }
    if (result.error && (result.error.includes('403') || result.error.includes('402'))) {
      return { available: false, message: `Finnhub holdings not available on current plan: ${result.error}` };
    }
    return { available: false, message: result.error || 'No holdings returned' };
  } catch (e) {
    return { available: false, message: `Exception: ${e.message}` };
  }
}

function normalizeHoldingTicker_(ticker) {
  if (!ticker) return '';
  ticker = ticker.toUpperCase().trim();
  ticker = ticker.replace(/\.PR$/, '-P');
  ticker = ticker.replace(/[^A-Z0-9\-]/g, '');
  return ticker;
}

function roundWeight_(weight) {
  return Math.round(weight * 10000) / 10000;
}

// ==================================================
// SECCION 11: HOLDINGS - ISSUER FILE
// ==================================================

function fetchIssuerHoldings(etf) {
  const issuerInfo = ISSUER_ETF_MAP[etf];
  if (!issuerInfo) {
    return { success: false, holdings: null, error: `No issuer mapping for ${etf}` };
  }

  if (issuerInfo.issuer === 'SPDR') {
    return fetchSpdrHoldings_(etf, issuerInfo);
  } else if (issuerInfo.issuer === 'ISHARES') {
    return fetchISharesHoldings_(etf, issuerInfo);
  }

  return { success: false, holdings: null, error: `Unknown issuer: ${issuerInfo.issuer}` };
}

function fetchSpdrHoldings_(etf, issuerInfo) {
  const baseUrl = 'https://www.ssga.com/us/en/intermediary/etfs/library-content/products/fund-data/etfs/us/holdings-daily-us-en-';
  const url = `${baseUrl}${issuerInfo.fundId.toLowerCase()}.xlsx`;

  logDebug('holdings_issuer', `Fetching SPDR holdings for ${etf} from ${url}`);

  if (isBudgetLimitReached(CONFIG_KEYS.MAX_DAILY_HTTP, 'http_requests_total')) {
    return { success: false, holdings: null, error: 'Budget exceeded' };
  }

  incrementBudgetCounter_('http_requests_total');

  try {
    const response = UrlFetchApp.fetch(url, { muteHttpExceptions: true, followRedirects: true });
    const statusCode = response.getResponseCode();

    if (statusCode !== 200) {
      logWarn('holdings_issuer', `Failed to fetch SPDR ${etf}`, { statusCode: statusCode });
      return { success: false, holdings: null, error: `HTTP ${statusCode}` };
    }

    const blob = response.getBlob();
    return parseSpdrExcelHoldings_(blob, etf);

  } catch (e) {
    logException('holdings_issuer', 'fetchSpdrHoldings_', e, { etf: etf });
    return { success: false, holdings: null, error: e.message };
  }
}

function parseSpdrExcelHoldings_(blob, etf) {
  const topN = getConfigValue(CONFIG_KEYS.HOLDINGS_TOP_N, 30);
  const asofDate = getTodayDateStr();

  try {
    const tempFile = DriveApp.createFile(blob.setName('temp_holdings.xlsx'));
    const fileId = tempFile.getId();

    const excelFile = DriveApp.getFileById(fileId);
    const ssId = Drive.Files.copy({ title: 'temp_holdings_converted', mimeType: MimeType.GOOGLE_SHEETS }, fileId).id;
    const ss = SpreadsheetApp.openById(ssId);
    const sheet = ss.getSheets()[0];

    const data = sheet.getDataRange().getValues();
    const holdings = [];

    let headerRow = -1;
    let tickerCol = -1;
    let weightCol = -1;

    for (let i = 0; i < Math.min(20, data.length); i++) {
      const row = data[i].map(cell => String(cell).toLowerCase());
      for (let j = 0; j < row.length; j++) {
        if (row[j].includes('ticker') || row[j].includes('symbol')) {
          tickerCol = j;
          headerRow = i;
        }
        if (row[j].includes('weight') || row[j].includes('%')) {
          weightCol = j;
        }
      }
      if (tickerCol >= 0 && weightCol >= 0) break;
    }

    if (tickerCol < 0 || weightCol < 0) {
      DriveApp.getFileById(ssId).setTrashed(true);
      tempFile.setTrashed(true);
      return { success: false, holdings: null, error: 'Could not find ticker/weight columns' };
    }

    for (let i = headerRow + 1; i < data.length; i++) {
      const ticker = normalizeHoldingTicker_(String(data[i][tickerCol]));
      let weight = data[i][weightCol];

      if (!ticker || ticker.length < 1) continue;

      if (typeof weight === 'string') {
        weight = parseFloat(weight.replace('%', '').replace(',', '.'));
      }
      if (isNaN(weight) || weight <= 0) continue;

      if (weight > 1) weight = weight / 100;

      holdings.push({ ticker: ticker, weight: weight * 100 });
    }

    holdings.sort((a, b) => b.weight - a.weight);
    const topHoldings = holdings.slice(0, topN);

    const result = topHoldings.map((h, idx) => ({
      asof_date: asofDate,
      etf: etf,
      holding_ticker: h.ticker,
      weight: roundWeight_(h.weight),
      rank: idx + 1,
      source: DATA_SOURCES.HOLDINGS.ISSUER_FILE,
      is_stale: false
    }));

    DriveApp.getFileById(ssId).setTrashed(true);
    tempFile.setTrashed(true);

    logDebug('holdings_issuer', `Parsed ${result.length} SPDR holdings for ${etf}`);
    return { success: true, holdings: result, error: null, asofDate: asofDate };

  } catch (e) {
    logException('holdings_issuer', 'parseSpdrExcelHoldings_', e, { etf: etf });
    return { success: false, holdings: null, error: `Parse error: ${e.message}` };
  }
}

function fetchISharesHoldings_(etf, issuerInfo) {
  logDebug('holdings_issuer', `iShares holdings not yet implemented for ${etf}`);
  return { success: false, holdings: null, error: 'iShares not implemented' };
}

function getManualHoldings(etf) {
  const manualData = getSheetDataFiltered(SHEET_NAMES.MANUAL_HOLDINGS, { etf: etf });

  if (manualData.length === 0) {
    return { success: false, holdings: null, error: 'No manual holdings' };
  }

  const topN = getConfigValue(CONFIG_KEYS.HOLDINGS_TOP_N, 30);
  const asofDate = getTodayDateStr();

  const holdings = manualData
    .sort((a, b) => (a.rank || 999) - (b.rank || 999))
    .slice(0, topN)
    .map((h, idx) => ({
      asof_date: asofDate,
      etf: etf,
      holding_ticker: normalizeHoldingTicker_(h.holding_ticker),
      weight: h.weight || 0,
      rank: h.rank || (idx + 1),
      source: DATA_SOURCES.HOLDINGS.MANUAL,
      is_stale: false
    }));

  return { success: true, holdings: holdings, error: null, asofDate: asofDate };
}

// ==================================================
// SECCION 12: HOLDINGS MANAGER
// ==================================================

function getHoldingsForEtf(etf) {
  etf = etf.toUpperCase();

  const latestHoldings = getLatestHoldingsForEtf(etf);
  if (latestHoldings.length > 0) {
    const asofDate = formatDateYMD_(latestHoldings[0].asof_date);
    const daysSince = daysBetween_(asofDate, new Date());
    const refreshDays = getConfigValue(CONFIG_KEYS.HOLDINGS_REFRESH_DAYS, 30);

    if (daysSince < refreshDays) {
      logDebug('holdings_manager', `Using cached holdings for ${etf} (${daysSince} days old)`);
      return { holdings: latestHoldings, source: latestHoldings[0].source, isStale: false };
    }
  }

  return { holdings: latestHoldings, source: latestHoldings.length > 0 ? latestHoldings[0].source : null, isStale: latestHoldings.length > 0 };
}

function refreshHoldings(etf) {
  etf = etf.toUpperCase();
  logDebug('holdings_manager', `Refreshing holdings for ${etf}`);

  const etfConfig = getSheetDataFiltered(SHEET_NAMES.ETFS, { etf: etf })[0];
  const primarySource = etfConfig ? etfConfig.holdings_source_primary : DATA_SOURCES.HOLDINGS.FINNHUB;
  const fallbackSource = etfConfig ? etfConfig.holdings_source_fallback : DATA_SOURCES.HOLDINGS.ISSUER_FILE;

  let result = fetchHoldingsFromSource_(etf, primarySource);

  if (!result.success && fallbackSource && fallbackSource !== primarySource) {
    logInfo('holdings_manager', `Primary source failed for ${etf}, trying fallback: ${fallbackSource}`);
    result = fetchHoldingsFromSource_(etf, fallbackSource);
  }

  if (!result.success) {
    const manual = getManualHoldings(etf);
    if (manual.success) {
      logInfo('holdings_manager', `Using manual holdings for ${etf}`);
      result = manual;
    }
  }

  if (result.success && result.holdings && result.holdings.length > 0) {
    saveHoldings_(etf, result.holdings);
    logInfo('holdings_manager', `Saved ${result.holdings.length} holdings for ${etf}`);
  }

  return result;
}

function fetchHoldingsFromSource_(etf, source) {
  switch (source) {
    case DATA_SOURCES.HOLDINGS.FINNHUB:
      return fetchFinnhubHoldings(etf);
    case DATA_SOURCES.HOLDINGS.ISSUER_FILE:
      return fetchIssuerHoldings(etf);
    case DATA_SOURCES.HOLDINGS.MANUAL:
      return getManualHoldings(etf);
    default:
      return { success: false, holdings: null, error: `Unknown source: ${source}` };
  }
}

function saveHoldings_(etf, holdings) {
  deleteRowsFiltered(SHEET_NAMES.HOLDINGS_SNAPSHOT, { etf: etf });
  batchWrite(SHEET_NAMES.HOLDINGS_SNAPSHOT, holdings);
}

function getAllUniqueTickers() {
  const holdings = getSheetData(SHEET_NAMES.HOLDINGS_SNAPSHOT);
  const tickers = new Set();
  for (const h of holdings) {
    if (h.holding_ticker) {
      tickers.add(h.holding_ticker);
    }
  }
  return Array.from(tickers);
}

function getLastHoldingsDate(etf) {
  const holdings = getLatestHoldingsForEtf(etf);
  if (holdings.length === 0) return null;
  return holdings[0].asof_date;
}

function didHoldingsChangeRecently(etf) {
  const stabilityDays = getConfigValue(CONFIG_KEYS.HOLDINGS_STABILITY_DAYS, 10);
  const lastDate = getLastHoldingsDate(etf);
  if (!lastDate) return true;

  const daysSince = daysBetween_(lastDate, new Date());
  return daysSince < stabilityDays;
}

function refreshAllHoldings() {
  logOperationStart('refreshAllHoldings', {});
  const enabledEtfs = getEnabledEtfs();
  let success = 0;
  let failed = 0;

  for (const etfConfig of enabledEtfs) {
    try {
      const result = refreshHoldings(etfConfig.etf);
      if (result.success) success++;
      else failed++;
    } catch (e) {
      logException('holdings_manager', `refreshHoldings(${etfConfig.etf})`, e);
      failed++;
    }
    Utilities.sleep(500);
  }

  const summary = { success, failed, total: enabledEtfs.length };
  logOperationEnd('refreshAllHoldings', summary);
  return summary;
}

// ==================================================
// SECCION 13: BREADTH CALCULATION
// ==================================================

function computeBreadthForEtf(etf, date) {
  date = date || getTodayDateStr();
  etf = etf.toUpperCase();

  logDebug('breadth', `Computing breadth for ${etf} on ${date}`);

  const holdingsResult = getHoldingsForEtf(etf);

  if (!holdingsResult.holdings || holdingsResult.holdings.length === 0) {
    logWarn('breadth', `No holdings for ${etf}`);
    return createEmptyBreadthRow_(etf, date, 'No holdings');
  }

  const holdings = holdingsResult.holdings;
  const holdingTickers = holdings.map(h => h.holding_ticker);

  let countAbove20 = 0;
  let countAbove50 = 0;
  let countValid = 0;

  for (const ticker of holdingTickers) {
    const priceData = getLatestPriceWithSMA_(ticker, date);

    if (!priceData || priceData.close === null) {
      logDebug('breadth', `No price data for holding ${ticker}`);
      continue;
    }

    countValid++;

    if (priceData.sma20 !== null && priceData.close > priceData.sma20) {
      countAbove20++;
    }

    if (priceData.sma50 !== null && priceData.close > priceData.sma50) {
      countAbove50++;
    }
  }

  const topN = getConfigValue(CONFIG_KEYS.HOLDINGS_TOP_N, 30);
  const minHoldings = Math.ceil(topN * 0.75);

  if (countValid < minHoldings) {
    logWarn('breadth', `Insufficient data for ${etf}: ${countValid}/${topN} holdings`);
    return createEmptyBreadthRow_(etf, date, `Insufficient data: ${countValid}/${topN}`);
  }

  const pctAbove20 = Math.round((countAbove20 / countValid) * 10000) / 100;
  const pctAbove50 = Math.round((countAbove50 / countValid) * 10000) / 100;

  const dataQuality = calculateDataQuality_(countValid, topN);

  const zScoreResult = computeZScores_(etf, pctAbove20, pctAbove50);

  const extremeByThreshold = isExtremeByThreshold_(pctAbove20, pctAbove50);

  const prevBreadth = getPreviousBreadth_(etf, date);
  const giroResult = computeGiro_(pctAbove20, pctAbove50, prevBreadth);

  const regimeChange = didHoldingsChangeRecently(etf);

  const breadthRow = {
    date: date,
    etf: etf,
    n_holdings: countValid,
    pct_above_sma20: pctAbove20,
    pct_above_sma50: pctAbove50,
    z_pct_above_sma20: zScoreResult.z20,
    z_pct_above_sma50: zScoreResult.z50,
    pct_above_sma20_pctl: zScoreResult.pctl20,
    pct_above_sma50_pctl: zScoreResult.pctl50,
    z20_method: zScoreResult.method,
    z50_method: zScoreResult.method,
    z20_window_used: zScoreResult.windowUsed,
    z50_window_used: zScoreResult.windowUsed,
    extreme_by_z: zScoreResult.extremeByZ,
    extreme_by_pctl: zScoreResult.extremeByPctl,
    extreme_score: zScoreResult.extremeScore,
    regime_change_flag: regimeChange,
    data_quality_flag: dataQuality,
    extreme_flag: extremeByThreshold || zScoreResult.extremeByZ || zScoreResult.extremeByPctl,
    giro_flag: giroResult.giroFlag,
    source: holdingsResult.source
  };

  logDebug('breadth', `Breadth for ${etf}: ${pctAbove20}% > SMA20, ${pctAbove50}% > SMA50, z20=${zScoreResult.z20}`);

  return breadthRow;
}

function computeAndStoreBreadthForAllEtfs(date) {
  date = date || getTodayDateStr();

  logOperationStart('computeAndStoreBreadth', { date });

  const enabledEtfs = getEnabledEtfs();
  const breadthRows = [];
  let success = 0;
  let failed = 0;

  for (const etfConfig of enabledEtfs) {
    try {
      const breadth = computeBreadthForEtf(etfConfig.etf, date);
      breadthRows.push(breadth);

      if (breadth.data_quality_flag !== DATA_QUALITY.BAD) {
        success++;
      } else {
        failed++;
      }
    } catch (e) {
      logException('breadth', `computeBreadthForEtf(${etfConfig.etf})`, e);
      failed++;
    }
  }

  if (breadthRows.length > 0) {
    upsertRows(SHEET_NAMES.BREADTH_DAILY, breadthRows, ['date', 'etf']);
  }

  const summary = { date, success, failed, total: enabledEtfs.length };
  logOperationEnd('computeAndStoreBreadth', summary);

  return summary;
}

function getLatestPriceWithSMA_(ticker, asOfDate) {
  const priceHistory = getPriceHistory(ticker, 60);

  if (!priceHistory || priceHistory.length === 0) {
    return null;
  }

  let latestPrice = null;

  for (let i = priceHistory.length - 1; i >= 0; i--) {
    const priceDate = formatDateYMD_(priceHistory[i].date);
    if (priceDate <= asOfDate) {
      latestPrice = priceHistory[i];
      break;
    }
  }

  if (!latestPrice) {
    latestPrice = priceHistory[priceHistory.length - 1];
  }

  if (latestPrice.sma20 === null || latestPrice.sma20 === undefined) {
    const closes = extractCloses(priceHistory);
    const sma20Array = computeSMA(closes, 20);
    const sma50Array = computeSMA(closes, 50);

    const idx = priceHistory.indexOf(latestPrice);
    if (idx >= 0) {
      latestPrice = {
        ...latestPrice,
        sma20: sma20Array[idx],
        sma50: sma50Array[idx]
      };
    }
  }

  return latestPrice;
}

function getPreviousBreadth_(etf, currentDate) {
  const breadthHistory = getBreadthHistory(etf, 10);

  if (!breadthHistory || breadthHistory.length === 0) {
    return null;
  }

  for (let i = breadthHistory.length - 1; i >= 0; i--) {
    const breadthDate = formatDateYMD_(breadthHistory[i].date);
    if (breadthDate < currentDate) {
      return breadthHistory[i];
    }
  }

  return null;
}

function isExtremeByThreshold_(pctAbove20, pctAbove50) {
  const threshold20 = getConfigValue(CONFIG_KEYS.EXTREME_PCT_ABOVE20, 10);
  const threshold50 = getConfigValue(CONFIG_KEYS.EXTREME_PCT_ABOVE50, 25);

  return pctAbove20 <= threshold20 || pctAbove50 <= threshold50;
}

function computeGiro_(pctAbove20, pctAbove50, prevBreadth) {
  if (!prevBreadth) {
    return { giroFlag: false, uptick20: null, uptick50: null };
  }

  const prevPct20 = prevBreadth.pct_above_sma20;
  const prevPct50 = prevBreadth.pct_above_sma50;

  const uptick20 = pctAbove20 - prevPct20;
  const uptick50 = pctAbove50 - prevPct50;

  const requireReversion = getConfigValue(CONFIG_KEYS.EXTREME_REQUIRE_REVERSION, true);
  const minUptick = getConfigValue(CONFIG_KEYS.REVERSION_MIN_UPTICK, 2.0);
  const crossLevel = getConfigValue(CONFIG_KEYS.REVERSION_CROSS_LEVEL20, 12.5);

  let giroFlag = false;

  if (requireReversion) {
    const hasUptick = uptick20 >= minUptick || uptick50 >= minUptick;
    const crossedLevel = (pctAbove20 >= crossLevel && prevPct20 < crossLevel) ||
                         (pctAbove50 >= crossLevel && prevPct50 < crossLevel);
    giroFlag = hasUptick || crossedLevel;
  } else {
    giroFlag = uptick20 > 0 || uptick50 > 0;
  }

  return {
    giroFlag: giroFlag,
    uptick20: Math.round(uptick20 * 100) / 100,
    uptick50: Math.round(uptick50 * 100) / 100
  };
}

function calculateDataQuality_(countValid, expected) {
  const ratio = countValid / expected;

  if (ratio >= 0.9) {
    return DATA_QUALITY.OK;
  } else if (ratio >= 0.75) {
    return DATA_QUALITY.PARTIAL;
  } else {
    return DATA_QUALITY.BAD;
  }
}

function createEmptyBreadthRow_(etf, date, reason) {
  return {
    date: date,
    etf: etf,
    n_holdings: 0,
    pct_above_sma20: null,
    pct_above_sma50: null,
    z_pct_above_sma20: null,
    z_pct_above_sma50: null,
    pct_above_sma20_pctl: null,
    pct_above_sma50_pctl: null,
    z20_method: null,
    z50_method: null,
    z20_window_used: null,
    z50_window_used: null,
    extreme_by_z: false,
    extreme_by_pctl: false,
    extreme_score: null,
    regime_change_flag: false,
    data_quality_flag: DATA_QUALITY.BAD,
    extreme_flag: false,
    giro_flag: false,
    source: reason
  };
}

function computeZScores_(etf, pctAbove20, pctAbove50) {
  if (typeof computeAdvancedZScores === 'function') {
    return computeAdvancedZScores(etf, pctAbove20, pctAbove50);
  }
  return computeSimpleZScores_(etf, pctAbove20, pctAbove50);
}

function computeSimpleZScores_(etf, pctAbove20, pctAbove50) {
  const windowDays = getConfigValue(CONFIG_KEYS.Z_WINDOW_DAYS, 252);
  const minObs = getConfigValue(CONFIG_KEYS.Z_MIN_OBS, 126);

  const history = getBreadthHistory(etf, windowDays + 10);

  const hist20 = history
    .filter(h => h.pct_above_sma20 !== null && h.pct_above_sma20 !== undefined)
    .map(h => h.pct_above_sma20);

  const hist50 = history
    .filter(h => h.pct_above_sma50 !== null && h.pct_above_sma50 !== undefined)
    .map(h => h.pct_above_sma50);

  let z20 = null;
  let z50 = null;
  let pctl20 = null;
  let pctl50 = null;
  let extremeByZ = false;
  let extremeByPctl = false;

  const extremeZ20 = getConfigValue(CONFIG_KEYS.EXTREME_Z20, -1.8);
  const extremeZ50 = getConfigValue(CONFIG_KEYS.EXTREME_Z50, -1.8);
  const extremePctl20 = getConfigValue(CONFIG_KEYS.EXTREME_PCTL20, 0.05);
  const extremePctl50 = getConfigValue(CONFIG_KEYS.EXTREME_PCTL50, 0.10);

  if (hist20.length >= minObs) {
    const stats20 = computeBasicStats_(hist20);
    if (stats20.stdev > 0) {
      z20 = Math.round(((pctAbove20 - stats20.mean) / stats20.stdev) * 100) / 100;
    }
    pctl20 = computePercentile_(pctAbove20, hist20);

    if (z20 !== null && z20 <= extremeZ20) {
      extremeByZ = true;
    }
    if (pctl20 !== null && pctl20 <= extremePctl20) {
      extremeByPctl = true;
    }
  }

  if (hist50.length >= minObs) {
    const stats50 = computeBasicStats_(hist50);
    if (stats50.stdev > 0) {
      z50 = Math.round(((pctAbove50 - stats50.mean) / stats50.stdev) * 100) / 100;
    }
    pctl50 = computePercentile_(pctAbove50, hist50);

    if (z50 !== null && z50 <= extremeZ50) {
      extremeByZ = true;
    }
    if (pctl50 !== null && pctl50 <= extremePctl50) {
      extremeByPctl = true;
    }
  }

  let extremeScore = null;
  if (z20 !== null && z50 !== null) {
    const w20 = getConfigValue(CONFIG_KEYS.Z_COMBO_W20, 0.65);
    const w50 = getConfigValue(CONFIG_KEYS.Z_COMBO_W50, 0.35);
    const zCombo = w20 * z20 + w50 * z50;
    extremeScore = Math.max(0, Math.min(1, -zCombo / 6));
    extremeScore = Math.round(extremeScore * 1000) / 1000;
  }

  return {
    z20: z20,
    z50: z50,
    pctl20: pctl20,
    pctl50: pctl50,
    method: 'STD',
    windowUsed: Math.min(hist20.length, hist50.length),
    extremeByZ: extremeByZ,
    extremeByPctl: extremeByPctl,
    extremeScore: extremeScore
  };
}

function computeBasicStats_(series) {
  if (!series || series.length === 0) {
    return { mean: null, stdev: null };
  }

  const n = series.length;
  const mean = series.reduce((a, b) => a + b, 0) / n;

  let sumSq = 0;
  for (const x of series) {
    sumSq += (x - mean) * (x - mean);
  }
  const stdev = Math.sqrt(sumSq / n);

  return {
    mean: Math.round(mean * 100) / 100,
    stdev: Math.round(stdev * 100) / 100
  };
}

function computePercentile_(value, series) {
  if (!series || series.length === 0) {
    return null;
  }

  let countBelow = 0;
  for (const x of series) {
    if (x <= value) {
      countBelow++;
    }
  }

  const pctl = countBelow / series.length;
  return Math.round(pctl * 1000) / 1000;
}

// ==================================================
// SECCION 14: SUPPORT LEVELS & PIVOTS
// ==================================================

function computeEtfTechnicals(etf, date) {
  date = date || getTodayDateStr();
  etf = etf.toUpperCase();

  logDebug('support', `Computing technicals for ${etf} on ${date}`);

  const lookbackDays = getConfigValue(CONFIG_KEYS.SUPPORT_LOOKBACK_DAYS, 252);
  const priceHistory = getPriceHistory(etf, lookbackDays + 50);

  if (!priceHistory || priceHistory.length < 50) {
    logWarn('support', `Insufficient price history for ${etf}: ${priceHistory ? priceHistory.length : 0} bars`);
    return createEmptyTechRow_(etf, date, 'Insufficient price data');
  }

  const enhancedPrices = attachSMAs(priceHistory, [50, 200]);

  let latestPrice = null;
  let latestIndex = -1;

  for (let i = enhancedPrices.length - 1; i >= 0; i--) {
    const priceDate = formatDateYMD_(enhancedPrices[i].date);
    if (priceDate <= date) {
      latestPrice = enhancedPrices[i];
      latestIndex = i;
      break;
    }
  }

  if (!latestPrice) {
    latestPrice = enhancedPrices[enhancedPrices.length - 1];
    latestIndex = enhancedPrices.length - 1;
  }

  const currentClose = latestPrice.close;
  const sma50 = latestPrice.sma50;
  const sma200 = latestPrice.sma200;

  const pivotRadius = 3;
  const pivotLows = detectPivotLows(enhancedPrices, pivotRadius, latestIndex);

  const atr = computeRecentATR_(enhancedPrices, latestIndex);
  const supportResult = clusterPivotsToSupportLevel(pivotLows, currentClose, atr);

  const nearSupportPct = getConfigValue(CONFIG_KEYS.SUPPORT_NEAR_PCT, 0.015);
  const nearSupport = supportResult.supportLevel !== null &&
                      isNearLevel(currentClose, supportResult.supportLevel, nearSupportPct);

  const trendFlag = computeTrendFlag_(enhancedPrices, latestIndex, currentClose, sma50, sma200);

  const techRow = {
    date: date,
    etf: etf,
    close: currentClose,
    sma50: sma50,
    sma200: sma200,
    support_level: supportResult.supportLevel,
    support_method: 'PIVOT_CLUSTER',
    near_support_flag: nearSupport,
    trend_flag: trendFlag,
    notes_json: JSON.stringify({
      pivotCount: pivotLows.length,
      clusterCount: supportResult.clusterCount,
      distanceToSupport: supportResult.distancePct,
      atr: atr
    })
  };

  logDebug('support', `Technicals for ${etf}: close=${currentClose}, support=${supportResult.supportLevel}, near=${nearSupport}, trend=${trendFlag}`);

  return techRow;
}

function detectPivotLows(ohlc, k, maxIndex) {
  k = k || 3;
  maxIndex = maxIndex !== undefined ? maxIndex : ohlc.length - 1;

  const pivots = [];

  for (let i = k; i <= maxIndex - k; i++) {
    const currentLow = ohlc[i].low;
    let isPivot = true;

    for (let j = 1; j <= k; j++) {
      if (ohlc[i - j].low <= currentLow) {
        isPivot = false;
        break;
      }
    }

    if (isPivot) {
      for (let j = 1; j <= k; j++) {
        if (ohlc[i + j].low <= currentLow) {
          isPivot = false;
          break;
        }
      }
    }

    if (isPivot) {
      pivots.push({
        index: i,
        date: ohlc[i].date,
        low: currentLow,
        price: currentLow
      });
    }
  }

  return pivots;
}

function clusterPivotsToSupportLevel(pivots, currentPrice, atr) {
  if (!pivots || pivots.length === 0) {
    return { supportLevel: null, clusterCount: 0, distancePct: null };
  }

  let binSize;
  if (atr && atr > 0) {
    binSize = atr * 0.5;
  } else {
    binSize = currentPrice * 0.005;
  }

  const supportPivots = pivots.filter(p => p.price < currentPrice);

  if (supportPivots.length === 0) {
    return { supportLevel: null, clusterCount: 0, distancePct: null };
  }

  const bins = {};

  for (const pivot of supportPivots) {
    const binKey = Math.floor(pivot.price / binSize) * binSize;
    if (!bins[binKey]) {
      bins[binKey] = { price: binKey + binSize / 2, count: 0, pivots: [] };
    }
    bins[binKey].count++;
    bins[binKey].pivots.push(pivot);
  }

  const binArray = Object.values(bins);

  if (binArray.length === 0) {
    return { supportLevel: null, clusterCount: 0, distancePct: null };
  }

  binArray.sort((a, b) => {
    if (b.count !== a.count) {
      return b.count - a.count;
    }
    return Math.abs(currentPrice - a.price) - Math.abs(currentPrice - b.price);
  });

  let selectedBin = binArray[0];
  const distancePct = Math.abs(currentPrice - selectedBin.price) / currentPrice;

  if (distancePct > 0.15 && binArray.length > 1) {
    for (const bin of binArray) {
      const thisDistance = Math.abs(currentPrice - bin.price) / currentPrice;
      if (thisDistance < 0.15 && bin.count >= selectedBin.count * 0.5) {
        selectedBin = bin;
        break;
      }
    }
  }

  let sumPrice = 0;
  let sumWeight = 0;

  for (const pivot of selectedBin.pivots) {
    const recency = pivot.index / pivots.length;
    const weight = 0.5 + 0.5 * recency;
    sumPrice += pivot.price * weight;
    sumWeight += weight;
  }

  const supportLevel = sumWeight > 0 ?
    Math.round((sumPrice / sumWeight) * 100) / 100 :
    Math.round(selectedBin.price * 100) / 100;

  return {
    supportLevel: supportLevel,
    clusterCount: selectedBin.count,
    distancePct: Math.round(((currentPrice - supportLevel) / supportLevel) * 10000) / 100
  };
}

function computeAndStoreEtfTechForAllEtfs(date) {
  date = date || getTodayDateStr();

  logOperationStart('computeAndStoreEtfTech', { date });

  const enabledEtfs = getEnabledEtfs();
  const techRows = [];
  let success = 0;
  let failed = 0;

  for (const etfConfig of enabledEtfs) {
    try {
      const tech = computeEtfTechnicals(etfConfig.etf, date);
      techRows.push(tech);

      if (tech.support_level !== null) {
        success++;
      } else {
        failed++;
      }
    } catch (e) {
      logException('support', `computeEtfTechnicals(${etfConfig.etf})`, e);
      failed++;
    }
  }

  if (techRows.length > 0) {
    upsertRows(SHEET_NAMES.ETF_TECH_DAILY, techRows, ['date', 'etf']);
  }

  const summary = { date, success, failed, total: enabledEtfs.length };
  logOperationEnd('computeAndStoreEtfTech', summary);

  return summary;
}

function computeTrendFlag_(priceHistory, latestIndex, close, sma50, sma200) {
  const trendMethod = getConfigValue(CONFIG_KEYS.TREND_METHOD, 'SMA200');

  switch (trendMethod) {
    case 'SMA200':
      return sma200 !== null && close > sma200;
    case 'SMA50_SLOPE':
      return computeSma50SlopePositive_(priceHistory, latestIndex);
    case 'BOTH':
      const aboveSma200 = sma200 !== null && close > sma200;
      const slopePositive = computeSma50SlopePositive_(priceHistory, latestIndex);
      return aboveSma200 && slopePositive;
    default:
      return sma200 !== null && close > sma200;
  }
}

function computeSma50SlopePositive_(priceHistory, latestIndex) {
  const window = getConfigValue(CONFIG_KEYS.TREND_SMA50_SLOPE_WINDOW, 20);

  if (latestIndex < window || !priceHistory[latestIndex].sma50) {
    return false;
  }

  const startIndex = latestIndex - window;
  const startSma = priceHistory[startIndex].sma50;
  const endSma = priceHistory[latestIndex].sma50;

  if (!startSma || !endSma) {
    return false;
  }

  return endSma > startSma;
}

function computeRecentATR_(priceHistory, latestIndex) {
  const period = 14;

  if (latestIndex < period) {
    return null;
  }

  const recentBars = priceHistory.slice(latestIndex - period + 1, latestIndex + 1);
  const atrArray = computeATR(recentBars, period);

  return atrArray.length > 0 ? atrArray[atrArray.length - 1] : null;
}

function createEmptyTechRow_(etf, date, reason) {
  return {
    date: date,
    etf: etf,
    close: null,
    sma50: null,
    sma200: null,
    support_level: null,
    support_method: 'PIVOT_CLUSTER',
    near_support_flag: false,
    trend_flag: false,
    notes_json: JSON.stringify({ error: reason })
  };
}

function getLatestEtfTech(etf) {
  const techData = getSheetDataFiltered(SHEET_NAMES.ETF_TECH_DAILY, { etf: etf });

  if (!techData || techData.length === 0) {
    return null;
  }

  let latest = techData[0];
  for (const row of techData) {
    if (formatDateYMD_(row.date) > formatDateYMD_(latest.date)) {
      latest = row;
    }
  }

  return latest;
}

// ==================================================
// SECCION 15: SIGNALS
// ==================================================

function computeSignalForEtf(etf, date) {
  date = date || getTodayDateStr();
  etf = etf.toUpperCase();

  logDebug('signals', `Computing signal for ${etf} on ${date}`);

  const breadthRows = getSheetDataFiltered(SHEET_NAMES.BREADTH_DAILY, { etf: etf, date: date });
  const breadth = breadthRows.length > 0 ? breadthRows[0] : null;

  const techRows = getSheetDataFiltered(SHEET_NAMES.ETF_TECH_DAILY, { etf: etf, date: date });
  const tech = techRows.length > 0 ? techRows[0] : null;

  const visionEnabled = getConfigValue(CONFIG_KEYS.VISION_ENABLED, false);
  let vision = null;
  if (visionEnabled) {
    const visionRows = getSheetDataFiltered(SHEET_NAMES.VISION_SIGNALS, { ticker: etf, date: date });
    vision = visionRows.length > 0 ? visionRows[0] : null;
  }

  return computeSignalRow_(etf, date, breadth, tech, vision);
}

function computeSignalRow_(etf, date, breadth, tech, vision) {
  let breadthExtreme = false;
  let nearSupport = false;
  let trendOk = false;
  let visionOk = true;
  let giroOk = false;

  const debug = { etf: etf, date: date, breadth: null, tech: null, vision: null, flags: {} };

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

    const extremeByThreshold = isExtremeByThresholdValues_(breadth.pct_above_sma20, breadth.pct_above_sma50);

    breadthExtreme = breadth.extreme_flag === true || breadth.extreme_flag === 'TRUE' ||
                     breadth.extreme_by_z === true || breadth.extreme_by_z === 'TRUE' ||
                     breadth.extreme_by_pctl === true || breadth.extreme_by_pctl === 'TRUE' ||
                     extremeByThreshold;

    const requireGiro = getConfigValue(CONFIG_KEYS.REQUIRE_GIRO, true);
    if (requireGiro) {
      giroOk = breadth.giro_flag === true || breadth.giro_flag === 'TRUE';
    } else {
      giroOk = true;
    }

    if (breadth.data_quality_flag === DATA_QUALITY.BAD) {
      debug.flags.dataQualityBlock = true;
    }

    const holdingsStabilityRequired = getConfigValue(CONFIG_KEYS.HOLDINGS_STABILITY_REQUIRED, true);
    if (holdingsStabilityRequired && (breadth.regime_change_flag === true || breadth.regime_change_flag === 'TRUE')) {
      if (breadth.extreme_by_z && !extremeByThreshold) {
        debug.flags.regimeChangeBlock = true;
      }
    }
  }

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

    if (tech.support_level && tech.close) {
      debug.tech.distanceToSupportPct = Math.round(((tech.close - tech.support_level) / tech.support_level) * 10000) / 100;
    }
  }

  const visionEnabledConfig = getConfigValue(CONFIG_KEYS.VISION_ENABLED, false);
  if (visionEnabledConfig) {
    if (vision) {
      debug.vision = { verdict: vision.verdict, pattern_score: vision.pattern_score, pattern_labels: vision.pattern_labels };
      visionOk = vision.verdict !== VISION_VERDICTS.BEARISH;
    } else {
      visionOk = true;
      debug.vision = { missing: true };
    }
  }

  debug.flags.breadthExtreme = breadthExtreme;
  debug.flags.nearSupport = nearSupport;
  debug.flags.trendOk = trendOk;
  debug.flags.visionOk = visionOk;
  debug.flags.giroOk = giroOk;

  let finalSignal = SIGNAL_TYPES.NONE;
  let reason = '';

  const allConditionsMet = nearSupport && breadthExtreme && giroOk && trendOk;
  const allConditionsMetWithVision = allConditionsMet && (visionEnabledConfig ? visionOk : true);

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
  } else if (allConditionsMet && visionEnabledConfig && !visionOk) {
    finalSignal = SIGNAL_TYPES.WATCH;
    reason = 'Vision verdict bearish, degraded from ENTER';
  } else {
    finalSignal = SIGNAL_TYPES.NONE;
    reason = 'No significant conditions met';
  }

  const score = calculateSignalScore_(breadth, tech, vision);

  const signalRow = {
    date: date,
    etf: etf,
    breadth_extreme: breadthExtreme,
    near_support: nearSupport,
    trend_ok: trendOk,
    vision_ok: visionEnabledConfig ? visionOk : '',
    final_signal: finalSignal,
    reason: reason,
    score: score,
    debug_json: JSON.stringify(debug)
  };

  logDebug('signals', `Signal for ${etf}: ${finalSignal} (score=${score})`);

  return signalRow;
}

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

  if (signalRows.length > 0) {
    upsertRows(SHEET_NAMES.SIGNALS, signalRows, ['date', 'etf']);
  }

  const summary = { date, total: enabledEtfs.length, enter: enterCount, watch: watchCount, none: noneCount };
  logOperationEnd('computeAndStoreSignals', summary);

  return summary;
}

function getRankedSignals(date, signalType) {
  date = date || getTodayDateStr();
  let signals = getSheetDataFiltered(SHEET_NAMES.SIGNALS, { date: date });

  if (signalType) {
    signals = signals.filter(s => s.final_signal === signalType);
  }

  signals.sort((a, b) => (b.score || 0) - (a.score || 0));
  return signals;
}

function getTodayEnterSignals() {
  return getRankedSignals(getTodayDateStr(), SIGNAL_TYPES.ENTER);
}

function getTodayWatchSignals() {
  return getRankedSignals(getTodayDateStr(), SIGNAL_TYPES.WATCH);
}

function isExtremeByThresholdValues_(pctAbove20, pctAbove50) {
  const threshold20 = getConfigValue(CONFIG_KEYS.EXTREME_PCT_ABOVE20, 10);
  const threshold50 = getConfigValue(CONFIG_KEYS.EXTREME_PCT_ABOVE50, 25);

  return (pctAbove20 !== null && pctAbove20 <= threshold20) ||
         (pctAbove50 !== null && pctAbove50 <= threshold50);
}

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

function buildWatchReason_(breadthExtreme, nearSupport, giroOk, trendOk) {
  const missing = [];

  if (!breadthExtreme) missing.push('breadth not extreme');
  if (!nearSupport) missing.push('not near support');
  if (!giroOk) missing.push('no giro');
  if (!trendOk) missing.push('trend not OK');

  return `Missing: ${missing.join(', ')}`;
}

function calculateSignalScore_(breadth, tech, vision) {
  let score = 0;

  if (breadth && breadth.extreme_score !== null) {
    score += breadth.extreme_score * 0.6;
  } else if (breadth) {
    const z20 = breadth.z_pct_above_sma20 || 0;
    const z50 = breadth.z_pct_above_sma50 || 0;
    const zCombo = 0.65 * z20 + 0.35 * z50;
    const extremeScoreBase = Math.max(0, Math.min(1, -zCombo / 6));
    score += extremeScoreBase * 0.6;
  }

  if (tech && tech.support_level && tech.close) {
    const distancePct = Math.abs(tech.close - tech.support_level) / tech.close;
    const supportScore = 1 / (1 + distancePct * 100);
    score += supportScore * 0.4;
  }

  const visionEnabled = getConfigValue(CONFIG_KEYS.VISION_ENABLED, false);
  if (visionEnabled && vision && vision.pattern_score !== null) {
    score = score * (0.8 + 0.2 * vision.pattern_score);
  }

  return Math.round(score * 1000) / 1000;
}

function recomputeSignalsWithVision(date) {
  date = date || getTodayDateStr();

  const visionEnabled = getConfigValue(CONFIG_KEYS.VISION_ENABLED, false);
  if (!visionEnabled) {
    logDebug('signals', 'Vision not enabled, skipping recompute');
    return;
  }

  logInfo('signals', 'Recomputing signals with vision data');

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

function exportDailyReport(date) {
  date = date || getTodayDateStr();

  const reportName = `DAILY_REPORT_${date.replace(/-/g, '')}`;
  const signals = getRankedSignals(date);

  if (signals.length === 0) {
    logWarn('signals', 'No signals to export');
    return;
  }

  const ss = getSpreadsheet();
  let reportSheet = ss.getSheetByName(reportName);
  if (reportSheet) {
    reportSheet.clear();
  } else {
    reportSheet = ss.insertSheet(reportName);
  }

  const headers = ['Rank', 'ETF', 'Signal', 'Score', 'Near Support', 'Breadth Extreme', 'Trend OK', 'Vision OK', 'Reason'];
  reportSheet.appendRow(headers);

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

  reportSheet.setFrozenRows(1);
  reportSheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');

  logInfo('signals', `Exported daily report to ${reportName}`);
}

// ==================================================
// SECCION 16: IMAGES (Chart Download)
// ==================================================

function downloadChartImage(ticker, timeframe, provider) {
  ticker = ticker.toUpperCase();
  provider = provider || getConfigValue(CONFIG_KEYS.IMAGE_PROVIDER, 'FINVIZ');
  const date = getTodayDateStr();

  logDebug('images', `Downloading ${ticker} ${timeframe} from ${provider}`);

  if (isBudgetLimitReached(CONFIG_KEYS.MAX_DAILY_HTTP, 'http_requests_total')) {
    return { success: false, driveFileId: null, sha1: null, error: 'HTTP budget exceeded' };
  }

  const imageUrl = getImageUrl_(ticker, timeframe, provider);

  if (!imageUrl) {
    return { success: false, driveFileId: null, sha1: null, error: `No image URL for provider: ${provider}` };
  }

  try {
    const response = UrlFetchApp.fetch(imageUrl, { muteHttpExceptions: true, followRedirects: true });

    if (response.getResponseCode() !== 200) {
      logWarn('images', `Failed to fetch image for ${ticker}`, { statusCode: response.getResponseCode() });
      return { success: false, driveFileId: null, sha1: null, error: `HTTP ${response.getResponseCode()}` };
    }

    const blob = response.getBlob();
    const sha1 = computeSha1_(blob.getBytes());

    const existing = checkExistingImage_(ticker, timeframe, sha1);
    if (existing) {
      logDebug('images', `Image already exists for ${ticker} ${timeframe}`);
      return { success: true, driveFileId: existing.drive_file_id, sha1: sha1, error: null, fromCache: true };
    }

    const driveFileId = saveImageToDrive_(blob, ticker, timeframe, date);

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

    return { success: true, driveFileId: driveFileId, sha1: sha1, error: null };

  } catch (e) {
    logException('images', `downloadChartImage(${ticker}, ${timeframe})`, e);

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

    return { success: false, driveFileId: null, sha1: null, error: e.message };
  }
}

function downloadImagesForCandidates(date, maxImages) {
  date = date || getTodayDateStr();
  maxImages = maxImages || 10;

  logOperationStart('downloadImagesForCandidates', { date, maxImages });

  const signals = getRankedSignals(date);
  const candidates = signals.filter(s =>
    s.final_signal === SIGNAL_TYPES.ENTER || s.final_signal === SIGNAL_TYPES.WATCH
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

      const existing = getSheetDataFiltered(SHEET_NAMES.IMAGES, { date: date, ticker: ticker, timeframe: trimmedTf });

      if (existing.length > 0 && existing[0].status === 'OK') {
        skipped++;
        continue;
      }

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

      Utilities.sleep(500);
    }
  }

  const summary = { downloaded, failed, skipped };
  logOperationEnd('downloadImagesForCandidates', summary);

  return summary;
}

function getImageUrl_(ticker, timeframe, provider) {
  const tfMap = { 'D': 'd', 'W': 'w', 'M': 'm' };
  const period = tfMap[timeframe.toUpperCase()] || 'd';

  switch (provider.toUpperCase()) {
    case 'FINVIZ':
      return fillUrlTemplate(API_ENDPOINTS.FINVIZ_CHART, { TICKER: ticker, PERIOD: period });
    case 'FINBIT':
      const template = getConfigValue(CONFIG_KEYS.FINBIT_IMAGE_URL_TEMPLATE, '');
      if (!template) return null;
      return template.replace('{TICKER}', ticker).replace('{PERIOD}', period).replace('{TIMEFRAME}', timeframe);
    case 'INTERNAL_CHARTS':
      logWarn('images', 'INTERNAL_CHARTS not implemented');
      return null;
    default:
      return null;
  }
}

function saveImageToDrive_(blob, ticker, timeframe, date) {
  const rootFolderName = DRIVE_FOLDERS.ROOT;
  const dateFolderName = date;
  const tickerFolderName = ticker;

  let rootFolder = getOrCreateFolder_(null, rootFolderName);
  let dateFolder = getOrCreateFolder_(rootFolder, dateFolderName);
  let tickerFolder = getOrCreateFolder_(dateFolder, tickerFolderName);

  const filename = `${timeframe}.png`;

  const existingFiles = tickerFolder.getFilesByName(filename);
  if (existingFiles.hasNext()) {
    const existingFile = existingFiles.next();
    existingFile.setTrashed(true);
  }

  blob.setName(filename);
  const file = tickerFolder.createFile(blob);

  return file.getId();
}

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
    const rootFolders = DriveApp.getFoldersByName(folderName);
    if (rootFolders.hasNext()) {
      folder = rootFolders.next();
    } else {
      folder = DriveApp.createFolder(folderName);
    }
  }

  return folder;
}

function computeSha1_(bytes) {
  const digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_1, bytes);
  return digest.map(b => ('0' + (b & 0xFF).toString(16)).slice(-2)).join('');
}

function checkExistingImage_(ticker, timeframe, sha1) {
  const images = getSheetDataFiltered(SHEET_NAMES.IMAGES, { ticker: ticker, timeframe: timeframe, sha1: sha1 });

  if (images.length > 0 && images[0].status === 'OK') {
    return images[0];
  }

  return null;
}

function getImageDriveId(ticker, timeframe, date) {
  date = date || getTodayDateStr();

  const images = getSheetDataFiltered(SHEET_NAMES.IMAGES, { date: date, ticker: ticker, timeframe: timeframe });

  if (images.length > 0 && images[0].status === 'OK') {
    return images[0].drive_file_id;
  }

  return null;
}

function getImageBase64(driveFileId) {
  if (!driveFileId) return null;

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

// ==================================================
// SECCION 17: VISION (Pattern Recognition)
// ==================================================

function analyzeImageWithVision(ticker, timeframe, date) {
  date = date || getTodayDateStr();
  ticker = ticker.toUpperCase();

  logDebug('vision', `Analyzing ${ticker} ${timeframe} for ${date}`);

  const visionEnabled = getConfigValue(CONFIG_KEYS.VISION_ENABLED, false);
  if (!visionEnabled) {
    return { success: false, error: 'Vision is disabled in config' };
  }

  if (isBudgetLimitReached(CONFIG_KEYS.MAX_DAILY_VISION, 'vision_requests')) {
    return { success: false, error: 'Vision budget exceeded' };
  }

  const driveFileId = getImageDriveId(ticker, timeframe, date);

  let ocrText = '';
  let ocrSuccess = false;

  if (driveFileId) {
    const ocrResult = callGoogleVisionOCR(driveFileId);
    if (ocrResult.success) {
      ocrText = ocrResult.text;
      ocrSuccess = true;
    }
  }

  const patternResult = computePatternHeuristicsFromOHLC(ticker, timeframe);

  const combinedResult = combineVisionResults_(ocrText, ocrSuccess, patternResult);

  const visionRow = {
    date: date,
    ticker: ticker,
    timeframe: timeframe,
    ocr_text: ocrText.substring(0, 500),
    pattern_labels: JSON.stringify(combinedResult.patterns),
    pattern_score: combinedResult.score,
    verdict: combinedResult.verdict,
    notes_json: JSON.stringify({ ocrSuccess: ocrSuccess, patternCount: combinedResult.patterns.length, driveFileId: driveFileId })
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

function callGoogleVisionOCR(driveFileId) {
  const apiKey = getConfigValue(CONFIG_KEYS.GCV_API_KEY, '');

  if (!apiKey) {
    return { success: false, text: '', error: 'GCV_API_KEY not configured' };
  }

  try {
    const base64Image = getImageBase64(driveFileId);

    if (!base64Image) {
      return { success: false, text: '', error: 'Could not read image from Drive' };
    }

    incrementBudgetCounter_('vision_requests');

    const requestBody = {
      requests: [{
        image: { content: base64Image },
        features: [{ type: 'TEXT_DETECTION', maxResults: 10 }]
      }]
    };

    const url = fillUrlTemplate(API_ENDPOINTS.GOOGLE_VISION, { KEY: apiKey });
    const response = httpPost(url, requestBody);

    if (!response.success) {
      return { success: false, text: '', error: response.error };
    }

    const json = JSON.parse(response.body);

    if (json.responses && json.responses[0] && json.responses[0].fullTextAnnotation) {
      return { success: true, text: json.responses[0].fullTextAnnotation.text || '', error: null };
    }

    return { success: true, text: '', error: null };

  } catch (e) {
    logException('vision', 'callGoogleVisionOCR', e);
    return { success: false, text: '', error: e.message };
  }
}

function computePatternHeuristicsFromOHLC(ticker, timeframe) {
  const lookbacks = { 'D': 60, 'W': 52, 'M': 24 };
  const lookback = lookbacks[timeframe.toUpperCase()] || 60;

  const priceHistory = getPriceHistory(ticker, lookback);

  if (!priceHistory || priceHistory.length < 10) {
    return { patterns: [], score: 0.5, bullishCount: 0, bearishCount: 0 };
  }

  const patterns = [];
  let bullishCount = 0;
  let bearishCount = 0;

  const recent = priceHistory.slice(-20);
  const latest = recent[recent.length - 1];
  const prev = recent.length > 1 ? recent[recent.length - 2] : null;

  const enhancedPrices = attachSMAs(priceHistory, [20, 50, 200]);
  const latestEnhanced = enhancedPrices[enhancedPrices.length - 1];

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

  if (latestEnhanced.sma50 !== null) {
    if (latest.close > latestEnhanced.sma50) {
      patterns.push('above_sma50');
      bullishCount += 0.5;
    } else {
      patterns.push('below_sma50');
      bearishCount += 0.5;
    }

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

  const pivotLows = detectPivotLows(priceHistory, 3);
  if (pivotLows.length > 0) {
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

  const closes = extractCloses(priceHistory);
  const rsi = computeRSI(closes, 14);
  const latestRSI = rsi[rsi.length - 1];

  if (latestRSI !== null) {
    if (latestRSI < 30) {
      patterns.push('rsi_oversold');
      bullishCount++;
    } else if (latestRSI > 70) {
      patterns.push('rsi_overbought');
      bearishCount++;
    }
  }

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

  const totalSignals = bullishCount + bearishCount;
  let score = 0.5;

  if (totalSignals > 0) {
    score = bullishCount / totalSignals;
    score = 0.3 + score * 0.4;
  }

  if (bullishCount >= 3 && bearishCount <= 1) {
    score = Math.min(1, score + 0.15);
  }

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

function combineVisionResults_(ocrText, ocrSuccess, patternResult) {
  let score = patternResult.score;
  const patterns = [...patternResult.patterns];

  if (ocrSuccess && ocrText) {
    const lowerText = ocrText.toLowerCase();

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

    if (bullishHits > bearishHits) {
      score = Math.min(1, score + 0.05 * (bullishHits - bearishHits));
    } else if (bearishHits > bullishHits) {
      score = Math.max(0, score - 0.05 * (bearishHits - bullishHits));
    }
  }

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

function runVisionForNewImages(date) {
  date = date || getTodayDateStr();

  logOperationStart('runVisionForNewImages', { date });

  const images = getSheetDataFiltered(SHEET_NAMES.IMAGES, { date: date, status: 'OK' });

  let analyzed = 0;
  let skipped = 0;
  let failed = 0;

  for (const img of images) {
    const existing = getSheetDataFiltered(SHEET_NAMES.VISION_SIGNALS, { date: date, ticker: img.ticker, timeframe: img.timeframe });

    if (existing.length > 0) {
      skipped++;
      continue;
    }

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

    Utilities.sleep(200);
  }

  const summary = { analyzed, skipped, failed };
  logOperationEnd('runVisionForNewImages', summary);

  return summary;
}

// ==================================================
// SECCION 18: ADVANCED STATISTICS
// ==================================================

function computeAdvancedZScores(etf, pctAbove20, pctAbove50) {
  const method = getConfigValue(CONFIG_KEYS.Z_METHOD, 'ROBUST');
  const windowDays = getConfigValue(CONFIG_KEYS.Z_WINDOW_DAYS, 252);
  const minObs = getConfigValue(CONFIG_KEYS.Z_MIN_OBS, 126);
  const doWinsorize = getConfigValue(CONFIG_KEYS.Z_WINSORIZE, true);
  const winsorPct = getConfigValue(CONFIG_KEYS.Z_WINSOR_PCT, 0.02);

  const extremeZ20 = getConfigValue(CONFIG_KEYS.EXTREME_Z20, -1.8);
  const extremeZ50 = getConfigValue(CONFIG_KEYS.EXTREME_Z50, -1.8);
  const extremePctl20 = getConfigValue(CONFIG_KEYS.EXTREME_PCTL20, 0.05);
  const extremePctl50 = getConfigValue(CONFIG_KEYS.EXTREME_PCTL50, 0.10);
  const usePctl = getConfigValue(CONFIG_KEYS.EXTREME_USE_PCTL, true);
  const combiner = getConfigValue(CONFIG_KEYS.EXTREME_COMBINER, 'ANY');

  const history = getBreadthHistory(etf, windowDays + 10);

  const series20 = history
    .filter(h => h.pct_above_sma20 !== null && h.pct_above_sma20 !== undefined && !isNaN(h.pct_above_sma20))
    .map(h => parseFloat(h.pct_above_sma20));

  const series50 = history
    .filter(h => h.pct_above_sma50 !== null && h.pct_above_sma50 !== undefined && !isNaN(h.pct_above_sma50))
    .map(h => parseFloat(h.pct_above_sma50));

  const result = {
    z20: null,
    z50: null,
    pctl20: null,
    pctl50: null,
    method: method,
    windowUsed: 0,
    extremeByZ: false,
    extremeByPctl: false,
    extremeScore: null,
    stats20: null,
    stats50: null
  };

  if (series20.length < minObs) {
    logDebug('stats', `Insufficient observations for ${etf} SMA20: ${series20.length}/${minObs}`);
    result.windowUsed = series20.length;
    return result;
  }

  if (series50.length < minObs) {
    logDebug('stats', `Insufficient observations for ${etf} SMA50: ${series50.length}/${minObs}`);
    result.windowUsed = series50.length;
    return result;
  }

  result.windowUsed = Math.min(series20.length, series50.length);

  let processed20 = series20;
  let processed50 = series50;

  if (doWinsorize) {
    processed20 = winsorize(series20, winsorPct);
    processed50 = winsorize(series50, winsorPct);
  }

  if (method === 'ROBUST') {
    result.stats20 = computeRobustStats(processed20);
    result.stats50 = computeRobustStats(processed50);

    result.z20 = computeRobustZScore(pctAbove20, result.stats20);
    result.z50 = computeRobustZScore(pctAbove50, result.stats50);
  } else {
    result.stats20 = computeStandardStats(processed20);
    result.stats50 = computeStandardStats(processed50);

    result.z20 = computeStandardZScore(pctAbove20, result.stats20);
    result.z50 = computeStandardZScore(pctAbove50, result.stats50);
  }

  result.pctl20 = computePercentileRank(pctAbove20, series20);
  result.pctl50 = computePercentileRank(pctAbove50, series50);

  result.extremeByZ = determineExtremeByZ_(result.z20, result.z50, extremeZ20, extremeZ50, combiner);

  if (usePctl) {
    result.extremeByPctl = determineExtremeByPctl_(result.pctl20, result.pctl50, extremePctl20, extremePctl50, combiner);
  }

  result.extremeScore = computeExtremeScore_(result.z20, result.z50, pctAbove20, pctAbove50);

  return result;
}

function winsorize(series, pct) {
  if (!series || series.length === 0 || pct <= 0 || pct >= 0.5) {
    return series;
  }

  const sorted = [...series].sort((a, b) => a - b);
  const n = sorted.length;

  const lowerIndex = Math.floor(n * pct);
  const upperIndex = Math.floor(n * (1 - pct));

  const lowerBound = sorted[lowerIndex];
  const upperBound = sorted[upperIndex];

  return series.map(x => {
    if (x < lowerBound) return lowerBound;
    if (x > upperBound) return upperBound;
    return x;
  });
}

function computeStandardStats(series) {
  if (!series || series.length === 0) {
    return { mean: null, stdev: null, n: 0 };
  }

  const n = series.length;
  const mean = series.reduce((a, b) => a + b, 0) / n;

  let sumSq = 0;
  for (const x of series) {
    sumSq += (x - mean) * (x - mean);
  }
  const stdev = Math.sqrt(sumSq / n);

  return { mean: round4_(mean), stdev: round4_(stdev), n: n };
}

function computeStandardZScore(value, stats) {
  if (!stats || stats.stdev === null || stats.stdev === 0) {
    return null;
  }

  const z = (value - stats.mean) / stats.stdev;
  return round4_(z);
}

function computeRobustStats(series) {
  if (!series || series.length === 0) {
    return { median: null, mad: null, robustSigma: null, n: 0 };
  }

  const sorted = [...series].sort((a, b) => a - b);
  const n = sorted.length;

  const median = computeMedian_(sorted);

  const deviations = series.map(x => Math.abs(x - median));
  const sortedDeviations = deviations.sort((a, b) => a - b);
  const mad = computeMedian_(sortedDeviations);

  const robustSigma = 1.4826 * mad;

  return { median: round4_(median), mad: round4_(mad), robustSigma: round4_(robustSigma), n: n };
}

function computeRobustZScore(value, stats) {
  if (!stats || stats.robustSigma === null || stats.robustSigma === 0) {
    return null;
  }

  const z = (value - stats.median) / stats.robustSigma;
  return round4_(z);
}

function computeMedian_(sortedArray) {
  const n = sortedArray.length;
  if (n === 0) return null;

  const mid = Math.floor(n / 2);

  if (n % 2 === 0) {
    return (sortedArray[mid - 1] + sortedArray[mid]) / 2;
  } else {
    return sortedArray[mid];
  }
}

function computePercentileRank(value, series) {
  if (!series || series.length === 0) {
    return null;
  }

  let countBelow = 0;
  let countEqual = 0;

  for (const x of series) {
    if (x < value) countBelow++;
    else if (x === value) countEqual++;
  }

  const rank = (countBelow + countEqual / 2) / series.length;
  return round4_(rank);
}

function determineExtremeByZ_(z20, z50, thresholdZ20, thresholdZ50, combiner) {
  if (z20 === null && z50 === null) return false;

  const extreme20 = z20 !== null && z20 <= thresholdZ20;
  const extreme50 = z50 !== null && z50 <= thresholdZ50;

  switch (combiner) {
    case 'ANY':
      return extreme20 || extreme50;
    case 'BOTH':
      return extreme20 && extreme50;
    case 'WEIGHTED':
      if (z20 === null || z50 === null) return extreme20 || extreme50;
      const w20 = getConfigValue(CONFIG_KEYS.Z_COMBO_W20, 0.65);
      const w50 = getConfigValue(CONFIG_KEYS.Z_COMBO_W50, 0.35);
      const zCombo = w20 * z20 + w50 * z50;
      const comboThreshold = w20 * thresholdZ20 + w50 * thresholdZ50;
      return zCombo <= comboThreshold;
    default:
      return extreme20 || extreme50;
  }
}

function determineExtremeByPctl_(pctl20, pctl50, threshold20, threshold50, combiner) {
  if (pctl20 === null && pctl50 === null) return false;

  const extreme20 = pctl20 !== null && pctl20 <= threshold20;
  const extreme50 = pctl50 !== null && pctl50 <= threshold50;

  switch (combiner) {
    case 'ANY':
      return extreme20 || extreme50;
    case 'BOTH':
      return extreme20 && extreme50;
    case 'WEIGHTED':
      return extreme20 || extreme50;
    default:
      return extreme20 || extreme50;
  }
}

function computeExtremeScore_(z20, z50, pctAbove20, pctAbove50) {
  const threshold20 = getConfigValue(CONFIG_KEYS.EXTREME_PCT_ABOVE20, 10);
  const threshold50 = getConfigValue(CONFIG_KEYS.EXTREME_PCT_ABOVE50, 25);

  let extremeScoreBase = 0;
  if (z20 !== null && z50 !== null) {
    const w20 = getConfigValue(CONFIG_KEYS.Z_COMBO_W20, 0.65);
    const w50 = getConfigValue(CONFIG_KEYS.Z_COMBO_W50, 0.35);
    const zCombo = w20 * z20 + w50 * z50;
    extremeScoreBase = Math.max(0, Math.min(1, -zCombo / 6));
  }

  let sev20 = 0;
  let sev50 = 0;

  if (pctAbove20 !== null && threshold20 > 0) {
    sev20 = Math.max(0, Math.min(1, (threshold20 - pctAbove20) / threshold20));
  }

  if (pctAbove50 !== null && threshold50 > 0) {
    sev50 = Math.max(0, Math.min(1, (threshold50 - pctAbove50) / threshold50));
  }

  const sevCombo = 0.7 * sev20 + 0.3 * sev50;

  const extremeScore = 0.6 * extremeScoreBase + 0.4 * sevCombo;

  return round4_(extremeScore);
}

function round4_(value) {
  if (value === null || value === undefined || isNaN(value)) return null;
  return Math.round(value * 10000) / 10000;
}

// ==================================================
// SECCION 19: BUDGET MANAGER
// ==================================================

function initBudgetTracking() {
  const today = getTodayDateStr();
  const storedDate = getBudgetDate_();

  if (storedDate !== today) {
    resetBudgetCounters_();
    setBudgetDate_(today);
    logInfo('budget', `Budget counters reset for new day: ${today}`);
  } else {
    loadBudgetCounters_();
  }
}

function checkBudgetStatus() {
  initBudgetTracking();

  const counters = getBudgetCounters();

  const limits = {
    http_total: getConfigValue(CONFIG_KEYS.MAX_DAILY_HTTP, 500),
    vision: getConfigValue(CONFIG_KEYS.MAX_DAILY_VISION, 20),
    fmp: LIMITS.FMP_FREE_DAILY_CALLS
  };

  const status = {
    date: getTodayDateStr(),
    counters: counters,
    limits: limits,
    remaining: {
      http: limits.http_total - (counters.http_requests_total || 0),
      vision: limits.vision - (counters.vision_requests || 0),
      fmp: limits.fmp - (counters.provider_requests_fmp || 0)
    },
    percentUsed: {
      http: ((counters.http_requests_total || 0) / limits.http_total * 100).toFixed(1),
      vision: ((counters.vision_requests || 0) / limits.vision * 100).toFixed(1),
      fmp: ((counters.provider_requests_fmp || 0) / limits.fmp * 100).toFixed(1)
    },
    warnings: []
  };

  if (status.remaining.http < limits.http_total * 0.2) {
    status.warnings.push('HTTP budget nearly exhausted');
  }
  if (status.remaining.vision < limits.vision * 0.2) {
    status.warnings.push('Vision budget nearly exhausted');
  }
  if (status.remaining.fmp < limits.fmp * 0.2) {
    status.warnings.push('FMP budget nearly exhausted');
  }

  return status;
}

function getDegradationMode() {
  const status = checkBudgetStatus();

  const degradation = {
    skipVision: false,
    skipNewHoldings: false,
    limitTickers: false,
    maxTickers: null,
    skipImages: false,
    useCacheOnly: false,
    reason: []
  };

  if (status.remaining.vision <= 0) {
    degradation.skipVision = true;
    degradation.skipImages = true;
    degradation.reason.push('Vision budget exhausted');
  }

  if (status.remaining.http <= 50) {
    degradation.skipVision = true;
    degradation.skipImages = true;
    degradation.skipNewHoldings = true;
    degradation.reason.push('HTTP budget critical');

    if (status.remaining.http <= 20) {
      degradation.useCacheOnly = true;
      degradation.reason.push('HTTP budget nearly exhausted - cache only');
    }
  }

  if (status.remaining.fmp <= 10) {
    degradation.limitTickers = true;
    degradation.maxTickers = 10;
    degradation.reason.push('FMP budget limited');
  }

  if (degradation.reason.length > 0) {
    logWarn('budget', 'Operating in degraded mode', degradation);
  }

  return degradation;
}

function applyTickerDegradation(tickers) {
  const degradation = getDegradationMode();

  if (degradation.limitTickers && degradation.maxTickers) {
    return tickers.slice(0, degradation.maxTickers);
  }

  return tickers;
}

function shouldSkipVision() {
  const visionEnabled = getConfigValue(CONFIG_KEYS.VISION_ENABLED, false);
  if (!visionEnabled) return true;

  const degradation = getDegradationMode();
  return degradation.skipVision;
}

function shouldSkipImages() {
  const degradation = getDegradationMode();
  return degradation.skipImages;
}

function getBudgetDate_() {
  try {
    const props = PropertiesService.getScriptProperties();
    return props.getProperty(BUDGET_DATE_KEY) || '';
  } catch (e) {
    return '';
  }
}

function setBudgetDate_(date) {
  try {
    const props = PropertiesService.getScriptProperties();
    props.setProperty(BUDGET_DATE_KEY, date);
  } catch (e) {
    logWarn('budget', 'Could not persist budget date: ' + e.message);
  }
}

function resetBudgetCounters_() {
  RUNTIME_CACHE.budgetCounters = {
    http_requests_total: 0,
    provider_requests_yahoo: 0,
    provider_requests_finnhub: 0,
    provider_requests_fmp: 0,
    vision_requests: 0
  };

  saveBudgetCounters_();
}

function loadBudgetCounters_() {
  try {
    const props = PropertiesService.getScriptProperties();
    const stored = props.getProperty(BUDGET_PROPERTY_KEY);

    if (stored) {
      const parsed = JSON.parse(stored);
      RUNTIME_CACHE.budgetCounters = { ...RUNTIME_CACHE.budgetCounters, ...parsed };
    }
  } catch (e) {
    logWarn('budget', 'Could not load budget counters: ' + e.message);
  }
}

function saveBudgetCounters_() {
  try {
    const props = PropertiesService.getScriptProperties();
    props.setProperty(BUDGET_PROPERTY_KEY, JSON.stringify(RUNTIME_CACHE.budgetCounters));
  } catch (e) {
    logWarn('budget', 'Could not persist budget counters: ' + e.message);
  }
}

function checkShouldContinue() {
  const status = checkBudgetStatus();

  if (status.remaining.http <= 10) {
    return { canContinue: false, message: 'HTTP budget exhausted, stopping processing' };
  }

  return { canContinue: true, message: `HTTP remaining: ${status.remaining.http}` };
}

function logBudgetReport() {
  const status = checkBudgetStatus();

  const lines = [
    `Budget Report for ${status.date}`,
    '================================',
    `HTTP Requests: ${status.counters.http_requests_total || 0}/${status.limits.http_total} (${status.percentUsed.http}%)`,
    `  - Yahoo: ${status.counters.provider_requests_yahoo || 0}`,
    `  - Finnhub: ${status.counters.provider_requests_finnhub || 0}`,
    `  - FMP: ${status.counters.provider_requests_fmp || 0}/${status.limits.fmp} (${status.percentUsed.fmp}%)`,
    `Vision Requests: ${status.counters.vision_requests || 0}/${status.limits.vision} (${status.percentUsed.vision}%)`
  ];

  if (status.warnings.length > 0) {
    lines.push('');
    lines.push('Warnings:');
    for (const warning of status.warnings) {
      lines.push(`  - ${warning}`);
    }
  }

  logInfo('budget', lines.join('\n'));
}

// ==================================================
// SECCION 20: SETUP Y CONFIGURACION INICIAL
// ==================================================

function setupAll() {
  logOperationStart('setupAll', {});

  try {
    setupSheets();
    setupDefaultConfig();
    seedEtfsUniverse();
    setupDriveFolders();
    warmUpTestCalls();
    setupTriggers();

    logInfo('setup', 'System setup complete!');
    logOperationEnd('setupAll', { success: true });

    return { success: true, message: 'Setup complete!' };

  } catch (e) {
    logException('setup', 'setupAll', e);
    return { success: false, error: e.message };
  }
}

function setupSheets() {
  logInfo('setup', 'Creating sheets...');

  for (const sheetName of Object.values(SHEET_NAMES)) {
    const columns = COLUMNS[sheetName];

    if (!columns) {
      logWarn('setup', `No column definition for ${sheetName}, skipping`);
      continue;
    }

    const sheet = getOrCreateSheet(sheetName);

    if (sheet.getLastRow() > 0) {
      const existingHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
      const headersMatch = columns.every((col, i) => existingHeaders[i] === col);

      if (!headersMatch) {
        logWarn('setup', `Headers mismatch in ${sheetName}, updating...`);
        sheet.getRange(1, 1, 1, columns.length).setValues([columns]);
      }
    } else {
      sheet.appendRow(columns);
      sheet.setFrozenRows(1);
      sheet.getRange(1, 1, 1, columns.length).setFontWeight('bold');
    }

    logDebug('setup', `Sheet ${sheetName} ready`);
  }

  logInfo('setup', 'All sheets created');
}

function setupDefaultConfig() {
  logInfo('setup', 'Setting up default configuration...');

  const sheet = getOrCreateSheet(SHEET_NAMES.CONFIG);

  const existingData = sheet.getDataRange().getValues();
  const existingKeys = new Set();

  for (let i = 1; i < existingData.length; i++) {
    if (existingData[i][0]) {
      existingKeys.add(existingData[i][0]);
    }
  }

  const newRows = [];

  for (const [key, value] of Object.entries(DEFAULT_CONFIG)) {
    if (!existingKeys.has(key)) {
      const note = getConfigNote_(key);
      newRows.push([key, value, note]);
    }
  }

  const apiKeyPlaceholders = [
    [CONFIG_KEYS.FINNHUB_TOKEN, '', 'Get from https://finnhub.io/'],
    [CONFIG_KEYS.FMP_KEY, '', 'Get from https://financialmodelingprep.com/'],
    [CONFIG_KEYS.GCV_API_KEY, '', 'Get from Google Cloud Console (Vision API)']
  ];

  for (const [key, value, note] of apiKeyPlaceholders) {
    if (!existingKeys.has(key)) {
      newRows.push([key, value, note]);
    }
  }

  if (newRows.length > 0) {
    const startRow = sheet.getLastRow() + 1;
    sheet.getRange(startRow, 1, newRows.length, 3).setValues(newRows);
  }

  clearConfigCache();

  logInfo('setup', `Added ${newRows.length} config entries`);
}

function getConfigNote_(key) {
  const notes = {
    [CONFIG_KEYS.TIMEZONE]: 'Timezone for date calculations',
    [CONFIG_KEYS.HOLDINGS_TOP_N]: 'Number of top holdings to track per ETF',
    [CONFIG_KEYS.HOLDINGS_REFRESH_DAYS]: 'Days between holdings refresh',
    [CONFIG_KEYS.PRICE_LOOKBACK_DAYS]: 'Days of price history to maintain',
    [CONFIG_KEYS.SUPPORT_NEAR_PCT]: 'Percentage threshold for near support',
    [CONFIG_KEYS.EXTREME_PCT_ABOVE20]: 'Threshold for extreme pct above SMA20',
    [CONFIG_KEYS.EXTREME_PCT_ABOVE50]: 'Threshold for extreme pct above SMA50',
    [CONFIG_KEYS.REQUIRE_GIRO]: 'Require breadth uptick for ENTER signal',
    [CONFIG_KEYS.VISION_ENABLED]: 'Enable vision layer',
    [CONFIG_KEYS.Z_METHOD]: 'Z-score method: STD or ROBUST'
  };

  return notes[key] || '';
}

function seedEtfsUniverse() {
  logInfo('setup', 'Seeding ETF universe...');

  const sheet = getOrCreateSheet(SHEET_NAMES.ETFS);

  const existingData = sheet.getDataRange().getValues();
  const existingEtfs = new Set();

  for (let i = 1; i < existingData.length; i++) {
    if (existingData[i][0]) {
      existingEtfs.add(existingData[i][0]);
    }
  }

  const newRows = [];

  for (const etfInfo of ETF_UNIVERSE) {
    if (!existingEtfs.has(etfInfo.etf)) {
      newRows.push({
        etf: etfInfo.etf,
        nombre: etfInfo.nombre,
        enabled: true,
        holdings_source_primary: DATA_SOURCES.HOLDINGS.FINNHUB,
        holdings_source_fallback: DATA_SOURCES.HOLDINGS.ISSUER_FILE,
        price_source_primary: DATA_SOURCES.PRICES.YAHOO_CHART,
        price_source_fallback: DATA_SOURCES.PRICES.FINNHUB_CANDLES,
        notes: etfInfo.sector
      });
    }
  }

  if (newRows.length > 0) {
    batchWrite(SHEET_NAMES.ETFS, newRows);
  }

  logInfo('setup', `Added ${newRows.length} ETFs`);
}

function setupDriveFolders() {
  logInfo('setup', 'Setting up Drive folders...');

  try {
    const rootFolderName = DRIVE_FOLDERS.ROOT;
    const existingFolders = DriveApp.getFoldersByName(rootFolderName);

    if (!existingFolders.hasNext()) {
      DriveApp.createFolder(rootFolderName);
      logInfo('setup', `Created Drive folder: ${rootFolderName}`);
    }
  } catch (e) {
    logWarn('setup', `Could not set up Drive folders: ${e.message}`);
  }
}

function warmUpTestCalls() {
  logInfo('setup', 'Testing API endpoints...');

  const results = {};

  results.yahoo = testYahooAvailability();
  setConfigValue(CONFIG_KEYS.YAHOO_OK, results.yahoo.available, results.yahoo.message);

  results.finnhubCandles = testFinnhubCandlesAvailability();
  setConfigValue(CONFIG_KEYS.FINNHUB_CANDLES_OK, results.finnhubCandles.available, results.finnhubCandles.message);

  results.finnhubHoldings = testFinnhubHoldingsAvailability();
  setConfigValue(CONFIG_KEYS.FINNHUB_HOLDINGS_OK, results.finnhubHoldings.available, results.finnhubHoldings.message);

  results.fmp = testFmpAvailability();
  setConfigValue(CONFIG_KEYS.FMP_OK, results.fmp.available, results.fmp.message);

  logInfo('setup', 'API test results:', results);

  return results;
}

function setupTriggers() {
  logInfo('setup', 'Setting up triggers...');

  const existingTriggers = ScriptApp.getProjectTriggers();

  for (const trigger of existingTriggers) {
    const handlerName = trigger.getHandlerFunction();
    if (['runDaily', 'runHoldingsRefresh'].includes(handlerName)) {
      ScriptApp.deleteTrigger(trigger);
    }
  }

  ScriptApp.newTrigger('runDaily').timeBased().everyDays(1).atHour(17).nearMinute(30).create();
  ScriptApp.newTrigger('runHoldingsRefresh').timeBased().onMonthDay(1).atHour(6).create();

  logInfo('setup', 'Triggers created');
}

function removeTriggers() {
  const triggers = ScriptApp.getProjectTriggers();
  for (const trigger of triggers) {
    ScriptApp.deleteTrigger(trigger);
  }
  logInfo('setup', `Removed ${triggers.length} triggers`);
}

function verifySystemHealth() {
  const health = { sheets: {}, config: {}, apiAvailability: {}, budgets: {} };

  for (const sheetName of Object.values(SHEET_NAMES)) {
    const sheet = getSpreadsheet().getSheetByName(sheetName);
    health.sheets[sheetName] = { exists: !!sheet, rows: sheet ? sheet.getLastRow() : 0 };
  }

  health.config.hasFinnhubToken = !!getConfigValue(CONFIG_KEYS.FINNHUB_TOKEN, '');
  health.config.hasFmpKey = !!getConfigValue(CONFIG_KEYS.FMP_KEY, '');

  health.apiAvailability = {
    yahoo: getConfigValue(CONFIG_KEYS.YAHOO_OK, null),
    finnhubCandles: getConfigValue(CONFIG_KEYS.FINNHUB_CANDLES_OK, null),
    finnhubHoldings: getConfigValue(CONFIG_KEYS.FINNHUB_HOLDINGS_OK, null),
    fmp: getConfigValue(CONFIG_KEYS.FMP_OK, null)
  };

  health.budgets = getBudgetCounters();

  logInfo('setup', 'System health check', health);

  return health;
}

function resetDataSheets() {
  const sheetsToReset = [
    SHEET_NAMES.HOLDINGS_SNAPSHOT, SHEET_NAMES.PRICES_DAILY, SHEET_NAMES.BREADTH_DAILY,
    SHEET_NAMES.ETF_TECH_DAILY, SHEET_NAMES.IMAGES, SHEET_NAMES.VISION_SIGNALS,
    SHEET_NAMES.SIGNALS, SHEET_NAMES.LOG
  ];

  for (const sheetName of sheetsToReset) {
    clearSheetData(sheetName);
    logInfo('setup', `Cleared ${sheetName}`);
  }
}

// ==================================================
// SECCION 21: ORCHESTRATOR (Main Entry Points)
// ==================================================

function runDaily() {
  const startTime = Date.now();
  const date = getTodayDateStr();

  logOperationStart('runDaily', { date });
  logInfo('orchestrator', `Starting daily run for ${date}`);

  initBudgetTracking();

  const results = { date: date, holdingsRefreshed: 0, pricesFetched: 0, breadthComputed: 0, techComputed: 0, signalsGenerated: 0, visionAnalyzed: 0, errors: [] };

  try {
    logInfo('orchestrator', 'Step 1: Checking holdings...');
    const holdingsResult = runHoldingsCheckAndRefresh_();
    results.holdingsRefreshed = holdingsResult.refreshed;

    if (!checkShouldContinue().canContinue) {
      throw new Error('Budget exhausted after holdings refresh');
    }

    logInfo('orchestrator', 'Step 2: Building ticker universe...');
    const tickerUniverse = buildTickerUniverse_();
    logInfo('orchestrator', `Ticker universe: ${tickerUniverse.length} tickers`);

    logInfo('orchestrator', 'Step 3: Fetching prices...');
    const pricesResult = fetchAndStorePrices(tickerUniverse);
    results.pricesFetched = pricesResult.success;

    logInfo('orchestrator', 'Step 4: Computing breadth...');
    const breadthResult = computeAndStoreBreadthForAllEtfs(date);
    results.breadthComputed = breadthResult.success;

    logInfo('orchestrator', 'Step 5: Computing technicals...');
    const techResult = computeAndStoreEtfTechForAllEtfs(date);
    results.techComputed = techResult.success;

    logInfo('orchestrator', 'Step 6: Generating signals...');
    const signalsResult = computeAndStoreSignalsForAllEtfs(date);
    results.signalsGenerated = signalsResult.enter + signalsResult.watch;

    const visionEnabled = getConfigValue(CONFIG_KEYS.VISION_ENABLED, false);
    if (visionEnabled && !shouldSkipVision()) {
      logInfo('orchestrator', 'Step 7: Running vision analysis...');
      downloadImagesForCandidates(date);
      const visionResult = runVisionForNewImages(date);
      results.visionAnalyzed = visionResult.analyzed;
      recomputeSignalsWithVision(date);
    } else {
      logInfo('orchestrator', 'Step 7: Vision analysis skipped');
    }

    logInfo('orchestrator', 'Step 8: Exporting report...');
    exportDailyReport(date);

    const durationSec = ((Date.now() - startTime) / 1000).toFixed(1);
    logInfo('orchestrator', `Daily run completed in ${durationSec}s`);
    logInfo('orchestrator', `Results: ${JSON.stringify(results)}`);

    logBudgetReport();

    const enterSignals = getTodayEnterSignals();
    const watchSignals = getTodayWatchSignals();

    logInfo('orchestrator', `ENTER signals: ${enterSignals.length}`);
    for (const sig of enterSignals) {
      logInfo('orchestrator', `  - ${sig.etf}: score=${sig.score}`);
    }

    logInfo('orchestrator', `WATCH signals: ${watchSignals.length}`);
    for (const sig of watchSignals.slice(0, 5)) {
      logInfo('orchestrator', `  - ${sig.etf}: score=${sig.score}`);
    }

  } catch (e) {
    results.errors.push(e.message);
    logException('orchestrator', 'runDaily', e);
  }

  logOperationEnd('runDaily', results);
  return results;
}

function runHoldingsRefresh() {
  logOperationStart('runHoldingsRefresh', {});
  initBudgetTracking();
  const result = refreshAllHoldings();
  logBudgetReport();
  logOperationEnd('runHoldingsRefresh', result);
  return result;
}

function runHoldingsCheckAndRefresh_() {
  const enabledEtfs = getEnabledEtfs();
  const refreshDays = getConfigValue(CONFIG_KEYS.HOLDINGS_REFRESH_DAYS, 30);

  let refreshed = 0;
  let skipped = 0;

  for (const etfConfig of enabledEtfs) {
    const etf = etfConfig.etf;
    const lastDate = getLastHoldingsDate(etf);

    if (!lastDate) {
      try {
        const result = refreshHoldings(etf);
        if (result.holdings && result.holdings.length > 0) refreshed++;
      } catch (e) {
        logException('orchestrator', `refreshHoldings(${etf})`, e);
      }
    } else {
      const daysSince = daysBetween_(lastDate, new Date());
      if (daysSince >= refreshDays) {
        try {
          const result = refreshHoldings(etf);
          if (result.holdings && result.holdings.length > 0 && !result.isStale) refreshed++;
        } catch (e) {
          logException('orchestrator', `refreshHoldings(${etf})`, e);
        }
      } else {
        skipped++;
      }
    }

    if (!checkShouldContinue().canContinue) break;
  }

  return { refreshed, skipped, total: enabledEtfs.length };
}

function buildTickerUniverse_() {
  const enabledEtfs = getEnabledEtfs();
  const tickers = new Set();

  for (const etfConfig of enabledEtfs) {
    tickers.add(etfConfig.etf);
  }

  const allHoldingTickers = getAllUniqueTickers();
  for (const ticker of allHoldingTickers) {
    tickers.add(ticker);
  }

  return Array.from(tickers).sort();
}

function fetchAndStorePrices(tickers) {
  logOperationStart('fetchAndStorePrices', { count: tickers.length });

  const lookbackDays = getConfigValue(CONFIG_KEYS.PRICE_LOOKBACK_DAYS, 140);
  const range = getYahooRangeForDays(lookbackDays);

  let success = 0;
  let failed = 0;

  tickers = applyTickerDegradation(tickers);

  for (const ticker of tickers) {
    if (!checkShouldContinue().canContinue) break;

    const result = fetchPriceWithFallback_(ticker, range);

    if (result.success && result.data && result.data.length > 0) {
      const enhancedData = attachSMAs(result.data, [20, 50, 200]);
      upsertRows(SHEET_NAMES.PRICES_DAILY, enhancedData, ['date', 'ticker']);
      success++;
    } else {
      failed++;
    }

    if (success % 10 === 0) Utilities.sleep(100);
  }

  const summary = { success, failed, total: tickers.length };
  logOperationEnd('fetchAndStorePrices', summary);

  return summary;
}

function fetchPriceWithFallback_(ticker, range) {
  const yahooOk = getConfigValue(CONFIG_KEYS.YAHOO_OK, true);
  if (yahooOk !== false) {
    const yahooResult = fetchYahooChart(ticker, range, '1d');
    if (yahooResult.success && yahooResult.data && yahooResult.data.length > 0) return yahooResult;
  }

  const finnhubOk = getConfigValue(CONFIG_KEYS.FINNHUB_CANDLES_OK, null);
  if (finnhubOk !== false) {
    const toDate = new Date();
    const fromDate = subtractDays_(toDate, parseInt(range.replace(/[^0-9]/g, '')) || 180);
    const finnhubResult = fetchFinnhubCandles(ticker, fromDate, toDate);
    if (finnhubResult.success && finnhubResult.data && finnhubResult.data.length > 0) return finnhubResult;
  }

  const fmpOk = getConfigValue(CONFIG_KEYS.FMP_OK, null);
  const degradation = getDegradationMode();

  if (fmpOk !== false && !degradation.limitTickers) {
    const toDate = formatDateYMD_(new Date());
    const fromDate = formatDateYMD_(subtractDays_(new Date(), 180));
    const fmpResult = fetchFmpEod(ticker, fromDate, toDate);
    if (fmpResult.success && fmpResult.data && fmpResult.data.length > 0) return fmpResult;
  }

  return { success: false, data: null, error: 'All sources failed' };
}

function runForDate(date) {
  if (!date || !date.match(/^\d{4}-\d{2}-\d{2}$/)) {
    throw new Error('Invalid date format. Use YYYY-MM-DD');
  }

  logInfo('orchestrator', `Running pipeline for date: ${date}`);

  const breadthResult = computeAndStoreBreadthForAllEtfs(date);
  const techResult = computeAndStoreEtfTechForAllEtfs(date);
  const signalsResult = computeAndStoreSignalsForAllEtfs(date);

  exportDailyReport(date);

  return { date, breadth: breadthResult, tech: techResult, signals: signalsResult };
}

function testSingleEtf(etf) {
  etf = etf || 'XLK';
  const date = getTodayDateStr();

  logInfo('orchestrator', `Testing single ETF: ${etf}`);

  const holdings = getHoldingsForEtf(etf);
  logInfo('orchestrator', `Holdings: ${holdings.holdings ? holdings.holdings.length : 0}`);

  const breadth = computeBreadthForEtf(etf, date);
  logInfo('orchestrator', `Breadth: pct20=${breadth.pct_above_sma20}, z20=${breadth.z_pct_above_sma20}`);

  const tech = computeEtfTechnicals(etf, date);
  logInfo('orchestrator', `Tech: support=${tech.support_level}, nearSupport=${tech.near_support_flag}`);

  upsertRows(SHEET_NAMES.BREADTH_DAILY, [breadth], ['date', 'etf']);
  upsertRows(SHEET_NAMES.ETF_TECH_DAILY, [tech], ['date', 'etf']);

  const signal = computeSignalForEtf(etf, date);
  logInfo('orchestrator', `Signal: ${signal.final_signal}, score=${signal.score}`);

  return { etf, holdings, breadth, tech, signal };
}

function runDryRun() {
  logInfo('orchestrator', 'Starting DRY-RUN');
  const date = getTodayDateStr();
  const breadthResult = computeAndStoreBreadthForAllEtfs(date);
  const techResult = computeAndStoreEtfTechForAllEtfs(date);
  const signalsResult = computeAndStoreSignalsForAllEtfs(date);
  return { date, breadth: breadthResult, tech: techResult, signals: signalsResult, dryRun: true };
}

function getSystemSummary() {
  const health = verifySystemHealth();
  const budget = checkBudgetStatus();
  const enabledEtfs = getEnabledEtfs();
  const latestSignals = getLatestSignals();

  const enterCount = Object.values(latestSignals).filter(s => s.final_signal === SIGNAL_TYPES.ENTER).length;
  const watchCount = Object.values(latestSignals).filter(s => s.final_signal === SIGNAL_TYPES.WATCH).length;

  return {
    timestamp: new Date().toISOString(),
    etfsEnabled: enabledEtfs.length,
    signalsGenerated: Object.keys(latestSignals).length,
    currentEnter: enterCount,
    currentWatch: watchCount,
    budgetRemaining: budget.remaining,
    apiAvailability: health.apiAvailability
  };
}

function acquireLock_() {
  const props = PropertiesService.getScriptProperties();
  const existing = props.getProperty(LOCK_KEY);

  if (existing) {
    const lockTime = parseInt(existing);
    if (Date.now() - lockTime < LOCK_TIMEOUT_MS) return false;
  }

  props.setProperty(LOCK_KEY, Date.now().toString());
  return true;
}

function releaseLock_() {
  PropertiesService.getScriptProperties().deleteProperty(LOCK_KEY);
}

function runDailySafe() {
  if (!acquireLock_()) return { success: false, error: 'Lock not acquired' };
  try {
    return runDaily();
  } finally {
    releaseLock_();
  }
}

// ==================================================
// FIN - AMPLITUD_TODO.gs
// ==================================================
//
// FUNCIONES PRINCIPALES:
// - setupAll(): Inicializa todo el sistema (ejecutar 1 vez)
// - runDaily(): Pipeline diario completo
// - runHoldingsRefresh(): Actualizar holdings
// - testSingleEtf('XLK'): Probar con un ETF
// - verifySystemHealth(): Verificar estado
// - getSystemSummary(): Resumen del sistema
// ==================================================
