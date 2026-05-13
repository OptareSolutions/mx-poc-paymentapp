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

---

## Tech Stack

| Categoría | Herramienta | Uso en este PoC |
|-----------|-------------|-----------------|
| API Functional | **Karate DSL** (Java/Maven) | Smoke tests con tag `@smoke`, validación HTTP + body |
| API Integration | **Karate DSL** | Flujo E2E 8 pasos con correlación de IDs entre servicios |
| API Contract | **oasdiff** + **Karate @contract** | Breaking changes OpenAPI/Swagger + contrato microservice-a→b |
| Smoke Perf. | **k6** (Grafana) | 20 VUs, 7 min, thresholds p95, comparación vs baseline |
| RPA | **Node.js + Playwright** | Flujo Salesforce completo 10 pasos con JWT auth headless |
| Mock externo | **Prism** (Stoplight) | Mock del operador y recibo vía especificación OpenAPI |
| Infraestructura | **Docker Compose** | Entorno completo simulado (ms-a, ms-b, BD, mocks) |
| Imágenes | **GHCR** (GitHub Container Registry) | Versionado por ambiente: `env-e-{sha}`, `env-a-{sha}` |
| Seguridad | **Gitleaks** + **Trivy** | Secrets en código + CVEs CRITICAL/HIGH en dependencias |
| Calidad código | **SonarCloud** + **JaCoCo** | Análisis estático + cobertura ≥ 80% |
| CD | **Kustomize** + **ArgoCD** | GitOps por overlay por ambiente |

---

## Arquitectura — Visión de 5 Etapas

```
┌──────────────────────────────────────────────────────────────────────────┐
│              PIPELINE COMPLETO — AT&T PaymentBox PoC                     │
├──────────────────────────────────────────────────────────────────────────┤
│  feature/**  →  testing-factory.yml (smoke + integración + contrato)     │
│  E/A push    →  golden-pipeline-testing.yml (suite completa)             │
│  A/F PR      →  golden-pipeline-testing.yml (suite completa)             │
└──────────────────────────────────────────────────────────────────────────┘

  ┌─────────────────────────────────────────────────────────────────────┐
  │  STAGE 1 · BUILD  (reusable-microservice-pipeline.yml)              │
  │  • Gitleaks (secret scan)                                           │
  │  • Unit Tests + JaCoCo (coverage gate ≥ 80%)                       │
  │  • SonarCloud (code quality)                                        │
  │  • Build JAR → artifact                                             │
  └─────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
  ┌─────────────────────────────────────────────────────────────────────┐
  │  STAGE 2 · TEST  (golden-pipeline-testing.yml / testing-factory)    │
  │                        [paralelo]                                    │
  │  ┌──────────────┐  ┌──────────────────┐  ┌──────────────────────┐  │
  │  │ 1a FUNCTIONAL│  │ 1b INTEGRATION   │  │ 1c CONTRACT          │  │
  │  │ Karate @smoke│  │ Karate @e2e      │  │ oasdiff OpenAPI      │  │
  │  │              │  │                  │  │ + Karate @contract   │  │
  │  │ • HTTP codes │  │ • Flujo 8 pasos  │  │ • 0 breaking changes │  │
  │  │ • Body valid.│  │ • Auth flow      │  │ • Campos/tipos       │  │
  │  └──────────────┘  └──────────────────┘  └──────────────────────┘  │
  │                                                                     │
  │  ┌───────────────────────────────┐  ┌──────────────────────────┐   │
  │  │ 2. SMOKE PERFORMANCE (k6)     │  │ 3. RPA (Node.js+Playwright│   │
  │  │ 20 VUs / 7 min                │  │    Salesforce — 10 pasos)│   │
  │  │ • flujo p95 < 3000ms          │  │ • Login · Oportunidad    │   │
  │  │ • login p95 < 700ms           │  │ • Producto · Crédito     │   │
  │  │ • consulta p95 < 900ms        │  │ • Pago · Closed Won      │   │
  │  │ • pago p95 < 1200ms           │  │ • Screenshots evidencia  │   │
  │  │ • error rate < 1%             │  │                          │   │
  │  └───────────────────────────────┘  └──────────────────────────┘   │
  └─────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
  ┌─────────────────────────────────────────────────────────────────────┐
  │  STAGE 3 · QUALITY GATES  (job consolidado)                         │
  │                                                                     │
  │  BLOQUEANTE   ┬─ API Functional   → 100% scenarios @smoke           │
  │  (exit 1 si   ├─ API Integration  → E2E 8 pasos sin error           │
  │   falla)      ├─ API Contract     → 0 breaking changes              │
  │               └─ Smoke Perf.      → todos los thresholds k6         │
  │                                                                     │
  │  OPCIONAL     └─ RPA              → ejecución completada            │
  │  (no bloquea)                                                        │
  └─────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
  ┌─────────────────────────────────────────────────────────────────────┐
  │  STAGE 4 · PUBLISH  (reusable-microservice-pipeline.yml)            │
  │  • Trivy scan (CRITICAL/HIGH CVEs)                                   │
  │  • Docker build → tag env-e|env-a|env-f|prod                        │
  │  • Push GHCR                                                         │
  │  • Update kustomization.yaml                                         │
  └─────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
  ┌─────────────────────────────────────────────────────────────────────┐
  │  STAGE 5 · DELIVER  (pipeline-integration.yml)                      │
  │  • Contract tests de promoción + E2E (gate de entrada al ambiente)  │
  │  • GitOps: Kustomize overlay actualizado                             │
  │  • ArgoCD sync: E (env-e) → A (env-a) → F (env-f) → PRODUCCION    │
  └─────────────────────────────────────────────────────────────────────┘
```

