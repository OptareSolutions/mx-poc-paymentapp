/**
 * k6 Load Performance Test — PaymentBox Telco Operator
 * Suite de carga: 2000 VUs durante 3600 segundos (1 hora)
 *
 * Flujo E2E de 8 pasos encadenados con transporte de IDs:
 *   Paso 2: Focalizar cliente    → GET  /api/clientes/buscar
 *   Paso 3: Consultar montos DB  → GET  /api/recargas/montos
 *   Paso 4: Validar operador     → POST /api/recargas/validar-operador
 *   Paso 5: Métodos de pago      → GET  /api/pagos/metodos
 *   Pasos 6+7: Registrar pago    → POST /api/pagos/registrar
 *   Paso 8: Emitir recibo        → POST /api/recibos/emitir
 *
 * Ejecución local:
 *   k6 run scripts/load_test_2k_vus.js
 *
 * Ejecución CI (GitHub Actions):
 *   k6 run --env BASE_URL=http://api-host:8080 \
 *          --env ENVIRONMENT=qa \
 *          --env MAX_VUS=2000 \
 *          --env DURATION_S=3600 \
 *          scripts/load_test_2k_vus.js
 *
 * Estrategia de carga (ramped-vus):
 *   0s–300s   : Ramp-up  0   → 2000 VUs  (5 min)
 *   300s–3300s: Steady   2000 VUs        (50 min)
 *   3300s–3600s: Ramp-down 2000 → 0 VUs (5 min)
 *
 * Thresholds (carga alta):
 *   - Flujo completo p95 < 8s
 *   - Login p95          < 2s
 *   - Consulta p95       < 2.5s
 *   - Pago p95           < 3s
 *   - Error rate         < 2%
 */

import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';
import { SharedArray } from 'k6/data';
import { randomIntBetween } from 'https://jslib.k6.io/k6-utils/1.4.0/index.js';

// ── Datos de prueba parametrizados ───────────────────────────────────────────
const users = new SharedArray('users', function () {
  return JSON.parse(open('./data/users_2k.json'));
});

// ── Métricas personalizadas ───────────────────────────────────────────────────
const errorRate           = new Rate('load_errors');
const loginLatencia       = new Trend('login_latencia_ms',        true);
const consultaLatencia    = new Trend('consulta_latencia_ms',     true);
const pagoLatencia        = new Trend('pago_latencia_ms',         true);
const reciboLatencia      = new Trend('recibo_latencia_ms',       true);
const flujoCompleto       = new Trend('flujo_completo_ms',        true);
const flujosExitosos      = new Counter('flujos_exitosos');
const flujosFallidos      = new Counter('flujos_fallidos');
const foliosGenerados     = new Counter('folios_generados');

// ── Configuración del test ────────────────────────────────────────────────────
const MAX_VUS    = parseInt(__ENV.MAX_VUS    || '2000');
const DURATION_S = parseInt(__ENV.DURATION_S || '3600');
const RAMP_S     = 300; // 5 minutos de ramp-up y ramp-down

