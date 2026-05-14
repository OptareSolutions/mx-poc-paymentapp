# Estrategia GitFlow de Pipelines — AT&T PaymentBox PoC

> **Proyecto:** AT&T PaymentBox PoC  
> **Módulo:** CI/CD — Ramas, PRs y ejecución por contexto  
> **Última actualización:** 2026-05-13  
> **Issues de referencia:** TRA-18 / TRA-19 / **TRA-33** (alineado a rama `E`)

### Rama base del análisis (`E`)

En este repositorio, la **rama `E`** es la rama de integración de desarrollo: es la referencia sobre la que se validó este documento (lectura de `.github/workflows/*.yml` en el mismo commit en que vive la rama `E`, no la rama `main` ni el `default_branch` de GitHub a menos que coincidan). Los triggers, `paths:` y reusables descritos aquí reflejan ese árbol.

Si necesitas comprobar el detalle en tu clon: `git fetch origin E && git checkout E` y abre los YAML en esa revisión. El cambio de documentación de TRA-33 se integra vía PR con **base `E`**.

---

## Para quién es este documento

Cualquier persona puede seguir el flujo leyendo **tres ideas**:

1. **Ramas fijas** (`E`, `A`, `F`, `PRODUCCION`) representan ambientes; `feature/*` es trabajo en curso.  
2. **Los merges solo avanzan en una dirección:** feature → E → A → F → PRODUCCION (mediante PRs).  
3. **GitHub Actions** dispara pipelines distintos según *evento* (push vs pull request) y *rama*. No todo corre en todas las ramas: muchos jobs tienen **filtros `paths`** (por ejemplo, solo si `microservice-a/**` cambió).

---

## Modelo de ramas y promoción

```
feature/* ──PR──► E ──PR──► A ──PR──► F ──PR──► PRODUCCION
              env-e      env-a      env-f         prod
```

| Rama | Overlay Kustomize | Rol |
|------|-------------------|-----|
| `feature/*` | — | Desarrollo aislado; CI rápido o validación hacia `E`. |
| `E` | `env-e` | Integración del equipo (desarrollo compartido). |
| `A` | `env-a` | QA. |
| `F` | `env-f` | UAT / preproducción. |
| `PRODUCCION` | `prod` | Producción. |

**Regla de oro:** un cambio “salta” de ambiente solo cuando el PR correspondiente se **aprueba y se mergea**; el push resultante en la rama destino es lo que suele disparar **build, imagen, y despliegue GitOps** (cuando aplica).

---

## Stack (herramientas que componen el flujo)

| Capa | Herramientas |
|------|----------------|
| CI/CD | GitHub Actions (callers + `workflow_call` reusables) |
| Build | Gradle 8, Java 17 (Temurin) |
| Calidad | Gitleaks, SonarCloud, Trivy (filesystem + imagen) |
| Registro de imágenes | Docker, GHCR (`ghcr.io`) |
| Despliegue | Kustomize + commit GitOps + sincronización tipo ArgoCD (en pipeline) |
| API / contrato | Karate (`@smoke`, `@e2e`, `@contract`), oasdiff |
| Rendimiento | k6 (`performance-smoke.yml`, `performance-load-2k.yml`) |
| RPA Salesforce | `rpa.yml` (Playwright; política **informativa** o **bloqueante** según variables) |

---

## Inventario de workflows (referencia rápida)

| Workflow | Rol |
|----------|-----|
| `pipeline-microservice-a.yml` / `pipeline-microservice-b.yml` | Caller del pipeline reusable por microservicio (rama y evento). |
| `reusable-microservice-pipeline.yml` | Build → tests → quality gates → publish imagen → (push) aprobación operaciones si aplica → deliver GitOps. |
| `testing-factory.yml` | **CI de feature y PR hacia `E`:** API reusable + k6 smoke + RPA informativo. |
| `golden-pipeline-testing.yml` | **Suite completa** en push a `E`/`A`/`F`/`PRODUCCION` y PR hacia `A`/`F`/`PRODUCCION`. |
| `reusable-api-testing.yml` | Karate + oasdiff reutilizable (lo llaman Testing Factory y Golden). |
| `pipeline-contrato-openapi.yml` | oasdiff / contrato OpenAPI en PR (`E`, `A`, `F`, `PRODUCCION`) y push (`A`, `F`) con paths acotados. |
| `performance-smoke.yml` | k6 smoke reusable + `schedule` nocturna (02:00 UTC) + `workflow_dispatch`. |
| `performance-load-2k.yml` | Carga larga (manual / invocable); pensado para gates de release. |
| `rpa.yml` | RPA reusable (Playwright). |
| `pipeline-integration.yml` | **Solo manual** (`workflow_dispatch`): demo de promoción con tests de contrato/E2E (ver nota más abajo). |
| `ci-cd-att.yml` | **Solo manual** (`workflow_dispatch`): orquestador legacy Karate + k6 + Selenium/RPA opcionales y quality gate interno. |
| `api-smoke-tests.yml` | **Solo manual** — smoke Karate autocontenido. |

