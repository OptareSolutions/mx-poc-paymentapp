# Paso a Paso — Replicación de la PoC/Demo AT&T PaymentBox

> **Proyecto:** PaymentBox — PoC de Calidad Declarativa  
> **Cliente:** AT&T (Telco Operator)  
> **Versión:** 1.0  
> **Fecha:** Mayo 2026  
> **Preparado por:** Optare Solutions — QE & DevSecOps

---

## RESUMEN DEL DEMO

La demo demuestra **calidad declarativa** en una cadena de entrega multi-ambiente para el flujo "Recarga por PaymentBox". Se muestran tres momentos clave:

| Momento | Qué se demuestra | Duración |
|---------|-----------------|----------|
| **Flujo verde** | Pipeline CI/CD completo en 4 jobs | ~10 min |
| **DEMO BREAK 1** | Ruptura de contrato entre equipos — detectada antes de llegar a QA | ~8 min |
| **DEMO BREAK 2** | Ruptura de comportamiento — el entorno de QA se protege solo | ~8 min |
| **Performance** | k6 con smoke test integrado en pipeline | ~5 min |

---

## PARTE 1 — PREREQUISITOS Y CONFIGURACIÓN INICIAL

### 1.1 Requisitos de software (verificar antes de la demo)

```powershell
# Verificar Docker
docker --version        # Docker 24+
docker compose version  # Docker Compose v2+

# Verificar Java
java -version           # OpenJDK 17 (Temurin)

# Verificar Maven
mvn -version            # Maven 3.9+

# Verificar k6
k6 version              # k6 v0.46+

# Verificar Git
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

```powershell
# Verificar puertos libres
netstat -ano | findstr "8080 8081 4200 4010 4011 5432"
# No debe mostrar ningún resultado activo
```

### 1.2 Directorio de trabajo

El repositorio local de la PoC está en:

```
C:\Users\jcunha\Documents\Optare\Clientes\AT_T\QA\PoC\att-poc-paymentbox\
```

El repositorio remoto (GitHub) es:
```
https://github.com/OptareSolutions/mx-poc-paymentapp
```

---

## PARTE 2 — PREPARACIÓN DEL ENTORNO LOCAL (30 minutos antes)

### 2.1 Levantar el entorno simulado con Docker Compose

```powershell
# Ir al directorio del repositorio
cd "C:\Users\jcunha\Documents\Optare\Clientes\AT_T\QA\PoC\att-poc-paymentbox"

# Levantar todos los servicios en background
cd simulation
docker compose pull        # Descarga imágenes actualizadas
docker compose up -d       # Levanta en modo background
```

**Verificar que todos los servicios están sanos:**

```powershell
docker compose ps
```

El resultado esperado es que todos los servicios muestren estado `healthy`:

```
NAME             STATUS
microservice-a   Up (healthy)
microservice-b   Up (healthy)
ui-paymentbox    Up
mock-operador    Up
mock-recibo      Up
postgres-tdm     Up (healthy)
```

> ⚠️ **Si algún servicio no arranca en 2 minutos**, revisar los logs:
> ```powershell
> docker compose logs microservice-a
> docker compose logs postgres-tdm
> ```

### 2.2 Verificar acceso a los servicios

```powershell
# UI PaymentBox
Start-Process "http://localhost:4200"

# Swagger microservice-a
Start-Process "http://localhost:8080/swagger-ui.html"

# Swagger microservice-b  
Start-Process "http://localhost:8081/swagger-ui.html"

# Health checks
Invoke-RestMethod http://localhost:8080/actuator/health
Invoke-RestMethod http://localhost:8081/actuator/health
```

**Resultado esperado de health check:**
```json
{"status":"UP"}
```

### 2.3 Abrir tabs del navegador (Chrome/Edge sin extensiones)

| Tab | URL | Propósito en la demo |
|-----|-----|---------------------|
| 1 | https://github.com/OptareSolutions/mx-poc-paymentapp | Repositorio GitHub |
| 2 | GitHub Actions → último run verde de `pipeline-microservice-a` | CI/CD activo |
| 3 | `http://localhost:8080/swagger-ui.html` | API microservice-a |
| 4 | `http://localhost:8081/swagger-ui.html` | API microservice-b |
| 5 | `http://localhost:4200` | UI PaymentBox |
| 6 | SonarCloud dashboard de `optaresolutions` | Calidad de código |

### 2.4 Preparar terminal (PowerShell)

