# Paso a Paso — Guía de Demo AT&T PaymentBox PoC

> **Proyecto:** PaymentBox — PoC de Calidad Declarativa  
> **Cliente:** AT&T (Telco Operator)  
> **Versión:** 2.0 (alineada con ramas E/A/F/PRODUCCION)  
> **Fecha:** Mayo 2026  
> **Preparado por:** Optare Solutions — QE & DevSecOps

---

## RESUMEN DEL DEMO

La demo muestra **calidad declarativa** en una cadena de entrega multi-ambiente para el flujo "Recarga por PaymentBox". Los pipelines en GitHub Actions son la red de seguridad: detectan rupturas antes de que lleguen al siguiente ambiente.

| Momento | Qué se demuestra | Duración |
|---------|-----------------|----------|
| **Flujo verde** | Push en `feature/*` → PR → `E` — Testing Factory + pipelines CICD | ~10 min |
| **DEMO BREAK 1** | Ruptura de contrato entre equipos — Testing Factory lo atrapa en `feature/*` | ~8 min |
| **DEMO BREAK 2** | Ruptura de comportamiento — Golden lo atrapa al integrar en `E` | ~8 min |
| **Promoción a QA** | PR `E` → `A` + gate OPERACIONES en push a `A` | ~5 min |
| **Performance** | k6 smoke integrado en Testing Factory y Golden | ~5 min |

---

## Modelo de ramas (referencia rápida)

```
feature/* ──PR──► E ──PR──► A ──PR──► F ──PR──► PRODUCCION
              env-e      env-a      env-f          prod
```

| Rama | Ambiente | Rol |
|------|----------|-----|
| `feature/*` | — | Desarrollo aislado; CI rápido sin publicar imagen |
| `E` | `env-e` | Integración compartida del equipo |
| `A` | `env-a` | QA operativo |
| `F` | `env-f` | UAT / preproducción |
| `PRODUCCION` | `prod` | Producción |

---

## PARTE 1 — PREREQUISITOS Y CONFIGURACIÓN INICIAL

### 1.1 Requisitos de software (verificar antes de la demo)

```powershell
docker --version        # Docker 24+
docker compose version  # Docker Compose v2+
java -version           # OpenJDK 17 (Temurin)
k6 version              # k6 v0.46+
git --version           # Git 2.x
```

**Puertos que deben estar libres:**

| Puerto | Servicio |
|--------|---------|
| 8080 | microservice-a (PaymentBox Core) |
| 8081 | microservice-b (Customer Profile) |
| 4200 | ui-paymentbox (Angular) |
| 4010 | mock-operador (Prism) |
| 4011 | mock-recibo (Prism) |
| 5432 | PostgreSQL |

### 1.2 Repositorio

```
https://github.com/OptareSolutions/mx-poc-paymentapp
```

Rama activa de referencia: **`E`** (integración de desarrollo).  
La demo parte creando una `feature/*` desde `E`.

---

## PARTE 2 — PREPARACIÓN DEL ENTORNO LOCAL (30 minutos antes)

### 2.1 Levantar el entorno simulado con Docker Compose

```powershell
cd simulation
docker compose pull
docker compose up -d
docker compose ps
# Todos los servicios deben mostrar estado "healthy"
```

### 2.2 Verificar acceso a los servicios

```powershell
Start-Process "http://localhost:4200"                     # UI PaymentBox
Start-Process "http://localhost:8080/swagger-ui.html"     # Swagger microservice-a
Start-Process "http://localhost:8081/swagger-ui.html"     # Swagger microservice-b
Invoke-RestMethod http://localhost:8080/actuator/health   # → {"status":"UP"}
Invoke-RestMethod http://localhost:8081/actuator/health   # → {"status":"UP"}
```

### 2.3 Abrir tabs del navegador

| Tab | URL | Propósito en la demo |
|-----|-----|---------------------|
| 1 | https://github.com/OptareSolutions/mx-poc-paymentapp/actions | GitHub Actions |
| 2 | Último run verde de `[microservice-a] CICD` | Pipeline CICD activo |
| 3 | Último run verde de `Testing Factory — CI Quality Gates` | Testing Factory |
| 4 | `http://localhost:8080/swagger-ui.html` | API microservice-a |
| 5 | `http://localhost:8081/swagger-ui.html` | API microservice-b |
| 6 | SonarCloud dashboard de `optaresolutions` | Calidad de código |

