# Arquitectura de la Solución — PoC AT&T Quality Assurance

> **Cliente:** AT&T (Telco Operator)  
> **Proyecto:** PaymentBox — PoC de Calidad Declarativa  
> **Versión:** 1.0  
> **Fecha:** Mayo 2026  
> **Autor:** Optare Solutions — QE & DevSecOps

---

## 1. Visión General

La solución demuestra una cadena de entrega multi-ambiente con **calidad declarativa** y **promoción controlada** entre entornos. Cada cambio en un microservicio desencadena automáticamente un ciclo completo de validación sin intervención humana, cubriendo el flujo de negocio "Recarga por PaymentBox".

El modelo se basa en tres pilares:

| Pilar | Descripción |
|-------|-------------|
| **Shift-Left** | Calidad integrada desde el primer commit: unit tests, cobertura ≥ 80 %, análisis estático y seguridad antes del build de imagen |
| **Contract-First** | Validación de contratos OpenAPI entre microservicios antes de cualquier promoción de entorno |
| **GitOps** | Los manifiestos Kubernetes son la fuente de verdad; solo un pipeline verde actualiza la etiqueta de imagen |

---

## 2. Diagrama de Arquitectura General

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           GITHUB ACTIONS (CI/CD)                            │
│                                                                             │
│  push (develop|qa|uat|main)                                                 │
│          │                                                                  │
│          ▼                                                                  │
│  ┌───────────────────┐    ┌───────────────────┐   ┌─────────────────────┐  │
│  │  pipeline-msvc-a  │    │  pipeline-msvc-b  │   │ pipeline-integration│  │
│  │  (path trigger)   │    │  (path trigger)   │   │ (workflow_dispatch)  │  │
│  │                   │    │                   │   │                     │  │
│  │ Job1: Build+QA    │    │ Job1: Build+QA    │   │ Job0: Validar prom. │  │
│  │ Job2: Seguridad   │    │ Job2: Seguridad   │   │ Job1: Contrato      │  │
│  │ Job3: Image Ops   │    │ Job3: Image Ops   │   │ Job2: E2E Completo  │  │
│  │ Job4: E2E+GitOps  │    │ Job4: Smoke+GitOps│   │ Job3: GitOps Prom.  │  │
│  └───────────────────┘    └───────────────────┘   └─────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
                    │                                         │
                    ▼                                         ▼
┌────────────────────────────────────┐    ┌──────────────────────────────────┐
│         GHCR (Container Registry) │    │      K8s Manifests (GitOps)      │
│  ghcr.io/optaresolutions/…        │    │  k8s/overlays/env-{e,a,u,prod}   │
│  Tags: env-e-{sha} / env-a-{sha}  │    │  kustomization.yaml (image tags)  │
│         env-u-{sha} / prod-{sha}  │    │  → ArgoCD Sync (simulado)        │
└────────────────────────────────────┘    └──────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        ENTORNO SIMULADO (Docker Compose)                    │
│                                                                             │
│  ┌──────────────┐   ┌──────────────┐   ┌────────────┐   ┌──────────────┐  │
│  │ microservice-a│  │ microservice-b│  │ui-paymentbox│  │ PostgreSQL   │  │
│  │  (port 8080) │   │  (port 8081) │   │ (port 4200) │  │ (port 5432)  │  │
│  │ PaymentBox   │   │ Customer     │   │ Angular SPA │  │ att_paymentbox│ │
│  │ Core API     │   │ Profile API  │   │ via Nginx   │  │              │  │
│  └──────┬───────┘   └──────┬───────┘   └─────────────┘  └──────────────┘  │
│         │                  │                                                │
│  ┌──────▼───────┐   ┌──────▼───────┐                                       │
│  │ mock-operador│   │ mock-recibo  │                                        │
│  │ Prism (4010) │   │ Prism (4011) │                                        │
│  │ Paso 4 (BLUE)│   │ Paso 8 (PDF) │                                        │
│  └──────────────┘   └──────────────┘                                       │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Estrategia Multi-Ambiente (GitOps)

```
Rama        Entorno   Overlay Kustomize        Tag de Imagen
─────────   ───────   ──────────────────       ─────────────────────
develop  →  env-e     k8s/overlays/env-e/      env-e-{7-char-sha}
qa       →  env-a     k8s/overlays/env-a/      env-a-{7-char-sha}
uat      →  env-u     k8s/overlays/env-u/      env-u-{7-char-sha}
main     →  prod      k8s/overlays/prod/       prod-{7-char-sha}
```

