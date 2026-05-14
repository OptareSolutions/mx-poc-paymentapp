# Estrategia GitFlow de Pipelines — AT&T PaymentBox PoC

> **Proyecto:** AT&T PaymentBox PoC  
> **Módulo:** CI/CD — Ramas, PRs y ejecución por contexto  
> **Última actualización:** 2026-05-14  
> **Issues de referencia:** TRA-18 / TRA-19 / TRA-33 / **TRA-41** (guion de demostración y matriz)

> **Doble verificación:** contenido contrastado con los workflows de la rama **`E`** (`reusable-microservice-pipeline.yml`, callers, `testing-factory.yml`, `golden-pipeline-testing.yml`, `pipeline-contrato-openapi.yml`). Tras cada sincronización con `origin/E`, conviene revisar que los `paths:` sigan coincidiendo.

### Rama base del análisis (`E`)

En este repositorio, la **rama `E`** es la rama de integración de desarrollo: es la referencia sobre la que se validó este documento (lectura de `.github/workflows/*.yml` en el mismo commit en que vive la rama `E`, no la rama `main` ni el `default_branch` de GitHub a menos que coincidan). Los triggers, `paths:` y reusables descritos aquí reflejan ese árbol.

Si necesitas comprobar el detalle en tu clon: `git fetch origin E && git checkout E` y abre los YAML en esa revisión. El cambio de documentación de TRA-33 se integra vía PR con **base `E`**.

> **Nota:** en clones que aún no han integrado la rama `E`, puede verse un conjunto de workflows orientado a `develop` / `qa` / `uat` / `main`. El flujo **oficial de la PoC** para PaymentBox es el modelado en **`E`** con ramas nominales `E`, `A`, `F`, `PRODUCCION` y `feature/**`.

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
| `feature/*` | — (en reusable, overlay por defecto orientado a `env-e` en ramas no productivas) | Desarrollo aislado; CI rápido o validación hacia `E`. |
| `E` | `env-e` | Integración del equipo (desarrollo compartido). |
| `A` | `env-a` | QA. |
| `F` | `env-f` | UAT / preproducción. |
| `PRODUCCION` | `prod` | Producción. |

**Regla de oro:** un cambio “salta” de ambiente solo cuando el PR correspondiente se **aprueba y se mergea**; el push resultante en la rama destino es lo que suele disparar **build, imagen, y despliegue GitOps** (cuando aplica).

---

## Stack (herramientas que componen el flujo)

| Capa | Herramientas |
|------|--------------|
| CI/CD | GitHub Actions (callers + `workflow_call` reusables) |
| Build | Gradle 8, Java 17 (Temurin) |
| Calidad | Gitleaks, SonarCloud, Trivy (filesystem + imagen) |
| Registro de imágenes | Docker, GHCR (`ghcr.io`) |
| Despliegue | Kustomize + commit GitOps + sincronización tipo ArgoCD (en pipeline) |
| API / contrato | Karate (`@smoke`, `@e2e`, `@contract`), oasdiff |
| Rendimiento | k6 (workflow reusable `performance-smoke.yml`) |
| RPA Salesforce | `rpa.yml` (Playwright; política **informativa** o **bloqueante** según variables en Golden) |

---

## Inventario de workflows (referencia rápida)

| Workflow | Rol |
|----------|-----|
| `pipeline-microservice-a.yml` / `pipeline-microservice-b.yml` | Caller del pipeline reusable por microservicio (rama y evento). |
| `reusable-microservice-pipeline.yml` | `Reusable: Microservice CI/CD pipeline` — build → test → quality gates (según rama/evento) → publish imagen (tag `versión-sha.run_number`) → gate OPERACIONES en `A`/`F`/`PRODUCCION` → deliver GitOps. |
| `testing-factory.yml` | **CI de `feature/**` y PR hacia `E`:** API reusable + k6 smoke + RPA informativo (según *change scope* y variables). |
| `golden-pipeline-testing.yml` | **Suite completa** en push a `E`/`A`/`F`/`PRODUCCION` y PR hacia `A`/`F`/`PRODUCCION`. |
| `reusable-api-testing.yml` | Karate + oasdiff reutilizable (lo llaman Testing Factory y Golden). |
| `pipeline-contrato-openapi.yml` | oasdiff / contrato OpenAPI en PR (`E`, `A`, `F`, `PRODUCCION`) y push (`A`, `F`) con paths acotados. |
| `performance-smoke.yml` | k6 smoke reusable + `workflow_dispatch` cuando se invoca desde otros workflows. |
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