export const options = {
  scenarios: {
    carga_sostenida: {
      executor: 'ramped-vus',
      stages: [
        { duration: `${RAMP_S}s`,               target: MAX_VUS  }, // Ramp-up
        { duration: `${DURATION_S - 2*RAMP_S}s`, target: MAX_VUS  }, // Sostenida
        { duration: `${RAMP_S}s`,               target: 0        }, // Ramp-down
      ],
      gracefulRampDown: '60s',
    },
  },
  thresholds: {
    // Flujo E2E completo
    flujo_completo_ms:    ['p(95)<8000', 'p(99)<15000'],
    load_errors:          ['rate<0.02'],   // < 2% errores bajo carga alta

    // Paso 2: Focalizar cliente
    login_latencia_ms:    ['p(95)<2000'],

    // Pasos 3+4: Consulta + validación operador
    consulta_latencia_ms: ['p(95)<2500'],

    // Pasos 6+7: Registrar pago
    pago_latencia_ms:     ['p(95)<3000'],

    // Paso 8: Emitir recibo
    recibo_latencia_ms:   ['p(95)<3000'],

    // Métricas HTTP estándar k6
    http_req_duration:    ['p(95)<8000'],
    http_req_failed:      ['rate<0.02'],
  },
  // Reducir output en consola para no saturar con 2k VUs
  summaryTrendStats: ['avg', 'min', 'med', 'max', 'p(90)', 'p(95)', 'p(99)'],
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8080';
const headers  = {
  'Content-Type': 'application/json',
  'Accept':       'application/json',
};

// ── Función principal (un VU = una iteración del flujo E2E) ──────────────────
export default function () {
  // Distribuir usuarios entre VUs usando round-robin
  const user        = users[__VU % users.length];
  const numeroOrden = `LOAD-${Date.now()}-VU${__VU}-${Math.random().toString(36).substr(2, 6)}`;

  const inicioFlujo = Date.now();
  let flujoOk       = true;
  let clienteTelefono = user.telefono;

  // ── Paso 2: Focalizar Cliente ──────────────────────────────────────────────
  group('Paso 2 - Focalizar Cliente', () => {
    const t0  = Date.now();
    const res = http.get(
      `${BASE_URL}/api/clientes/buscar?telefono=${user.telefono}`,
      { headers, tags: { paso: 'p02_focalizar_cliente' } }
    );
    loginLatencia.add(Date.now() - t0);

    const ok = check(res, {
      'P2 status 200':     (r) => r.status === 200,
      'P2 cliente ACTIVO': (r) => {
        try { return JSON.parse(r.body).status === 'ACTIVO'; } catch { return false; }
      },
    });

    if (ok) {
      try {
        const body = JSON.parse(res.body);
        if (body.phone) clienteTelefono = body.phone;
      } catch { /* usar telefono original */ }
    } else {
      errorRate.add(1);
      flujoOk = false;
    }
  });

  if (!flujoOk) {
    flujosFallidos.add(1);
    return;
  }

  sleep(randomIntBetween(1, 2));

  // ── Paso 3: Consultar Montos DB ────────────────────────────────────────────
  group('Paso 3 - Consultar Montos DB', () => {
    const t0  = Date.now();
    const res = http.get(
      `${BASE_URL}/api/recargas/montos?operador=${user.operador}`,
      { headers, tags: { paso: 'p03_consultar_montos' } }
    );
    consultaLatencia.add(Date.now() - t0);

    const ok = check(res, {
      'P3 status 200':   (r) => r.status === 200,
      'P3 tiene montos': (r) => {
        try { return JSON.parse(r.body).length > 0; } catch { return false; }
      },
    });
    if (!ok) { errorRate.add(1); flujoOk = false; }
  });

  if (!flujoOk) { flujosFallidos.add(1); return; }

  sleep(randomIntBetween(1, 2));

  // ── Paso 4: Validar API Operador ───────────────────────────────────────────
  group('Paso 4 - Validar API Operador', () => {
    const t0  = Date.now();
    const res = http.post(
      `${BASE_URL}/api/recargas/validar-operador?telefono=${clienteTelefono}&operador=${user.operador}`,
      null,
      { headers, tags: { paso: 'p04_validar_operador' } }
    );
    consultaLatencia.add(Date.now() - t0);

    const ok = check(res, {
      'P4 status 200':  (r) => r.status === 200,
      'P4 valido true': (r) => {
        try { return JSON.parse(r.body).valido === true; } catch { return false; }
      },
    });
    if (!ok) { errorRate.add(1); flujoOk = false; }
  });

  if (!flujoOk) { flujosFallidos.add(1); return; }

  sleep(randomIntBetween(1, 2));

  // ── Paso 5: Métodos de Pago ────────────────────────────────────────────────
  group('Paso 5 - Métodos de Pago', () => {
    const res = http.get(
      `${BASE_URL}/api/pagos/metodos`,
      { headers, tags: { paso: 'p05_metodos_pago' } }
    );

    const ok = check(res, {
      'P5 status 200':     (r) => r.status === 200,
      'P5 tiene EFECTIVO': (r) => r.body.includes('EFECTIVO'),
    });
    if (!ok) { errorRate.add(1); flujoOk = false; }
  });

  if (!flujoOk) { flujosFallidos.add(1); return; }

  sleep(randomIntBetween(1, 2));

  // ── Pasos 6+7: Registrar Pago (ruta crítica) ───────────────────────────────
  let folioGenerado = '';
  group('Pasos 6+7 - Registrar Pago', () => {
    const payload = JSON.stringify({
      telefonoCliente: clienteTelefono,
      monto:           user.monto,
      metodoPago:      user.metodoPago,
      numeroOrden:     numeroOrden,
    });

    const t0  = Date.now();
    const res = http.post(
      `${BASE_URL}/api/pagos/registrar`,
      payload,
      { headers, tags: { paso: 'p0607_registrar_pago' } }
    );
    pagoLatencia.add(Date.now() - t0);

    const ok = check(res, {
      'P6 status 201':      (r) => r.status === 201,
      'P6 status APLICADO': (r) => {
        try { return JSON.parse(r.body).status === 'APLICADO'; } catch { return false; }
      },
      'P6 folio generado':  (r) => {
        try { return JSON.parse(r.body).folio.startsWith('B-'); } catch { return false; }
      },
    });

    if (!ok) {
      errorRate.add(1);
      flujoOk = false;
    } else {
      try {
        folioGenerado = JSON.parse(res.body).folio;
        foliosGenerados.add(1);
      } catch { /* no-op */ }
    }
  });

  if (!flujoOk) { flujosFallidos.add(1); return; }

  sleep(randomIntBetween(1, 2));

  // ── Paso 8: Emitir Recibo ──────────────────────────────────────────────────
  if (folioGenerado) {
    group('Paso 8 - Emitir Recibo', () => {
      const t0  = Date.now();
      const res = http.post(
        `${BASE_URL}/api/recibos/emitir?folio=${folioGenerado}&numeroOrden=${numeroOrden}`,
        null,
        { headers, tags: { paso: 'p08_emitir_recibo' } }
      );
      reciboLatencia.add(Date.now() - t0);

      const ok = check(res, {
        'P8 status 200':     (r) => r.status === 200,
        'P8 status EMITIDO': (r) => {
          try { return JSON.parse(r.body).status === 'EMITIDO'; } catch { return false; }
        },
        'P8 tiene url_pdf':  (r) => {
          try { return JSON.parse(r.body).url_pdf !== undefined; } catch { return false; }
        },
      });

      if (!ok) { errorRate.add(1); flujoOk = false; }
    });
  }

  // ── Registro final del flujo ───────────────────────────────────────────────
  flujoCompleto.add(Date.now() - inicioFlujo);

  if (flujoOk) {
    flujosExitosos.add(1);
  } else {
    flujosFallidos.add(1);
  }

  sleep(randomIntBetween(1, 3));
}

// ── Resumen HTML/JSON al final del test ───────────────────────────────────────
export function handleSummary(data) {
  const ts  = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const env = __ENV.ENVIRONMENT || 'local';

  const metricas = {
    flujo_completo_p95_ms:  data.metrics.flujo_completo_ms?.values?.['p(95)']     ?? null,
    flujo_completo_p99_ms:  data.metrics.flujo_completo_ms?.values?.['p(99)']     ?? null,
    flujo_completo_avg_ms:  data.metrics.flujo_completo_ms?.values?.avg            ?? null,
    login_p95_ms:           data.metrics.login_latencia_ms?.values?.['p(95)']      ?? null,
    consulta_p95_ms:        data.metrics.consulta_latencia_ms?.values?.['p(95)']   ?? null,
    pago_p95_ms:            data.metrics.pago_latencia_ms?.values?.['p(95)']       ?? null,
    recibo_p95_ms:          data.metrics.recibo_latencia_ms?.values?.['p(95)']     ?? null,
    error_rate:             data.metrics.load_errors?.values?.rate                  ?? null,
    http_req_failed_rate:   data.metrics.http_req_failed?.values?.rate              ?? null,
    http_reqs_total:        data.metrics.http_reqs?.values?.count                   ?? null,
    http_req_rate:          data.metrics.http_reqs?.values?.rate                    ?? null,
    vus_max:                data.metrics.vus_max?.values?.value                     ?? null,
    flujos_exitosos:        data.metrics.flujos_exitosos?.values?.count             ?? null,
    flujos_fallidos:        data.metrics.flujos_fallidos?.values?.count             ?? null,
    folios_generados:       data.metrics.folios_generados?.values?.count            ?? null,
  };

  const summary = {
    timestamp:         new Date().toISOString(),
    environment:       env,
    run_id:            __ENV.GITHUB_RUN_ID || 'local',
    config: {
      max_vus:         MAX_VUS,
      duration_s:      DURATION_S,
      ramp_s:          RAMP_S,
      base_url:        BASE_URL,
    },
    thresholds_passed: checkAllThresholds(data),
    metrics:           metricas,
    raw:               data,
  };

  const jsonResult  = JSON.stringify(summary, null, 2);
  const htmlReport  = buildHtmlDashboard(summary);
  const consoleOut  = formatConsoleReport(summary);

  return {
    [`resultados/load_test_${ts}.json`]:       jsonResult,
    'resultados/load_test_latest.json':        jsonResult,
    [`reportes/dashboard_${ts}.html`]:         htmlReport,
    'reportes/dashboard_latest.html':          htmlReport,
    stdout:                                    consoleOut,
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function checkAllThresholds(data) {
  return Object.entries(data.metrics)
    .filter(([, v]) => v.thresholds)
    .every(([, v]) => Object.values(v.thresholds).every(t => t.ok !== false));
}

function formatConsoleReport(s) {
  const m   = s.metrics;
  const ok  = (val, threshold) => (val !== null && val <= threshold) ? '✅' : (val === null ? '❓' : '❌');
  const pct = (val) => val !== null ? `${(val * 100).toFixed(2)}%` : 'N/A';
  const ms  = (val) => val !== null ? `${val.toFixed(0)} ms` : 'N/A';
  const num = (val) => val !== null ? String(Math.round(val)) : 'N/A';

  return `
╔══════════════════════════════════════════════════════════════════════════╗
║          PaymentBox — Load Test 2k VUs / 3600s — Resultados              ║
╠══════════════════════════════════════════════════════════════════════════╣
║  Timestamp  : ${s.timestamp.padEnd(57)}║
║  Entorno    : ${(s.environment || 'local').padEnd(57)}║
║  Run ID     : ${(s.run_id || 'local').padEnd(57)}║
║  Config     : ${MAX_VUS} VUs × ${DURATION_S}s (ramp ${RAMP_S}s)${' '.repeat(Math.max(0, 42-String(MAX_VUS).length-String(DURATION_S).length-String(RAMP_S).length))}║
╠══════════════════════════════════════════════════════════════════════════╣
║  THRESHOLDS DE CARGA                                                     ║
║  ${ok(m.flujo_completo_p95_ms, 8000)} Flujo completo p95 : ${ms(m.flujo_completo_p95_ms).padEnd(12)} (límite: 8000ms)          ║
║  ${ok(m.flujo_completo_p99_ms,15000)} Flujo completo p99 : ${ms(m.flujo_completo_p99_ms).padEnd(12)} (límite: 15000ms)         ║
║  ${ok(m.login_p95_ms, 2000)}  Login p95          : ${ms(m.login_p95_ms).padEnd(12)} (límite: 2000ms)          ║
║  ${ok(m.consulta_p95_ms,2500)}  Consulta p95       : ${ms(m.consulta_p95_ms).padEnd(12)} (límite: 2500ms)          ║
║  ${ok(m.pago_p95_ms, 3000)}  Pago p95           : ${ms(m.pago_p95_ms).padEnd(12)} (límite: 3000ms)          ║
║  ${ok(m.recibo_p95_ms,3000)}  Recibo p95         : ${ms(m.recibo_p95_ms).padEnd(12)} (límite: 3000ms)          ║
║  ${ok(m.error_rate, 0.02)}  Error rate         : ${pct(m.error_rate).padEnd(12)} (límite: 2%)             ║
╠══════════════════════════════════════════════════════════════════════════╣
║  VOLUMEN                                                                 ║
║  Total requests   : ${num(m.http_reqs_total).padEnd(51)}║
║  Req/s (avg)      : ${num(m.http_req_rate).padEnd(51)}║
║  VUs máximos      : ${num(m.vus_max).padEnd(51)}║
║  Flujos exitosos  : ${num(m.flujos_exitosos).padEnd(51)}║
║  Flujos fallidos  : ${num(m.flujos_fallidos).padEnd(51)}║
║  Folios generados : ${num(m.folios_generados).padEnd(51)}║
╠══════════════════════════════════════════════════════════════════════════╣
║  RESULTADO GLOBAL : ${(s.thresholds_passed ? '✅ TODOS LOS THRESHOLDS CUMPLEN' : '❌ THRESHOLDS INCUMPLIDOS').padEnd(51)}║
╚══════════════════════════════════════════════════════════════════════════╝
`;
}

// ── HTML Dashboard ─────────────────────────────────────────────────────────────
function buildHtmlDashboard(s) {
  const m      = s.metrics;
  const ms     = (v) => v !== null ? `${v.toFixed(0)} ms` : 'N/A';
  const pct    = (v) => v !== null ? `${(v * 100).toFixed(2)}%` : 'N/A';
  const num    = (v) => v !== null ? Math.round(v).toLocaleString() : 'N/A';
  const badge  = (ok) => ok ? `<span class="badge ok">✅ OK</span>` : `<span class="badge fail">❌ FALLA</span>`;
  const bOk    = (v, t) => v !== null && v <= t;

  const successRate = (m.flujos_exitosos && m.flujos_fallidos)
    ? ((m.flujos_exitosos / (m.flujos_exitosos + m.flujos_fallidos)) * 100).toFixed(1)
    : 'N/A';

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>PaymentBox — Load Test Dashboard — ${s.timestamp}</title>
  <style>
    :root {
      --ok:   #22c55e; --fail: #ef4444; --warn: #f59e0b;
      --bg:   #0f172a; --card: #1e293b; --text: #e2e8f0;
      --mute: #94a3b8; --brd:  #334155;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Segoe UI', system-ui, sans-serif; background: var(--bg); color: var(--text); padding: 24px; }
    h1 { font-size: 1.6rem; color: #38bdf8; margin-bottom: 4px; }
    .subtitle { color: var(--mute); font-size: 0.9rem; margin-bottom: 24px; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px; margin-bottom: 24px; }
    .card { background: var(--card); border: 1px solid var(--brd); border-radius: 12px; padding: 20px; }
    .card .label { font-size: 0.75rem; color: var(--mute); text-transform: uppercase; letter-spacing: .05em; margin-bottom: 8px; }
    .card .value { font-size: 2rem; font-weight: 700; line-height: 1; }
    .card .unit  { font-size: 0.85rem; color: var(--mute); margin-top: 4px; }
    .ok-val   { color: var(--ok); }
    .fail-val { color: var(--fail); }
    .warn-val { color: var(--warn); }
    table { width: 100%; border-collapse: collapse; }
    th, td { padding: 12px 16px; text-align: left; border-bottom: 1px solid var(--brd); font-size: 0.9rem; }
    th { color: var(--mute); font-weight: 600; font-size: 0.75rem; text-transform: uppercase; }
    .badge { padding: 3px 10px; border-radius: 999px; font-size: 0.8rem; font-weight: 600; }
    .badge.ok   { background: rgba(34,197,94,.15);  color: var(--ok);   }
    .badge.fail { background: rgba(239,68,68,.15);  color: var(--fail); }
    .section-title { font-size: 1rem; font-weight: 600; color: #38bdf8; margin: 24px 0 12px; }
    .global-result { padding: 16px 20px; border-radius: 12px; margin-bottom: 24px; font-size: 1rem; font-weight: 600; }
    .global-ok   { background: rgba(34,197,94,.1);  border: 1px solid rgba(34,197,94,.3); color: var(--ok); }
    .global-fail { background: rgba(239,68,68,.1); border: 1px solid rgba(239,68,68,.3); color: var(--fail); }
  </style>
</head>
<body>
  <h1>🚀 PaymentBox — Load Performance Dashboard</h1>
  <div class="subtitle">
    Ejecución: ${s.timestamp} &nbsp;|&nbsp; Entorno: ${s.environment} &nbsp;|&nbsp;
    Run ID: ${s.run_id} &nbsp;|&nbsp; Config: ${s.config.max_vus} VUs × ${s.config.duration_s}s
  </div>

  <div class="global-result ${s.thresholds_passed ? 'global-ok' : 'global-fail'}">
    ${s.thresholds_passed
      ? '✅ RESULTADO GLOBAL: Todos los thresholds cumplen'
      : '❌ RESULTADO GLOBAL: Thresholds incumplidos — Revisar métricas'}
  </div>

  <div class="section-title">📊 Resumen de Volumen</div>
  <div class="grid">
    <div class="card">
      <div class="label">Total Requests</div>
      <div class="value">${num(m.http_reqs_total)}</div>
      <div class="unit">HTTP requests</div>
    </div>
    <div class="card">
      <div class="label">Throughput</div>
      <div class="value">${num(m.http_req_rate)}</div>
      <div class="unit">req/s promedio</div>
    </div>
    <div class="card">
      <div class="label">VUs Máximos</div>
      <div class="value">${num(m.vus_max)}</div>
      <div class="unit">usuarios virtuales</div>
    </div>
    <div class="card">
      <div class="label">Flujos Exitosos</div>
      <div class="value ok-val">${num(m.flujos_exitosos)}</div>
      <div class="unit">tasa: ${successRate}%</div>
    </div>
    <div class="card">
      <div class="label">Error Rate</div>
      <div class="value ${bOk(m.error_rate, 0.02) ? 'ok-val' : 'fail-val'}">${pct(m.error_rate)}</div>
      <div class="unit">límite: 2%</div>
    </div>
    <div class="card">
      <div class="label">Folios Generados</div>
      <div class="value">${num(m.folios_generados)}</div>
      <div class="unit">pagos registrados</div>
    </div>
  </div>

  <div class="section-title">⏱ Latencias por Paso (p95)</div>
  <div class="card">
    <table>
      <thead>
        <tr>
          <th>Paso E2E</th>
          <th>Latencia p95</th>
          <th>Latencia p99</th>
          <th>Latencia avg</th>
          <th>Límite</th>
          <th>Estado</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>Flujo Completo (8 pasos)</td>
          <td>${ms(m.flujo_completo_p95_ms)}</td>
          <td>${ms(m.flujo_completo_p99_ms)}</td>
          <td>${ms(m.flujo_completo_avg_ms)}</td>
          <td>8 000 ms</td>
          <td>${badge(bOk(m.flujo_completo_p95_ms, 8000))}</td>
        </tr>
        <tr>
          <td>Paso 2 — Focalizar Cliente</td>
          <td>${ms(m.login_p95_ms)}</td>
          <td>-</td>
          <td>-</td>
          <td>2 000 ms</td>
          <td>${badge(bOk(m.login_p95_ms, 2000))}</td>
        </tr>
        <tr>
          <td>Pasos 3+4 — Consulta + Operador</td>
          <td>${ms(m.consulta_p95_ms)}</td>
          <td>-</td>
          <td>-</td>
          <td>2 500 ms</td>
          <td>${badge(bOk(m.consulta_p95_ms, 2500))}</td>
        </tr>
        <tr>
          <td>Pasos 6+7 — Registrar Pago</td>
          <td>${ms(m.pago_p95_ms)}</td>
          <td>-</td>
          <td>-</td>
          <td>3 000 ms</td>
          <td>${badge(bOk(m.pago_p95_ms, 3000))}</td>
        </tr>
        <tr>
          <td>Paso 8 — Emitir Recibo</td>
          <td>${ms(m.recibo_p95_ms)}</td>
          <td>-</td>
          <td>-</td>
          <td>3 000 ms</td>
          <td>${badge(bOk(m.recibo_p95_ms, 3000))}</td>
        </tr>
      </tbody>
    </table>
  </div>

  <div class="section-title">🔍 Comparación vs Smoke Baseline</div>
  <div class="card">
    <table>
      <thead>
        <tr><th>Métrica</th><th>Smoke (20 VUs)</th><th>Load (2000 VUs)</th><th>Factor</th></tr>
      </thead>
      <tbody>
        <tr><td>VUs</td><td>20</td><td>${s.config.max_vus}</td><td>${s.config.max_vus / 20}×</td></tr>
        <tr><td>Duración</td><td>7 min</td><td>${Math.round(s.config.duration_s/60)} min</td><td>-</td></tr>
        <tr><td>Flujo p95 límite</td><td>3 000 ms</td><td>8 000 ms</td><td>-</td></tr>
        <tr><td>Error rate límite</td><td>1%</td><td>2%</td><td>-</td></tr>
      </tbody>
    </table>
  </div>

  <p style="color: var(--mute); font-size: 0.8rem; margin-top: 24px; text-align: center;">
    Generado automáticamente por load_test_2k_vus.js — AT&T PaymentBox PoC &nbsp;|&nbsp;
    <a href="https://git.optare.net/jcunha/QA_POC_ATT" style="color:#38bdf8">GitLab: QA_POC_ATT</a>
  </p>
</body>
</html>`;
}
