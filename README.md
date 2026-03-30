# Telco Operator PaymentBox — PoC de Calidad Declarativa

> **Optare Solutions** para Telco Operator | Arquitecto: QE & DevSecOps  
> Validado con: Evelyn Pineda & Billy Cortes

[![microservice-a](../../actions/workflows/pipeline-microservice-a.yml/badge.svg)](../../actions/workflows/pipeline-microservice-a.yml)
[![microservice-b](../../actions/workflows/pipeline-microservice-b.yml/badge.svg)](../../actions/workflows/pipeline-microservice-b.yml)
[![integración](../../actions/workflows/pipeline-integration.yml/badge.svg)](../../actions/workflows/pipeline-integration.yml)

---

## Objetivo

Demostrar una cadena de entrega multi-ambiente con **calidad declarativa** y **promoción controlada** entre entornos, donde cada cambio en un microservicio desencadena automáticamente un ciclo completo de validación sin intervención humana, cubriendo los 8 pasos del flujo "Recarga por PaymentBox".

Dos escenarios de demo ilustran el valor de los gates de calidad:
- **DEMO BREAK 1** — una ruptura de contrato entre servicios, detectada antes de llegar a QA
- **DEMO BREAK 2** — una ruptura de comportamiento, detectada en E2E antes de actualizar el manifiesto GitOps

---

## Arquitectura Multi-Ambiente

```
Rama          Entorno   Overlay Kustomize
----------    ------    -----------------
develop    ?  env-e     k8s/overlays/env-e/   (Desarrollo)
qa         ?  env-a     k8s/overlays/env-a/   (QA)
uat        ?  env-u     k8s/overlays/env-u/   (UAT)
main       ?  prod      k8s/overlays/prod/    (Producción)
```

La **promoción entre entornos es manual y declarativa**: se activa con `pipeline-integration.yml` (workflow_dispatch), que ejecuta tests de contrato + E2E completo antes de copiar las tags de imagen al overlay destino.

---

## Flujo de 8 Pasos Automatizado

| Paso | Tipo | Herramienta | Descripción |
|------|------|-------------|-------------|
| **1** | UI | Selenium Headless | Menús de Recarga visibles |
| **2** | API | Karate DSL | Localizar Cliente (Billy 1 — `tel: 4544`) |
| **3** | UI/DB | Karate DSL + SQL | Seleccionar Monto (coherencia con BD) |
| **4** | Mock/Contrato | Prism CLI | API Operador BLUE (validación de contrato) |
| **5** | UI | Selenium Headless | Seleccionar Método de Pago |
| **6** | Performance | k6 Smoke Test | Ruta Crítica — umbrales p95 < 2s |
| **7** | DB | Karate DSL | Persistencia del pago en el entorno |
| **8** | Mock/API | Prism CLI | Emisión del recibo (PDF sintético) |

---

## Estructura del Repositorio

```
mx-poc-paymentapp/
+-- .github/workflows/
¦   +-- pipeline-microservice-a.yml   # Pipeline Team A (4 jobs, path trigger)
¦   +-- pipeline-microservice-b.yml   # Pipeline Team B (4 jobs, path trigger)
¦   +-- pipeline-integration.yml      # Promoción manual entre entornos
¦   +-- pipeline.yml                  # LEGACY — mantenido como referencia
+-- microservice-a/                   # PaymentBox Core (port 8080)
¦   +-- src/main/java/                # Spring Boot (controller, service, model)
¦   +-- src/test/java/                # JUnit 5 + Mockito (cobertura >= 80%)
¦   +-- src/Dockerfile                # Multi-stage (gradle build ? JRE alpine)
¦   +-- build.gradle
¦   +-- sonar-project.properties
+-- microservice-b/                   # Customer Profile Service (port 8081)
¦   +-- src/main/java/                # Customer profile API (CustomerProfileDto)
¦   +-- src/test/java/
¦   +-- src/Dockerfile
¦   +-- build.gradle
¦   +-- sonar-project.properties
+-- ui-paymentbox/                    # Angular UI (port 80)
¦   +-- src/app/
¦   +-- Dockerfile
¦   +-- nginx.conf
+-- k8s/
¦   +-- base/                         # Manifests K8s base (Deployment + Service)
¦   ¦   +-- microservice-a/
¦   ¦   +-- microservice-b/
¦   ¦   +-- ui-paymentbox/
¦   +-- overlays/                     # Kustomize overlays por entorno
¦       +-- env-e/kustomization.yaml  # develop ? tags env-e-{sha}
¦       +-- env-a/kustomization.yaml  # qa      ? tags env-a-{sha}
¦       +-- env-u/kustomization.yaml  # uat     ? tags env-u-{sha}
¦       +-- prod/kustomization.yaml   # main    ? tags prod-{sha}
+-- simulation/
¦   +-- docker-compose.yml            # Entorno simulado completo (4 servicios)
¦   +-- prism-mocks/
¦   ¦   +-- operador.yaml             # OpenAPI mock — Paso 4
¦   ¦   +-- recibo.yaml               # OpenAPI mock — Paso 8
¦   +-- tdm-seeders/
¦       +-- 01_schema.sql
¦       +-- 02_billy_profiles.sql     # Perfiles Billy 1-5
+-- tests/
¦   +-- functional-karate/            # Karate DSL — 8 pasos + contrato
¦   +-- ui-selenium/                  # Selenium Headless — pasos 1, 3, 5
¦   +-- k6/smoke_recarga.js           # Performance Smoke — Paso 6
+-- demo/
    +-- break-contract.ps1            # DEMO BREAK 1 — rompe contrato DTO
    +-- break-behavior.ps1            # DEMO BREAK 2 — activa validación monto
    +-- restore.ps1                   # Restaurar estado verde
```