La **promoción entre entornos es declarativa**: se activa manualmente con `pipeline-integration.yml` (workflow_dispatch). Solo si el pipeline de integración pasa (contrato + E2E completo), se copia la etiqueta de imagen al overlay destino.

**Rutas de promoción permitidas:**
```
develop → qa → uat → main
```

---

## 4. Flujo de 8 Pasos del Negocio

El flujo automatizado "Recarga por PaymentBox" es el escenario principal de la demo:

```
 Inicio
   │
   ▼
[Paso 1] UI — Menús de Recarga visibles
   │         Herramienta: Selenium Headless
   │
   ▼
[Paso 2] API — Localizar Cliente (Billy 1, tel: 4544)
   │           Herramienta: Karate DSL
   │
   ▼
[Paso 3] UI/DB — Seleccionar Monto (coherencia con BD)
   │             Herramienta: Karate DSL + SQL
   │
   ▼
[Paso 4] Mock/Contrato — API Operador BLUE (validación de contrato)
   │                      Herramienta: Prism CLI (OpenAPI mock)
   │
   ▼
[Paso 5] UI — Seleccionar Método de Pago
   │          Herramienta: Selenium Headless
   │
   ▼
[Paso 6] Performance — Ruta Crítica bajo carga
   │                   Herramienta: k6 Smoke Test (p95 < 2s)
   │
   ▼
[Paso 7] DB — Persistencia del pago
   │          Herramienta: Karate DSL
   │
   ▼
[Paso 8] Mock/API — Emisión del recibo (PDF sintético)
   │                Herramienta: Prism CLI
   │
  Fin — Flujo E2E Completo ✓
```

---

## 5. Flujo de Pipeline por Microservicio

```
Push a develop|qa|uat|main  (cambio en microservice-{a|b}/**)
  │
  ▼
Job 1 — Build & Calidad (Shift-Left)
  ├── Compilación Gradle (JDK 17)
  ├── Tests unitarios JUnit 5 + Mockito
  ├── Cobertura JaCoCo (gate ≥ 80 %)
  └── Análisis SonarCloud
  │
  ▼
Job 2 — Seguridad
  └── Trivy fs scan (CRITICAL + HIGH, BLOQUEANTE)
  │
  ▼
Job 3 — Image Ops
  ├── Docker build multi-stage (Gradle → JRE Alpine)
  ├── Trivy image scan (BLOQUEANTE)
  ├── Push a GHCR
  └── Tag: {env-prefix}-{7-char-sha}
  │
  ▼
Job 4 — E2E / Smoke + GitOps
  ├── [microservice-a] Karate E2E (8 pasos completos)
  ├── [microservice-b] Smoke test
  └── Si pasa → actualiza kustomization.yaml (git commit [skip ci])
                → ArgoCD sync (simulado)
```

---

## 6. Flujo de Pipeline de Integración (Promoción)

```
workflow_dispatch (promote_from, promote_to)
  │
  ▼
Job 0 — Validar Promoción
  └── Solo: develop→qa | qa→uat | uat→main
  │
  ▼
Job 1 — Tests de Contrato          ← DEMO BREAK 1 falla aquí
  └── Karate valida campos del API público de microservice-b
  │
  ▼
Job 2 — E2E Completo
  ├── Karate 8 pasos completos
  └── k6 smoke performance
  │
  ▼
Job 3 — GitOps Promoción
  ├── Copia tags de imagen origen → destino overlay
  └── git commit [skip ci] + ArgoCD sync (simulado)
```

---

## 7. Componentes del Sistema

### 7.1 microservice-a — PaymentBox Core (Puerto 8080)

| Atributo | Valor |
|----------|-------|
| Framework | Spring Boot 3.2.5 |
| Lenguaje | Java 17 (Temurin) |
| Grupo | `com.att.paymentbox` |
| Base de datos | PostgreSQL 14 |
| API docs | SpringDoc OpenAPI / Swagger UI |
| Endpoints clave | `POST /api/pagos/registrar`, `GET /actuator/health` |
| Imagen | `ghcr.io/optaresolutions/mx-poc-paymentapp/microservice-a` |

