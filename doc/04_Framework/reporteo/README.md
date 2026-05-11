# Reporteo — Framework de Testing QA

> Dashboard de resultados, KPIs, ROI estimado y trazabilidad de evidencias

---

## Estrategia de Reporteo

El framework ofrece **tres niveles de visibilidad** sobre la calidad:

1. **Tiempo real** — Estado del pipeline en GitHub Actions durante la ejecución
2. **Por ejecución** — Reportes detallados de cada suite de pruebas (artefactos)
3. **Histórico / Tendencias** — Comparativas entre ejecuciones para detectar regresiones

---

## Dashboard de Resultados

### Panel GitHub Actions (Tiempo Real)

```
GitHub Actions → Actions Tab
│
├── pipeline-microservice-a.yml
│   ├── ✅ Build & Quality   (JUnit: 47/47, JaCoCo: 84%)
│   ├── ✅ Security Scan     (Trivy: 0 CRITICAL, 0 HIGH)
│   ├── ✅ Image Ops         (ghcr.io/...a:env-a-a1b2c3d)
│   └── ✅ E2E Functional    (Karate: 8/8, k6: p95=1.4s ✅)
│
├── pipeline-microservice-b.yml
│   ├── ✅ Build & Quality   (JUnit: 32/32, JaCoCo: 81%)
│   ├── ✅ Security Scan     (Trivy: 0 CRITICAL)
│   ├── ✅ Image Ops         (ghcr.io/...b:env-a-a1b2c3d)
│   └── ✅ Smoke Test        (k6: p95=0.9s ✅)
│
└── pipeline-integration.yml
    ├── ✅ Validar Promoción (develop → qa)
    ├── ✅ Tests Contrato    (Karate: 5/5 contrato OK)
    ├── ✅ E2E Completo      (8 pasos OK, k6 umbrales OK)
    └── ✅ GitOps Promoción  (kustomization env-a actualizado)
```

---

## Tipos de Reportes Generados

### 1. Reporte de Cobertura de Código (JaCoCo + SonarCloud)

**Formato:** HTML + XML  
**Ubicación:** `microservice-{a|b}/build/reports/jacoco/`  
**Artefacto GitHub:** `microservice-{a|b}-test-results-{rama}`

**Métricas capturadas:**
| Métrica | Gate | Ejemplo |
|---------|------|---------|
| Line Coverage | ≥ 80% | 84% ✅ |
| Branch Coverage | ≥ 75% | 78% ✅ |
| Complexity | Informativo | 12.5 |
| Code Smells | ≤ 10 | 3 ✅ |
| Security Hotspots | 0 bloqueantes | 0 ✅ |
| Technical Debt | < 1h | 45min ✅ |

---

### 2. Reporte de Tests Funcionales (Karate DSL)

**Formato:** HTML + JSON (Cucumber-compatible)  
**Ubicación:** `tests/functional-karate/target/karate-reports/`

**Contenido:**
- Resumen de features ejecutados
- Estado paso a paso (PASSED/FAILED)
- Request/Response HTTP capturado
- Tiempo de ejecución por escenario
- Evidencias de las 8 etapas del flujo PaymentBox

**Ejemplo de salida:**
```
Feature: Flujo de Recarga PaymentBox (8 pasos)
  Scenario: Billy 1 recarga $50 - PASS (4.2s)
    ✅ Paso 1: Menús de Recarga visibles
    ✅ Paso 2: Localizar Cliente tel=4544
    ✅ Paso 3: Seleccionar Monto $50
    ✅ Paso 4: Contrato API Operador BLUE
    ✅ Paso 5: Seleccionar Método de Pago
    ✅ Paso 6: k6 Smoke - p95=1.4s < 2s ✅
    ✅ Paso 7: Persistencia BD confirmada
    ✅ Paso 8: Emisión recibo OK

  Scenario: BREAK 1 - Contrato roto - FAIL (1.1s)
    ✅ Paso 1-3: OK
    ❌ Paso 4: match response.telefono failed
       actual: {phone: '4544'} | expected: telefono
```

---

### 3. Reporte de Performance (k6)

**Formato:** JSON + Console output  
**Ubicación:** `tests/k6/results/`

**Umbrales (Thresholds) configurados:**
| Umbral | Valor | Estado |
|--------|-------|--------|
| `http_req_duration` p95 flujo completo | < 3s | ✅ |
| `http_req_failed` error rate | < 1% | ✅ |
| `http_req_duration` login p95 | < 700ms | ✅ |
| `http_req_duration` consulta p95 | < 900ms | ✅ |
| `http_req_duration` actualización p95 | < 1200ms | ✅ |

