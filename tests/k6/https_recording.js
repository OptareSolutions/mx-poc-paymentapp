/**
 * k6 HTTPS Recording Script — PaymentBox Telco Operator
 * ======================================================
 * Generado a partir de grabación HTTPS del flujo E2E de 8 pasos.
 * Equivalente k6 del fichero JMeter: paymentbox_https_recording.jmx
 *
 * Protocolo: HTTPS (TLS 1.2/1.3)
 * Flujo grabado:
 *   Paso 1: Auth/Login            → POST /api/auth/token
 *   Paso 2: Focalizar cliente     → GET  /api/clientes/buscar?telefono=...
 *   Paso 3: Consultar montos      → GET  /api/recargas/montos?operador=...
 *   Paso 4: Validar operador      → POST /api/recargas/validar-operador
 *   Paso 5: Métodos de pago       → GET  /api/pagos/metodos
 *   Paso 6+7: Registrar pago      → POST /api/pagos/registrar
 *   Paso 8: Emitir recibo         → POST /api/recibos/emitir
 *
 * Ejecución local:
 *   k6 run tests/k6/https_recording.js
 *
 * Ejecución con URL personalizada:
 *   k6 run --env BASE_URL=https://api.paymentbox.att.com \
 *          --env PROTOCOL=https \
 *          --env THREAD_COUNT=20 \
 *          --env DURATION=7m \
 *          tests/k6/https_recording.js
 *
 * Parámetros de entorno:
 *   BASE_URL      : URL base del servicio  (default: http://localhost:8080)
 *   PROTOCOL      : http | https            (default: http)
 *   THREAD_COUNT  : VUs concurrentes       (default: 20)
 *   RAMP_UP       : Tiempo de ramp-up      (default: 1m)
 *   DURATION      : Duración sostenida     (default: 7m)
 *   THINK_TIME    : Pausa entre pasos (ms) (default: 500)
 */

import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';
import { SharedArray } from 'k6/data';
import { uuidv4 } from 'https://jslib.k6.io/k6-utils/1.4.0/index.js';