---

## Leyenda (tablas siguientes)

| Símbolo | Significado |
|---------|-------------|
| ✅ | Bloqueante si el job corre y falla |
| ⚠️ / informativo | Corre pero no rompe el pipeline (o depende de una variable) |
| 📋 | Manual (`workflow_dispatch`) o revisión humana fuera del YAML |
| — | No aplica o no está cableado en ese evento |

Muchos workflows solo corren si cambian rutas bajo `paths:` (por ejemplo `microservice-a/**`). Si solo editas documentación en `doc/**`, **no esperes** el pipeline del microservicio.

---

## Qué corre en cada momento (visión por rama y evento)

### A) Push a `feature/*`

| Qué | Workflow típico | Notas |
|-----|-----------------|--------|
| Build + tests + Sonar + Trivy FS + publicar imagen | `pipeline-microservice-*.yml` | Solo si cambió el microservicio o los YAML/toml relacionados. **No ejecuta Deliver** (deploy) en feature: Deliver exige `push` a `E`/`A`/`F`/`PRODUCCION`. |
| API + contrato + k6 smoke + RPA informativo | `testing-factory.yml` | Solo si cambian app, tests, simulación o workflows listados en `paths`. RPA suele ser **informativo** (`enforce_gate: false`). |

**Objetivo:** feedback rápido al desarrollador sin desplegar a clusters compartidos.

---

### B) Pull Request `feature/*` → `E`

| Qué | Workflow | Notas |
|-----|----------|--------|
| Build + tests + Gitleaks + Sonar + Trivy FS + build/push imagen | `pipeline-microservice-*.yml` | Misma línea que push, pero **sin jobs de deploy** (`Deliver` y gates de operaciones están condicionados a `push`). |
| Karate (`@smoke`, `@e2e`, `@contract`) + oasdiff | `testing-factory.yml` → `reusable-api-testing.yml` | PR con base `E`. |
| k6 smoke 20 VUs | `testing-factory.yml` → `performance-smoke.yml` | Tras API exitosa. |
| RPA | `testing-factory.yml` → `rpa.yml` | **Informativo** salvo políticas futuras. |
| Breaking changes OpenAPI | `pipeline-contrato-openapi.yml` | Si tocan OpenAPI/Java bajo paths definidos. |

**Objetivo:** que lo que entra a `E` no rompa contratos ni performance básica.

---

### C) Push a `E` (tras merge a desarrollo)

| Qué | Workflow | Notas |
|-----|----------|--------|
| Pipeline microservicio completo hasta Deliver | `pipeline-microservice-*.yml` | Incluye E2E Karate + k6 local en `Deliver` para **microservice-a** (`test_runner: karate`); **microservice-b** usa runner `smoke`. |
| Suite completa API + k6 + RPA (política Golden) | `golden-pipeline-testing.yml` | `update_baseline` en k6 puede activarse en push a ramas de ambiente. |

**Objetivo:** imagen versionada, GitOps actualizado a `env-e`, validación post-merge.

---

### D) Pull Request `E` → `A`

| Qué | Workflow | Notas |
|-----|----------|--------|
| Validación microservicio (sin deploy hasta merge) | `pipeline-microservice-*.yml` | Igual patrón PR: build/publicación sin Deliver. |
| Golden: API + k6 + RPA | `golden-pipeline-testing.yml` | PR con base `A`. RPA puede volverse **bloqueante** si `RPA_BLOCKING_GATE=true` (variable de repo). |
| Contrato OpenAPI | `pipeline-contrato-openapi.yml` | Según paths. |

**Objetivo:** gate de calidad previo a QA. Las **aprobaciones de Operaciones** configuradas en GitHub no están en el job del PR: aparecen en el flujo de **`push` a `A`** (ver siguiente sección).

---

