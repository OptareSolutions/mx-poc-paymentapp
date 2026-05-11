#!/usr/bin/env node
/**
 * compare-results.js — Compara resultados k6 actuales vs baseline histórico
 *
 * Uso:
 *   node scripts/compare-results.js \
 *     --current  tests/k6/results/smoke_performance_latest.json \
 *     --baseline tests/k6/results/baseline.json \
 *     --output   tests/k6/results/comparison_report.md
 *
 * Salida:
 *   - Imprime resumen en stdout
 *   - Escribe reporte Markdown si se especifica --output
 *   - Exit code 1 si hay regresión (> 20% deterioro en cualquier métrica clave)
 */

const fs   = require('fs');
const path = require('path');

// ── Parse arguments ───────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const get  = (flag) => {
  const i = args.indexOf(flag);
  return i !== -1 ? args[i + 1] : null;
};

const currentFile  = get('--current');
const baselineFile = get('--baseline');
const outputFile   = get('--output');

if (!currentFile || !baselineFile) {
  console.error('Error: --current y --baseline son obligatorios');
  process.exit(2);
}

// ── Load data ─────────────────────────────────────────────────────────────────
function loadResult(filePath) {
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (e) {
    console.error(`Error al leer ${filePath}: ${e.message}`);
    return null;
  }
}

const current  = loadResult(currentFile);
const baseline = loadResult(baselineFile);

if (!current) {
  console.error(`No se encontró resultado actual: ${currentFile}`);
  process.exit(2);
}

// ── Comparison logic ──────────────────────────────────────────────────────────
const REGRESSION_THRESHOLD = 0.20; // 20% de degradación = regresión
const IMPROVEMENT_THRESHOLD = 0.05; // 5% mejora = notable

const METRICS_CONFIG = [
  { key: 'flujo_completo_p95_ms', label: 'Flujo Completo p95',  limit: 3000, unit: 'ms', lowerIsBetter: true },
  { key: 'login_p95_ms',          label: 'Login p95',           limit: 700,  unit: 'ms', lowerIsBetter: true },
  { key: 'consulta_p95_ms',       label: 'Consulta p95',        limit: 900,  unit: 'ms', lowerIsBetter: true },
  { key: 'pago_p95_ms',           label: 'Actualización p95',   limit: 1200, unit: 'ms', lowerIsBetter: true },
  { key: 'error_rate',            label: 'Error Rate',          limit: 0.01, unit: '%',  lowerIsBetter: true, multiplier: 100 },
];

function formatValue(val, unit, multiplier = 1) {
  if (val === null || val === undefined) return 'N/A';
  return `${(val * multiplier).toFixed(unit === '%' ? 2 : 0)} ${unit}`;
}

function getDeltaSymbol(delta, lowerIsBetter) {
  if (Math.abs(delta) < 0.02) return '→'; // neutro (< 2%)
  if (lowerIsBetter) {
    return delta > 0 ? '↑' : '↓';
  }
  return delta > 0 ? '↑' : '↓';
}

function getStatus(currentVal, baselineVal, limit, lowerIsBetter) {
  const thresholdOk = lowerIsBetter ? currentVal <= limit : currentVal >= limit;

  if (!thresholdOk) return '❌ FALLA_THRESHOLD';

  if (baselineVal === null || baselineVal === undefined) return '✅ OK (sin baseline)';

  const delta = (currentVal - baselineVal) / baselineVal;

  if (lowerIsBetter) {
    if (delta > REGRESSION_THRESHOLD)  return `⚠️  REGRESIÓN (+${(delta * 100).toFixed(1)}%)`;
    if (delta < -IMPROVEMENT_THRESHOLD) return `✅ MEJORA (${(delta * 100).toFixed(1)}%)`;
    return '✅ ESTABLE';
  } else {
    if (delta < -REGRESSION_THRESHOLD) return `⚠️  REGRESIÓN (${(delta * 100).toFixed(1)}%)`;
    if (delta > IMPROVEMENT_THRESHOLD) return `✅ MEJORA (+${(delta * 100).toFixed(1)}%)`;
    return '✅ ESTABLE';
  }
}

