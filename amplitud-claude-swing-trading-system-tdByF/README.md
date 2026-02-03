# Sistema de Swing Trading por Industrias - Amplitud de Mercado

Sistema completo de swing trading basado en amplitud de mercado por ETF, soporte técnico del ETF, y una capa opcional de visión (OCR y reconocimiento de patrones).

## Descripción

Este sistema genera un ranking diario de ETFs industriales/sectoriales clasificándolos como:
- **ENTER**: Momento de compra (ETF cerca de soporte + amplitud interna en desviación extrema + confirmación de giro)
- **WATCH**: Vigilar (una de las condiciones principales cumplidas)
- **NONE**: Sin señal

## Universo de ETFs (31 ETFs)

### Tecnología
- XLK, XSW, XSD

### Utilities & Materiales
- XLU, XLB, XME

### Real Estate
- XLRE

### Industriales
- XAR, XTN, IFRA, XLI

### Healthcare
- XHS, IHF, XBI, XPH, XHE, XLV

### Financiero
- KCE, KIE, XLF, KBE, KRE

### Energía
- XLE, XOP, XES

### Consumo Discrecional
- XLY, XRT, XHB

### Comunicaciones
- XLC, XTL

### Consumo Básico
- XLP

## Instalación

### Requisitos previos
- Google Account con acceso a Google Sheets y Google Apps Script
- (Opcional) API Keys para:
  - Finnhub (https://finnhub.io/)
  - Financial Modeling Prep (https://financialmodelingprep.com/)
  - Google Cloud Vision (para la capa de visión)

### Pasos de instalación

1. **Crear una nueva hoja de cálculo en Google Sheets**

2. **Abrir el editor de Apps Script**
   - Extensiones > Apps Script

3. **Copiar todos los archivos .gs**
   - Copiar el contenido de cada archivo en `src/` al proyecto de Apps Script
   - Mantener los nombres de archivo (sin la extensión .gs)

4. **Ejecutar la configuración inicial**
   ```javascript
   setupAll()
   ```
   Esta función:
   - Crea todas las hojas necesarias
   - Configura valores por defecto
   - Carga el universo de ETFs
   - Crea carpetas en Drive
   - Prueba disponibilidad de APIs
   - Configura triggers automáticos

5. **Configurar API Keys** (en la hoja CONFIG)
   - `FINNHUB_TOKEN`: Tu token de Finnhub
   - `FMP_KEY`: Tu API key de FMP
   - `GCV_API_KEY`: (Opcional) Tu API key de Google Cloud Vision

## Estructura de Hojas

| Hoja | Descripción |
|------|-------------|
| CONFIG | Configuración del sistema |
| ETFS | Lista de ETFs y fuentes de datos |
| HOLDINGS_SNAPSHOT | Snapshots de holdings por ETF |
| PRICES_DAILY | Precios OHLC diarios |
| BREADTH_DAILY | Métricas de amplitud por ETF |
| ETF_TECH_DAILY | Datos técnicos del ETF (soporte, SMAs) |
| IMAGES | Registro de imágenes descargadas |
| VISION_SIGNALS | Señales de la capa de visión |
| SIGNALS | Señales finales de trading |
| LOG | Log del sistema |
| MANUAL_HOLDINGS | Holdings manuales (fallback) |

## Configuración Principal

| Clave | Descripción | Valor por defecto |
|-------|-------------|-------------------|
| TIMEZONE | Zona horaria | America/New_York |
| HOLDINGS_TOP_N | Holdings a trackear por ETF | 30 |
| HOLDINGS_REFRESH_DAYS | Días entre actualización de holdings | 30 |
| PRICE_LOOKBACK_DAYS | Días de historial de precios | 140 |
| Z_WINDOW_DAYS | Ventana para cálculo de Z-score | 252 |
| SUPPORT_NEAR_PCT | Umbral "cerca de soporte" | 0.015 (1.5%) |
| EXTREME_Z20 | Z-score umbral para SMA20 | -1.8 |
| EXTREME_Z50 | Z-score umbral para SMA50 | -1.8 |
| REQUIRE_GIRO | Requerir giro (uptick) para ENTER | TRUE |
| VISION_ENABLED | Activar capa de visión | FALSE |

## Fuentes de Datos

### Precios (con fallback automático)
1. **Yahoo Finance** (primario) - No requiere API key
2. **Finnhub** - Requiere API key
3. **Financial Modeling Prep** - Requiere API key (250 calls/día en free)

### Holdings
1. **Finnhub** - Disponibilidad depende del plan
2. **Archivos oficiales del emisor** - SPDR, iShares
3. **Manual** - Configuración en MANUAL_HOLDINGS

### Imágenes (opcional)
- FINVIZ (por defecto)
- FINBIT (configurable)
- Internal Charts (generación propia)

## Capa Estadística Avanzada

El sistema implementa análisis estadístico robusto:

- **Z-score clásico** (mean/stdev) o **Z-score robusto** (median/MAD)
- **Percentiles** históricos
- **Winsorización** para reducir impacto de outliers
- **Detección de persistencia** (condición extrema N días)
- **Detección de reversión/giro** (uptick mínimo o cruce de nivel)
- **Estabilidad de holdings** (flag de régimen cuando cambian holdings)

## Uso

### Ejecución diaria automática
El trigger `runDaily` se ejecuta automáticamente después del cierre del mercado.

### Ejecución manual
```javascript
// Ejecutar pipeline completo
runDaily()

// Probar un ETF específico
testSingleEtf('XLK')

// Ejecutar en modo dry-run (sin llamadas API)
runDryRun()

// Ver estado del sistema
logSystemSummary()

// Ver presupuesto de API
logBudgetReport()
```

### Añadir nuevos ETFs
1. Agregar fila en la hoja ETFS
2. Configurar `enabled=TRUE`
3. El sistema los incluirá en la próxima ejecución

### Cambiar fuentes de datos
1. Modificar columnas `holdings_source_primary/fallback` y `price_source_primary/fallback` en ETFS
2. O modificar valores globales en CONFIG

### Activar capa de visión
1. Configurar `GCV_API_KEY` en CONFIG
2. Cambiar `VISION_ENABLED` a TRUE
3. Configurar `IMAGE_PROVIDER` (FINVIZ, FINBIT, o INTERNAL_CHARTS)

## Lógica de Señales

### Condiciones para ENTER
- `near_support`: ETF cerca de nivel de soporte (≤1.5% por defecto)
- `breadth_extreme`: Amplitud en extremo (Z-score o percentil)
- `giro_ok`: Confirmación de giro (breadth subiendo)
- `trend_ok`: Tendencia OK (close > SMA200 por defecto)
- `vision_ok`: (Opcional) Visión no bearish

### Score para ranking
```
score = 0.6 * extreme_score + 0.4 * support_score
```
- `extreme_score`: Basado en Z-scores combinados
- `support_score`: Cercanía al soporte

## Gestión de Presupuesto

El sistema trackea y limita:
- Requests HTTP totales (default: 500/día)
- Requests de Vision API (default: 20/día)
- Requests a FMP (límite 250/día en free)

Degradación automática cuando se agotan presupuestos.

## Estructura de Archivos

```
src/
├── 00_constants.gs      # Constantes y configuración
├── 01_logger.gs         # Sistema de logging
├── 02_storage.gs        # Helpers de almacenamiento
├── 03_http.gs           # Cliente HTTP con retry/rate-limit
├── 04_prices_yahoo.gs   # Fetcher Yahoo Finance
├── 05_prices_finnhub.gs # Fetcher Finnhub
├── 06_prices_fmp.gs     # Fetcher FMP
├── 07_indicators.gs     # Indicadores técnicos (SMA, etc.)
├── 08_holdings_finnhub.gs    # Holdings desde Finnhub
├── 09_holdings_issuer_file.gs # Holdings desde emisor
├── 10_holdings_manager.gs    # Gestor de holdings
├── 11_breadth.gs        # Cálculo de amplitud
├── 12_support_pivots.gs # Detección de soportes
├── 13_signals.gs        # Generación de señales
├── 14_images.gs         # Gestión de imágenes
├── 15_vision.gs         # Capa de visión/OCR
├── 16_setup.gs          # Setup del sistema
├── 17_statistics_advanced.gs # Estadísticas avanzadas
├── 18_budget_manager.gs # Gestión de presupuesto
└── 19_orchestrator.gs   # Orquestador principal
```

## Revisar el LOG

La hoja LOG contiene todos los eventos del sistema:
- INFO: Información general
- WARN: Advertencias (fallbacks, datos faltantes)
- ERROR: Errores que requieren atención
- DEBUG: Información detallada (modo desarrollo)

## Solución de Problemas

### "No holdings for ETF X"
- Verificar que el ETF existe en la hoja ETFS con `enabled=TRUE`
- Revisar LOG para errores de API
- Añadir holdings manualmente en MANUAL_HOLDINGS

### "Insufficient price data"
- Verificar conexión a APIs
- Revisar flags `YAHOO_OK`, `FINNHUB_CANDLES_OK`, `FMP_OK` en CONFIG
- Ejecutar `warmUpTestCalls()` para re-probar APIs

### "Budget exhausted"
- Esperar al día siguiente para reset automático
- O ejecutar `resetBudgetCountersManual()` para reset manual
- Considerar aumentar límites en CONFIG

## Licencia

Sistema desarrollado para uso personal de trading. No constituye asesoría financiera.
