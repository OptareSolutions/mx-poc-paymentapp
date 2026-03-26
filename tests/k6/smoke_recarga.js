/**
 * k6 Smoke Test - Ruta Crítica PaymentBox AT&T (Paso 6 - Performance)
 * Valida o caminho crítico do fluxo de 8 passos sob carga mínima.
 *
 * Execução local:  k6 run tests/k6/smoke_recarga.js
 * Execução CI:     k6 run --env BASE_URL=http://localhost:8080 tests/k6/smoke_recarga.js
 */

import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// ── Métricas customizadas ────────────────────────────────────────────────────
const errorRate = new Rate('errors');
const pagoLatencia = new Trend('pago_latencia_ms', true);

// ── Configuração do Smoke Test ────────────────────────────────────────────────
export const options = {
  // Smoke: 1 VU, 1 minuto — valida que a rota crítica não está quebrada
  vus: 1,
  duration: '1m',
  thresholds: {
    http_req_duration: ['p(95)<2000'],  // 95% dos requests < 2s (DORA: MTTR)
    http_req_failed: ['rate<0.01'],     // < 1% de erros (Change Failure Rate)
    errors: ['rate<0.01'],
    pago_latencia_ms: ['p(95)<1500'],   // Rota de pagamento < 1.5s
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8080';

// ── Dados sintéticos (TDM - Perfil Billy 1) ───────────────────────────────────
const BILLY_1_TELEFONO = '4544';
const OPERADOR = 'BLUE';
const MONTO = 20.00;
const METODO_PAGO = 'EFECTIVO';
const NUMERO_ORDEN = `ORD-${Date.now()}`;

const headers = { 'Content-Type': 'application/json' };

export default function () {

  // ── Paso 2: Focalizar Cliente ───────────────────────────────────────────────
  group('Paso 2 - Focalizar Cliente Billy 1', () => {
    const res = http.get(`${BASE_URL}/api/clientes/buscar?telefono=${BILLY_1_TELEFONO}`);
    check(res, {
      'status 200': (r) => r.status === 200,
      'status ACTIVO': (r) => JSON.parse(r.body).status === 'ACTIVO',
      'es Billy': (r) => JSON.parse(r.body).nombre.includes('Billy'),
    }) || errorRate.add(1);
  });

  sleep(0.3);

  // ── Paso 3: Montos desde DB ─────────────────────────────────────────────────
  group('Paso 3 - Obtener Montos DB (BLUE)', () => {
    const res = http.get(`${BASE_URL}/api/recargas/montos?operador=${OPERADOR}`);
    check(res, {
      'status 200': (r) => r.status === 200,
      'tiene montos': (r) => JSON.parse(r.body).length > 0,
      'monto 20 existe': (r) => JSON.parse(r.body).some(m => m.monto === MONTO),
    }) || errorRate.add(1);
  });

  sleep(0.3);

  // ── Paso 4: Validar Operador (Mock Prism) ───────────────────────────────────
  group('Paso 4 - Validar API Operador (Prism)', () => {
    const res = http.post(
      `${BASE_URL}/api/recargas/validar-operador?telefono=${BILLY_1_TELEFONO}&operador=${OPERADOR}`,
      null, { headers }
    );
    check(res, {
      'status 200': (r) => r.status === 200,
      'valido true': (r) => JSON.parse(r.body).valido === true,
    }) || errorRate.add(1);
  });

  sleep(0.3);

  // ── Paso 5: Métodos de Pago ─────────────────────────────────────────────────
  group('Paso 5 - Métodos de Pago PaymentBox', () => {
    const res = http.get(`${BASE_URL}/api/pagos/metodos`);
    check(res, {
      'status 200': (r) => r.status === 200,
      'tem EFECTIVO': (r) => r.body.includes('EFECTIVO'),
      'tem TARJETA': (r) => r.body.includes('TARJETA'),
    }) || errorRate.add(1);
  });

  sleep(0.3);

  // ── Pasos 6 & 7: Registrar Pago (ruta crítica) ─────────────────────────────
  let folioGenerado = '';
  group('Pasos 6&7 - Registrar Pago (Ruta Crítica)', () => {
    const payload = JSON.stringify({
      telefonoCliente: BILLY_1_TELEFONO,
      monto: MONTO,
      metodoPago: METODO_PAGO,
      numeroOrden: NUMERO_ORDEN,
    });
    const start = Date.now();
    const res = http.post(`${BASE_URL}/api/pagos/registrar`, payload, { headers });
    pagoLatencia.add(Date.now() - start);

    const ok = check(res, {
      'status 201': (r) => r.status === 201,
      'status APLICADO': (r) => JSON.parse(r.body).status === 'APLICADO',
      'folio gerado': (r) => JSON.parse(r.body).folio.startsWith('B-'),
    });
    if (!ok) errorRate.add(1);
    else folioGenerado = JSON.parse(res.body).folio;
  });

  sleep(0.3);

  // ── Paso 8: Emitir Recibo ───────────────────────────────────────────────────
  if (folioGenerado) {
    group('Paso 8 - Emitir Recibo (Prism Mock)', () => {
      const res = http.post(
        `${BASE_URL}/api/recibos/emitir?folio=${folioGenerado}&numeroOrden=${NUMERO_ORDEN}`,
        null, { headers }
      );
      check(res, {
        'status 200': (r) => r.status === 200,
        'status EMITIDO': (r) => JSON.parse(r.body).status === 'EMITIDO',
        'tem url_pdf': (r) => JSON.parse(r.body).url_pdf !== undefined,
      }) || errorRate.add(1);
    });
  }

  sleep(1);
}

// ── Relatório final ───────────────────────────────────────────────────────────
export function handleSummary(data) {
  return {
    'tests/k6/results/smoke_summary.json': JSON.stringify(data, null, 2),
    stdout: '\n=== AT&T PaymentBox - Smoke Test Completo ===\n',
  };
}
