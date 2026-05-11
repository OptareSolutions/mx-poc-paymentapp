#!/usr/bin/env node
/**
 * compare-baseline.js — Compara resultados de load test vs baseline de smoke/load
 *
 * Detecta regresiones de rendimiento con umbrales configurables.
 * La regresión se define como deterioro > REGRESSION_THRESHOLD respecto al baseline.
 *
 * Uso:
 *   node utils/compare-baseline.js \
 *     --current   resultados/load_test_latest.json \
 *     --baseline  resultados/load_test_baseline.json \
 *     --output    reportes/comparison_report.md \
 *     [--threshold 0.20]
 *
 * Exit codes:
 *   0 — Sin regresiones, todos los thresholds OK
 *   1 — Regresiones detectadas o thresholds fallidos
 *   2 — Error de argumentos o archivos no encontrados
 */

const fs   = require('fs');
const path = require('path');

// ── Parse arguments ───────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const get  = (flag) => { const i = args.indexOf(flag); return i !== -1 ? args[i + 1] : null; };

const currentFile       = get('--current');
const baselineFile      = get('--baseline');
const outputFile        = get('--output');
const regressionPct     = parseFloat(get('--threshold') || '0.20');
const improvementPct    = 0.05;

if (!currentFile || !baselineFile) {
  console.error('Error: --current y --baseline son obligatorios');
  process.exit(2);
}

// ── Load data ─────────────────────────────────────────────────────────────────
function loadResult(filePath) {
  if (!fs.existsSync(filePath)) return null;
  try { return JSON.parse(fs.readFileSync(filePath, 'utf8')); }
  catch (e) { console.error(`Error al leer ${filePath}: ${e.message}`); return null; }
}

const current  = loadResult(currentFile);
const baseline = loadResult(baselineFile);

if (!current) {
  console.error(`No se encontró resultado actual: ${currentFile}`);
  process.exit(2);
}

// ── Métricas a comparar ───────────────────────────────────────────────────────
const METRICS = [
  { key: 'flujo_completo_p95_ms', label: 'Flujo Completo p95',      limit: 8000,  unit: 'ms',  lowerIsBetter: true },
  { key: 'flujo_completo_p99_ms', label: 'Flujo Completo p99',      limit: 15000, unit: 'ms',  lowerIsBetter: true },
  { key: 'login_p95_ms',          label: 'Focalizar Cliente p95',   limit: 2000,  unit: 'ms',  lowerIsBetter: true },
  { key: 'consulta_p95_ms',       label: 'Consulta + Operador p95', limit: 2500,  unit: 'ms',  lowerIsBetter: true },
  { key: 'pago_p95_ms',           label: 'Registrar Pago p95',      limit: 3000,  unit: 'ms',  lowerIsBetter: true },
  { key: 'recibo_p95_ms',         label: 'Emitir Recibo p95',       limit: 3000,  unit: 'ms',  lowerIsBetter: true },
  { key: 'error_rate',            label: 'Error Rate',              limit: 0.02,  unit: '%',   lowerIsBetter: true, multiplier: 100 },
];

// ── Comparison logic ──────────────────────────────────────────────────────────
function fmt(val, unit, mult = 1) {
  if (val === null || val === undefined) return 'N/A';
  return `${(val * mult).toFixed(unit === '%' ? 2 : 0)} ${unit}`;
}

function getStatus(cur, base, limit, lowerIsBetter) {
  const pass = lowerIsBetter ? cur <= limit : cur >= limit;
  if (!pass) return { code: 'THRESHOLD_FAIL', icon: '❌', label: `FALLA THRESHOLD` };
  if (base === null || base === undefined) return { code: 'OK', icon: '✅', label: 'OK (sin baseline)' };

  const delta = (cur - base) / base;
  if (lowerIsBetter) {
    if (delta >  regressionPct)   return { code: 'REGRESSION', icon: '⚠️',  label: `REGRESIÓN (+${(delta*100).toFixed(1)}%)` };
    if (delta < -improvementPct)  return { code: 'IMPROVEMENT',icon: '🟢', label: `MEJORA (${(delta*100).toFixed(1)}%)` };
  } else {
    if (delta < -regressionPct)   return { code: 'REGRESSION', icon: '⚠️',  label: `REGRESIÓN (${(delta*100).toFixed(1)}%)` };
    if (delta >  improvementPct)  return { code: 'IMPROVEMENT',icon: '🟢', label: `MEJORA (+${(delta*100).toFixed(1)}%)` };
  }
  return { code: 'STABLE', icon: '✅', label: 'ESTABLE' };
}