### 2.4 Preparar terminal

```powershell
# Clonar o actualizar el repositorio
git fetch origin
git checkout E
git pull origin E

# Crear rama de demo
git checkout -b feature/demo-att-paymentbox
```

---

## PARTE 3 — FLUJO VERDE (Push en `feature/*` → PR a `E`)

### 3.1 Hacer un cambio mínimo

```powershell
# Editar README de ambos microservicios (esto dispara paths de todos los workflows relevantes)
Add-Content microservice-a\README.md "`n<!-- Demo AT&T $(Get-Date -Format 'yyyy-MM-dd HH:mm') -->"
Add-Content microservice-b\README.md "`n<!-- Demo AT&T $(Get-Date -Format 'yyyy-MM-dd HH:mm') -->"

git add microservice-a\README.md microservice-b\README.md
git commit -m "demo: touch README para trigger de pipelines"
git push origin feature/demo-att-paymentbox
```

### 3.2 Qué observar en GitHub Actions (evento `push` a `feature/*`)

Tres workflows arrancan **en paralelo**:

| Workflow | Qué hace | Resultado esperado |
|----------|----------|-------------------|
| `[microservice-a] CICD` | Build + unit tests (sin publicar imagen) | ✅ Verde |
| `[microservice-b] CICD` | Build + unit tests (sin publicar imagen) | ✅ Verde |
| `Testing Factory — CI Quality Gates` | API (Karate) → k6 smoke → RPA informativo | ✅ Verde |

> **Narración:** *"Un solo push en la rama de feature dispara dos pipelines de microservicio y un Testing Factory. Nada llega a publicarse todavía — estamos validando antes de integrarnos al equipo."*

### 3.3 Abrir el Pull Request `feature/*` → `E`

En GitHub:
1. Crear PR con base **`E`**.
2. Observar que los mismos tres workflows se vuelven a ejecutar con evento `pull_request`.
3. En los pipelines de microservicio, este PR **activa también el job `quality-gates`** (Gitleaks + SonarCloud + Trivy filesystem) — algo que el `push` en feature no hacía.
4. Testing Factory vuelve a correr (API + k6 + RPA).

> **Punto clave:** *"El PR añade una capa de seguridad adicional: secrets, análisis estático, vulnerabilidades. La imagen no se construye hasta que el PR esté aprobado y mergeado."*

### 3.4 Merge del PR → push a `E`

Al mergear, ocurre un **push a `E`**:

- Los dos pipelines de microservicio avanzan hasta **Deliver** (publican imagen con tag `versión-sha.run_number` y actualizan el manifiesto GitOps `env-e`).
- **Golden Pipeline** arranca con la suite completa: API + k6 + RPA según variables.

> **Narración:** *"Solo cuando el equipo aprueba el PR la imagen se construye, se publica en GHCR y el clúster de `env-e` se actualiza automáticamente."*

---

## PARTE 4 — DEMO BREAK 1: Ruptura de Contrato

> **Narrativa:** Team B renombra campos del DTO público sin avisar a Team A.  
> **Detectado en:** Testing Factory (push en `feature/*`)

### 4.1 Ejecutar el script de ruptura

```powershell
.\demo\break-contract.ps1
git add .
git commit -m "demo: BREAK 1 - romper contrato DTO"
git push origin feature/demo-att-paymentbox
```

### 4.2 Observar en GitHub Actions

| Workflow | Resultado | Por qué |
|----------|----------|---------|
| `[microservice-b] CICD` | ✅ PASA | Unit tests de Team B están actualizados |
| `[microservice-a] CICD` | ✅ PASA | Team A aún no tiene la nueva versión |
| `Testing Factory` | ❌ FALLA | Karate (`@contract`) detecta el campo renombrado |

```
FAILED - contract_microservices.feature:27
match response.telefono == '4544'
  actual: {phone: '4544', fullName: 'Billy 1 - Cortes', status: 'ACTIVO'}
  expected: response.telefono to exist
```

> **Mensaje clave:** *"Todo parece verde en los pipelines individuales — cada equipo pasó sus tests. Pero Testing Factory valida el contrato entre servicios y lo detiene antes de que el cambio llegue a `E`. En el mundo real de AT&T, este error habría llegado a QA y tardado 2-3 días en diagnosticarse."*

### 4.3 Restaurar el estado verde

```powershell
.\demo\restore.ps1
git add .
git commit -m "demo: restaurar contrato"
git push origin feature/demo-att-paymentbox
```

---

## PARTE 5 — DEMO BREAK 2: Ruptura de Comportamiento

> **Narrativa:** Team A activa una validación de negocio (monto mínimo $100) sin actualizar los tests.  
> **Detectado en:** Golden Pipeline (push a `E`)

> ⚠️ **Prerequisito:** Tener `feature/demo-att-paymentbox` en estado verde y el PR mergeado a `E`.

### 5.1 Crear rama desde E y ejecutar el script de ruptura

```powershell
git checkout E
git pull origin E
git checkout -b feature/demo-break2

.\demo\break-behavior.ps1
git add .
git commit -m "demo: BREAK 2 - validacion monto minimo 100"
git push origin feature/demo-break2
```

### 5.2 Abrir PR `feature/demo-break2` → `E` y mergear

1. El PR pasa (unit tests no cubren el monto mínimo).
2. Al mergear, el **push a `E`** dispara:
   - Pipelines de microservicio → avanzan hasta publish y deliver (imagen llega a `env-e`).
   - **Golden Pipeline** → detecta la ruptura en los tests funcionales E2E.

### 5.3 Observar el fallo en Golden Pipeline

```
FAILED - recarga_flow.feature:60
  POST /api/pagos/registrar  monto=20
  expected: status 201
  actual:   status 400  {"message": "Monto mínimo $100"}
```

> **Mensaje clave:** *"El pipeline de microservicio pasó: el cambio compiló, los tests unitarios pasaron, la imagen se publicó. Pero Golden, la suite completa que corre en cada push a `E`, detecta que el comportamiento E2E está roto. El manifiesto de `env-e` refleja la imagen, pero el equipo tiene visibilidad inmediata del problema antes de promover a QA."*

### 5.4 Restaurar el estado verde

```powershell
.\demo\restore.ps1
git add .
git commit -m "demo: restaurar comportamiento"
git push origin feature/demo-break2
# Mergear vía PR a E
```

---

## PARTE 6 — PROMOCIÓN A QA (PR `E` → `A`)

### 6.1 Abrir PR de `E` a `A`

En GitHub:
1. Crear PR con base **`A`**.
2. Observar que corren:
   - Pipelines de microservicio (build + test, **sin quality-gates del reusable** en esta base, **sin deliver**).
   - **Golden Pipeline** en modo PR hacia `A` (API + k6 + RPA según variables).

### 6.2 Merge del PR → push a `A`

Al mergear:

1. **Publish** de imagen con tag de versión.
2. **Gate `OPERACIONES`** — GitHub Environment requiere aprobación del equipo de Operaciones antes de continuar.
3. Tras la aprobación: **Deliver** actualiza el overlay `env-a` → QA queda con la nueva versión.
4. **Golden** vuelve a correr en push a `A`.

> **Narración:** *"Antes de que nada llegue a QA, hay un gate humano de Operaciones. La automatización hace la validación; el equipo toma la decisión consciente de aprobar."*

---

## PARTE 7 — PERFORMANCE (k6)

### 7.1 Smoke test integrado en Testing Factory y Golden

k6 corre automáticamente como parte de Testing Factory (en `feature/*` y PR → `E`) y de Golden (en push a ambientes):
- **20 VUs durante 5 minutos**
- **Umbral: p95 < 2 segundos**

Si el umbral falla, el workflow correspondiente no avanza.

### 7.2 Ejecutar el smoke test localmente (demo en directo)

```powershell
cd tests\k6
k6 run smoke-test.js
```

**Output esperado:**
```
✓ status is 201
✓ response time < 2000ms

checks.........................: 100.00%
http_req_duration..............: avg=450ms  p95=1.2s
```

### 7.3 Script de carga completa (2k VUs / 3600s)

```powershell
k6 run --vus 2000 --duration 3600s load-test.js
```

> **Diferenciador vs JMeter:** k6 soporta 2.000+ VUs sin degradación, script en JavaScript, integración nativa con GitHub Actions.

---

## PARTE 8 — DEMO RPA (Salesforce)

```powershell
cd C:\Users\jcunha\Documents\Optare\Clientes\AT_T\QA\01_RPA\scripts
pip install -r requirements.txt
playwright install chromium
python salesforce_flow.py
```

> El RPA de Salesforce es **informativo** por defecto en Testing Factory. En Golden puede volverse **bloqueante** si `RPA_BLOCKING_GATE=true` (variable de repo).

---

## PARTE 9 — CLEANUP (POST-DEMO)

```powershell
# Bajar el entorno simulado
cd simulation
docker compose down
docker ps   # No debe mostrar contenedores corriendo

# Verificar que el repositorio quedó en estado verde
cd ..
git checkout E
git pull origin E
git status
git log --oneline -5
```

---

## APÉNDICE A — SOLUCIÓN DE PROBLEMAS

### Puerto en uso

```powershell
netstat -ano | findstr :8080
Stop-Process -Id <PID> -Force
```

### Docker Compose no levanta microservice-a

```powershell
docker compose logs microservice-a --tail=50
docker compose up postgres-tdm -d
Start-Sleep -Seconds 15
docker compose up -d
```

### Pipeline falla por SONAR_TOKEN

```
GitHub → Settings → Secrets and variables → Actions → SONAR_TOKEN
```

### Restauración de emergencia

```powershell
git checkout E
git pull origin E
git checkout -- .
git clean -fd
```

---

## APÉNDICE B — TIEMPOS DE REFERENCIA

| Pipeline | Duración típica |
|----------|----------------|
| `[microservice-a] CICD` completo (hasta Deliver) | 8–12 min |
| `[microservice-b] CICD` completo (hasta Deliver) | 6–10 min |
| `Testing Factory` (API + k6 + RPA) | 10–15 min |
| `Golden Pipeline` completo | 12–18 min |
| k6 smoke test local | 5 min |

---

## APÉNDICE C — DATOS DE PRUEBA (TDM)

| Perfil | Teléfono | Estado | Uso en demo |
|--------|----------|--------|-------------|
| Billy 1 - Cortes | `4544` | ACTIVO | Escenario principal — todos los flujos |
| Billy 2 - Cortes | `4545` | ACTIVO | Escenarios alternativos |
| Billy 3 - Cortes | `4546` | ACTIVO | Escenarios alternativos |
| Billy 4 - Pineda | `4547` | INACTIVO | Tests negativos |
| Billy 5 - Bloqueado | `4548` | BLOQUEADO | Tests negativos |

---

## APÉNDICE D — REFERENCIAS

| Documento | Ruta |
|-----------|------|
| Estrategia GitFlow y matriz de pipelines | `doc/02_CI_CD/gitflow-pipeline-strategy.md` |
| Arquitectura completa | `doc/05_Documentacion/arquitectura/arquitectura_solucion.md` |
| Tech Stack justificado | `doc/05_Documentacion/tech_stack/tech_stack.md` |
| Guión presentación (PathWay) | `doc/05_Documentacion/presentacion/pathway_guion_demo.md` |
| Guía de demo técnica | `demo/DEMO_GUIDE.md` |

---

## APÉNDICE E — VARIABLES DE REPOSITORIO

| Variable | Efecto |
|----------|--------|
| `RPA_ENABLED` | Activa RPA en Golden para ramas `E`/`A`/`F`/`PRODUCCION` |
| `RPA_BLOCKING_GATE` | Si `true`, Golden bloquea el pipeline si RPA falla |
| `UI_TESTS_ENABLED` | Solo para `ci-cd-att.yml` manual: activa Selenium |

---

*Documento: `doc/05_Documentacion/paso_a_paso_demo.md`*  
*Actualizado v2.0 — Mayo 2026. Alineado con ramas `E`/`A`/`F`/`PRODUCCION` y workflows `testing-factory.yml`, `golden-pipeline-testing.yml`, `reusable-microservice-pipeline.yml`.*
