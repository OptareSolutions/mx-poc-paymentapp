# Pipeline CI/CD AT&T PoC QA — Documentación

## Descripción

Pipeline principal de GitHub Actions que orquesta la suite completa de pruebas de la PoC AT&T PaymentBox. Define el proceso automatizado de CI/CD con calidad, rendimiento y automatización RPA.

## Archivo de Pipeline

**Ubicación en repositorio:** `.github/workflows/ci-cd-att.yml`  
**Copia local:** `C:\Users\jcunha\Documents\Optare\Clientes\AT_T\QA\02_CI_CD\ci-cd-att.yml`

---

## Triggers (Activación Automática)

| Evento | Ramas | Descripción |
|--------|-------|-------------|
| `push` | Todas excepto `main` | Build automático en cada commit |
| `pull_request` | Todas excepto `main` | Validación antes de merge |

> ⚠️ **Nunca se ejecuta en `main`** — protección explícita con `branches-ignore: [main]`.

---

## Arquitectura del Pipeline

```
push / pull_request (no main)
         │
    ┌────┴────────────────────────────────────────┐
    │                  PARALELO                    │
    │                                              │
    ▼           ▼           ▼           ▼          │
[api-testing] [performance] [ui-testing] [rpa]     │
   Karate        k6          Selenium   Playwright  │
    │           │           │           │           │
    └────┬──────┴─────┬─────┴─────┬─────┘          │
         │            │           │                 │
         ▼            ▼           ▼                 │
              [quality-gate]                        │
           Evaluación consolidada                   │
    └────────────────────────────────────────────────┘
```

---

## Jobs

### 1. API Testing — Karate

**Propósito:** Validar funcionalidad, contratos e integración de las APIs REST.

| Aspecto | Detalle |
|---------|---------|
| Framework | Karate DSL (Maven/Java 17) |
| Tests | Funcional, Contrato, Integración |
| Entorno | Simulación Docker Compose local |
| Artefactos | `api-testing-results-<run>` |
| Bloquea QG | ✅ Sí |

**Flujo:**
1. Checkout código
2. Login GHCR (`$GITHUB_TOKEN`)
3. `docker compose up --build --wait` (simulation/)
4. Health check microservice-a
5. `mvn test -Dkarate.env=ci`
6. Upload resultados Karate
7. `docker compose down -v`

### 2. Performance Testing — k6

**Propósito:** Verificar que la ruta crítica de pago cumple los umbrales de latencia.

| Aspecto | Detalle |
|---------|---------|
| Framework | k6 |
| Test | smoke_recarga.js (1 VU, 1 min) |
| Umbrales | p95 < 2s, error rate < 1% |
| Entorno | Simulación Docker Compose local |
| Artefactos | `performance-results-<run>` |
| Bloquea QG | ✅ Sí |

**Flujo:**
1. Checkout + GHCR login
2. `docker compose up --build --wait`
3. Health check microservice-a
4. Instalar k6 vía apt
5. `k6 run --env BASE_URL=http://localhost:8080 tests/k6/smoke_recarga.js`
6. Upload resultados JSON
7. `docker compose down -v`

### 3. UI Testing — Selenium *(condicional)*

**Activación:** Variable de repositorio `UI_TESTS_ENABLED = true`

| Aspecto | Detalle |
|---------|---------|
| Framework | Selenium WebDriver + JUnit 5 + WebDriverManager |
| Browser | Chrome (Google Chrome stable) |
| Entorno | Simulación Docker Compose + UI Angular en puerto 4200 |
| Artefactos | `ui-testing-results-<run>` |
| Bloquea QG | ❌ No (informativo en PoC) |

### 4. RPA — Salesforce Playwright *(condicional)*

**Activación:** Variable de repositorio `RPA_ENABLED = true`

| Aspecto | Detalle |
|---------|---------|
| Framework | Python 3.11 + Playwright |
| Target | Salesforce (sistema externo) |
| Scripts | `tests/rpa/main.py` |
| Artefactos | `rpa-evidencias-<run>` (screenshots) |
| Bloquea QG | ❌ No (informativo en PoC) |

**Secrets requeridos:**
- `SF_URL` — URL de Salesforce
- `SF_USERNAME` — Usuario Salesforce
- `SF_PASSWORD` — Contraseña Salesforce
- `SF_SECURITY_TOKEN` — Security token de Salesforce

### 5. Quality Gate

**Propósito:** Evaluar los resultados de todos los jobs y determinar si el pipeline tiene éxito o falla.

| Job | Comportamiento si falla |
|-----|------------------------|
| api-testing | 🚫 Bloquea pipeline (`exit 1`) |
| performance | 🚫 Bloquea pipeline (`exit 1`) |
| ui-testing | ⚠️ Warning informativo |
| rpa | ⚠️ Warning informativo |

---

## Entorno de Simulación

El entorno de simulación (Docker Compose) se levanta independientemente en cada job que lo necesita (api-testing, performance, ui-testing). Esto garantiza aislamiento entre jobs y permite ejecución paralela sin conflictos de puertos.