**Flujo de promoción entre ambientes:**

```
E (env-e) → [contrato+E2E gate] → A (env-a) → [contrato+E2E gate] → F (env-f) → [gate] → PRODUCCION
```

---

## Proceso por Audiencia

### Desarrolladores

**¿Qué pasa en cada push o pull request?**

1. El push a `feature/**` dispara `testing-factory.yml` automáticamente (smoke + integración + contrato + performance).
2. Si algún test falla, el job **Quality Gate** muestra qué suite falló con resumen visual en la tab "Summary" de GitHub Actions.
3. Los **breaking changes en OpenAPI** se comentan automáticamente en el PR con el diff de campos afectados.
4. El pipeline NO hace deploy hasta que todos los gates obligatorios pasan.
5. Los reportes Karate (HTML interactivo) y resultados k6 (JSON) quedan como **artifacts** descargables 30-90 días.

**Flujo típico de desarrollo:**

```
git push origin feature/mi-fix
  → testing-factory dispara
  → smoke: ¿el endpoint responde correctamente?
  → integration: ¿el flujo de 8 pasos sigue funcionando?
  → contract: ¿no rompiste el contrato con microservice-b?
  → performance: ¿el fix no introdujo regresión de latencia?
  → ✅ gate verde → PR hacia E → golden-pipeline en E/A/F
```

**Para agregar casos de prueba:**
- Funcional/integración: `tests/functional-karate/src/test/resources/features/recarga_flow.feature` con tag `@smoke` o `@e2e`.
- Contrato: `contract_microservices.feature` con `@contract`.
- Performance: ajustar thresholds en `tests/k6/smoke_performance.js` → sección `options.thresholds`.

---

### QAs

**Suites ejecutadas y cómo ver resultados:**

| Suite | Herramienta | Tag/Runner | Artifact |
|-------|-------------|------------|---------|
| Smoke Functional | Karate | `@smoke` | `api-functional-report-*` (HTML) |
| Integration E2E | Karate | `@e2e` / `testRecargaFlow` | `api-integration-report-*` (HTML) |
| Contract micro-a→b | Karate | `@contract` / `testContratoMicroservicios` | `api-contract-report-*` (JUnit XML) |
| Breaking changes | oasdiff | automático en PR | Comentario en PR + logs de Actions |
| Smoke Performance | k6 | `smoke_performance.js` | `smoke-performance-*` (JSON p95) |
| RPA Salesforce | Node.js + Playwright | `rpa-flow.js` | `rpa-results-*` (screenshots + logs) |

**Ver quality gates en GitHub UI:** Actions → run → tab "Summary" → tabla ✅/❌ con thresholds.

---

### Operaciones

- Solo si Build + Test + Quality Gates pasan, la imagen Docker se construye, escanea con Trivy y se sube a GHCR con tag `env-e-{sha}`.
- La promoción entre ambientes es **manual**: `pipeline-integration.yml` (workflow_dispatch) eligiendo `E→A`, `A→F` o `F→PRODUCCION`.
- Cada promoción requiere Contract Tests + E2E Full antes de actualizar el overlay de Kustomize.
- ArgoCD detecta el cambio en `kustomization.yaml` y hace sync automático al cluster destino.
- **Performance load 2k VUs:** ejecutar manualmente desde `performance-load-2k.yml` (60+ min, solo QA/UAT).

---

### Seguridad

| Control | Herramienta | Cuándo | Qué detecta |
|---------|-------------|--------|-------------|
| Secret scanning | Gitleaks | Cada push | Tokens, API keys, contraseñas en código |
| Vulnerabilidades deps | Trivy (FS) | Después del build | CVEs CRITICAL/HIGH en JARs |
| Vulnerabilidades imagen | Trivy (image) | Después del build Docker | CVEs en imagen final |
| Breaking changes API | oasdiff | Cada PR | Contratos rotos entre microservicios |
| Permisos mínimos | `permissions:` por job | Siempre | Least privilege por workflow |
| Pinning de actions | SHA completo | Siempre | Supply chain: versiones inmutables |
| Secrets | GitHub Secrets | RPA, GHCR | SF tokens → nunca en código |

---

## Evidencias y Reportes por Suite

| Suite | Formato | Artifact GitHub Actions | Retención |
|-------|---------|------------------------|-----------|
| Karate funcional | HTML interactivo + JUnit XML | `api-functional-report-*` | 30 días |
| Karate integración | HTML interactivo + JUnit XML | `api-integration-report-*` | 30 días |
| Karate contrato | JUnit XML + logs oasdiff | `api-contract-report-*` | 30 días |
| k6 smoke perf. | JSON con métricas p95 | `smoke-performance-*` | 90 días |
| k6 load 2k | JSON raw + comparación baseline | `load-test-results-*` | 90 días |
| RPA Salesforce | Screenshots PNG + logs JSON | `rpa-results-*` | 30 días |
| Trivy CVEs | SARIF | GitHub Security → Code Scanning | indefinido |

---

*Documentado en: `doc/02_CI_CD/README.md`*  
*AT&T PaymentBox PoC*