Muchos workflows solo corren si cambian rutas bajo `paths:` (por ejemplo `microservice-a/**`). Un `README.md` bajo `microservice-a/` **sí** cuenta como cambio en ese prefijo.

---

## Qué corre en cada momento (visión por rama y evento)

### A) Push a `feature/*`

| Qué | Workflow típico | Notas |
|-----|-----------------|--------|
| Build + tests unitarios + JaCoCo (sin job `quality-gates`) | `pipeline-microservice-*.yml` | Solo si cambió el microservicio o los YAML/toml en `paths`. En el reusable, **Publish** (imagen GHCR) y **Deliver** (GitOps) **solo** se ejecutan en `push` a `E`/`A`/`F`/`PRODUCCION`; en `feature/**` el flujo termina tras **test** y el job de quality gates **no** está cableado para push en feature. |
| API + contrato + k6 smoke + RPA informativo | `testing-factory.yml` | Solo si cambian rutas declaradas en `paths` (microservicios, tests, simulación, RPA, workflows citados). **Una** ejecución de Testing Factory orquesta API → k6 → RPA (condicionado). |

**Objetivo:** feedback rápido al desarrollador **sin** publicar imagen ni desplegar; la validación pesada de secrets/Sonar/Trivy FS del reusable se reserva a PR hacia `E` o a push en ramas de ambiente según el YAML.

---

### B) Pull Request `feature/*` → `E`

| Qué | Workflow | Notas |
|-----|----------|--------|
| Build + tests + job `quality-gates` (Gitleaks + Sonar + Trivy FS) | `pipeline-microservice-*.yml` | **Publish** y **Deliver** no corren en PR: el reusable exige `push` a `E`/`A`/`F`/`PRODUCCION` (o `workflow_dispatch`) para publicar imagen. |
| Karate (`@smoke`, `@e2e`, `@contract`) + oasdiff | `testing-factory.yml` → `reusable-api-testing.yml` | PR con base `E` y *app_changed*. |
| k6 smoke 20 VUs | `testing-factory.yml` → `performance-smoke.yml` | Tras API exitosa. |
| RPA | `testing-factory.yml` → `rpa.yml` | **Informativo** (`enforce_gate: false`) salvo que se flexibilice en el futuro. |
| Breaking changes OpenAPI | `pipeline-contrato-openapi.yml` | Si tocan OpenAPI o Java bajo paths definidos. |

**Objetivo:** que lo que entra a `E` no rompa contratos ni performance básica.

---

### C) Push a `E` (tras merge a desarrollo)

| Qué | Workflow | Notas |
|-----|----------|--------|
| Pipeline microservicio completo hasta Deliver | `pipeline-microservice-*.yml` | Incluye E2E Karate + k6 local en `Deliver` para **microservice-a** (`test_runner: karate`); **microservice-b** usa runner `smoke`. En push a `E`, Sonar/Trivy FS pueden ser **informativos** (no bloquean) según el reusable. |
| Suite completa API + k6 + RPA (política Golden) | `golden-pipeline-testing.yml` | `update_baseline` en k6 puede activarse en push a ramas de ambiente. |

**Objetivo:** imagen versionada, GitOps actualizado a `env-e`, validación post-merge.

---

### D) Pull Request `E` → `A`

| Qué | Workflow | Notas |
|-----|----------|--------|
| Build + tests (sin job `quality-gates` del reusable en esta base) | `pipeline-microservice-*.yml` | El reusable **no** programa `quality-gates` para PR cuya base es `A`/`F`/`PRODUCCION`; la exigencia equivalente en la promoción la cubren **Golden** y otros workflows del PR. **Publish/Deliver** siguen reservados al `push` tras el merge. |
| Golden: API + k6 + RPA | `golden-pipeline-testing.yml` | PR con base `A`. RPA puede volverse **bloqueante** si `RPA_BLOCKING_GATE=true` (variable de repo). |
| Contrato OpenAPI | `pipeline-contrato-openapi.yml` | Según paths. |

**Objetivo:** gate de calidad previo a QA. Las **aprobaciones de Operaciones** configuradas en GitHub no bloquean el job del PR: aparecen en el flujo de **`push` a `A`** (y otras ramas con gate; ver siguiente sección).

---

### E) Push a `A` (QA operativo)