// ── Datos de prueba parametrizados (CSV grabado) ──────────────────────────────
// Equivalente al CSV parametrizado del JMeter:
//   datos_usuarios.csv (user_id, telefono, nombre, operador, monto, metodoPago)
const users = new SharedArray('usuarios-billy', function () {
  return [
    { userId: 'billy-1',  telefono: '4544', nombre: 'Billy Rodriguez', operador: 'BLUE', monto: '20.00', metodoPago: 'EFECTIVO', authUser: 'billy.rodriguez', authPass: 'Pass@123' },
    { userId: 'billy-2',  telefono: '4545', nombre: 'Billy Martinez',  operador: 'BLUE', monto: '50.00', metodoPago: 'TARJETA',  authUser: 'billy.martinez',  authPass: 'Pass@123' },
    { userId: 'billy-3',  telefono: '4546', nombre: 'Billy Sanchez',   operador: 'RED',  monto: '100.00',metodoPago: 'EFECTIVO', authUser: 'billy.sanchez',   authPass: 'Pass@123' },
    { userId: 'billy-4',  telefono: '4547', nombre: 'Billy Lopez',     operador: 'BLUE', monto: '30.00', metodoPago: 'TARJETA',  authUser: 'billy.lopez',     authPass: 'Pass@123' },
    { userId: 'billy-5',  telefono: '4548', nombre: 'Billy Gomez',     operador: 'RED',  monto: '20.00', metodoPago: 'EFECTIVO', authUser: 'billy.gomez',     authPass: 'Pass@123' },
    { userId: 'billy-6',  telefono: '4549', nombre: 'Billy Torres',    operador: 'BLUE', monto: '75.00', metodoPago: 'TARJETA',  authUser: 'billy.torres',    authPass: 'Pass@123' },
    { userId: 'billy-7',  telefono: '4550', nombre: 'Billy Flores',    operador: 'RED',  monto: '50.00', metodoPago: 'EFECTIVO', authUser: 'billy.flores',    authPass: 'Pass@123' },
    { userId: 'billy-8',  telefono: '4551', nombre: 'Billy Rivera',    operador: 'BLUE', monto: '20.00', metodoPago: 'TARJETA',  authUser: 'billy.rivera',    authPass: 'Pass@123' },
    { userId: 'billy-9',  telefono: '4552', nombre: 'Billy Diaz',      operador: 'RED',  monto: '100.00',metodoPago: 'EFECTIVO', authUser: 'billy.diaz',      authPass: 'Pass@123' },
    { userId: 'billy-10', telefono: '4553', nombre: 'Billy Morales',   operador: 'BLUE', monto: '30.00', metodoPago: 'TARJETA',  authUser: 'billy.morales',   authPass: 'Pass@123' },
    { userId: 'billy-11', telefono: '4554', nombre: 'Billy Ortega',    operador: 'RED',  monto: '20.00', metodoPago: 'EFECTIVO', authUser: 'billy.ortega',    authPass: 'Pass@123' },
    { userId: 'billy-12', telefono: '4555', nombre: 'Billy Ramos',     operador: 'BLUE', monto: '50.00', metodoPago: 'TARJETA',  authUser: 'billy.ramos',     authPass: 'Pass@123' },
    { userId: 'billy-13', telefono: '4556', nombre: 'Billy Ruiz',      operador: 'RED',  monto: '75.00', metodoPago: 'EFECTIVO', authUser: 'billy.ruiz',      authPass: 'Pass@123' },
    { userId: 'billy-14', telefono: '4557', nombre: 'Billy Perez',     operador: 'BLUE', monto: '100.00',metodoPago: 'TARJETA',  authUser: 'billy.perez',     authPass: 'Pass@123' },
    { userId: 'billy-15', telefono: '4558', nombre: 'Billy Vargas',    operador: 'RED',  monto: '20.00', metodoPago: 'EFECTIVO', authUser: 'billy.vargas',    authPass: 'Pass@123' },
    { userId: 'billy-16', telefono: '4559', nombre: 'Billy Herrera',   operador: 'BLUE', monto: '30.00', metodoPago: 'TARJETA',  authUser: 'billy.herrera',   authPass: 'Pass@123' },
    { userId: 'billy-17', telefono: '4560', nombre: 'Billy Medina',    operador: 'RED',  monto: '50.00', metodoPago: 'EFECTIVO', authUser: 'billy.medina',    authPass: 'Pass@123' },
    { userId: 'billy-18', telefono: '4561', nombre: 'Billy Castro',    operador: 'BLUE', monto: '20.00', metodoPago: 'TARJETA',  authUser: 'billy.castro',    authPass: 'Pass@123' },
    { userId: 'billy-19', telefono: '4562', nombre: 'Billy Reyes',     operador: 'RED',  monto: '75.00', metodoPago: 'EFECTIVO', authUser: 'billy.reyes',     authPass: 'Pass@123' },
    { userId: 'billy-20', telefono: '4563', nombre: 'Billy Jimenez',   operador: 'BLUE', monto: '100.00',metodoPago: 'TARJETA',  authUser: 'billy.jimenez',   authPass: 'Pass@123' },
  ];
});

// ── Métricas personalizadas ───────────────────────────────────────────────────
const errorRate       = new Rate('recording_errors');
const authLatencia    = new Trend('recording_auth_ms',     true);
const clienteLatencia = new Trend('recording_cliente_ms',  true);
const pagoLatencia    = new Trend('recording_pago_ms',     true);
const reciboLatencia  = new Trend('recording_recibo_ms',   true);

// ── Configuración ─────────────────────────────────────────────────────────────
const BASE_URL     = __ENV.BASE_URL     || 'http://localhost:8080';
const PROTOCOL     = __ENV.PROTOCOL     || 'http';
const THREAD_COUNT = parseInt(__ENV.THREAD_COUNT || '20');
const RAMP_UP      = __ENV.RAMP_UP      || '1m';
const DURATION     = __ENV.DURATION     || '7m';
const THINK_TIME   = parseInt(__ENV.THINK_TIME || '500') / 1000; // ms → s