**Comparativa histórica:**
```
Ejecución        p95 (ms)   Error %   VUs
─────────────────────────────────────────
2026-04-01       1,820ms    0.0%      20
2026-04-15       1,940ms    0.1%      20
2026-05-01       1,400ms    0.0%      20  ← mejora post-refactor
2026-05-07       1,350ms    0.0%      20  ✅
```

---

### 4. Reporte de Seguridad (Trivy)

**Formato:** SARIF + JSON (GitHub Security Tab)  
**Tipos de análisis:**
- `trivy fs scan` — Dependencias del código fuente
- `trivy image scan` — Imagen Docker final

**Severidades bloqueantes:** CRITICAL y HIGH

---

### 5. Reporte de Contrato (Karate Contract)

Detecta **breaking changes** entre microservicio-a y microservicio-b:

```
Feature: contract_microservices
  Background: microservice-b responde con {telefono, nombre, status}
  
  Scenario: Validar campos contrato público
    Given url 'http://microservice-b:8081'
    When GET /api/clientes/4544
    Then status 200
    And match response.telefono == '4544'   ← FALLA si se renombra a 'phone'
    And match response.nombre != null
    And match response.status == 'ACTIVO'
```

---

## KPIs del Framework

### KPIs Técnicos (por sprint/semana)

| KPI | Fórmula | Objetivo |
|-----|---------|---------|
| **Test Pass Rate** | (Tests OK / Total tests) × 100 | ≥ 95% |
| **Coverage Rate** | Líneas cubiertas / Total líneas | ≥ 80% |
| **Pipeline Success Rate** | Pipelines OK / Total pipelines | ≥ 90% |
| **Mean Time to Detect** | Tiempo push → fallo detectado | < 10 min |
| **Flaky Test Rate** | Tests inestables / Total tests | < 2% |
| **Security Vulnerabilities** | CRITICAL + HIGH sin resolver | 0 |

### KPIs de Negocio (por mes)

| KPI | Cálculo | Ejemplo |
|-----|---------|---------|
| **Casos Automatizados** | Nº tests E2E activos | 8 flujos (48 scenarios) |
| **Cobertura de Flujos Críticos** | Flujos críticos cubiertos / Total | 80% |
| **Defectos en Producción** | Bugs en prod relacionados con QA | ≤ 2/mes |
| **Tiempo de Validación Ahorrado** | Casos manuales × tiempo estimado | ~240h/mes |

---

## ROI Estimado

### Supuestos Base
- **Casos manuales actuales:** 5,200 validaciones
- **Tiempo promedio por caso manual:** 5 minutos
- **Costo hora QA Tester:** ~$25/hora

### Cálculo ROI

```
Casos Automatizados en PoC:          48 scenarios (8 flujos × 6 variantes)
Extrapolación al universo total:     48 / 5200 = ~1% cubierto en PoC

Ahorro estimado por ejecución (PoC):
  48 casos × 5 min = 240 min = 4 horas
  4 horas × $25/hora = $100 por ejecución

Ejecuciones por día (CI/CD):         ~10 pipelines
Ahorro diario estimado:               ~$1,000
Ahorro mensual (20 días laborables): ~$20,000

Costo mantenimiento mensual:         ~$2,000 (estimado)
──────────────────────────────────────────────
ROI Mensual Neto (PoC):              ~$18,000
ROI escalado (100% automatización):  ~$1.8M/mes
```

> **Nota:** El ROI real dependerá del índice de automatización alcanzado. Con 30% de cobertura (target realista primer año), el ahorro neto sería ~$540K/mes.

---

## Evidencias y Trazabilidad

Todos los artefactos de evidencia se almacenan como **GitHub Actions Artifacts** con retención configurable:

| Artefacto | Contenido | Retención |
|-----------|-----------|-----------|
| `microservice-a-test-results-{rama}` | JUnit HTML + JaCoCo HTML | 30 días |
| `microservice-b-test-results-{rama}` | JUnit HTML + JaCoCo HTML | 30 días |
| `karate-reports-{run_id}` | Karate HTML + JSON | 30 días |
| `k6-results-{run_id}` | k6 JSON summary | 30 días |
| `trivy-sarif-{run_id}` | SARIF (GitHub Security) | 90 días |

---

## Acceso a Reportes

```bash
# Ver reportes en GitHub Actions
# GitHub → Repositorio → Actions → Seleccionar run → Artifacts

# Descargar reporte Karate localmente
gh run download <run_id> --name karate-reports-<run_id>

# Ver reporte k6 en consola
k6 run --out json=results/resultado.json tests/k6/smoke_recarga.js

# Ver cobertura JaCoCo
open microservice-a/build/reports/jacoco/test/html/index.html
```
