/**
 * k6 Smoke Performance Test - PaymentBox Telco Operator
 * Flujo completo de 8 pasos con 20 VUs y comparación histórica de resultados.
 *
 * Ejecución local:
 *   k6 run tests/k6/smoke_performance.js
 *
 * Ejecución CI:
 *   k6 run --env BASE_URL=http://localhost:8080 \
 *          --env ENVIRONMENT=ci \
 *          tests/k6/smoke_performance.js
 *
 * Thresholds configurados:
 *   - 95% flujo completo < 3s
 *   - Error rate < 1%
 *   - Login (focalizar cliente) p95 < 700ms
 *   - Consulta (montos + validación operador) p95 < 900ms
 *   - Actualización (registrar pago) p95 < 1200ms
 */

import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';
import { SharedArray } from 'k6/data';
import { randomIntBetween } from 'https://jslib.k6.io/k6-utils/1.4.0/index.js';

// ── Datos de prueba parametrizados ───────────────────────────────────────────
const users = new SharedArray('users', function () {
  return JSON.parse(open('./data/users.json'));
});

// ── Métricas personalizadas ───────────────────────────────────────────────────
const errorRate        = new Rate('smoke_errors');
const loginLatencia    = new Trend('login_latencia_ms',        true);
const consultaLatencia = new Trend('consulta_latencia_ms',     true);
const pagoLatencia     = new Trend('pago_latencia_ms',         true);
const flujoCompleto    = new Trend('flujo_completo_ms',        true);
const K6_VUS           = Number.parseInt(__ENV.K6_VUS || '20', 10);
const K6_DURATION      = __ENV.K6_DURATION || '7m';

