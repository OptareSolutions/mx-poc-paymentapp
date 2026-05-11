# AT&T PaymentBox — Suite de Carga: 2k VUs / 3600s

## Descripción

Suite de pruebas de carga sostenida para el flujo E2E de recarga de PaymentBox.
Ejecuta **2000 usuarios virtuales durante 3600 segundos (1 hora)** cubriendo
los 8 pasos de negocio con correlación de IDs entre peticiones.

## Estructura

```
03_Performance_Testing/
├── scripts/
│   ├── load_test_2k_vus.js       # Script principal k6 (2k VUs / 3600s)
│   ├── data/
│   │   └── users_2k.json         # Dataset 100 usuarios de prueba
│   └── utils/
│       └── compare-baseline.js   # Comparador vs baseline histórico
├── workflows/
│   └── performance-load-2k.yml   # GitHub Actions workflow
├── resultados/                   # JSONs de ejecuciones (generados al correr)
├── reportes/                     # Dashboards HTML + comparaciones MD
└── README.md
```

## Flujo E2E (8 pasos con correlación de IDs)

```
Paso 2: GET  /api/clientes/buscar?telefono={tel}        → clienteTelefono
Paso 3: GET  /api/recargas/montos?operador={op}
Paso 4: POST /api/recargas/validar-operador?...
Paso 5: GET  /api/pagos/metodos
Paso 6+7: POST /api/pagos/registrar                     → folio (B-XXXXX)
Paso 8: POST /api/recibos/emitir?folio={folio}
```

Variables transportadas entre pasos:
- `clienteTelefono` — del paso 2 al paso 4
- `folio` — del paso 6+7 al paso 8 (correlación crítica)

## Estrategia de Carga

| Fase | Duración | VUs |
|------|----------|-----|
| Ramp-up | 0s–300s (5 min) | 0 → 2000 |
| Carga sostenida | 300s–3300s (50 min) | 2000 |
| Ramp-down | 3300s–3600s (5 min) | 2000 → 0 |

## Thresholds Configurados (Carga Alta)

| Métrica | Límite | Notas |
|---------|--------|-------|
| Flujo E2E completo p95 | < 8 000 ms | 8 pasos encadenados |
| Flujo E2E completo p99 | < 15 000 ms | percentil cola |
| Focalizar Cliente p95 | < 2 000 ms | paso crítico |
| Consulta + Operador p95 | < 2 500 ms | pasos 3+4 |
| Registrar Pago p95 | < 3 000 ms | escritura DB |
| Emitir Recibo p95 | < 3 000 ms | paso final |
| Error rate | < 2% | bajo carga alta |

> **Nota:** Estos thresholds son más permisivos que el smoke test (20 VUs) porque
> bajo carga de 2000 VUs se esperan tiempos de respuesta superiores. Para el
> smoke test los límites son: flujo p95 < 3s, error rate < 1%.

## Requisitos Previos

- [k6](https://k6.io/docs/get-started/installation/) ≥ v0.50.0
- Node.js ≥ 18 (para los scripts de comparación)
- Servicio PaymentBox levantado (o WireMock con mocks)

## Ejecución Local

```bash
# Test completo (2000 VUs, 3600s)
k6 run \
  --env BASE_URL=http://localhost:8080 \
  --env ENVIRONMENT=local \
  scripts/load_test_2k_vus.js

# Test reducido para validar script (50 VUs, 60s)
k6 run \
  --env BASE_URL=http://localhost:8080 \
  --env MAX_VUS=50 \
  --env DURATION_S=60 \
  scripts/load_test_2k_vus.js
```

## Ejecución CI (GitHub Actions)

```yaml
# Llamada manual desde GitHub Actions UI
workflow_dispatch → environment: qa, max_vus: 2000, duration_s: 3600

# Llamada desde otro pipeline
uses: ./.github/workflows/performance-load-2k.yml
with:
  base_url: http://api-host:8080
  environment: qa
```

> **IMPORTANTE:** El workflow está en `workflows/performance-load-2k.yml`.
> Copiarlo a `.github/workflows/` en el repositorio GitHub para que lo ejecute Actions.

## Comparación con Baseline

Después de una ejecución exitosa, comparar contra baseline anterior:

```bash
node scripts/utils/compare-baseline.js \
  --current   resultados/load_test_latest.json \
  --baseline  resultados/load_test_baseline.json \
  --output    reportes/comparison_report.md \
  --threshold 0.20
```

Exit code `0` = sin regresiones, `1` = regresiones detectadas.

## Métricas Reportadas

| Métrica | Descripción |
|---------|-------------|
| `flujo_completo_ms` | Duración total del flujo E2E de 8 pasos |
| `login_latencia_ms` | Tiempo del paso 2 (focalizar cliente) |
| `consulta_latencia_ms` | Tiempo pasos 3+4 (montos + operador) |
| `pago_latencia_ms` | Tiempo pasos 6+7 (registrar pago) |
| `recibo_latencia_ms` | Tiempo paso 8 (emitir recibo) |
| `load_errors` | Tasa de errores en el flujo |
| `flujos_exitosos` | Contador de flujos E2E completados OK |
| `flujos_fallidos` | Contador de flujos que fallaron |
| `folios_generados` | Contador de pagos registrados (folio B-XXXX) |
| `http_reqs` | Total de requests HTTP |
| `http_req_duration` | Latencia HTTP estándar k6 |

## Salidas del Test

- **`resultados/load_test_YYYY-MM-DDTHH-MM-SS.json`** — Resultado JSON completo
- **`resultados/load_test_latest.json`** — Último resultado (sobreescribe)
- **`reportes/dashboard_YYYY-MM-DDTHH-MM-SS.html`** — Dashboard HTML interactivo
- **`reportes/dashboard_latest.html`** — Último dashboard (sobreescribe)
- **`resultados/k6_raw_output.json`** — Salida raw k6 (generado solo en CI)

## Diferencias vs Smoke Test (02_CI_CD/performance/)

| Aspecto | Smoke | Load |
|---------|-------|------|
| VUs | 20 | 2000 |
| Duración | 7 min | 60 min (+ ramp) |
| Flujo p95 límite | 3 000 ms | 8 000 ms |
| Error rate límite | 1% | 2% |
| Propósito | Humo diario / CI | Validación de capacidad |
| Frecuencia | Diario (schedule) | Manual / release |

## Referencias

- GitHub PoC: https://github.com/OptareSolutions/mx-poc-paymentapp
- GitLab QA_POC_ATT: https://git.optare.net/jcunha/QA_POC_ATT
- Issue Multica: OPT-139
- k6 docs: https://k6.io/docs/