### Servicios del entorno

| Servicio | Puerto | Descripción |
|----------|--------|-------------|
| microservice-a | 8080 | API Core PaymentBox |
| microservice-b | 18081 | Customer Profile Service |
| ui-paymentbox | 4200 | Angular SPA |
| mock-operador | 4010 | Prism Mock operador telco |
| mock-recibo | 4011 | Prism Mock recibo/folio |
| db-simulado | 5432 | PostgreSQL con datos Billy 1-3 |

---

## Artefactos de Resultados

Todos los artefactos tienen retención de **30 días** y están disponibles en la pestaña **Actions > Summary > Artifacts** de GitHub.

| Artefacto | Contenido |
|-----------|-----------|
| `api-testing-results-N` | Reportes Karate HTML + Cucumber JSON |
| `performance-results-N` | Resultados k6 en JSON |
| `ui-testing-results-N` | Reportes Surefire + screenshots Selenium |
| `rpa-evidencias-N` | Screenshots del flujo Salesforce |

---

## Seguridad

El pipeline sigue las mejores prácticas de seguridad para GitHub Actions:

- **Actions pinadas a SHA completo** — Inmutables, resistentes a supply-chain attacks  
  ```yaml
  uses: actions/checkout@34e114876b0b11c390a56381ad16ebd13914f8d5 # v4
  ```
- **Permisos mínimos** — `contents: read` por defecto; solo `checks: write` y `pull-requests: write` cuando es necesario
- **Secrets como variables de entorno** — Nunca en líneas de comando o logs
- **Control de concurrencia** — Cancela builds obsoletos en PRs
- **Sin credenciales hardcodeadas** — GHCR usa `${{ secrets.GITHUB_TOKEN }}` automático

### SHAs de acciones utilizadas

| Acción | SHA | Versión |
|--------|-----|---------|
| actions/checkout | `34e114876b0b11c390a56381ad16ebd13914f8d5` | v4 |
| actions/setup-java | `c1e323688fd81a25caa38c78aa6df2d33d3e20d9` | v4 |
| actions/setup-python | `a26af69be951a213d495a4c3e4e4022e16d87065` | v5 |
| actions/upload-artifact | `ea165f8d65b6e75b540449e92b4886f43607fa02` | v4 |

---

## Configuración Inicial

### Variables de repositorio

Configurar en **Settings > Secrets and variables > Actions > Variables**:

```
UI_TESTS_ENABLED = true   # Activar UI Testing
RPA_ENABLED      = true   # Activar RPA Salesforce
```

### Secrets de repositorio

Configurar en **Settings > Secrets and variables > Actions > Secrets**:

```
SF_URL             = https://login.salesforce.com
SF_USERNAME        = usuario@dominio.com
SF_PASSWORD        = xxxxxxxx
SF_SECURITY_TOKEN  = xxxxxxxxxxxxxxxx
```

### Estructura esperada en el repositorio

```
att-poc-paymentbox/
├── .github/workflows/
│   └── ci-cd-att.yml          ← Este pipeline
├── simulation/
│   └── docker-compose.yml     ← Entorno de simulación
├── microservice-a/            ← Código fuente Java
├── microservice-b/            ← Código fuente Java
├── ui-paymentbox/             ← Angular SPA
└── tests/
    ├── functional-karate/     ← Tests Karate (Maven)
    ├── k6/                    ← Scripts k6
    │   └── smoke_recarga.js
    ├── ui-selenium/           ← Tests Selenium (Maven)
    └── rpa/                   ← Scripts RPA Python
        ├── main.py
        └── requirements.txt
```

---

## Ejecución Manual

El pipeline se puede disparar manualmente desde **GitHub Actions > Workflows > AT&T PoC QA — Pipeline CI/CD Orquestador > Run workflow**.

---

## Branching Strategy (GitFlow)

El modelo de ramas sigue el flujo `feature/* → E → A → F → PRODUCCION`, donde cada transición tiene controles de calidad específicos.

| Rama | Ambiente | Trigger automático | Descripción |
|------|----------|--------------------|-------------|
| `feature/*` | Local / CI | push / PR → E | Desarrollo de funcionalidades |
| `E` | Desarrollo (`env-e`) | push / PR → A | Integración continua del equipo |
| `A` | QA (`env-a`) | push / PR → F | Validación por el equipo de calidad |
| `F` | UAT (`env-f`) | push / PR → PRODUCCION | Aceptación por el negocio |
| `PRODUCCION` | Producción (`prod`) | push (post-aprobación) | Entorno productivo |

> 📄 **Estrategia detallada:** Ver [`gitflow-pipeline-strategy.md`](./gitflow-pipeline-strategy.md) para la tabla completa de qué controles se ejecutan en cada contexto (push, PR, merge) y las acciones de consolidación de pipelines pendientes.

---

*Documentado en: `doc/02_CI_CD/README.md`*  
*AT&T PaymentBox PoC*