### E) Push a `A` (QA operativo)

| Qué | Workflow | Notas |
|-----|----------|--------|
| Publish + gate **OPERACIONES** + Deliver | `reusable-microservice-pipeline.yml` | Tras publish exitoso en **`push`** a `A`, el job `operations-approval` usa el environment `OPERACIONES` (revisores en GitHub). |
| Golden suite | `golden-pipeline-testing.yml` | Mantiene baseline de performance y RPA si variables lo piden. |

---

### F) Pull Request `A` → `F`

| Qué | Workflow | Notas |
|-----|----------|--------|
| Microservicio + Golden + OpenAPI | Igual patrón que PR hacia `A` pero base `F` | Carga pesada **no** está en Golden por defecto. |
| Load test 2000 VUs | `performance-load-2k.yml` | **Manual** o vía orquestación explícita; pensado como evidencia para UAT. |

---

### G) Push a `F` (UAT)

| Qué | Workflow | Notas |
|-----|----------|--------|
| Publish + gate **OPERACIONES** + Deliver a `env-f` | `reusable-microservice-pipeline.yml` | Misma lógica que `A`: aprobación en push post-publish. |
| Golden | `golden-pipeline-testing.yml` | Sigue validando en ramas de release. |

---

### H) Pull Request `F` → `PRODUCCION`

| Qué | Workflow | Notas |
|-----|----------|--------|
| Microservicio + Golden + OpenAPI | `pipeline-microservice-*.yml`, `golden-pipeline-testing.yml`, `pipeline-contrato-openapi.yml` | Máxima exigencia en tests reusables. |
| Revisión de carga previa | `performance-load-2k.yml` | **Manual** — el equipo revisa resultados antes o durante el PR. |

**Nota:** en el YAML actual, el environment `OPERACIONES` aplica a pushes de **`A`** y **`F`**, no a `PRODUCCION`. Para producción suelen sumarse **reglas de rama, revisores del PR y procedimiento fuera del repo** según la organización.

---

### I) Push a `PRODUCCION`

| Qué | Workflow | Notas |
|-----|----------|--------|
| Deliver a `prod` | `pipeline-microservice-*.yml` | Incluye Trivy imagen con severidad **CRITICAL** bloqueante, GitOps `prod`, E2E/smoke en entorno simulado según microservicio. |
| Golden | `golden-pipeline-testing.yml` | Valida la rama productiva tras cambios relevantes. |

---

## Tabla maestra simplificada (por tipo de control)

| Control | Herramienta | feature push | PR → E | push E | PR → A | push A | PR → F | push F | PR → PROD | push PROD |
|---------|-------------|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| Build + unit + JaCoCo ≥80% | Gradle | ✅* | ✅* | ✅* | ✅* | ✅* | ✅* | ✅* | ✅* | ✅* |
| Secrets + Sonar + Trivy FS | Gitleaks / Sonar / Trivy | ✅* | ✅* | ✅* | ✅* | ✅* | ✅* | ✅* | ✅* | ✅* |
| Docker build + Trivy imagen + GHCR | Docker / Trivy | ✅* | ✅* | ✅* | ✅* | ✅* | ✅* | ✅* | ✅* | ✅* |
| Deploy GitOps + sync | Kustomize / script ArgoCD | — | — | ✅ | — | ✅ | — | ✅ | — | ✅ |
| Karate + oasdiff (suites reusables) | Testing Factory / Golden | ✅† | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| k6 smoke | `performance-smoke.yml` | ✅† | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| k6 smoke baseline en ambiente | Golden / dispatch | — | — | ⚠‡ | — | ⚠‡ | — | ⚠‡ | — | ⚠‡ |
| RPA Salesforce | `rpa.yml` | ⚠ | ⚠ | ⚠§ | ⚠§ | ⚠§ | ⚠§ | ⚠§ | ⚠§ | ⚠§ |
| OpenAPI breaking (dedicated workflow) | `pipeline-contrato-openapi.yml` | — | ✅** | — | ✅** | — | ✅** | — | ✅** | — |
| Aprobación Operaciones (GitHub Environment) | `OPERACIONES` | — | — | — | — | ✅ | — | ✅ | — | — |
| Suite manual legacy | `ci-cd-att.yml` | 📋 | 📋 | 📋 | 📋 | 📋 | 📋 | 📋 | 📋 | 📋 |