| Qué | Workflow | Notas |
|-----|----------|--------|
| Publish + gate **OPERACIONES** + Deliver | `reusable-microservice-pipeline.yml` | Tras publish exitoso en **`push`** a `A`, el job de operaciones usa el environment `OPERACIONES` (revisores en GitHub). |
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

---

### I) Push a `PRODUCCION`

| Qué | Workflow | Notas |
|-----|----------|--------|
| Publish imagen + Trivy imagen (CRITICAL bloqueante) + gate **OPERACIONES** + Deliver a `prod` | `pipeline-microservice-*.yml` → reusable | El job **quality-gates** (Sonar + Trivy FS) **no** está cableado para `push` a `PRODUCCION`; el análisis estático en desktop suele haberse ejecutado en etapas previas. |
| Golden | `golden-pipeline-testing.yml` | Valida la rama productiva tras cambios relevantes. |

---

## Tabla maestra simplificada (por tipo de control)

| Control | Herramienta | feature push | PR → E | push E | PR → A | push A | PR → F | push F | PR → PROD | push PROD |
|---------|-------------|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| Build + unit + JaCoCo ≥80% | Gradle | ✅* | ✅* | ✅* | ✅* | ✅* | ✅* | ✅* | ✅* | ✅* |
| Secrets + Sonar + Trivy FS | Gitleaks / Sonar / Trivy | — | ✅* | ✅* | — ◆ | ✅* | — ◆ | ✅* | — ◆ | — |
| Docker build + Trivy imagen + GHCR | Docker / Trivy | — | — | ✅* | — | ✅* | — | ✅* | — | ✅* |
| Deploy GitOps + sync | Kustomize / script ArgoCD | — | — | ✅ | — | ✅ | — | ✅ | — | ✅ |
| Karate + oasdiff (suites reusables) | Testing Factory / Golden | ✅† | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| k6 smoke | `performance-smoke.yml` | ✅† | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| k6 smoke baseline en ambiente | Golden / dispatch | — | — | ⚠‡ | — | ⚠‡ | — | ⚠‡ | — | ⚠‡ |
| RPA Salesforce | `rpa.yml` | ⚠ | ⚠ | ⚠§ | ⚠§ | ⚠§ | ⚠§ | ⚠§ | ⚠§ | ⚠§ |
| OpenAPI breaking (dedicated workflow) | `pipeline-contrato-openapi.yml` | — | ✅** | — | ✅** | — | ✅** | — | ✅** | — |
| Aprobación Operaciones (GitHub Environment) | `OPERACIONES` | — | — | — | — | ✅ | — | ✅ | — | ✅ |
| Suite manual legacy | `ci-cd-att.yml` | 📋 | 📋 | 📋 | 📋 | 📋 | 📋 | 📋 | 📋 | 📋 |

\* Condicionado a `paths` del microservicio.  
◆ En el `reusable-microservice-pipeline.yml` de la rama `E`, el job **quality-gates** solo corre en **PR con base `E`** o en **push** a `E`/`A`/`F` — **no** en push a `feature/**`, **no** en PR hacia `A`/`F`/`PRODUCCION`, y **no** en push a `PRODUCCION` (la calidad en esos contextos la cubren **Golden**, el contrato dedicado y etapas previas).  
† `testing-factory.yml` con filtro de cambios (`change-scope`).  
‡ `update_baseline` en Golden en push a ramas de ambiente cuando el job de performance corre.  
§ Política **informativa** por defecto en Testing Factory; en Golden puede ser **bloqueante** si `RPA_BLOCKING_GATE=true`.  
\** Solo si cambian OpenAPI o código bajo paths del workflow.

---

## Guion de demostración (laboratorio PoC)

Este guion está pensado para **mostrar en vivo** cómo se encadenan los pipelines cuando se tocan los `README.md` de ambos microservicios y luego se promociona el cambio por PRs. Ejecútalo sobre la rama **`E`** (o una `feature/*` creada desde `E`) en el repositorio configurado con los workflows descritos arriba.

### Preparación

1. `git fetch origin E && git checkout -b feature/demo-readme-pipelines origin/E` (nombre de rama ejemplo).  
2. Confirma en la UI de GitHub Actions que ves workflows **Testing Factory** y **Golden** (archivos presentes solo en la línea de ramas `E`/`A`/`F`/`PRODUCCION` según el remoto).

### Paso 1 — Cambio en feature (`push`)

