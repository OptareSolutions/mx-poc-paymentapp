# Estrategia GitFlow de Pipelines — AT&T PaymentBox PoC

> **Proyecto:** AT&T PaymentBox PoC  
> **Módulo:** CI/CD — Estrategia de Ejecución por Rama  
> **Última actualización:** 2026-05-13  
> **Issue de referencia:** TRA-18 / TRA-19

---

## Modelo de Ramas

```
feature/* ──→ E (Desarrollo) ──→ A (QA) ──→ F (UAT) ──→ PRODUCCION
               [env-e]            [env-a]     [env-f]      [prod]
```

| Rama | Ambiente | Propósito |
|------|----------|-----------|
| `feature/*` | Local / CI | Desarrollo de funcionalidades |
| `E` | Desarrollo (`env-e`) | Integración continua del equipo |
| `A` | QA (`env-a`) | Validación por el equipo de calidad |
| `F` | UAT (`env-f`) | Aceptación por el negocio |
| `PRODUCCION` | Producción (`prod`) | Entorno productivo |

---

## Inventario de Workflows

| Workflow | Tipo | Propósito |
|----------|------|-----------|
| `pipeline-microservice-a.yml` | Caller | CI/CD completo microservice-a |
| `pipeline-microservice-b.yml` | Caller | CI/CD completo microservice-b |
| `reusable-microservice-pipeline.yml` | Reusable (`workflow_call`) | Build → Test → Publish → Deliver |
| `ci-cd-att.yml` | Orquestador | API Testing + Performance + RPA + Quality Gate |
| `testing-factory.yml` | Orquestador | Quality Gates unificados |
| `pipeline-contrato-openapi.yml` | Especializado | oasdiff — breaking changes OpenAPI |
| `pipeline-integration.yml` | Manual | Promoción deliberada entre ambientes |
| `performance-smoke.yml` | Reusable (`workflow_call`) | k6 smoke performance |
| `performance-load-2k.yml` | Reusable (`workflow_call`) | k6 load 2000 VUs |
| `rpa.yml` | Especializado | RPA Salesforce (Node.js / Playwright) |

---

## Duplicados Identificados y Plan de Consolidación

### Grupo A — API Testing

Los siguientes workflows duplican la ejecución de pruebas Karate:

| Workflow | Overlap | Acción |
|----------|---------|--------|
| `ci-cd-att.yml` | Karate + k6 + RPA | **Conservar** — actualizar ramas a `E/A/F` |
| `api-smoke-tests.yml` | Subset de Karate @smoke | **Desactivar** trigger push; dejar solo `workflow_dispatch` |
| `golden-pipeline-testing.yml` | Karate + k6 + RPA | **Corregir** ramas `develop/qa/uat` → `E/A` |
| `testing-factory.yml` | Placeholders + RPA | **Actualizar** placeholders con Karate real |

### Grupo B — Smoke Performance

| Workflow | Overlap | Acción |
|----------|---------|--------|
| `ci-cd-att.yml` (job `performance`) | k6 duplicado | Reemplazar por llamada a `performance-smoke.yml` |
| `golden-pipeline-testing.yml` (job `smoke-performance`) | k6 duplicado | Igual |
| `testing-factory.yml` (job `performance-smoke`) | Script demo | Reemplazar por `workflow_call` a `performance-smoke.yml` |

### Grupo C — RPA

| Implementación | Tecnología | Estado |
|----------------|-----------|--------|
| `tests/rpa/main.py` | Python / Playwright | Desactivar de pipelines automáticos |
| `doc/02_CI_CD/rpa/scripts/rpa-flow.js` | Node.js / Playwright (JWT Salesforce) | **Activa** — usar desde `testing-factory.yml` |

---

## Estrategia de Ejecución por Contexto

### Leyenda

| Símbolo | Significado |
|---------|-------------|
| ✅ | Automático y **bloqueante** — falla el pipeline si no pasa |
| ⚠️ | Automático y **no bloqueante** — registra resultado sin bloquear |
| 📋 | Manual o bajo demanda — no dispara automáticamente |
| — | No aplica en este contexto |

---

### Tabla Maestra de Ejecución

La tabla se lee por **columna** (contexto de ejecución) e indica qué controles aplican en cada momento del ciclo de vida.

