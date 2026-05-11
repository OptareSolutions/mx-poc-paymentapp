# Orquestación — Framework de Testing QA

> Módulo de orquestación: gestión de flujos automatizados, pipelines CI/CD y GitOps

---

## ¿Qué es la Orquestación en este Framework?

La **orquestación** centraliza y coordina la ejecución de todos los tipos de pruebas dentro de un pipeline de CI/CD. En lugar de execuciones standalone desconectadas, cada cambio de código desencadena automáticamente un ciclo completo de validación sin intervención humana.

---

## Arquitectura de Pipelines

```
┌─────────────────────────────────────────────────────────────────┐
│                    GITHUB ACTIONS                               │
│                                                                 │
│  Push microservice-a/**                Push microservice-b/**  │
│          │                                       │              │
│          ▼                                       ▼              │
│  pipeline-microservice-a.yml     pipeline-microservice-b.yml  │
│  [Job1] Build & Quality           [Job1] Build & Quality       │
│  [Job2] Security Scan             [Job2] Security Scan         │
│  [Job3] Image Ops                 [Job3] Image Ops             │
│  [Job4] E2E Functional            [Job4] Smoke Test            │
│          │                                       │              │
│          └──────────────┬────────────────────────┘              │
│                         ▼                                       │
│              pipeline-integration.yml                          │
│              (workflow_dispatch)                                │
│              [Job0] Validar Promoción                          │
│              [Job1] Tests Contrato                              │
│              [Job2] E2E Completo                                │
│              [Job3] GitOps Promoción                            │
└─────────────────────────────────────────────────────────────────┘
                          │
                          ▼
               ┌─────────────────────┐
               │      ArgoCD         │
               │  (GitOps Sync Sim.) │
               │  Kustomize Overlays │
               └─────────────────────┘
```

---

## Pipelines Disponibles

### 1. `pipeline-microservice-a.yml` — PaymentBox Core (Team A)

**Trigger:** Push en `develop`, `qa`, `uat`, `main` cuando cambia `microservice-a/**`

| Job | Nombre | Qué valida | Herramientas |
|-----|--------|-----------|--------------|
| 1 | Build & Quality | Unit tests + JaCoCo ≥80% + SonarCloud | Gradle, JUnit5, JaCoCo, SonarCloud |
| 2 | Security Scan | Vulnerabilidades CRITICAL/HIGH en código | Trivy fs scan |
| 3 | Image Ops | Build Docker + scan imagen + push GHCR | Docker, Trivy image, GHCR |
| 4 | E2E Functional | Karate 8 pasos + k6 + GitOps | Karate DSL, k6, Kustomize |

**Tag de imagen por entorno:**

| Rama | Entorno | Tag |
|------|---------|-----|
| `develop` | env-e (Dev) | `env-e-{7-sha}` |
| `qa` | env-a (QA) | `env-a-{7-sha}` |
| `uat` | env-u (UAT) | `env-u-{7-sha}` |
| `main` | prod | `prod-{7-sha}` |

---

### 2. `pipeline-microservice-b.yml` — Customer Profile (Team B)

**Trigger:** Push en `develop`, `qa`, `uat`, `main` cuando cambia `microservice-b/**`

Mismo patrón de 4 jobs que microservice-a. Permite trabajo paralelo entre equipos sin bloqueos gracias a **path triggers**.

---

### 3. `pipeline-integration.yml` — Promoción Multi-Ambiente

**Trigger:** Manual (`workflow_dispatch`) — parámetros: `promote_from`, `promote_to`

**Rutas permitidas:**
- `develop → qa`
- `qa → uat`
- `uat → main`

| Job | Descripción | Bloqueante |
|-----|-------------|-----------|
| 0 | Validar Promoción | ✅ Rechaza rutas inválidas |
| 1 | Tests Contrato | ✅ Karate: valida campos del API público de microservice-b |
| 2 | E2E Completo | ✅ Karate 8 pasos + k6 smoke test |
| 3 | GitOps Promoción | Copia tags de imagen origen → destino overlay |

---

## Entorno Simulado (Local)

Para demo y desarrollo local se levanta un docker-compose completo:

```bash
cd simulation
docker compose up -d
docker compose ps   # todos "healthy"
```

**Servicios:**

| Servicio | Puerto | Descripción |
|---------|--------|-------------|
| `microservice-a` | 8080 | PaymentBox Core API |
| `microservice-b` | 8081 | Customer Profile API |
| `mock-operador` | 4010 | Prism mock — Operador BLUE |
| `mock-recibo` | 4011 | Prism mock — emisión recibo |
| `postgresql` | 5432 | BD con perfiles Billy 1-5 |
| `ui-paymentbox` | 4200 | Angular UI |

---

## Estructura de Ramas / Overlays Kustomize

```
Rama          Entorno   Overlay Kustomize
----------    ------    -----------------
develop    →  env-e     k8s/overlays/env-e/   (Desarrollo)
qa         →  env-a     k8s/overlays/env-a/   (QA)
uat        →  env-u     k8s/overlays/env-u/   (UAT)
main       →  prod      k8s/overlays/prod/    (Producción)
```

La promoción entre entornos es **manual y declarativa**: se activa desde `pipeline-integration.yml` y ejecuta contrato + E2E antes de actualizar el overlay destino.

---

## Escenarios de Ruptura (Quality Gates)

### DEMO BREAK 1 — Ruptura de Contrato

- **Origen:** Team B renombra campos del DTO (`telefono` → `phone`)
- **Falla en:** Job 1 del pipeline-integration.yml (Tests Contrato)
- **Efecto:** Bloquea promoción a env-a; Jobs 2 y 3 no se ejecutan

### DEMO BREAK 2 — Ruptura de Comportamiento

- **Origen:** Team A añade validación de monto mínimo $100 sin avisar
- **Falla en:** Job 4 de pipeline-microservice-a.yml (Karate Paso 6/7)
- **Efecto:** Overlay env-a NO se actualiza — GitOps protege el entorno

---

## Concurrencia y Optimización

- **`cancel-in-progress: true`**: Nuevo push cancela el pipeline anterior del mismo grupo
- **Path triggers**: Cada microservicio solo lanza su pipeline cuando sus archivos cambian
- **Artefactos de build**: Los JARs y reportes se suben como artefactos descargables
- **Caching Gradle/Maven**: Reduce tiempos de build en ejecuciones subsecuentes

---

## Visualización del Workspace

Desde **GitHub Actions → Actions tab**, se visualiza:
- Todos los pipelines en ejecución
- Estado por job (✅ pasado / ❌ fallido / ⏳ en progreso)
- Logs en tiempo real por step
- Artefactos descargables (reportes de cobertura, resultados Karate)
- Historial completo de ejecuciones por rama