export const options = {
  scenarios: {
    // Equivalente al Thread Group del JMeter con ramp-up y duración
    flujo_https_grabado: {
      executor:       'ramped-vus',
      startVUs:       1,
      stages: [
        { duration: RAMP_UP,   target: THREAD_COUNT },  // Ramp-up
        { duration: DURATION,  target: THREAD_COUNT },  // Sostenida
        { duration: '30s',     target: 0 },             // Ramp-down
      ],
      gracefulRampDown: '30s',
    },
  },
  thresholds: {
    // Thresholds equivalentes a los assertion del JMeter
    http_req_duration:      ['p(95)<3000', 'p(99)<5000'],  // 3s p95, 5s p99
    recording_errors:       ['rate<0.01'],                  // < 1% errores
    recording_auth_ms:      ['p(95)<2000'],
    recording_cliente_ms:   ['p(95)<1500'],
    recording_pago_ms:      ['p(95)<2500'],
    recording_recibo_ms:    ['p(95)<2000'],
  },
  // Configuración TLS para HTTPS (equivalente a HTTPS en JMeter)
  tlsConfig: {
    insecureSkipTLSVerify: PROTOCOL === 'https',
  },
};

// ── Headers grabados (exactos del navegador/cliente durante la grabación) ─────
function buildHeaders(token) {
  return {
    'Content-Type':  'application/json',
    'Accept':        'application/json',
    'X-Request-ID':  uuidv4(),
    'User-Agent':    'PaymentBox-k6-recording/1.0',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
  };
}

