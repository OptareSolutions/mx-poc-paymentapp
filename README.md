# AT&T PaymentBox — PoC de Calidad Declarativa

> **Optare Solutions** para AT&T | Arquitecto: QE & DevSecOps  
> Validado con: Evelyn Pineda & Billy Cortes

[![Estado del Pipeline](../../actions/workflows/pipeline.yml/badge.svg)](../../actions/workflows/pipeline.yml)

---

## Objetivo

Demostrar que **un cambio en el Microservicio A desencadena automáticamente un ciclo completo de validación** sin intervención humana (UAT manual eliminado), cubriendo los 8 pasos del flujo "Recarga por PaymentBox".

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
| **7** | DB | Karate DSL | Persistencia del pago en Ambiente A |
| **8** | Mock/API | Prism CLI | Emisión del recibo (PDF sintético) |

---

## Estructura del Repositorio

```
att-poc-paymentbox/
├── .github/workflows/
│   └── pipeline.yml          # Pipeline declarativo de 4 etapas
├── microservice-a/
│   ├── src/
│   │   ├── main/java/        # Spring Boot (controller, service, model)
│   │   ├── test/java/        # JUnit 5 + Mockito (cobertura >= 80%)
│   │   ├── main/resources/
│   │   │   └── application.yml
│   │   └── Dockerfile        # Multi-stage (gradle build -> JRE alpine)
│   ├── build.gradle          # Gradle + JaCoCo
│   └── settings.gradle
├── simulation/
│   ├── docker-compose.yml    # Ambiente A completo (4 servicios)
│   ├── prism-mocks/
│   │   ├── operador.yaml     # OpenAPI mock — Paso 4
│   │   └── recibo.yaml       # OpenAPI mock — Paso 8
│   └── tdm-seeders/
│       ├── 01_schema.sql     # Esquema de la BD simulada
│       └── 02_billy_profiles.sql  # Perfiles Billy 1-5 (datos sintéticos)
└── tests/
    ├── functional-karate/    # Karate DSL — pasos 2, 3, 4, 5, 7, 8
    │   └── src/test/resources/features/recarga_flow.feature
    ├── ui-selenium/          # Selenium Headless — pasos 1, 3, 5
    │   └── src/test/java/.../RecargaUiTest.java
    └── k6/
        └── smoke_recarga.js  # Performance Smoke — Paso 6 (ruta crítica)
```

---

## Pipeline GitHub Actions (4 Etapas)

```
Push/PR
  |
  v
+---------------------------------+
|  1 · Build & Quality (Shift-Left)|  <- JUnit + JaCoCo (>=80%) + SAST simulado
+----------------+----------------+
                 | needs
                 v
+---------------------------------+
|  2 · Integration & Contract     |  <- TDM Seed + validación contratos Prism
+----------------+----------------+
                 | needs
                 v
+---------------------------------+
|  3 · Image Ops                  |  <- Docker Build + Push a GHCR
+----------------+----------------+
                 | needs
                 v
+---------------------------------+
|  4 · Functional E2E & Deploy    |  <- Karate + Selenium + k6 Smoke
+---------------------------------+
```

**Artefactos publicados por cada ejecución:**
- `unit-test-results` — informes JUnit + JaCoCo HTML
- `karate-report` — resultados Karate DSL
- `selenium-report` — resultados Selenium
- `k6-smoke-results` — resumen JSON del test de performance

---

## Cómo Probar en GitHub

### 1. Crear repositorio y hacer push

```bash
# Dentro de la carpeta att-poc-paymentbox/
git init
git add .
git commit -m "feat: PoC AT&T PaymentBox - Flujo 8 pasos automatizado"
git branch -M main
git remote add origin https://github.com/<TU-USER>/att-poc-paymentbox.git
git push -u origin main
```

### 2. Verificar el pipeline

1. Ir a **Actions** en el repositorio GitHub
2. Hacer clic en el workflow **"AT&T PaymentBox - Pipeline Declarativo PoC"**
3. Cada push dispara las 4 etapas automáticamente

### 3. Ver artefactos

Tras cada ejecución, descargar los informes en **Actions → ejecución → Artifacts**.

---

## Probar Localmente (Ambiente A Completo)

```bash
# 1. Levantar el Ambiente A simulado
cd simulation
docker compose up -d --wait
docker compose ps   # todos los servicios deben estar "healthy"

# 2. Probar la API via Swagger
open http://localhost:8080/swagger-ui.html

# 3. Ejecutar tests Karate
cd tests/functional-karate
mvn test

# 4. Ejecutar tests Selenium (headless)
cd tests/ui-selenium
mvn test -Dapp.url=http://localhost:8080

# 5. Ejecutar smoke test k6 (requiere k6 instalado)
k6 run --env BASE_URL=http://localhost:8080 tests/k6/smoke_recarga.js

# 6. Detener el ambiente
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

## Métricas DORA — Objetivos de esta PoC

| Métrica | Objetivo | Mecanismo |
|---------|----------|-----------|
| **Deployment Frequency** | Cada push | Pipeline automático on push |
| **Lead Time for Changes** | < 10 min pipeline | Jobs secuenciales con dependencias |
| **Change Failure Rate** | < 1% | JaCoCo >=80% + Karate E2E + umbral k6 |
| **MTTR** | Automático | Rollback vía `docker compose down -v` |