1. Edita `microservice-a/README.md` y `microservice-b/README.md` (por ejemplo, una línea de documentación).  
2. `git commit` y `git push origin feature/demo-readme-pipelines`.

**Qué deberías ver en Actions (evento `push` a `feature/*`):**

- **`[microservice-a] CICD`** — se dispara porque cambió `microservice-a/**`.  
- **`[microservice-b] CICD`** — se dispara porque cambió `microservice-b/**`.  
  Son **dos ejecuciones independientes** (dos callers), cada una con su grupo de concurrencia. En **push** a `feature/**` cada una ejecuta **build + test**; **no** publican imagen ni despliegan.  
- **`Testing Factory — CI Quality Gates`** — **una** corrida que encadena: *change-scope* → API (`reusable-api-testing.yml`) → k6 (`performance-smoke.yml`) → decisión RPA → `rpa.yml` (informativo salvo configuración).  

**Orden sugerido para narrar la demo:** primero los dos CICD de microservicio (**compilación y pruebas unitarias** en paralelo), luego Testing Factory como “segunda línea” de validación funcional, contrato, rendimiento y RPA.

### Paso 2 — Pull Request `feature/*` → `E`

1. Abre PR con **base `E`**.  
2. Vuelve a observar Actions con evento `pull_request`.

**Qué esperar:**

- Los **mismos tres tipos** de workflows pueden correr otra vez; en los callers de microservicio el PR añade **quality gates** (secrets/Sonar/Trivy FS) cuando la base es **`E`**, pero **siguen sin publicar imagen** hasta el `push` post-merge en `E`.  
- **Testing Factory** vuelve a ejecutar API + k6 + RPA (mismas reglas de `paths` y *change scope*).  
- **`pipeline-contrato-openapi.yml` no corre** si solo cambiaron los README (no tocan `openapi*.yaml` ni `src/main/java/**` bajo los paths del contrato).

Tras **aprobar y mergear** el PR:

- Ocurre **`push` a `E`**. Ahí los pipelines de microservicio pueden llegar hasta **Deliver** (GitOps `env-e`) y corre **Golden** en paralelo según `paths`, validando la integración compartida.

### Paso 3 — Pull Request `E` → `A`

1. Abre PR desde `E` hacia `A` (o desde una rama que contenga el merge anterior, según política del equipo).  
2. En el PR verás **Golden** y los **pipelines de microservicio** en modo validación **sin Deliver** en la rama `A` hasta el merge.

**Qué narrar:** aquí el énfasis es el **gate de promoción a QA**: suite Golden completa y calidad de microservicio alineada a la base `A`.

Al hacer **merge** a `A`:

- **`push` a `A`** dispara publish, **aprobación en el environment `OPERACIONES`**, Deliver a overlay `env-a`, y Golden si aplica.

### Paso 4 — Pull Request `A` → `F` y hacia `PRODUCCION` (opcional en la misma sesión)

- **`A` → `F`:** mismo patrón de PR (validación) y **push a `F`** con gate **OPERACIONES** y Deliver a `env-f`.  
- **`F` → `PRODUCCION`:** PR con exigencia máxima; **push a `PRODUCCION`** entrega a `prod`, Trivy imagen crítico bloqueante y, según YAML actual del reusable, **gate OPERACIONES** también en producción.

---

## Matriz del guion — qué corre y cómo (ejemplo README en ambos microservicios)

Evento y ramas en columnas; marcamos si el workflow **puede** ejecutarse cuando los únicos cambios son los dos README bajo `microservice-*` (y no hay cambios en OpenAPI/Java de contrato).

| Momento | Rama / evento | `[microservice-a] CICD` | `[microservice-b] CICD` | Testing Factory | Golden | `pipeline-contrato-openapi` |
|---------|-----------------|:---:|:---:|:---:|:---:|:---:|
| Tras push en feature | `feature/*` + `push` | ✅ | ✅ | ✅ | — | — |
| Validación previa a integrar | PR `feature/*` → `E` | ✅ (sin Deliver) | ✅ (sin Deliver) | ✅ | — | — |
| Tras merge a desarrollo | `E` + `push` | ✅ (con Deliver env-e) | ✅ (con Deliver env-e) | — ‡ | ✅ | — |
| Promoción a QA | PR `E` → `A` | ✅ (sin Deliver) | ✅ (sin Deliver) | — | ✅ | — |
| Tras merge a QA | `A` + `push` | ✅ (+ OPERACIONES + Deliver env-a) | ✅ (+ OPERACIONES + Deliver env-a) | — | ✅ | — † |
| Promoción a UAT / Prod | PRs posteriores | ✅ (patrón PR) | ✅ (patrón PR) | — | ✅ | ✅ ** |