| Control de Calidad | Herramienta | `feature/*` push | PR `→ E` | `E` push | PR `E → A` | `A` push | PR `A → F` | `F` push | PR `F → PROD` | `PROD` push |
|--------------------|-------------|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| **BUILD** | | | | | | | | | | |
| Compilación (Gradle JAR) | Gradle 8 | ✅ | ✅ | ✅ | — | ✅ | — | ✅ | — | ✅ |
| Detección de secrets | Gitleaks | ✅ | ✅ | ✅ | — | — | — | — | — | — |
| Tests unitarios + cobertura | JUnit + JaCoCo (≥80%) | ✅ | ✅ | ✅ | — | ✅ | — | — | — | — |
| Análisis de calidad de código | SonarCloud | ✅ | ✅ | ✅ | — | — | — | — | — | — |
| **SEGURIDAD** | | | | | | | | | | |
| Escaneo de dependencias (JAR) | Trivy filesystem | — | ✅ | ✅ | — | — | — | — | — | — |
| Escaneo de imagen Docker | Trivy image | — | — | ✅ | — | ✅ | — | ✅ | — | ✅ |
| **API TESTING** | | | | | | | | | | |
| Breaking changes OpenAPI | oasdiff | — | ✅ | — | ✅ | — | ✅ | — | ✅ | — |
| Smoke tests de endpoints | Karate `@smoke` | — | ✅ | ✅ | ✅ | ✅ | — | ✅ | — | ✅ |
| Flujo E2E (8 pasos encadenados) | Karate `@e2e` | — | ✅ | — | ✅ | — | — | — | — | — |
| Contrato entre microservicios | Karate `@contract` | — | ✅ | — | ✅ | — | ✅ | — | ✅ | — |
| **PERFORMANCE** | | | | | | | | | | |
| Smoke performance (20 VUs / 7 min) | k6 | — | ✅ | ✅ | ✅ | ✅ | — | — | — | — |
| Load test (2000 VUs / 3600 s) | k6 | — | — | — | — | — | 📋 | — | 📋 | — |
| **AUTOMATIZACIÓN** | | | | | | | | | | |
| RPA Salesforce (flujo web completo) | Node.js + Playwright | — | ⚠️ | — | ⚠️ | ✅ | — | — | — | — |
| **ENTREGA** | | | | | | | | | | |
| Publicación imagen Docker (GHCR) | Docker + GHCR | — | — | ✅ | — | ✅ | — | ✅ | — | ✅ |
| Despliegue GitOps | Kustomize + ArgoCD | — | — | ✅ | — | ✅ | — | ✅ | — | ✅ |
| **APROBACIONES** | | | | | | | | | | |
| Gate manual — Operaciones | Approval GitHub | — | — | — | ✅ | — | ✅ | — | ✅ | — |
| Gate manual — Seguridad | Approval GitHub | — | — | — | — | — | — | — | ✅ | — |

---

## Descripción Detallada por Contexto

### 1. Push a `feature/*`

**Objetivo:** Feedback rápido al desarrollador. Sin simulación Docker ni despliegue.  
**Duración estimada:** 5–8 minutos.

| Etapa | Pipeline | Gate |
|-------|----------|------|
| Build + secrets + unit tests | `pipeline-microservice-*.yml` | ✅ Bloqueante |
| Cobertura ≥ 80% | `reusable-microservice-pipeline.yml` | ✅ Bloqueante |
| Análisis SonarCloud | `reusable-microservice-pipeline.yml` | ✅ Bloqueante |

---

### 2. Pull Request `feature/*` → `E`

**Objetivo:** Garantizar que el código que entra a la rama E no rompe contratos ni performance.  
**Duración estimada:** 15–20 minutos (jobs en paralelo).

| Etapa | Pipeline | Gate |
|-------|----------|------|
| Build + unit tests + Gitleaks + Trivy FS | `pipeline-microservice-*.yml` | ✅ Bloqueante |
| Breaking changes OpenAPI | `pipeline-contrato-openapi.yml` | ✅ Bloqueante |
| API Smoke (`@smoke`) | `ci-cd-att.yml` | ✅ Bloqueante |
| API Integration E2E (`@e2e`) | `ci-cd-att.yml` | ✅ Bloqueante |
| API Contract (`@contract`) | `ci-cd-att.yml` | ✅ Bloqueante |
| Smoke Performance (k6) | `ci-cd-att.yml` → `performance-smoke.yml` | ✅ Bloqueante |
| RPA Salesforce | `testing-factory.yml` | ⚠️ No bloqueante |