```powershell
# Abrir PowerShell en la raíz del repositorio
cd "C:\Users\jcunha\Documents\Optare\Clientes\AT_T\QA\PoC\att-poc-paymentbox"

# Confirmar que los scripts de demo están accesibles
Get-ChildItem demo\
# Debe mostrar: break-contract.ps1, break-behavior.ps1, restore.ps1, DEMO_GUIDE.md
```

---

## PARTE 3 — FLUJO VERDE (Pipeline OK)

### 3.1 Verificar estado verde en GitHub Actions

1. Ir al Tab 2 del navegador (GitHub Actions)
2. Comprobar que el último run de `pipeline-microservice-a` está en verde ✅
3. Abrir el run y revisar los 4 jobs:
   - **Job 1 — Build & Quality**: Tests unitarios + JaCoCo ≥ 80% + SonarCloud
   - **Job 2 — Security**: Trivy filesystem scan (0 CVEs críticos/altos)
   - **Job 3 — Image Ops**: Build Docker + push a GHCR con tag `env-e-{sha}`
   - **Job 4 — E2E + GitOps**: Karate 8 pasos + actualización del manifiesto K8s

### 3.2 Trigger manual de un run verde (opcional)

Si no hay un run reciente, se puede triggerear un `workflow_dispatch`:

```
GitHub Actions → pipeline-microservice-a → Run workflow → Branch: develop → Run workflow
```

### 3.3 Demostrar el flujo E2E local con Karate (opcional)

```powershell
# Ejecutar tests Karate localmente (requiere entorno Docker levantado)
cd "C:\Users\jcunha\Documents\Optare\Clientes\AT_T\QA\PoC\att-poc-paymentbox\tests\functional-karate"
mvn test -Dkarate.options="--tags @smoke" --no-transfer-progress
```

**El flujo de 8 pasos que valida Karate:**

| Paso | Herramienta | Acción | Resultado esperado |
|------|-------------|--------|-------------------|
| 1 | Selenium | Abrir UI — menú Recarga visible | HTTP 200 + menú visible |
| 2 | Karate | `GET /api/clientes/buscar?tel=4544` | Billy 1 encontrado (ACTIVO) |
| 3 | Karate + SQL | `GET /api/recargas/montos` + verificar en BD | Montos coherentes |
| 4 | Prism (mock) | `POST /api/recargas/validar-operador` | Operador BLUE: crédito aprobado |
| 5 | Selenium | Seleccionar método de pago en UI | Método seleccionado |
| 6 | k6 smoke | `POST /api/pagos/registrar` bajo carga (p95 < 2s) | HTTP 201 dentro de umbral |
| 7 | Karate | `GET /api/pagos/{id}` verificar en BD | Pago persistido |
| 8 | Prism (mock) | `GET /api/recibos/{id}` | PDF sintético generado |

### 3.4 Mostrar SonarCloud

1. Ir al Tab 6 (SonarCloud)
2. Navegar a `optaresolutions / mx-poc-paymentapp`
3. Mostrar: cobertura actual, bugs, vulnerabilidades, security hotspots
4. Punto clave: **Cobertura ≥ 80 %** — si cae, el Job 1 bloquea el pipeline

---

## PARTE 4 — DEMO BREAK 1: Ruptura de Contrato

> **Narrativa:** Team B renombra campos del DTO público sin avisar a Team A.

### 4.1 Ejecutar el script de ruptura

```powershell
# Desde la raíz del repositorio
cd "C:\Users\jcunha\Documents\Optare\Clientes\AT_T\QA\PoC\att-poc-paymentbox"
.\demo\break-contract.ps1
```

**Qué hace este script:**
- Renombra `telefono` → `phone` y `nombre` → `fullName` en el DTO de `microservice-b`
- Actualiza el test unitario de `microservice-b` para que **siga compilando y pasando** (simula que Team B actualizó sus propios tests, pero no avisó a Team A)

### 4.2 Commit y push

```powershell
git add .
git commit -m "demo: BREAK 1 - romper contrato DTO (telefono->phone)"
git push origin develop
```

### 4.3 Observar en GitHub Actions

**Pipeline microservice-b** se lanza automáticamente (path trigger):
- ✅ Job 1 — Build & Quality: **PASA** (los tests unitarios de Team B están actualizados)
- ✅ Job 2 — Security: **PASA**
- ✅ Job 3 — Image Ops: **PASA** — imagen `env-e-{sha}` push al GHCR

> **Punto clave:** Todo parece verde. Pero...

### 4.4 Triggerear el pipeline de integración