\* Condicionado a `paths` del microservicio.  
† `testing-factory.yml` con filtro de cambios (`change-scope`).  
‡ `update_baseline` en Golden en push a ramas de ambiente cuando el job de performance corre.  
§ Política **informativa** por defecto en Testing Factory; en Golden puede ser **bloqueante** si `RPA_BLOCKING_GATE=true`.  
\** Solo si cambian OpenAPI o código bajo paths del workflow.

---

## Casos de uso (cómo leer el flujo en la práctica)

| Caso | Qué hacer | Qué observar en Actions |
|------|-----------|-------------------------|
| Desarrollo en una feature | Push a `feature/…` | `testing-factory` + quizá `pipeline-microservice-*` según archivos tocados. |
| Integrar a desarrollo compartido | PR a `E` | Testing Factory + OpenAPI + pipelines de microservicio; tras merge, push a `E` despliega `env-e`. |
| Promover a QA | PR `E` → `A`; luego merge | En el **push** a `A`, revisar gate `OPERACIONES` antes del Deliver. |
| Promover a UAT | PR `A` → `F` | Igual: gate de operaciones en **push** a `F`. Evidencia de carga manual si aplica. |
| Release a producción | PR `F` → `PRODUCCION` | Tras merge, push ejecuta deliver `prod` y Golden; revisión de carga y aprobaciones según proceso del equipo. |
| Investigación / demo completa sin PR | Actions → `ci-cd-att.yml` | Ejecución manual (UI/Selenium y RPA opcionales vía variables `UI_TESTS_ENABLED`, `RPA_ENABLED`). |

---

## Variables de repositorio relevantes

| Variable | Efecto |
|----------|--------|
| `RPA_ENABLED` | En Golden, favorece ejecutar RPA en ramas `E`, `A`, `F`, `PRODUCCION`. En Testing Factory, fuerza RPA informativo si está en `true`. |
| `RPA_BLOCKING_GATE` | Si es `true`, Golden hace fallar el quality gate si RPA falla. |
| `UI_TESTS_ENABLED` | Solo para `ci-cd-att.yml` (manual): activa Selenium. |

Secrets típicos para RPA/SF están documentados en `rpa.yml` y en comentarios de `ci-cd-att.yml`.

---

## Flujo visual (resumen)

```
feature/*  ──push──► build/test rápido (paths) + Testing Factory (paths)
     │
     └── PR a E ──► API reusable + k6 + RPA info + OpenAPI (paths) + microservice PR jobs
              │
              merge/push E ──► deploy env-e + Golden + GitOps microservicios

E ──PR──► A ──► (merge) push A ──► gate OPERACIONES ──► deploy env-a + Golden
A ──PR──► F ──► (merge) push F ──► gate OPERACIONES ──► deploy env-f + Golden
F ──PR──► PRODUCCION ──► (merge) push PROD ──► deploy prod + Golden

Manuales puntuales: ci-cd-att.yml · api-smoke-tests.yml · pipeline-integration.yml · performance-load-2k.yml
```

---

## Limitaciones / deuda técnica conocida (no bloquean la lectura del flujo)

1. **`pipeline-integration.yml`** declara entradas `E`/`A`/`F`, pero el job `validate` aún contiene combinaciones antiguas (`develop`/`qa`/`uat`). Trátelo como **workflow de demostración** hasta alinear el script de validación con las ramas reales.  
2. **`performance-load-2k.yml`** usa etiquetas `develop`/`qa`/`uat` en inputs de entorno: son **nombres del workflow**, no necesariamente las ramas Git `E`/`A`/`F` — al ejecutarlo manualmente, elegir el valor coherente con el ambiente bajo prueba.  
3. **`golden-pipeline-testing.yml`** mantiene opciones históricas (`develop`, `qa`) en `workflow_dispatch` para inputs; las ramas de producto oficiales son `E`, `A`, `F`, `PRODUCCION`.

---

## Evolución y duplicidad histórica

La PoC consolidó pruebas API en **`reusable-api-testing.yml`** llamado desde **Testing Factory** (camino feature/→E) y **Golden** (release). Los workflows `ci-cd-att.yml` y `api-smoke-tests.yml` quedaron como **herramientas manuales** o legado documentado; no sustituyen a Factory/Golden en triggers automáticos.

---

*Documento: `doc/02_CI_CD/gitflow-pipeline-strategy.md`*  
*Actualizado para alineación con rama `E` y workflows en `.github/workflows/` (estado al 2026-05-13).*