---

## Pipelines GitHub Actions

### Pipeline por Microservicio (automático en push)

Cada microservicio tiene su propio pipeline independiente con **path triggers**. Los dos equipos pueden trabajar en paralelo sin bloqueos.

```
Push a develop|qa|uat|main  (cambio en microservice-{a|b}/**)
  |
  v
Job 1 · Build & Calidad     ? JUnit + JaCoCo (=80%) + SonarCloud
  |
  v
Job 2 · Seguridad            ? Trivy fs scan (CRITICAL+HIGH, bloqueante)
  |
  v
Job 3 · Image Ops            ? Docker build + Trivy image scan + Push GHCR
  |                             Tag: {env-prefix}-{7-char-sha}
  v
Job 4 · E2E / Smoke + GitOps ? Karate E2E (msvc-a) | Smoke test (msvc-b)
                                 ? Si pasa ? actualiza kustomization.yaml
                                 ? git commit [skip ci] + ArgoCD sync (sim.)
```

**Tag de imagen por entorno:**

| Rama | Tag |
|------|-----|
| `develop` | `env-e-a1b2c3d` |
| `qa` | `env-a-a1b2c3d` |
| `uat` | `env-u-a1b2c3d` |
| `main` | `prod-a1b2c3d` |

### Pipeline de Integración (promoción manual)

Activado manualmente desde **Actions ? Pipeline Integración ? Run workflow**.

```
workflow_dispatch (promote_from, promote_to)
  |
  v
Job 0 · Validar Promoción    ? Solo permite: develop?qa | qa?uat | uat?main
  |
  v
Job 1 · Tests Contrato       ? ?? DEMO BREAK 1: Karate valida campos del
  |                              API público de microservice-b
  v
Job 2 · E2E Completo         ? Karate 8 pasos + k6
  |
  v
Job 3 · GitOps Promoción     ? Copia tags de imagen origen ? destino
                                git commit [skip ci] + ArgoCD sync (sim.)
```

---

## DEMO: Escenarios de Ruptura

### DEMO BREAK 1 — Ruptura de Contrato

**Quién:** Team B (microservice-b) renombra campos del DTO público sin coordinar con Team A.  
**Rama:** `develop`  
**Dónde falla:** `pipeline-integration.yml` Job 1 (Tests de Contrato)

```powershell
# 1. Ejecutar el script de ruptura
demo\break-contract.ps1

# 2. Push a develop — pipeline-microservice-b PASA ? (tests unitarios actualizados)
git add . && git commit -m "demo: BREAK 1 - romper contrato DTO" && git push origin develop

# 3. Trigger manual: pipeline-integration.yml  (develop ? qa)
# ? Job 1 FALLA ?  Karate: match response.telefono == '4544'  ? campo ya es 'phone'
# ? Promoción a env-a BLOQUEADA

# 4. Restaurar
demo\restore.ps1 && git add . && git commit -m "restore" && git push origin develop
```

### DEMO BREAK 2 — Ruptura de Comportamiento

**Quién:** Team A activa una validación de monto mínimo ($100) sin avisar a QA.  
**Rama:** `qa`  
**Dónde falla:** `pipeline-microservice-a.yml` Job 4 (E2E Karate, rama qa)

```powershell
# 1. Ejecutar el script de ruptura
demo\break-behavior.ps1

# 2. Push a qa — Jobs 1-3 PASAN ? (unit tests no cubren el escenario Billy $20)
git add . && git commit -m "demo: BREAK 2 - validación monto mínimo" && git push origin qa

# 3. pipeline-microservice-a.yml Job 4 FALLA ?
#    Karate Paso 6/7: POST /api/pagos/registrar monto=20 ? HTTP 400 (esperaba 201)
#    El overlay env-a NO se actualiza — GitOps protege el entorno

# 4. Restaurar
demo\restore.ps1 && git add . && git commit -m "restore" && git push origin qa
```

---

## Probar Localmente

```bash
# Levantar el entorno simulado completo
cd simulation
docker compose up -d
docker compose ps   # todos los servicios deben estar "healthy"

# API microservice-a
open http://localhost:8080/swagger-ui.html

# API microservice-b
open http://localhost:8081/swagger-ui.html

# Ejecutar tests Karate
cd tests/functional-karate && mvn test

# Ejecutar tests Selenium (headless)
cd tests/ui-selenium && mvn test -Dapp.url=http://localhost:8080

# Ejecutar smoke test k6
k6 run --env BASE_URL=http://localhost:8080 tests/k6/smoke_recarga.js

# Detener el entorno
cd simulation && docker compose down -v
```

---

## Datos Sintéticos (TDM)

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
| **Deployment Frequency** | Cada push por rama | Pipelines automáticos con path triggers |
| **Lead Time for Changes** | < 10 min pipeline | 4 jobs secuenciales por microservicio |
| **Change Failure Rate** | < 1% | JaCoCo =80% + Trivy + Karate E2E + gates GitOps |
| **MTTR** | Automático | Manifiesto no se actualiza si falla E2E; rollback por git revert |