// ── VU principal ──────────────────────────────────────────────────────────────
export default function () {
  // Seleccionar usuario parametrizado (round-robin igual que JMeter CSV Data Set)
  const user = users[__VU % users.length];
  let token  = null;
  let folioId = null;
  let pagoId  = null;
  let ok      = true;

  // ── PASO 1: Auth/Login (grabado desde el flujo HTTPS) ─────────────────────
  group('Paso 1 — Auth Login', function () {
    const start = Date.now();
    const res = http.post(
      `${BASE_URL}/api/auth/token`,
      JSON.stringify({
        username: user.authUser,
        password: user.authPass,
        grant_type: 'password',
      }),
      { headers: buildHeaders(null), tags: { paso: '1_auth' } }
    );
    authLatencia.add(Date.now() - start);

    const passed = check(res, {
      'P1 Auth status 200':    r => r.status === 200,
      'P1 Token en respuesta': r => {
        try { return JSON.parse(r.body).access_token !== undefined; } catch { return false; }
      },
    });
    if (passed) {
      try { token = JSON.parse(res.body).access_token; } catch { /* fallback */ }
    } else {
      errorRate.add(1);
      ok = false;
    }
  });

  if (!ok) return;
  sleep(THINK_TIME);

  // ── PASO 2: Focalizar cliente (GET con parámetro telefono grabado) ─────────
  group('Paso 2 — Buscar Cliente', function () {
    const start = Date.now();
    const res = http.get(
      `${BASE_URL}/api/clientes/buscar?telefono=${user.telefono}`,
      { headers: buildHeaders(token), tags: { paso: '2_cliente' } }
    );
    clienteLatencia.add(Date.now() - start);

    check(res, {
      'P2 Cliente status 200':  r => r.status === 200,
      'P2 Cliente activo':      r => {
        try { return JSON.parse(r.body).status === 'ACTIVO'; } catch { return false; }
      },
    }) || (errorRate.add(1), ok = false);
  });

  if (!ok) return;
  sleep(THINK_TIME);

  // ── PASO 3: Consultar montos disponibles ───────────────────────────────────
  group('Paso 3 — Montos Operador', function () {
    const res = http.get(
      `${BASE_URL}/api/recargas/montos?operador=${user.operador}`,
      { headers: buildHeaders(token), tags: { paso: '3_montos' } }
    );
    check(res, {
      'P3 Montos status 200': r => r.status === 200,
      'P3 Montos no vacío':   r => {
        try { return JSON.parse(r.body).montos?.length > 0; } catch { return false; }
      },
    }) || errorRate.add(1);
  });

  sleep(THINK_TIME);

  // ── PASO 4: Validar operador (POST grabado con body completo) ──────────────
  group('Paso 4 — Validar Operador', function () {
    const res = http.post(
      `${BASE_URL}/api/recargas/validar-operador`,
      JSON.stringify({
        telefono:       user.telefono,
        operador:       user.operador,
        monto:          parseFloat(user.monto),
        tipoValidacion: 'PRE_PAGO',
      }),
      { headers: buildHeaders(token), tags: { paso: '4_validar' } }
    );
    check(res, {
      'P4 Validar status 200':   r => r.status === 200,
      'P4 Operador activo':      r => {
        try { return JSON.parse(r.body).operadorActivo === true; } catch { return false; }
      },
    }) || (errorRate.add(1), ok = false);
  });

  if (!ok) return;
  sleep(THINK_TIME);

  // ── PASO 5: Métodos de pago ────────────────────────────────────────────────
  group('Paso 5 — Métodos de Pago', function () {
    const res = http.get(
      `${BASE_URL}/api/pagos/metodos`,
      { headers: buildHeaders(token), tags: { paso: '5_metodos' } }
    );
    check(res, {
      'P5 Métodos status 200': r => r.status === 200,
    }) || errorRate.add(1);
  });

  sleep(THINK_TIME);

  // ── PASO 6+7: Registrar pago (body grabado con correlación de IDs) ─────────
  group('Paso 6+7 — Registrar Pago', function () {
    const correlationId = uuidv4();
    const start = Date.now();
    const res = http.post(
      `${BASE_URL}/api/pagos/registrar`,
      JSON.stringify({
        telefono:       user.telefono,
        operador:       user.operador,
        monto:          parseFloat(user.monto),
        metodoPago:     user.metodoPago,
        correlationId:  correlationId,
        clienteId:      user.userId,
      }),
      { headers: buildHeaders(token), tags: { paso: '6_pago' } }
    );
    pagoLatencia.add(Date.now() - start);

    const passed = check(res, {
      'P6 Pago status 200':    r => r.status === 200,
      'P6 Folio generado':     r => {
        try { return JSON.parse(r.body).folioId !== undefined; } catch { return false; }
      },
    });
    if (passed) {
      try { folioId = JSON.parse(res.body).folioId; pagoId = JSON.parse(res.body).pagoId; }
      catch { /* sin correlación */ }
    } else {
      errorRate.add(1);
      ok = false;
    }
  });

  if (!ok) return;
  sleep(THINK_TIME);

  // ── PASO 8: Emitir recibo (body grabado con folio correlacionado) ──────────
  group('Paso 8 — Emitir Recibo', function () {
    const start = Date.now();
    const res = http.post(
      `${BASE_URL}/api/recibos/emitir`,
      JSON.stringify({
        folioId:    folioId || `FOLIO-${user.userId}`,
        pagoId:     pagoId  || `PAGO-${user.userId}`,
        telefono:   user.telefono,
        monto:      parseFloat(user.monto),
        operador:   user.operador,
        clienteId:  user.userId,
      }),
      { headers: buildHeaders(token), tags: { paso: '8_recibo' } }
    );
    reciboLatencia.add(Date.now() - start);

    check(res, {
      'P8 Recibo status 200 o 201': r => r.status === 200 || r.status === 201,
      'P8 Recibo con número':       r => {
        try { return JSON.parse(r.body).numeroRecibo !== undefined; } catch { return false; }
      },
    }) || errorRate.add(1);
  });
}

// ── Summary al finalizar ──────────────────────────────────────────────────────
export function handleSummary(data) {
  const m = data.metrics;
  const p = v => v?.values?.['p(95)'] != null ? v.values['p(95)'].toFixed(0) + ' ms' : 'N/A';
  const r = v => v?.values?.rate != null ? (v.values.rate * 100).toFixed(2) + '%' : 'N/A';

  console.log('\n════════════════════════════════════════════');
  console.log('  AT&T PoC — HTTPS Recording k6 Summary');
  console.log('════════════════════════════════════════════');
  console.log(`  Auth p95:         ${p(m.recording_auth_ms)}`);
  console.log(`  Cliente p95:      ${p(m.recording_cliente_ms)}`);
  console.log(`  Pago p95:         ${p(m.recording_pago_ms)}`);
  console.log(`  Recibo p95:       ${p(m.recording_recibo_ms)}`);
  console.log(`  HTTP p95:         ${p(m['http_req_duration'])}`);
  console.log(`  Error rate:       ${r(m.recording_errors)}`);
  console.log('════════════════════════════════════════════\n');
  return {};
}