const rows = METRICS.map((m) => {
  const cur  = current.metrics?.[m.key];
  const base = baseline?.metrics?.[m.key];
  const mult = m.multiplier ?? 1;

  const delta = (cur != null && base != null) ? (cur - base) / base : null;
  const status = (cur != null) ? getStatus(cur, base, m.limit, m.lowerIsBetter) : { code: 'UNKNOWN', icon: '❓', label: 'Sin datos' };

  return {
    ...m,
    curFmt:  fmt(cur,  m.unit, mult),
    baseFmt: base != null ? fmt(base, m.unit, mult) : 'Sin baseline',
    delta:   delta != null ? `${delta > 0 ? '+' : ''}${(delta*100).toFixed(1)}%` : '-',
    limitFmt: fmt(m.limit, m.unit, mult),
    status,
    hasIssue: status.code === 'REGRESSION' || status.code === 'THRESHOLD_FAIL',
  };
});

const hasRegression    = rows.some(r => r.hasIssue);
const runInfo = {
  current:  { id: current.run_id  || 'local', ts: current.timestamp  || '-', config: current.config  || {} },
  baseline: { id: baseline?.run_id || '-',     ts: baseline?.timestamp || '-', config: baseline?.config || {} },
};

// ── Console output ────────────────────────────────────────────────────────────
console.log('\n╔═════════════════════════════════════════════════════════════════════╗');
console.log('║         PaymentBox — Comparación Load Test vs Baseline              ║');
console.log('╠═════════════════════════════════════════════════════════════════════╣');
console.log(`║  Ejecución actual : ${runInfo.current.id.padEnd(51)}║`);
console.log(`║  Timestamp actual : ${runInfo.current.ts.padEnd(51)}║`);
console.log(`║  Baseline         : ${runInfo.baseline.id.padEnd(51)}║`);
console.log(`║  Threshold regres : >${(regressionPct*100).toFixed(0)}%${' '.repeat(48)}║`);
console.log('╠═════════════════════════════════════════════════════════════════════╣');
console.log('║  Métrica                     │ Actual    │ Baseline  │ Δ       │ Estado   ║');
console.log('╠═════════════════════════════════════════════════════════════════════╣');
rows.forEach(r => {
  console.log(`║  ${r.label.padEnd(28)} │ ${r.curFmt.padEnd(9)} │ ${r.baseFmt.padEnd(9)} │ ${r.delta.padEnd(7)} │ ${r.status.icon} ${r.status.label}`);
});
console.log('╚═════════════════════════════════════════════════════════════════════╝');

if (hasRegression) {
  console.log('\n⚠️  Se detectaron regresiones o fallos de threshold. Revisión requerida.\n');
} else {
  console.log('\n✅ Sin regresiones. Todos los thresholds cumplen.\n');
}

// ── Markdown report ───────────────────────────────────────────────────────────
if (outputFile) {
  const md = `# 📊 PaymentBox — Reporte Comparación Load Test

| Campo | Valor |
|-------|-------|
| Ejecución actual | \`${runInfo.current.id}\` (${runInfo.current.ts}) |
| Config actual | ${runInfo.current.config.max_vus || '-'} VUs × ${runInfo.current.config.duration_s || '-'}s |
| Baseline | \`${runInfo.baseline.id}\` (${runInfo.baseline.ts}) |
| Config baseline | ${runInfo.baseline.config.max_vus || '-'} VUs × ${runInfo.baseline.config.duration_s || '-'}s |
| Resultado | ${hasRegression ? '⚠️ **REGRESIONES DETECTADAS**' : '✅ **SIN REGRESIONES**'} |
| Umbral regresión | >${(regressionPct*100).toFixed(0)}% deterioro |

## Métricas de Rendimiento

| Métrica | Actual | Baseline | Δ | Límite | Estado |
|---------|--------|----------|---|--------|--------|
${rows.map(r => `| ${r.label} | ${r.curFmt} | ${r.baseFmt} | ${r.delta} | ${r.limitFmt} | ${r.status.icon} ${r.status.label} |`).join('\n')}

## Criterios

- **Regresión**: deterioro > ${(regressionPct*100).toFixed(0)}% respecto al baseline
- **Mejora notable**: mejora > ${(improvementPct*100).toFixed(0)}%
- **Falla threshold**: métrica supera el límite de carga configurado

---
*Generado por compare-baseline.js — AT&T PaymentBox PoC*
`;

  fs.mkdirSync(path.dirname(outputFile), { recursive: true });
  fs.writeFileSync(outputFile, md, 'utf8');
  console.log(`📄 Reporte Markdown escrito en: ${outputFile}`);
}

process.exit(hasRegression ? 1 : 0);