### 7.2 microservice-b — Customer Profile Service (Puerto 8081)

| Atributo | Valor |
|----------|-------|
| Framework | Spring Boot 3.2.5 |
| Lenguaje | Java 17 (Temurin) |
| Base de datos | PostgreSQL 14 (compartida) |
| API docs | SpringDoc OpenAPI / Swagger UI |
| Endpoints clave | `GET /api/customers/{tel}` |
| Imagen | `ghcr.io/optaresolutions/mx-poc-paymentapp/microservice-b` |

### 7.3 ui-paymentbox — Frontend Angular (Puerto 4200/80)

| Atributo | Valor |
|----------|-------|
| Framework | Angular (SPA) |
| Server | Nginx |
| Build | Multi-stage Docker |
| Imagen | `ghcr.io/optaresolutions/mx-poc-paymentapp/ui-paymentbox` |

### 7.4 Mocks (Prism CLI)

| Servicio | Puerto | Propósito |
|---------|--------|-----------|
| mock-operador | 4010 | API Operador BLUE — Paso 4 (validación biométrica / crédito) |
| mock-recibo | 4011 | API Recibo — Paso 8 (emisión PDF sintético) |

### 7.5 Base de Datos (PostgreSQL 14)

Perfiles sintéticos de prueba (TDM):

| Perfil | Teléfono | Estado | Uso |
|--------|----------|--------|-----|
| Billy 1 - Cortes | `4544` | ACTIVO | Escenario principal |
| Billy 2 - Cortes | `4545` | ACTIVO | Escenarios alternativos |
| Billy 3 - Cortes | `4546` | ACTIVO | Escenarios alternativos |
| Billy 4 - Pineda | `4547` | INACTIVO | Test negativo |
| Billy 5 - Bloqueado | `4548` | BLOQUEADO | Test negativo |

---

## 8. Infraestructura Requerida

### Para la Demo (Local)

| Componente | Requerimiento |
|-----------|---------------|
| Docker Desktop / Rancher Desktop | Docker Compose habilitado |
| Memoria RAM | ≥ 8 GB recomendado |
| CPU | ≥ 4 cores |
| Puertos libres | 8080, 8081, 4200, 4010, 4011, 5432 |
| JDK | 17 (solo para ejecución directa sin Docker) |
| k6 | v0.46+ (para ejecutar smoke tests localmente) |
| Maven | 3.9+ (para tests Karate/Selenium) |

### Para CI/CD (GitHub Actions)

| Componente | Requerimiento |
|-----------|---------------|
| GitHub Actions | Runners `ubuntu-latest` |
| GHCR | Acceso a `ghcr.io/optaresolutions` |
| Secrets | `SONAR_TOKEN`, `GITHUB_TOKEN` (automático) |
| SonarCloud | Organización `optaresolutions` configurada |

---

## 9. Métricas DORA Objetivo

| Métrica | Objetivo | Mecanismo |
|---------|----------|-----------|
| **Deployment Frequency** | Cada push por rama | Pipelines automáticos con path triggers |
| **Lead Time for Changes** | < 10 min por pipeline | 4 jobs secuenciales por microservicio |
| **Change Failure Rate** | < 1 % | JaCoCo ≥ 80 % + Trivy + Karate E2E + gates GitOps |
| **MTTR** | Automático (sin rollback manual) | Manifiesto no se actualiza si falla E2E; rollback por `git revert` |

---

## 10. Escenarios de Ruptura (Demo)

### DEMO BREAK 1 — Ruptura de Contrato

- **Actor:** Team B renombra campo `telefono` → `phone` en el DTO público
- **Dónde falla:** `pipeline-integration.yml` Job 1 (Karate contrato)
- **Impacto visible:** Promoción a env-a BLOQUEADA — el comité ve el error en GitHub Actions antes de llegar a QA
- **Restauración:** `demo\restore.ps1`

### DEMO BREAK 2 — Ruptura de Comportamiento

- **Actor:** Team A activa validación de monto mínimo ($100) sin avisar
- **Dónde falla:** `pipeline-microservice-a.yml` Job 4 (Karate E2E, rama `qa`)
- **Impacto visible:** `POST /api/pagos/registrar monto=20` → HTTP 400 (esperaba 201); overlay env-a NO se actualiza
- **Restauración:** `demo\restore.ps1`