‡ Testing Factory **no** está cableado para `push` a `E`; en ese momento la suite paralela típica es **Golden** + CICD de microservicios.  
† Push a `A` con solo README no dispara el workflow dedicado de contrato si no cambian los paths OpenAPI; se muestra **—** en la práctica del guion.  
\** Solo si el PR/push incluye rutas de contrato; para README puro, **—**.

---

## Casos de demostración: camino verde vs fallos esperados

En la demo conviene enseñar **dos familias** de resultados: flujos que **terminan bien** (gates en verde, merge y Deliver cuando aplica) y otros donde **algo rompe de forma controlada** (contrato, negocio, calidad o seguridad), para que la audiencia vea *shift-left* y promoción real.

### Tabla resumen (qué probar y dónde se nota)

| Tipo | Ejemplo de cambio | Dónde suele verse el resultado |
|------|-------------------|-------------------------------|
| **Verde** | Solo `README`, doc, o código que mantiene contratos y tests | **Testing Factory** y/o CICD de microservicio completan; tras merge a `E`/`A`/… aparecen **publish + Deliver** (y **Golden** en ramas de ambiente) según el guion de arriba. |
| **Rojo — OpenAPI / oasdiff** | Spec incompatible (`microservice-*/docs/openapi*.yaml`) o cambio de API analizado como *breaking* | **`reusable-api-testing.yml`**: paso de *breaking changes* bloquea el job. También **`pipeline-contrato-openapi.yml`** en PR cuando los `paths:` del workflow aplican. En el PR, puede generarse comentario con el diff oasdiff. |
| **Rojo — contrato en Karate (runtime)** | DTO o JSON real no coincide con features `@contract` / integración (p. ej. renombre de campos sin avisar) | Misma **API reusable** (Karate); en escenarios manuales, job de contrato en **`pipeline-integration.yml`**; en **Deliver**, el smoke de **microservice-b** o E2E de **microservice-a** según qué consumidor rompe. |
| **Rojo — negocio / E2E (DEMO BREAK 2)** | Regla nueva (p. ej. validación de monto) que rompe el flujo de los 8 pasos | Job **Deliver** · paso **Karate E2E** en **`reusable-microservice-pipeline.yml`** (push tras integración en rama con Deliver; típicamente post-merge a `E` o superior). El manifiesto GitOps **no** debe actualizarse si el job falla. |
| **Rojo — tests o cobertura** | Test unitario fallido o cobertura estricta de JaCoCo no cumplida (umbral **≥ 80%**) | Job **Test** · `jacocoTestCoverageVerification` en el reusable (bloquea antes de publish). |
| **Rojo — imagen** | Vulnerabilidad **CRITICAL** en imagen (Trivy) | Job **Publish** · scan de imagen con `exit-code: 1` en severidad CRITICAL. |
| **Rojo — operaciones** | Falta aprobación o rechazo explícito | Environment **`OPERACIONES`** en push a **`A`**, **`F`** o **`PRODUCCION`**: el flujo queda esperando revisión en **Deployments** antes de Deliver. |
| **RPA / performance (Golden)** | Umbrales k6 o RPA cuando `RPA_BLOCKING_GATE=true` | **`golden-pipeline-testing.yml`** (y cadenas que invocan los mismos reusables). En Testing Factory el RPA suele ser **informativo** salvo configuración. |

### Guion mínimo verde + rojo

1. **Verde:** seguir la sección *Guion de demostración* (README en ambos microservicios, PR a `E`, observar Factory + CICD sin tocar OpenAPI).  
2. **Rojo contrato:** en una `feature/*`, aplicar **`demo/break-contract.ps1`** (o un cambio OpenAPI breaking manual), commit + push, abrir PR → `E` y mostrar el fallo en **Testing Factory** y/o **`pipeline-contrato-openapi`**. Restaurar con **`demo/restore.ps1`** y un commit de reversión.  
3. **Rojo comportamiento:** **`demo/break-behavior.ps1`**, integrar el cambio hasta un **push** que ejecute **Deliver** con Karate (p. ej. tras merge a `E`), y mostrar el paso **DEMO BREAK 2** en rojo. Restaurar igualmente.

