# AT&T PoC QA — Criterios de Aceptación por Tipo de Prueba

> **Proyecto:** AT&T PaymentBox PoC  
> **Módulo:** CI/CD Quality Gates  
> **Ruta:** `C:\Users\jcunha\Documents\Optare\Clientes\AT_T\QA\02_CI_CD\quality_gates\`  
> **Última actualización:** 2026-05-07

---

## Resumen de Quality Gates

Todos los gates son **BLOQUEANTES**. El pipeline marca error si cualquiera falla.

| # | Tipo de Prueba | Herramienta | Criterio de Aceptación | Estado |
|---|----------------|-------------|------------------------|--------|
| 1 | API Testing Funcional | Karate (`@smoke`) | 0 smoke tests fallidos | BLOQUEANTE |
| 2 | API Testing Integración | Karate (`@integracion`) | Todos los flujos E2E completan sin error | BLOQUEANTE |
| 3 | API Testing Contrato | oasdiff (OpenAPI diff) | 0 breaking changes | BLOQUEANTE |
| 4 | Performance | k6 (smoke carga) | Todos los thresholds respetados | BLOQUEANTE |
| 5 | RPA Web | Node.js + Playwright | Flujo web completado exitosamente | BLOQUEANTE |

---

## Gate 1 — API Testing Funcional (Karate `@smoke`)

### Propósito
Verificar que todos los endpoints críticos de la API responden correctamente y que el contrato básico se cumple. Estos tests son la primera barrera de calidad.

### Endpoints cubiertos
| Paso Demo | Endpoint | Método | Criterio |
|-----------|----------|--------|----------|
| Paso 2 | `/api/clientes/buscar` | GET | HTTP 200, devuelve Billy 1-3 activos |
| Paso 3 | `/api/recargas/montos` | GET | HTTP 200, lista de montos disponibles |
| Paso 4 | `/api/recargas/validar-operador` | POST | HTTP 200, operador validado vía Prism |
| Paso 5 | `/api/pagos/metodos` | GET | HTTP 200, métodos de pago disponibles |
| Paso 6-7 | `/api/pagos/registrar` | POST | HTTP 201, pago registrado correctamente |
| Paso 8 | `/api/recibos/emitir` | POST | HTTP 200/201, recibo emitido vía Prism |
| Contrato | `/api/customers/{telefono}` | GET | HTTP 200, schema microservice-b válido |
| E2E | Ruta crítica 8 pasos | — | Flujo completo encadenado exitoso |

### Criterio de aceptación
- **PASA:** `failures = 0` en todos los reports JUnit generados por Karate
- **FALLA:** `failures >= 1` en cualquier test `@smoke`

### Artefactos generados
- `tests/functional-karate/target/surefire-reports/*.xml`
- `tests/functional-karate/target/karate-reports/`
- Artifact GitHub Actions: `qg-api-funcional-{run_number}`

### Runner
- Tag Karate: `@smoke`
- Clase: `RecargaFlowRunner#testSmoke`
- Directorio: `tests/functional-karate/`

---

## Gate 2 — API Testing Integración (Karate `@integracion`)

### Propósito
Verificar la integración completa entre microservice-a, microservice-b y los mocks externos (Prism). Valida flujos E2E multi-servicio que simulan el comportamiento real de la demo.

### Flujos cubiertos
| Flujo | Descripción | Criterio |
|-------|-------------|----------|
| Auth completo | Login → Refresh token → Logout | Todos los pasos encadenados OK |
| Cliente E2E | Búsqueda → Selección → Validación | Datos correctos en cada paso |
| Recarga E2E | Montos → Validar operador → Registrar pago → Emitir recibo | Flujo 8 pasos sin interrupciones |
| Integración cross-service | Llamadas encadenadas microservice-a ↔ microservice-b | Sincronización correcta |

### Criterio de aceptación
- **PASA:** Todos los escenarios Karate `@integracion` terminan con estado `passed`
- **FALLA:** Cualquier escenario termina con `failed` o `error`
- **Condición adicional:** exit code 0 en `mvn test`

### Artefactos generados
- `tests/integration-karate/target/surefire-reports/*.xml`
- `tests/integration-karate/target/karate-reports/`
- Artifact GitHub Actions: `qg-api-integracion-{run_number}`

### Runner
- Tag Karate: `@integracion`
- Directorio: `tests/integration-karate/`

---

## Gate 3 — API Testing Contrato (OpenAPI / oasdiff)

### Propósito
Garantizar que ninguna modificación en el código rompe el contrato API definido en las especificaciones OpenAPI. Previene regresiones que afectarían a los consumidores de la API.

### Servicios verificados
| Servicio | Especificación | Baseline |
|----------|---------------|---------|
| microservice-a | `microservice-a/docs/openapi.yaml` | Rama base (`develop`/`main`) |
| microservice-b | `microservice-b/docs/openapi.yaml` | Rama base (`develop`/`main`) |

### Breaking changes detectados
- Eliminación de endpoints o métodos HTTP existentes
- Adición de campos requeridos en el request body
- Renombrado o eliminación de campos en el response
- Cambio de tipo de datos en campos existentes
- Eliminación de valores de enum usados
- Cambio en parámetros obligatorios de query/path/header
- Cambio en códigos de respuesta existentes (2xx/4xx/5xx)

### Criterio de aceptación
- **PASA:** `breaking_changes = 0` en microservice-a y microservice-b
- **FALLA:** `breaking_changes >= 1` en cualquier microservicio
- **Herramienta:** `oasdiff breaking` (https://github.com/tufin/oasdiff)

### Artefactos generados
- Output de `oasdiff` visible en el log del job
- No se generan artefactos descargables (resultados en job log)

---

## Gate 4 — Performance Testing (k6)

### Propósito
Verificar que el flujo de recarga completo (8 pasos) cumple con los tiempos de respuesta aceptables bajo carga controlada. Garantiza la experiencia de usuario en la demo.

### Configuración de carga
| Parámetro | Valor |
|-----------|-------|
| Virtual Users (VUs) | 20 |
| Duración | 7 minutos |
| Flujo probado | Ruta crítica 8 pasos (recarga completa) |

### Thresholds de aceptación

| Métrica | Umbral | Descripción |
|---------|--------|-------------|
| `http_req_duration{name:"flujo_completo"}` p95 | **< 3000 ms** | Tiempo total del flujo de 8 pasos |
| `http_req_duration{name:"login"}` p95 | **< 700 ms** | Autenticación |
| `http_req_duration{name:"consulta_cliente"}` p95 | **< 900 ms** | Búsqueda de cliente |
| `http_req_duration{name:"registrar_pago"}` p95 | **< 1200 ms** | Registro del pago |
| `http_req_failed` rate | **< 1%** | Tasa de error global |

### Criterio de aceptación
- **PASA:** k6 termina con exit code `0` (todos los thresholds cumplidos)
- **FALLA:** k6 termina con exit code `99` (uno o más thresholds superados) o cualquier otro código de error

### Artefactos generados
- `tests/k6/results/smoke_summary.json`
- Artifact GitHub Actions: `qg-performance-{run_number}`

### Runner
- Script: `tests/k6/smoke_recarga.js`
- Variable: `BASE_URL=http://localhost:8080`

---

## Gate 5 — RPA Web (Node.js + Playwright)

### Propósito
Verificar que el flujo de automatización web completo puede ejecutarse en CI sin intervención humana. Valida la integración con el sistema web externo (configurado vía secrets).

### Flujo automatizado
| Paso | Acción | Criterio |
|------|--------|----------|
| 1 | Navegación a URL base | Carga correcta de la página |
| 2 | Autenticación | Login exitoso, sin errores |
| 3 | Búsqueda de registro | Elemento encontrado por record ID |
| 4 | Interacción / procesamiento | Acción completada sin timeout |
| 5 | Captura de evidencia | Screenshot guardado en `rpa/results/` |

### Criterio de aceptación
- **PASA:** `node scripts/rpa-flow.js` termina con exit code `0`
- **FALLA:** Exit code distinto de `0` (error de navegación, timeout, elemento no encontrado, etc.)

### Secrets requeridos
| Secret | Descripción |
|--------|-------------|
| `SF_URL` | URL base del sistema web |
| `SF_USERNAME` | Usuario de acceso |
| `SF_PASSWORD` | Contraseña |
| `SF_SECURITY_TOKEN` | Token de seguridad adicional |

### Artefactos generados
- Screenshots y logs en `rpa/results/`
- Artifact GitHub Actions: `qg-rpa-{run_number}`

---

## Notificaciones

### Slack (opcional)
Las notificaciones Slack se activan cuando:
1. El job `quality-gate` falla (algún gate no superado)
2. La variable de repositorio `SLACK_NOTIFICATIONS = true`
3. El secret `SLACK_WEBHOOK_URL` está configurado

### Contenido de la notificación
- Nombre de los gates fallidos
- Rama y número de run
- URL directa a la ejecución en GitHub Actions

---

## Activación del Pipeline

### Triggers automáticos
```yaml
on:
  push:
    branches-ignore: [main]   # cualquier rama excepto main
  pull_request:
    branches-ignore: [main]
```

### Ejecución manual (`workflow_dispatch`)
Parámetros disponibles:
| Parámetro | Valores | Descripción |
|-----------|---------|-------------|
| `skip_rpa` | `false` / `true` | Omite el gate de RPA |
| `skip_performance` | `false` / `true` | Omite el gate de Performance |

### NOTA IMPORTANTE
> ⛔ **Nunca hacer push/commit directamente a la rama `main`.**  
> El pipeline está configurado para ignorar eventos en `main`.  
> Los cambios deben llegar por rama de trabajo + Pull Request.

---

## Artefactos y Retención

| Artefacto | Contenido | Retención |
|-----------|-----------|-----------|
| `qg-api-funcional-{N}` | Reports Karate smoke tests | 30 días |
| `qg-api-integracion-{N}` | Reports Karate integración | 30 días |
| `qg-performance-{N}` | JSON resultados k6 | 30 días |
| `qg-rpa-{N}` | Screenshots y logs RPA | 30 días |

---

## Flujo del Pipeline

```
PUSH / PR
    │
    ├──────────────────────────────────────────────────┐
    │                                                  │
    ▼                    ▼                    ▼        ▼          ▼
[api-funcional]  [api-integracion]  [api-contrato]  [performance]  [rpa]
  (parallel)        (parallel)        (parallel)    (parallel)   (parallel)
    │                    │                    │        │          │
    └────────────────────┴────────────────────┴────────┴──────────┘
                                    │
                                    ▼
                           [quality-gate]
                         (needs: all 5 jobs)
                                    │
                    ┌───────────────┴───────────────┐
                    ▼                               ▼
              ✅ SUCCESS                       ❌ FAILURE
         (todos los gates OK)          (notificación Slack + bloqueo)
```

---

## Seguridad del Workflow

Según las mejores prácticas de GitHub Actions aplicadas en este pipeline:

- **Acciones pinadas a SHA inmutable** con comentario de versión (e.g., `actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683 # v4.2.2`)
- **Permisos mínimos** (`contents: read` por defecto; `checks: write` y `pull-requests: write` solo donde es necesario)
- **Secrets vía variables de entorno** — nunca expuestos en logs
- **Concurrencia controlada** — cancela builds obsoletos en PRs
- **Timeout por job** — evita runners bloqueados indefinidamente

---

## Quality Gates — Configuración Detallada

### Gate API Testing (Karate)

```yaml
# Gate Funcional: todos los @smoke deben pasar
api-functional → RecargaFlowRunner#testSmoke
  criterio:
    - GET  /api/clientes/buscar          → 200 + status ACTIVO
    - GET  /api/recargas/montos          → 200 + lista no vacía
    - POST /api/recargas/validar-operador → 200 + valido=true
    - GET  /api/pagos/metodos            → 200 + EFECTIVO/TARJETA/OODI
    - POST /api/pagos/registrar          → 201 + status APLICADO + folio B-*
    - POST /api/recibos/emitir           → 200 + status EMITIDO
  bloqueante: true
  exit_code_esperado: 0

# Gate Integración: flujo E2E completo
api-integration → RecargaFlowRunner#testRecargaFlow
  criterio:
    - Pasos 2→3→4→5→6+7→8 encadenados con IDs correlacionados
    - Sin errores en ningún paso del flujo
  bloqueante: true

# Gate Contrato: 0 breaking changes
api-contract → oasdiff + RecargaFlowRunner#testContratoMicroservicios
  criterio:
    - oasdiff exit 0 (sin breaking changes en openapi.yaml)
    - Campos: phone, fullName, status en /api/customers/{telefono}
    - Tipos y requerimientos sin cambios incompatibles
  bloqueante: true
```

### Gate Performance (k6 Thresholds)

```javascript
// tests/k6/smoke_performance.js
export const options = {
  scenarios: {
    smoke_performance: {
      executor: 'constant-vus',
      vus: 20,        // usuarios virtuales
      duration: '7m', // duración del test
    }
  },
  thresholds: {
    'http_req_duration{name:"flujo_completo"}': ['p(95)<3000'],  // flujo completo < 3s
    'http_req_duration{name:"login"}':          ['p(95)<700'],   // autenticación < 700ms
    'http_req_duration{name:"consulta"}':       ['p(95)<900'],   // montos + operador < 900ms
    'http_req_duration{name:"registrar_pago"}': ['p(95)<1200'],  // pago < 1200ms
    'http_req_failed':                          ['rate<0.01'],   // error rate < 1%
    'http_req_duration':                        ['p(95)<3000'],
  }
  // Datos parametrizados: tests/k6/data/users.json (5 perfiles Billy)
  // Think time entre pasos: 1-3s aleatorio
};
```

### Gate RPA (no bloqueante)

```yaml
# doc/02_CI_CD/rpa/scripts/rpa-flow.js — Node.js + Playwright (JWT auth)
flujo:
  - Paso 1: Login Salesforce (JWT → access token)
  - Paso 2: Crear/buscar Account
  - Paso 3: Crear Contact asociado
  - Paso 4: Crear Opportunity
  - Paso 5: Agregar Product Line Item
  - Paso 6: Verificar Biometrics / datos cliente
  - Paso 7: Credit check
  - Paso 8: Registrar Payment
  - Paso 9: Marcar Opportunity como Closed Won
  - Paso 10: Validar estado final + screenshot
criterio: node scripts/rpa-flow.js → exit code 0
bloqueante: false  # continue-on-error: true
artifacts: doc/02_CI_CD/rpa/results/ (screenshots PNG + logs JSON)
```

### Resumen de Bloqueantes

| Gate | Runner | Bloqueante | Condición de fallo |
|------|--------|-----------|-------------------|
| API Functional (@smoke) | `RecargaFlowRunner#testSmoke` | Sí | `failures >= 1` en JUnit XML |
| API Integration (@e2e) | `RecargaFlowRunner#testRecargaFlow` | Sí | Cualquier escenario `failed` |
| API Contract (oasdiff) | `oasdiff breaking` | Sí | exit code != 0 (breaking changes) |
| API Contract (Karate) | `RecargaFlowRunner#testContratoMicroservicios` | Sí | `failures >= 1` |
| Smoke Performance | k6 `smoke_performance.js` | Sí | k6 exit code `99` (threshold superado) |
| RPA Salesforce | Node.js `rpa-flow.js` | No | exit code != 0 (solo advertencia) |