```
GitHub Actions → pipeline-integration → Run workflow
  → promote_from: develop
  → promote_to: qa
  → Run workflow
```

**O desde PowerShell con GitHub CLI:**
```powershell
gh workflow run pipeline-integration.yml \
  -f promote_from=develop \
  -f promote_to=qa
```

### 4.5 Observar el fallo

El pipeline de integración ejecuta:
- ✅ Job 0 — Validar Promoción: PASA (develop→qa es una ruta válida)
- ❌ **Job 1 — Tests de Contrato: FALLA**

```
FAILED - contract_microservices.feature:27
match response.telefono == '4544'
  actual: {phone: '4544', fullName: 'Billy 1 - Cortes', status: 'ACTIVO'}
  expected: response.telefono to exist
```

> **La promoción a env-a (QA) queda BLOQUEADA.**
> 
> Mensaje clave: *"Este error, en el mundo real de AT&T, habría llegado al ambiente de pruebas, habría requerido 2-3 días de análisis. Con nuestra solución, se detecta en segundos antes de que una imagen llega a QA."*

### 4.6 Restaurar el estado verde

```powershell
.\demo\restore.ps1
git add .
git commit -m "demo: restaurar contrato - estado verde"
git push origin develop
```

Esperar a que el pipeline de `microservice-b` vuelva a verde, luego triggerear `pipeline-integration` nuevamente para confirmar la restauración.

---

## PARTE 5 — DEMO BREAK 2: Ruptura de Comportamiento

> **Narrativa:** Team A activa una validación de negocio (monto mínimo $100) sin avisar al equipo de QA.

> ⚠️ **Prerequisito:** Tener `develop` ya promovido a `qa` (env-a) en estado verde.

### 5.1 Ejecutar el script de ruptura

```powershell
.\demo\break-behavior.ps1
```

**Qué hace este script:**
- Activa la validación de monto mínimo $100 en `RecargaService.java` de `microservice-a`
- Los tests unitarios de microservice-a **no cubren este escenario**, por eso **pasan**

### 5.2 Commit y push a la rama `qa`

```powershell
git add .
git commit -m "demo: BREAK 2 - validacion monto minimo 100"
git push origin qa
```

### 5.3 Observar en GitHub Actions — pipeline-microservice-a en rama qa

- ✅ Job 1 — Build & Quality: **PASA** (unit tests no testean monto mínimo)
- ✅ Job 2 — Security: **PASA**
- ✅ Job 3 — Image Ops: **PASA** — imagen `env-a-{sha}` en GHCR
- ❌ **Job 4 — E2E + GitOps: FALLA**

```
FAILED - recarga_flow.feature:60 (Pasos 6 y 7 - Registrar pago)
  POST /api/pagos/registrar  monto=20
  expected: status 201
  actual:   status 400  {"message": "Monto mínimo $100"}
```

> **El overlay `k8s/overlays/env-a/kustomization.yaml` NO se actualiza.**
> GitOps protege el entorno de QA. La imagen con el defecto nunca llega al overlay.
> 
> Mensaje clave: *"El entorno de QA sigue apuntando a la versión anterior que funcionaba. El pipeline es la red de seguridad. El equipo decide conscientemente qué hacer: ¿es intencional esta validación? ¿Se actualiza el test? La decisión es humana, el sistema no la permite pasar sin revisión."*

### 5.4 Restaurar el estado verde

```powershell
.\demo\restore.ps1
git add .
git commit -m "demo: restaurar comportamiento - estado verde"
git push origin qa
```

---

## PARTE 6 — DEMO PERFORMANCE (k6)

### 6.1 Smoke test integrado en el pipeline

El smoke test de k6 se ejecuta automáticamente en el **Job 4** de cada pipeline:
- **20 VUs durante 5 minutos**
- **Umbral: p95 < 2 segundos**

Si el umbral se supera, el Job 4 falla y el manifiesto GitOps no se actualiza.

### 6.2 Ejecutar el smoke test localmente (demo en directo)

```powershell
# Asegurarse de que el entorno Docker está levantado
cd "C:\Users\jcunha\Documents\Optare\Clientes\AT_T\QA\PoC\att-poc-paymentbox\tests\k6"
k6 run smoke-test.js
```

**Output esperado:**
```
✓ status is 201
✓ response time < 2000ms

checks.........................: 100.00%
http_req_duration..............: avg=450ms  p95=1.2s
```

### 6.3 Script de carga completa (2k VUs / 3600s)