Detalle paso a paso de los guiones PowerShell y narrativa local: **[`demo/README.md`](../../demo/README.md)** · **[`demo/DEMO_GUIDE.md`](../../demo/DEMO_GUIDE.md)**.

---

## Casos de uso (cómo leer el flujo en la práctica)

| Caso | Qué hacer | Qué observar en Actions |
|------|-----------|-------------------------|
| Desarrollo en una feature | Push a `feature/…` | `testing-factory` + uno o dos `pipeline-microservice-*` según microservicios tocados. |
| Integrar a desarrollo compartido | PR a `E` | Testing Factory + pipelines de microservicio; tras merge, push a `E` despliega `env-e` y corre Golden. |
| Promover a QA | PR `E` → `A`; luego merge | En el **push** a `A`, revisar gate `OPERACIONES` antes del Deliver. |
| Promover a UAT | PR `A` → `F` | Igual: gate de operaciones en **push** a `F`. Evidencia de carga manual si aplica. |
| Release a producción | PR `F` → `PRODUCCION` | Tras merge, push ejecuta deliver `prod`, Golden y gate **OPERACIONES** según reusable; revisión de carga y aprobaciones según proceso del equipo. |
| Investigación / demo completa sin PR | Actions → `ci-cd-att.yml` | Ejecución manual (UI/Selenium y RPA opcionales vía variables `UI_TESTS_ENABLED`, `RPA_ENABLED`). |

---

## Variables de repositorio relevantes

| Variable | Efecto |
|----------|--------|
| `RPA_ENABLED` | En Golden, favorece ejecutar RPA en ramas `E`, `A`, `F`, `PRODUCCION`. En Testing Factory, fuerza RPA informativo si está en `true` junto con la lógica de *change scope*. |
| `RPA_BLOCKING_GATE` | Si es `true`, Golden hace fallar el quality gate si RPA falla. |
| `UI_TESTS_ENABLED` | Solo para `ci-cd-att.yml` (manual): activa Selenium. |

Secrets típicos para RPA/SF están documentados en `rpa.yml` y en comentarios de `ci-cd-att.yml`.

---

## Flujo visual (resumen)

```
feature/*  ──push──► build/test (paths) + Testing Factory (paths)
     │
     └── PR a E ──► API reusable + k6 + RPA info + OpenAPI (paths) + microservice PR jobs
              │
              merge/push E ──► deploy env-e + Golden + GitOps microservicios

E ──PR──► A ──► (merge) push A ──► gate OPERACIONES ──► deploy env-a + Golden
A ──PR──► F ──► (merge) push F ──► gate OPERACIONES ──► deploy env-f + Golden
F ──PR──► PRODUCCION ──► (merge) push PROD ──► gate OPERACIONES ──► deploy prod + Golden

Manuales puntuales: ci-cd-att.yml · api-smoke-tests.yml · pipeline-integration.yml · performance-load-2k.yml
```

---

## Limitaciones / deuda técnica conocida (no bloquean la lectura del flujo)

1. **`pipeline-integration.yml`** declara entradas alineadas a `E`/`A`/`F`, pero conviene validar que los jobs internos no referencien nombres legacy de rama (`develop`/`qa`/`uat`) en scripts; trátelo como **workflow de demostración** hasta alinear por completo.  
2. **`performance-load-2k.yml`** puede mantener *labels* históricos (`develop`, `qa`) en inputs de entorno: al ejecutarlo manualmente, elegir el valor coherente con el ambiente bajo prueba.  
3. **`golden-pipeline-testing.yml`** puede mantener opciones históricas en `workflow_dispatch`; las ramas de producto oficiales son `E`, `A`, `F`, `PRODUCCION`.

---

## Evolución y duplicidad histórica

La PoC consolidó pruebas API en **`reusable-api-testing.yml`** llamado desde **Testing Factory** (camino feature/→E) y **Golden** (release). Los workflows `ci-cd-att.yml` y `api-smoke-tests.yml` quedaron como **herramientas manuales** o legado documentado; no sustituyen a Factory/Golden en triggers automáticos.

---

*Documento: `doc/02_CI_CD/gitflow-pipeline-strategy.md`*  
*Actualizado para alineación con rama `E` y workflows en `.github/workflows/` (revisión 2026-05-14; guion TRA-41 + casos verde/rojo).*