// ── Build comparison rows ─────────────────────────────────────────────────────
const rows = METRICS_CONFIG.map((m) => {
  const cur  = current.metrics?.[m.key];
  const base = baseline?.metrics?.[m.key];
  const mult = m.multiplier ?? 1;

  const curFmt  = formatValue(cur,  m.unit, mult);
  const baseFmt = base !== undefined ? formatValue(base, m.unit, mult) : 'Sin baseline';

  let delta = null;
  if (cur !== null && cur !== undefined && base !== null && base !== undefined) {
    delta = (cur - base) / base;
  }

  const status = getStatus(cur, base, m.limit, m.lowerIsBetter);
  const sym    = delta !== null ? getDeltaSymbol(delta, m.lowerIsBetter) : '-';

  return {
    label: m.label,
    current: curFmt,
    baseline: baseFmt,
    delta: delta !== null ? `${sym} ${(delta * 100).toFixed(1)}%` : '-',
    limit: formatValue(m.limit, m.unit, mult),
    status,
    hasRegression: status.includes('REGRESIÓN') || status.includes('FALLA'),
  };
});

const hasRegression = rows.some((r) => r.hasRegression);
const runInfo = {
  currentRun:  current.run_id   || 'desconocido',
  currentTime: current.timestamp || 'desconocido',
  baselineRun: baseline?.run_id  || 'sin baseline',
  baselineTime:baseline?.timestamp || 'sin baseline',
};

// ── Console output ────────────────────────────────────────────────────────────
console.log('\n╔══════════════════════════════════════════════════════════════════╗');
console.log('║     PaymentBox — Comparación de Resultados k6                    ║');
console.log('╠══════════════════════════════════════════════════════════════════╣');
console.log(`║  Ejecución actual : ${runInfo.currentRun.padEnd(45)}║`);
console.log(`║  Baseline         : ${runInfo.baselineRun.padEnd(45)}║`);
console.log('╠══════════════════════════════════════════════════════════════════╣');
console.log('║  Métrica                  │ Actual    │ Baseline  │ Δ       │ Estado        ║');
console.log('╠══════════════════════════════════════════════════════════════════╣');

rows.forEach((r) => {
  const label  = r.label.padEnd(25);
  const cur    = r.current.padEnd(9);
  const base   = r.baseline.padEnd(9);
  const delta  = r.delta.padEnd(7);
  console.log(`║  ${label} │ ${cur} │ ${base} │ ${delta} │ ${r.status}`);
});

console.log('╚══════════════════════════════════════════════════════════════════╝');

if (hasRegression) {
  console.log('\n⚠️  Se detectaron regresiones o fallos de threshold. Revisión requerida.\n');
} else {
  console.log('\n✅ Sin regresiones detectadas. Todos los thresholds cumplen.\n');
}

// ── Markdown report ───────────────────────────────────────────────────────────
if (outputFile) {
  const md = `# 📊 PaymentBox — Reporte de Comparación k6

| Campo | Valor |
|-------|-------|
| Ejecución actual | \`${runInfo.currentRun}\` (${runInfo.currentTime}) |
| Baseline | \`${runInfo.baselineRun}\` (${runInfo.baselineTime}) |
| Resultado | ${hasRegression ? '⚠️ **REGRESIONES DETECTADAS**' : '✅ **SIN REGRESIONES**'} |

## Métricas de Rendimiento

| Métrica | Actual | Baseline | Δ | Límite | Estado |
|---------|--------|----------|---|--------|--------|
${rows.map((r) =>
  `| ${r.label} | ${r.current} | ${r.baseline} | ${r.delta} | ${r.limit} | ${r.status} |`
).join('\n')}

## Criterios de Evaluación

- **Regresión**: deterioro > 20% respecto al baseline
- **Mejora notable**: mejora > 5% respecto al baseline
- **Falla de threshold**: métrica supera el límite configurado

## Definición de Thresholds

| Métrica | Límite |
|---------|--------|
| Flujo completo p95 | < 3000 ms |
| Login p95 (focalizar cliente) | < 700 ms |
| Consulta p95 (montos + operador) | < 900 ms |
| Actualización p95 (registrar pago) | < 1200 ms |
| Error rate | < 1% |

---
*Generado automáticamente por compare-results.js*
`;

  fs.mkdirSync(path.dirname(outputFile), { recursive: true });
  fs.writeFileSync(outputFile, md, 'utf8');
  console.log(`📄 Reporte escrito en: ${outputFile}`);
}

// ── Exit code ─────────────────────────────────────────────────────────────────
process.exit(hasRegression ? 1 : 0);