Para la demo de carga completa (si se muestra en contexto):
```powershell
k6 run --vus 2000 --duration 3600s load-test.js
```

> **Diferenciador vs JMeter:**
> - k6 soporta 2.000+ VUs sin degradación de rendimiento en el executor
> - Grabación nativa en protocolo HTTPS (resuelve el problema de tokens entre nubes)
> - Scripting en JavaScript: más mantenible para el equipo de QA
> - Integración directa con GitHub Actions como binario standalone

---

## PARTE 7 — DEMO RPA (Salesforce)

### 7.1 Script RPA con Playwright Python

```powershell
cd "C:\Users\jcunha\Documents\Optare\Clientes\AT_T\QA\01_RPA\scripts"

# Instalar dependencias (primera vez)
pip install -r requirements.txt
playwright install chromium

# Ejecutar el flujo de Salesforce
python salesforce_flow.py
```

> **Nota:** El script RPA de Salesforce (`salesforce_flow.py`) automatiza el flujo de ventas. Requiere credenciales de Salesforce configuradas en `config.py` o variables de entorno.

---

## PARTE 8 — DEMO IA: Generación de Tests desde Historias de Usuario

### 8.1 Ejecutar el generador de tests IA

```powershell
cd "C:\Users\jcunha\Documents\Optare\Clientes\AT_T\QA\PoC\att-poc-paymentbox\tests\ia"

# Instalar dependencias (primera vez)
pip install -r requirements.txt

# Ejecutar la demo — pedir al comité AT&T que proporcione una historia de usuario
python demo.py
```

### 8.2 Momento WOW — IA en vivo

Pedir a un miembro del comité que dicte una historia de usuario, por ejemplo:

> *"Como operador de recarga, quiero que el sistema rechace intentos de recarga cuando el cliente esté bloqueado, para evitar fraudes."*

Introducirla en el prompt del script y mostrar cómo se generan 10-15 casos de prueba en formato Karate DSL en segundos.

---

## PARTE 9 — CLEANUP (POST-DEMO)

```powershell
# Bajar el entorno simulado
cd "C:\Users\jcunha\Documents\Optare\Clientes\AT_T\QA\PoC\att-poc-paymentbox\simulation"
docker compose down

# Verificar que no quedaron contenedores corriendo
docker ps

# Asegurarse de que el repositorio quedó en estado verde
cd ..
git status
git log --oneline -5
```

---

## APÉNDICE A — SOLUCIÓN DE PROBLEMAS

### Error: Puerto en uso

```powershell
# Encontrar el proceso que usa el puerto (ej: 8080)
netstat -ano | findstr :8080
# Anotar el PID y matar el proceso
Stop-Process -Id <PID> -Force
```

### Error: Docker Compose no levanta microservice-a

```powershell
# Ver logs de microservice-a
docker compose logs microservice-a --tail=50

# Si el problema es la BD, esperar a que postgres-tdm esté healthy primero
docker compose up postgres-tdm -d
Start-Sleep -Seconds 15
docker compose up -d
```

### Error: Pipeline falla por SONAR_TOKEN

El secret `SONAR_TOKEN` debe estar configurado en el repositorio de GitHub:
```
GitHub → Settings → Secrets and variables → Actions → SONAR_TOKEN
```

### Restauración de emergencia

Si algún break-script dejó el repositorio en mal estado:

```powershell
cd "C:\Users\jcunha\Documents\Optare\Clientes\AT_T\QA\PoC\att-poc-paymentbox"
# Revertir TODOS los cambios no commiteados
git checkout -- .
git clean -fd
```

---

## APÉNDICE B — TIEMPOS DE REFERENCIA

| Pipeline | Duración típica |
|----------|----------------|
| pipeline-microservice-a completo | 8–12 min |
| pipeline-microservice-b completo | 6–10 min |
| pipeline-integration (contrato + E2E) | 10–15 min |
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
| Arquitectura completa | `05_Documentacion\arquitectura\arquitectura_solucion.md` |
| Tech Stack justificado | `05_Documentacion\tech_stack\tech_stack.md` |
| Guión de presentación (PathWay) | `05_Documentacion\presentacion\pathway_guion_demo.md` |
| README del repositorio | `PoC\att-poc-paymentbox\README.md` |
| Guía de demo del repositorio | `PoC\att-poc-paymentbox\demo\DEMO_GUIDE.md` |
| Análisis PoC vs requerimientos | `05_Documentacion\arquitectura\analisis-poc-github-vs-requerimientos.md` |