---

### 3. Push a `E` (integración post-merge)

**Objetivo:** Desplegar al ambiente de Desarrollo y ejecutar la suite completa post-deploy.

| Etapa | Pipeline | Gate |
|-------|----------|------|
| Build → JAR → Docker → tag `env-e-{sha}` | `pipeline-microservice-*.yml` | ✅ Bloqueante |
| Trivy imagen Docker | `reusable-microservice-pipeline.yml` | ✅ Bloqueante |
| Deploy a `env-e` (Kustomize + ArgoCD) | `reusable-microservice-pipeline.yml` | ✅ Bloqueante |
| API Smoke post-deploy | `ci-cd-att.yml` | ✅ Bloqueante |
| Smoke Performance + actualización de baseline | `performance-smoke.yml` | ✅ Bloqueante |

---

### 4. Pull Request `E` → `A` (gate de promoción a QA)

**Objetivo:** Gate de calidad estricto antes de QA. Usa imágenes reales del registry (no mocks locales).

| Etapa | Pipeline | Gate |
|-------|----------|------|
| Contract Tests (imágenes `env-e`) | `pipeline-integration.yml` | ✅ Bloqueante |
| E2E Full 8 pasos | `pipeline-integration.yml` | ✅ Bloqueante |
| Breaking changes OpenAPI | `pipeline-contrato-openapi.yml` | ✅ Bloqueante |
| Smoke Performance + comparación con baseline | `performance-smoke.yml` | ✅ Bloqueante |
| RPA Salesforce | `testing-factory.yml` | ⚠️ No bloqueante |
| **Aprobación manual — Operaciones** | GitHub Environments | ✅ Bloqueante |

---

### 5. Push a `A` (integración en QA)

**Objetivo:** Desplegar al ambiente de QA y ejecutar la suite completa.

| Etapa | Pipeline | Gate |
|-------|----------|------|
| Build → Docker → tag `env-a-{sha}` → push GHCR | `pipeline-microservice-*.yml` | ✅ Bloqueante |
| Trivy imagen | `reusable-microservice-pipeline.yml` | ✅ Bloqueante |
| Deploy a `env-a` | `reusable-microservice-pipeline.yml` | ✅ Bloqueante |
| API Smoke + Integration + Contract | `ci-cd-att.yml` | ✅ Bloqueante |
| Smoke Performance (nuevo baseline de A) | `performance-smoke.yml` | ✅ Bloqueante |
| RPA Salesforce | `testing-factory.yml` | ✅ Bloqueante |

---

### 6. Pull Request `A` → `F` (gate de promoción a UAT)

**Objetivo:** Validación antes de UAT. Incluye prueba de carga real.

| Etapa | Pipeline | Gate |
|-------|----------|------|
| Contract Tests | `pipeline-integration.yml` | ✅ Bloqueante |
| E2E Full 8 pasos | `pipeline-integration.yml` | ✅ Bloqueante |
| Breaking changes OpenAPI | `pipeline-contrato-openapi.yml` | ✅ Bloqueante |
| **Load Performance (2000 VUs / 3600 s)** | `performance-load-2k.yml` | 📋 Manual — resultado visible |
| RPA Salesforce | `testing-factory.yml` | ⚠️ No bloqueante |
| **Aprobación manual — Operaciones** | GitHub Environments | ✅ Bloqueante |

---

### 7. Push a `F` (integración en UAT)

**Objetivo:** Desplegar al ambiente de UAT con validación mínima post-deploy.

| Etapa | Pipeline | Gate |
|-------|----------|------|
| Build → Docker → tag `env-f-{sha}` → push GHCR | `pipeline-microservice-*.yml` | ✅ Bloqueante |
| Trivy imagen | `reusable-microservice-pipeline.yml` | ✅ Bloqueante |
| Deploy a `env-f` | `reusable-microservice-pipeline.yml` | ✅ Bloqueante |
| API Smoke post-deploy (health check) | `ci-cd-att.yml` | ✅ Bloqueante |
| Performance nocturno (nightly) | `performance-smoke.yml` (cron 02:00 UTC) | ⚠️ Informativo |

---

