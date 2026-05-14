# Telco Operator PaymentBox — PoC de Calidad Declarativa

> **Optare Solutions** para Telco Operator | Arquitecto: QE & DevSecOps  
> Validado con: Evelyn Pineda & Billy Cortes

[![microservice-a](https://github.com/OptareSolutions/mx-poc-paymentapp/actions/workflows/pipeline-microservice-a.yml/badge.svg?branch=E)](https://github.com/OptareSolutions/mx-poc-paymentapp/actions/workflows/pipeline-microservice-a.yml)
[![microservice-b](https://github.com/OptareSolutions/mx-poc-paymentapp/actions/workflows/pipeline-microservice-b.yml/badge.svg?branch=E)](https://github.com/OptareSolutions/mx-poc-paymentapp/actions/workflows/pipeline-microservice-b.yml)
[![testing-factory](https://github.com/OptareSolutions/mx-poc-paymentapp/actions/workflows/testing-factory.yml/badge.svg?branch=E)](https://github.com/OptareSolutions/mx-poc-paymentapp/actions/workflows/testing-factory.yml)
[![golden](https://github.com/OptareSolutions/mx-poc-paymentapp/actions/workflows/golden-pipeline-testing.yml/badge.svg?branch=E)](https://github.com/OptareSolutions/mx-poc-paymentapp/actions/workflows/golden-pipeline-testing.yml)
[![pipeline-contrato-openapi](https://github.com/OptareSolutions/mx-poc-paymentapp/actions/workflows/pipeline-contrato-openapi.yml/badge.svg?branch=E)](https://github.com/OptareSolutions/mx-poc-paymentapp/actions/workflows/pipeline-contrato-openapi.yml)
[![integración](https://github.com/OptareSolutions/mx-poc-paymentapp/actions/workflows/pipeline-integration.yml/badge.svg?branch=E)](https://github.com/OptareSolutions/mx-poc-paymentapp/actions/workflows/pipeline-integration.yml)

---

## Objetivo

Demostrar una cadena de entrega **multi-ambiente** con **calidad declarativa** y **promoción por PR** (`feature/*` ? `E` ? `A` ? `F` ? `PRODUCCION`), donde los cambios en código disparan validación automática (tests API, contrato OpenAPI, k6, RPA informativo en feature, suite **Golden** en promoción) y **publish / Deliver GitOps** solo en pushes a ramas de ambiente.

Dos escenarios de demo ilustran gates de calidad end-to-end:

- **DEMO BREAK 1** — ruptura de **contrato** (OpenAPI / Karate entre servicios): debe detectarse en **PR** o en jobs de contrato, antes de promover.
- **DEMO BREAK 2** — ruptura de **comportamiento** en el flujo de negocio: debe detectarse en **Deliver** (Karate E2E) al integrar en rama con despliegue, sin actualizar manifiesto si falla.

---

## Documentación relacionada

| Recurso | Contenido |
|---------|-----------|
| [**Estrategia GitFlow y pipelines**](doc/02_CI_CD/gitflow-pipeline-strategy.md) | Ramas `E` / `A` / `F` / `PRODUCCION`, inventario de workflows, guion de demo (README + PRs), matriz de ejecución, **casos verde vs rojo** (contrato, E2E, cobertura, Trivy, OPERACIONES). |
| [**Guía de demo local**](demo/DEMO_GUIDE.md) | Arquitectura del entorno simulado, narrativa de los DEMO BREAK y uso de scripts. |
| [**Documentación CI/CD**](doc/02_CI_CD/README.md) | Detalle por carpeta (API testing, performance, RPA, quality gates). |

La línea de producto PoC en GitHub convive a veces con ramas históricas (`develop` / `qa` / …). La referencia de flujo **oficial PaymentBox** para este repo es la rama **`E`**.

---

## Arquitectura multi-ambiente (GitFlow)

```
Rama Git       Rol típico        Overlay Kustomize (manifiesto)
--------       ----------          ------------------------------
E              Desarrollo          k8s/overlays/env-e/
A              QA                  k8s/overlays/env-a/
F              UAT / preprod       (pipeline usa prefijo env-f en imagen; en repo puede alinearse con overlays existentes, p. ej. env-u — revisar `k8s/overlays/`)
PRODUCCION     Producción          k8s/overlays/prod/
feature/*      Trabajo aislado     Sin overlay propio; CI sin publish hasta integrar
```

La **promoción** entre ambientes es por **merge** a la rama destino; en `A`, `F` y `PRODUCCION` el pipeline puede exigir aprobación del environment **OPERACIONES** antes del **Deliver** (ver documento de estrategia).

---

## Flujo de 8 pasos automatizado

| Paso | Tipo | Herramienta | Descripción |
|------|------|-------------|-------------|
| **1** | UI | Selenium Headless | Menús de Recarga visibles |
| **2** | API | Karate DSL | Localizar Cliente (Billy 1 — `tel: 4544`) |
| **3** | UI/DB | Karate DSL + SQL | Seleccionar Monto (coherencia con BD) |
| **4** | Mock/Contrato | Prism CLI | API Operador BLUE (validación de contrato) |
| **5** | UI | Selenium Headless | Seleccionar Método de Pago |
| **6** | Performance | k6 Smoke Test | Ruta crítica — umbrales p95 |
| **7** | DB | Karate DSL | Persistencia del pago en el entorno |
| **8** | Mock/API | Prism CLI | Emisión del recibo (PDF sintético) |

---

## Estructura del repositorio

```
mx-poc-paymentapp/
??? .github/workflows/
?   ??? pipeline-microservice-a.yml      # CICD Team A (path trigger; llama reusable)
?   ??? pipeline-microservice-b.yml      # CICD Team B
?   ??? reusable-microservice-pipeline.yml
?   ??? testing-factory.yml              # feature/* + PR ? E
?   ??? golden-pipeline-testing.yml    # push/PR promoción hacia A/F/PRODUCCION
?   ??? reusable-api-testing.yml
?   ??? pipeline-contrato-openapi.yml
?   ??? performance-smoke.yml
?   ??? rpa.yml
?   ??? pipeline-integration.yml        # manual (demo promoción)
?   ??? legacy/pipeline.yml              # LEGACY — referencia
??? microservice-a/                     # PaymentBox Core (puerto 8080)
?   ??? src/main/java/
?   ??? src/test/java/
?   ??? src/Dockerfile
?   ??? build.gradle
?   ??? docs/openapi*.yaml
?   ??? sonar-project.properties
??? microservice-b/                     # Customer Profile (puerto 8081)
?   ??? …
?   ??? docs/openapi*.yaml
??? ui-paymentbox/                      # Angular UI
??? k8s/
?   ??? base/
?   ??? overlays/                       # env-e, env-a, env-u, prod
??? simulation/                         # docker-compose + Prism + TDM
??? tests/                              # Karate, Selenium, k6
??? demo/
?   ??? break-contract.ps1              # DEMO BREAK 1
?   ??? break-behavior.ps1              # DEMO BREAK 2
?   ??? restore.ps1
?   ??? DEMO_GUIDE.md
??? doc/02_CI_CD/
    ??? README.md
    ??? gitflow-pipeline-strategy.md    # Estrategia y guiones de demo
```

---

## Pipelines GitHub Actions

### Por microservicio (`pipeline-microservice-*.yml`)

Triggers en **`feature/**`**, **`E`**, **`A`**, **`F`**, **`PRODUCCION`** con filtros `paths` por carpeta del servicio. El reusable ejecuta, en orden conceptual:

1. **Build** — JAR Gradle  
2. **Test** — unitarios + JaCoCo (umbral **? 80%**)  
3. **Quality gates** — Gitleaks, Sonar, Trivy FS *(según evento/rama; no en todos los push, p. ej. `feature/*` no ejecuta este job)*  
4. **Publish** — build de imagen, **Trivy imagen (CRITICAL bloqueante)**, push GHCR *(solo push a ramas de ambiente + `workflow_dispatch`)*  
5. **OPERACIONES** — aprobación en **`A` / `F` / `PRODUCCION`** antes de continuar  
6. **Deliver** — validación E2E/smoke + actualización `k8s/overlays/<overlay>/kustomization.yaml` + sync simulado ArgoCD  

**Tag de imagen (GHCR):** `{version}-{sha7}.{run_number}` (definido en el reusable).

### Testing Factory y Golden

- **Testing Factory** — `push` en `feature/**` y `pull_request` con base **`E`**: API (Karate + oasdiff vía reusable), k6 smoke, RPA (informativo por defecto).  
- **Golden** — `push` en **`E`/`A`/`F`/`PRODUCCION`** y **PR** con base **`A`/`F`/`PRODUCCION`**: suite completa consolidada.

### Contrato OpenAPI dedicado

**`pipeline-contrato-openapi.yml`** — breaking changes en PR hacia ramas de ambiente y revalidación en push según `paths` (specs y código bajo prefijos definidos en el YAML).

### Casos verde y rojo (demo)

Para una matriz de **qué falla y dónde** (contrato OpenAPI, Karate, E2E Deliver, cobertura, Trivy, OPERACIONES, Golden), usar la sección **«Casos de demostración: camino verde vs fallos esperados»** en [`doc/02_CI_CD/gitflow-pipeline-strategy.md`](doc/02_CI_CD/gitflow-pipeline-strategy.md). Los scripts **`demo/break-contract.ps1`** y **`demo/break-behavior.ps1`** aplican roturas reproducibles; **`demo/restore.ps1`** revierte.

### Pipeline de integración (manual)

**`pipeline-integration.yml`** — `workflow_dispatch` para escenarios de **promoción** y validación de contrato/E2E sin depender de un PR concreto. Revisar inputs y overlays en el YAML antes de la demo (algunos comentarios históricos pueden referir nombres antiguos de entorno).

---

## DEMO: escenarios de ruptura

### DEMO BREAK 1 — Ruptura de contrato

**Quién:** Team B (`microservice-b`) altera el contrato público (DTO / OpenAPI) sin coordinar con consumidores.  
**Dónde falla (automático):** **`testing-factory.yml`** / **`reusable-api-testing.yml`** (Karate + oasdiff) en **PR `feature/*` ? `E`**, y/o **`pipeline-contrato-openapi.yml`** si los archivos tocados entran en `paths`.  
**Dónde falla (manual):** Job de contrato en **`pipeline-integration.yml`**.

```powershell
# Rama ejemplo: feature/demo-break1 desde E
.\demo\break-contract.ps1
git add .
git commit -m "demo: BREAK 1 - contrato"
git push -u origin feature/demo-break1
# Abrir PR ? E y observar fallo en API/contrato OpenAPI
# Restaurar:
.\demo\restore.ps1
git add . && git commit -m "restore: contrato" && git push
```

### DEMO BREAK 2 — Ruptura de comportamiento (E2E)

**Quién:** Team A introduce una regla (p. ej. validación de monto) que rompe el flujo de 8 pasos.  
**Dónde falla:** **Deliver** · **Karate E2E** en **`reusable-microservice-pipeline.yml`**, cuando hay **`push`** tras merge en rama con **publish + Deliver** (p. ej. integración en **`E`**).

```powershell
.\demo\break-behavior.ps1
git add .
git commit -m "demo: BREAK 2 - comportamiento"
# Integrar vía PR hasta ejecutar push con Deliver (p. ej. merge a E)
# Observar fallo en paso DEMO BREAK 2 · Karate E2E
.\demo\restore.ps1
git add . && git commit -m "restore: comportamiento" && git push
```

---

## Probar localmente

```bash
cd simulation
docker compose up -d
docker compose ps

# API microservice-a / microservice-b
open http://localhost:8080/swagger-ui.html
open http://localhost:8081/swagger-ui.html

cd tests/functional-karate && mvn test
cd ../ui-selenium && mvn test -Dapp.url=http://localhost:8080
k6 run --env BASE_URL=http://localhost:8080 tests/k6/smoke_recarga.js

cd ../../simulation && docker compose down -v
```

---

## Datos sintéticos (TDM)

| Perfil | Teléfono | Estado | Uso |
|--------|----------|--------|-----|
| Billy 1 - Cortes | `4544` | ACTIVO | Escenario principal |
| Billy 2 - Cortes | `4545` | ACTIVO | Escenarios alternativos |
| Billy 3 - Cortes | `4546` | ACTIVO | Escenarios alternativos |
| Billy 4 - Pineda | `4547` | INACTIVO | Test negativo |
| Billy 5 - Bloqueado | `4548` | BLOQUEADO | Test negativo |

---

## Métricas DORA

| Métrica | Objetivo | Mecanismo |
|---------|----------|-----------|
| **Deployment Frequency** | Cada cambio integrado en rama de ambiente | Path triggers + publish en `E`/`A`/… |
| **Lead Time for Changes** | Acotado por duración de jobs | Pipeline reusable en etapas paralelizables donde aplica |
| **Change Failure Rate** | Gateo con tests, contrato, Trivy y aprobaciones | Bloqueo antes de Deliver o sin merge si falla PR |
| **MTTR** | Revert / fix en rama | Manifiesto no avanza si Deliver falla; rollback vía git |