// ── Configuración del test ────────────────────────────────────────────────────
export const options = {
  scenarios: {
    smoke_performance: {
      executor: 'constant-vus',
      vus: K6_VUS,
      duration: K6_DURATION,
    },
  },
  thresholds: {
    // Flujo completo de 8 pasos
    flujo_completo_ms:   ['p(95)<3000'],  // 95% < 3s
    smoke_errors:        ['rate<0.01'],   // < 1% errores

    // Paso 2: Focalizar cliente (equivalente a "login")
    login_latencia_ms:   ['p(95)<700'],   // Login p95 < 700ms

    // Pasos 3+4: Consulta montos + validar operador
    consulta_latencia_ms: ['p(95)<900'],  // Consulta p95 < 900ms

    // Pasos 6+7: Registrar pago (actualización)
    pago_latencia_ms:    ['p(95)<1200'],  // Actualización p95 < 1200ms

    // Métricas estándar k6
    http_req_duration:   ['p(95)<3000'],
    http_req_failed:     ['rate<0.01'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8080';
const headers  = { 'Content-Type': 'application/json' };

// ── Función principal ─────────────────────────────────────────────────────────
export default function () {
  // Seleccionar usuario parametrizado (round-robin por VU)
  const user        = users[__VU % users.length];
  const numeroOrden = `ORD-${Date.now()}-${__VU}`;

  const inicioFlujo = Date.now();
  let flujoOk       = true;

  // ── Paso 2: Focalizar Cliente (Login) ──────────────────────────────────────
  group('Paso 2 - Focalizar Cliente', () => {
    const t0  = Date.now();
    const res = http.get(`${BASE_URL}/api/clientes/buscar?telefono=${user.telefono}`);
    loginLatencia.add(Date.now() - t0);

    const ok = check(res, {
      'P2 status 200':      (r) => r.status === 200,
      'P2 cliente ACTIVO':  (r) => {
        try { return JSON.parse(r.body).status === 'ACTIVO'; } catch { return false; }
      },
      'P2 nombre correcto': (r) => {
        try { return JSON.parse(r.body).nombre.includes('Billy'); } catch { return false; }
      },
    });
    if (!ok) { errorRate.add(1); flujoOk = false; }
  });

  sleep(randomIntBetween(1, 3));

  // ── Paso 3: Obtener Montos DB ───────────────────────────────────────────────
  group('Paso 3 - Consultar Montos DB', () => {
    const t0  = Date.now();
    const res = http.get(`${BASE_URL}/api/recargas/montos?operador=${user.operador}`);
    consultaLatencia.add(Date.now() - t0);

    const ok = check(res, {
      'P3 status 200':    (r) => r.status === 200,
      'P3 tiene montos':  (r) => {
        try { return JSON.parse(r.body).length > 0; } catch { return false; }
      },
    });
    if (!ok) { errorRate.add(1); flujoOk = false; }
  });

  sleep(randomIntBetween(1, 3));

  // ── Paso 4: Validar Operador ────────────────────────────────────────────────
  group('Paso 4 - Validar API Operador', () => {
    const t0  = Date.now();
    const res = http.post(
      `${BASE_URL}/api/recargas/validar-operador?telefono=${user.telefono}&operador=${user.operador}`,
      null,
      { headers }
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

  sleep(randomIntBetween(1, 3));

  // ── Paso 5: Métodos de Pago ─────────────────────────────────────────────────
  group('Paso 5 - Métodos de Pago PaymentBox', () => {
    const res = http.get(`${BASE_URL}/api/pagos/metodos`);

    const ok = check(res, {
      'P5 status 200':    (r) => r.status === 200,
      'P5 tiene EFECTIVO': (r) => r.body.includes('EFECTIVO'),
    });
    if (!ok) { errorRate.add(1); flujoOk = false; }
  });

  sleep(randomIntBetween(1, 3));

  // ── Pasos 6+7: Registrar Pago (ruta crítica) ────────────────────────────────
  let folioGenerado = '';
  group('Pasos 6+7 - Registrar Pago', () => {
    const payload = JSON.stringify({
      telefonoCliente: user.telefono,
      monto:           user.monto,
      metodoPago:      user.metodoPago,
      numeroOrden:     numeroOrden,
    });

    const t0  = Date.now();
    const res = http.post(`${BASE_URL}/api/pagos/registrar`, payload, { headers });
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
    if (!ok) { errorRate.add(1); flujoOk = false; }
    else {
      try { folioGenerado = JSON.parse(res.body).folio; } catch { /* no-op */ }
    }
  });

  sleep(randomIntBetween(1, 3));

  // ── Paso 8: Emitir Recibo ───────────────────────────────────────────────────
  if (folioGenerado) {
    group('Paso 8 - Emitir Recibo', () => {
      const res = http.post(
        `${BASE_URL}/api/recibos/emitir?folio=${folioGenerado}&numeroOrden=${numeroOrden}`,
        null,
        { headers }
      );

      const ok = check(res, {
        'P8 status 200':       (r) => r.status === 200,
        'P8 status EMITIDO':   (r) => {
          try { return JSON.parse(r.body).status === 'EMITIDO'; } catch { return false; }
        },
        'P8 tiene url_pdf':    (r) => {
          try { return JSON.parse(r.body).url_pdf !== undefined; } catch { return false; }
        },
      });
      if (!ok) { errorRate.add(1); flujoOk = false; }
    });
  }

  // Registrar duración total del flujo
  flujoCompleto.add(Date.now() - inicioFlujo);
  if (!flujoOk) errorRate.add(0); // No doble conteo, solo registro

  sleep(randomIntBetween(1, 3));
}

// ── Reporte final con métricas y comparación ─────────────────────────────────
export function handleSummary(data) {
  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);

  const summary = {
    timestamp:   new Date().toISOString(),
    environment: __ENV.ENVIRONMENT || 'local',
    run_id:      __ENV.GITHUB_RUN_ID || 'local',
    thresholds_passed: Object.entries(data.metrics)
      .filter(([, v]) => v.thresholds)
      .every(([, v]) => Object.values(v.thresholds).every(t => !t.ok === false)),
    metrics: {
      flujo_completo_p95_ms:   data.metrics.flujo_completo_ms?.values?.['p(95)'] ?? null,
      login_p95_ms:            data.metrics.login_latencia_ms?.values?.['p(95)'] ?? null,
      consulta_p95_ms:         data.metrics.consulta_latencia_ms?.values?.['p(95)'] ?? null,
      pago_p95_ms:             data.metrics.pago_latencia_ms?.values?.['p(95)'] ?? null,
      error_rate:              data.metrics.smoke_errors?.values?.rate ?? null,
      http_req_failed_rate:    data.metrics.http_req_failed?.values?.rate ?? null,
      http_reqs_total:         data.metrics.http_reqs?.values?.count ?? null,
      vus_max:                 data.metrics.vus_max?.values?.value ?? null,
    },
    raw: data,
  };

  return {
    [`tests/k6/results/smoke_performance_${ts}.json`]: JSON.stringify(summary, null, 2),
    'tests/k6/results/smoke_performance_latest.json':  JSON.stringify(summary, null, 2),
    stdout: formatConsoleReport(summary),
  };
}

function formatConsoleReport(s) {
  const m   = s.metrics;
  const ok  = (val, threshold) => val !== null && val <= threshold ? '✅' : '❌';
  return `
╔══════════════════════════════════════════════════════════════╗
║     PaymentBox — Smoke Performance Test — Resultados         ║
╠══════════════════════════════════════════════════════════════╣
║  Timestamp : ${s.timestamp.padEnd(46)}║
║  Entorno   : ${(s.environment || 'local').padEnd(46)}║
╠══════════════════════════════════════════════════════════════╣
║  THRESHOLDS                                                  ║
║  ${ok(m.flujo_completo_p95_ms, 3000)} Flujo completo p95   : ${String(m.flujo_completo_p95_ms?.toFixed(0) ?? 'n/a').padEnd(8)} ms  (límite: 3000ms)  ║
║  ${ok(m.login_p95_ms, 700)}   Login p95             : ${String(m.login_p95_ms?.toFixed(0) ?? 'n/a').padEnd(8)} ms  (límite: 700ms)   ║
║  ${ok(m.consulta_p95_ms, 900)}   Consulta p95          : ${String(m.consulta_p95_ms?.toFixed(0) ?? 'n/a').padEnd(8)} ms  (límite: 900ms)   ║
║  ${ok(m.pago_p95_ms, 1200)}   Pago/Actualiz p95     : ${String(m.pago_p95_ms?.toFixed(0) ?? 'n/a').padEnd(8)} ms  (límite: 1200ms)  ║
║  ${ok(m.error_rate, 0.01)}   Error rate            : ${String((m.error_rate * 100)?.toFixed(2) ?? 'n/a').padEnd(8)} %   (límite: 1%)      ║
╠══════════════════════════════════════════════════════════════╣
║  Total requests : ${String(m.http_reqs_total ?? 'n/a').padEnd(41)}║
╚══════════════════════════════════════════════════════════════╝
`;
}