### 8. Pull Request `F` → `PRODUCCION` (gate de producción)

**Objetivo:** Gate más estricto del ciclo. Requiere aprobación de Operaciones y Seguridad.

| Etapa | Pipeline | Gate |
|-------|----------|------|
| Contract Tests | `pipeline-integration.yml` | ✅ Bloqueante |
| E2E Full 8 pasos | `pipeline-integration.yml` | ✅ Bloqueante |
| Breaking changes OpenAPI | `pipeline-contrato-openapi.yml` | ✅ Bloqueante |
| Revisión de resultados Load Test (de F) | `performance-load-2k.yml` | 📋 Revisión manual |
| **Aprobación manual — Seguridad** | GitHub Environments | ✅ Bloqueante |
| **Aprobación manual — Operaciones** | GitHub Environments | ✅ Bloqueante |

---

### 9. Push a `PRODUCCION`

**Objetivo:** Despliegue productivo con smoke test post-deploy y notificación.

| Etapa | Pipeline | Gate |
|-------|----------|------|
| Build → Docker → tag `prod-{sha}` → push GHCR | `pipeline-microservice-*.yml` | ✅ Bloqueante |
| Trivy imagen (CRITICAL/HIGH bloquea) | `reusable-microservice-pipeline.yml` | ✅ Bloqueante |
| Deploy a `prod` (Kustomize + ArgoCD) | `reusable-microservice-pipeline.yml` | ✅ Bloqueante |
| API Smoke post-deploy | `ci-cd-att.yml` | ✅ Bloqueante |
| Job Summary + notificación | GitHub Actions Summary | — |

---

## Flujo Visual Completo

```
feature/*
   │
   │  push → Build + Unit Tests + SonarCloud
   │
   ▼  Pull Request → E
   │  ├── API Smoke + E2E + Contract (Karate)
   │  ├── Breaking Changes (oasdiff)
   │  ├── Smoke Performance (k6 / 20 VUs)
   │  └── RPA Salesforce [no bloqueante]
   │
   ▼  merge → E
   │  Build → Docker → Deploy env-e → API Smoke + Performance (baseline)
   │
   ▼  Pull Request → A
   │  ├── Contract Tests (imágenes env-e reales)
   │  ├── E2E Full 8 pasos
   │  ├── Breaking Changes (oasdiff)
   │  ├── Smoke Performance (comparación vs baseline)
   │  └── Aprobación Operaciones [manual]
   │
   ▼  merge → A
   │  Build → Docker → Deploy env-a → API full + RPA + Performance
   │
   ▼  Pull Request → F
   │  ├── Contract Tests + E2E Full
   │  ├── Breaking Changes (oasdiff)
   │  ├── Load Test 2000 VUs [manual / revisión]
   │  └── Aprobación Operaciones [manual]
   │
   ▼  merge → F
   │  Build → Docker → Deploy env-f → Smoke post-deploy + Nightly perf
   │
   ▼  Pull Request → PRODUCCION
   │  ├── Contract Tests + E2E Full
   │  ├── Breaking Changes (oasdiff)
   │  ├── Aprobación Seguridad [manual]
   │  └── Aprobación Operaciones [manual]
   │
   ▼  merge → PRODUCCION
      Build → Docker → Deploy prod → Smoke post-deploy + Notificación
```

---

## Acciones Pendientes (TRA-19)

| # | Archivo | Acción requerida |
|---|---------|-----------------|
| 1 | `ci-cd-att.yml` | Actualizar triggers: push → `feature/**`, PR → `[E, A, F]` |
| 2 | `testing-factory.yml` | Reemplazar placeholders por Karate real + llamada a `performance-smoke.yml` |
| 3 | `golden-pipeline-testing.yml` | Corregir ramas `develop/qa/uat` → `E/A` o convertir en `workflow_call` |
| 4 | `api-smoke-tests.yml` | Desactivar trigger push; conservar `workflow_dispatch` |
| 5 | `rpa.yml` | Alinear paths con `testing-factory.yml` (evitar doble ejecución) |
| 6 | `pipeline-integration.yml` | Agregar llamada a `performance-load-2k.yml` como job opcional en A→F |

---

*Documentado en: `doc/02_CI_CD/gitflow-pipeline-strategy.md`*  
*Generado a partir del análisis en TRA-18 — AT&T PaymentBox PoC*
