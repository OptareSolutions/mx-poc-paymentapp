# Guión de Demo — Framework QA AT&T
## Capacidades de Orquestación, Reporteo, Calendarización y Gobierno

> **Versión:** 1.0 | **Duración estimada:** 30-45 minutos  
> **Audiencia:** AT&T — Comité Técnico / Fábrica de Software  
> **Presentador:** Optare Solutions

---

## 📋 Pre-Demo Checklist (30 min antes)

```
□ Entorno simulado levantado:  cd simulation && docker compose up -d
□ Todos los servicios healthy:  docker compose ps  (4 servicios "Up")
□ UI accessible:               http://localhost:4200  (Angular)
□ API A accessible:            http://localhost:8080/swagger-ui.html
□ API B accessible:            http://localhost:8081/swagger-ui.html
□ GitHub Actions visible:      Tab Actions del repositorio att-poc-paymentbox
□ Browser sin caché en tabs:   GitHub Actions, UI, Swagger
□ Terminal abierta en:         C:\Users\jcunha\Documents\Optare\Clientes\AT_T\QA\PoC\att-poc-paymentbox
□ Rama activa verificada:      git status (debe mostrar develop limpio)
□ Estado verde confirmado:     Último run de pipeline-microservice-a.yml = ✅
```

---

## 🎯 Apertura (3 minutos)

### Mensaje de Valor

> _"AT&T realiza más de 5,200 validaciones manuales en sus fábricas de software. 
> Lo que vamos a mostrarles hoy es cómo un framework centralizado puede transformar 
> ese proceso: reducir el tiempo de detección de defectos de días a minutos, 
> hacer visible la calidad en tiempo real, y habilitar la entrega continua con confianza."_

### Agenda de la Demo

| # | Bloque | Duración |
|---|--------|---------|
| 1 | Orquestación — El workspace en verde | 8 min |
| 2 | Ejecución en Vivo — Demo Break 1 (Contrato) | 8 min |
| 3 | Ejecución en Vivo — Demo Break 2 (Comportamiento) | 8 min |
| 4 | Reporteo — Dashboard, KPIs y ROI | 5 min |
| 5 | Calendarización — Ejecuciones programadas | 3 min |
| 6 | Gobierno — Estándares y mantenibilidad | 3 min |
| 7 | IA — Generación de datos y casos de prueba | 3 min |
| 8 | Plan de Mantenimiento y Q&A | 5 min |

---

## 🔧 Bloque 1: Orquestación — El Workspace en Verde (8 min)

### Narrative

> _"Lo primero que quiero mostrarles es el workspace completo. Aquí en GitHub Actions 
> pueden ver todos los flujos automatizados. Este es el estado normal — todo en verde."_

### Pasos

1. **Abrir GitHub → tab Actions**
   - Señalar los 3 pipelines: `pipeline-microservice-a`, `pipeline-microservice-b`, `pipeline-integration`
   - Mostrar el último run exitoso con los 4 jobs en verde
   
2. **Hacer clic en el último run exitoso de microservice-a**
   - Mostrar los 4 jobs: Build & Quality, Security Scan, Image Ops, E2E Functional
   - _"Cada push al repositorio dispara automáticamente estos 4 jobs en secuencia"_
   
3. **Expandir Job 1 — Build & Quality**
   - Señalar: `Unit Tests: 47/47 ✅`, `JaCoCo: 84% ✅`, `SonarCloud: Quality Gate OK ✅`
   - _"La cobertura de código mínima es 80%. Si un desarrollador introduce código sin tests suficientes, el pipeline falla aquí — no llega a construir la imagen."_

4. **Expandir Job 4 — E2E Functional**
   - Mostrar los 8 pasos de Karate ejecutándose
   - _"Este es el flujo real de PaymentBox: desde que el cliente ve los menús hasta que recibe el recibo. 8 pasos, automatizados, en menos de 5 minutos."_

5. **Mostrar la arquitectura multi-ambiente**

```
GitHub push → CI pipeline → Docker image → GitOps (Kustomize) → ArgoCD sync

Rama develop  →  env-e  (Desarrollo)
Rama qa       →  env-a  (QA)
Rama uat      →  env-u  (UAT)
Rama main     →  prod   (Producción)
```

> _"La promoción entre entornos es manual y controlada. Nadie puede hacer push 
> directamente a producción. El estado de cada entorno es declarativo — está 
> definido en el repositorio como código."_

---

## 💥 Bloque 2: Demo Break 1 — Ruptura de Contrato (8 min)

### Narrative

> _"Ahora vamos a simular un escenario muy común: Team B modifica su API pública 
> sin coordinar con Team A. En el mundo actual, esto se descubriría en producción. 
> Con este framework, se detecta en segundos."_

### Setup (hacer antes de la demo o en vivo)

```powershell
# Ejecutar en terminal
cd C:\Users\jcunha\Documents\Optare\Clientes\AT_T\QA\PoC\att-poc-paymentbox
.\demo\break-contract.ps1
git add .
git commit -m "demo: BREAK 1 - romper contrato DTO"
git push origin develop
```

### Pasos

1. **Explicar el escenario mientras se ejecuta el push:**
   > _"Team B ha renombrado el campo 'telefono' a 'phone' en su respuesta. 
   > Los consumidores esperan 'telefono' — incluyendo Team A y los tests de contrato."_

2. **Abrir GitHub Actions — ver el pipeline arrancando en tiempo real**
   - _"Vean — el pipeline de microservice-b se inicia automáticamente"_
   - Jobs 1, 2, 3 pasan (los unit tests de Team B no cubren este cambio)
   - _"Job 4 pasa también... porque los tests unitarios de Team B están actualizados"_

3. **Trigger manual del pipeline-integration.yml (develop → qa)**
   ```
   Actions → "Pipeline Integración" → Run workflow → promote_from: develop → promote_to: qa → Run
   ```
   
4. **Esperar el fallo en Job 1 (Tests Contrato)**
   - _"Aquí está — Job 1 falla. El Karate de contrato detectó que el campo 'telefono' ya no existe."_
   
5. **Expandir el log del fallo:**
   ```
   FAILED - contract_microservices.feature:27
   match response.telefono == '4544'
     actual: {phone: '4544', fullName: 'Billy 1', status: 'ACTIVO'}
     expected: response.telefono to exist
   ```
   
6. **Señalar el bloqueo:**
   > _"Jobs 2, 3 y 4 nunca se ejecutaron. La promoción a env-a está bloqueada. 
   > AT&T nunca verá este breaking change en QA."_

7. **Restaurar:**
   ```powershell
   .\demo\restore.ps1
   git add . && git commit -m "restore: contrato" && git push origin develop
   ```

---

## 💥 Bloque 3: Demo Break 2 — Ruptura de Comportamiento (8 min)

### Narrative

> _"El segundo escenario muestra por qué el E2E es crucial incluso cuando el contrato está correcto. Team A añade una validación de negocio sin avisar al equipo de QA."_

### Setup

```powershell
.\demo\break-behavior.ps1
git add .
git commit -m "demo: BREAK 2 - validación monto mínimo $100"
git push origin qa
```

### Pasos

1. **Explicar el escenario:**
   > _"Team A ha añadido una validación: el monto mínimo de recarga es $100. 
   > Los perfiles Billy usan $20 y $50. Nadie actualizó los tests."_

2. **Observar el pipeline de microservice-a en GitHub Actions:**
   - Job 1 ✅ (unit tests pasan — la validación tiene cobertura unitaria)
   - Job 2 ✅ (Trivy pasa)
   - Job 3 ✅ (imagen construida y publicada)
   - Job 4 ❌ — _"Aquí falla el E2E"_

3. **Expandir el log del Job 4:**
   ```
   FAILED - recarga_flow.feature:60 (Pasos 6 y 7)
   POST /api/pagos/registrar  monto=20
     expected status: 201
     actual status:   400  {"message": "Monto mínimo $100"}
   ```

4. **Señalar el impacto:**
   > _"El overlay de env-a NO se actualizó. La imagen del Job 3 fue construida, 
   > pero Kubernetes sigue apuntando a la versión anterior. GitOps protegió el entorno."_

5. **Comparar con Demo Break 1:**
   > _"En Break 1, fallamos en Job 1 — antes de construir la imagen. 
   > En Break 2, fallamos en Job 4 — después de construirla. 
   > Por eso el testing de contrato (más barato) va primero: shift-left."_

6. **Restaurar:**
   ```powershell
   .\demo\restore.ps1
   git add . && git commit -m "restore: comportamiento" && git push origin qa
   ```

---

## 📊 Bloque 4: Reporteo — Dashboard, KPIs y ROI (5 min)

### Narrative

> _"Además de los quality gates, el framework genera reportes automáticos que 
> permiten hacer seguimiento de la calidad en el tiempo."_

### Pasos

1. **Mostrar artefactos del último run exitoso:**
   - GitHub Actions → run exitoso → Artifacts
   - Descargar y abrir: `microservice-a-test-results-develop`
   - Mostrar el HTML de JaCoCo con cobertura visual

2. **Señalar métricas clave:**
   ```
   ✅ Test Pass Rate:      100% (47/47)
   ✅ Code Coverage:        84% (gate: 80%)
   ✅ Security Issues:       0 CRITICAL, 0 HIGH
   ✅ k6 p95 (flujo):     1,350ms (umbral: 3,000ms)
   ✅ k6 error rate:        0.0% (umbral: 1%)
   ```

3. **Mostrar ROI estimado:**
   ```
   Casos automatizados en PoC:     48 scenarios
   Ahorro por ejecución:           ~4 horas QA manual
   Ejecuciones automáticas/día:    ~10
   Ahorro mensual estimado (PoC):  ~$20,000
   
   Con 100% automatización (5,200 casos):
   Ahorro potencial mensual:       ~$1.8M
   ```

4. **Señalar comparativa histórica de performance:**
   > _"Aquí pueden ver cómo el p95 ha mejorado del 1,820ms al 1,350ms 
   > a lo largo de 4 sprints. El framework detecta regresiones de performance 
   > antes de que lleguen a producción."_

---

## 📅 Bloque 5: Calendarización (3 min)

### Narrative

> _"Además de los pipelines automáticos por push, tenemos ejecuciones programadas."_

### Pasos

1. **Mostrar la configuración del cron en el YAML:**
   ```yaml
   schedule:
     - cron: '0 7 * * 1-5'   # Smoke diario L-V 07:00 UTC
     - cron: '0 22 * * 0'    # Regresión completa domingos 22:00 UTC
   ```

2. **Explicar el calendario:**
   ```
   L-V 07:00 UTC:  Smoke Test Diario (5 min) — estado del sistema al despertar
   Dom 22:00 UTC:  Regresión Completa (20 min) — estado de calidad semanal
   1er lunes:      Performance Full (30 min) — 1k VUs, 1600 seg
   ```

3. **Señalar el resultado práctico:**
   > _"Cada mañana el equipo de QA llega a la oficina con el estado de salud del 
   > sistema en su bandeja de entrada. Si algo falló durante la noche, lo saben 
   > antes de tocar una sola línea de código."_

---

## 🏛️ Bloque 6: Gobierno y Estándares (3 min)

### Narrative

> _"Un framework sin governance es un conjunto de scripts. Con governance es una plataforma."_

### Pasos

1. **Mostrar la estructura de ramas:**
   ```
   main (PROD) ← solo GitOps, nunca push directo
   uat ← promoción manual desde qa con pipeline-integration
   qa ← promoción manual desde develop
   develop ← integración de features
   feature/* ← desarrollo
   ```

2. **Mostrar los quality gates:**
   ```
   Gate 1: Cobertura ≥ 80% (JaCoCo) — bloqueante
   Gate 2: Seguridad 0 CRITICAL/HIGH (Trivy) — bloqueante
   Gate 3: Contrato OK (Karate) — bloqueante en promoción
   Gate 4: E2E 8 pasos OK (Karate) — bloqueante
   Gate 5: Performance p95 < 3s (k6) — bloqueante
   ```

3. **Señalar el valor del estándar:**
   > _"Cualquier nuevo desarrollador que se una al equipo tiene reglas claras. 
   > El framework no depende de la disciplina individual — la disciplina está 
   > automatizada en el pipeline."_

---

## 🤖 Bloque 7: IA — Generación de Datos y Casos de Prueba (3 min)

### Narrative

> _"Mostramos brevemente cómo la IA complementa el framework."_

### Pasos

1. **Datos sintéticos:**
   - Mostrar los perfiles Billy en `simulation/tdm-seeders/`
   - _"Tenemos 5 perfiles predefinidos: 3 activos, 1 inactivo, 1 bloqueado. 
     Para pruebas de carga generamos miles de perfiles sintéticos bajo demanda."_

2. **Generación de casos de prueba desde historia de usuario:**
   ```
   Historia: "Como cliente quiero cancelar mi recarga"
   
   IA genera:
   ✅ Scenario: Cancelar recarga en estado PENDIENTE → status 200
   ✅ Scenario: No cancelar recarga PROCESADA → status 400
   ✅ Scenario: No cancelar recarga de cliente INACTIVO → status 403
   ```
   _"La IA reduce de días a minutos el diseño inicial de los casos de prueba."_

3. **Señalar el módulo `.agent/`:**
   - _"El repositorio incluye prompts preconfigurados para que el agente de IA 
     entienda el contexto de AT&T y genere tests coherentes con el dominio."_

---

## 📋 Bloque 8: Plan de Mantenimiento y Cierre (5 min)

### Costes Estimados

```
Mantenimiento mensual del framework:
  QA Lead (8h):              $400/mes
  QA Automation (12h):       $540/mes
  DevOps (4h):               $220/mes
  Infraestructura:           ~$50/mes
  ─────────────────────────────────────
  Total:                    ~$1,210/mes

vs.

Ahorro estimado (PoC, 1% cobertura):  ~$20,000/mes
ROI Mensual Neto:                     ~$18,800/mes
```

### Roadmap de Crecimiento

| Fase | Periodo | Cobertura | Ahorro Mensual |
|------|---------|----------|---------------|
| PoC (hoy) | Q2 2026 | 1% (48 casos) | ~$20K |
| Fase 1 | Q3 2026 | 10% (~500 casos) | ~$200K |
| Fase 2 | Q4 2026 | 29% (~1,500) | ~$600K |
| Objetivo | Q3 2027 | 100% (~5,200) | ~$1.8M |

### Mensaje de Cierre

> _"Lo que han visto hoy no es un prototipo: es un framework operativo, 
> con pipelines reales en GitHub Actions, tests funcionales, de contrato 
> y de performance corriendo en un entorno simulado completo. 
>  
> La diferencia con lo que AT&T tiene hoy: centralización, visibilidad, 
> detección temprana y ROI medible. La pregunta no es si automatizar — 
> es a qué velocidad queremos hacerlo."_

---

## 🚨 Plan de Contingencia

### Si falla el entorno local durante la demo:

```powershell
# Restart rápido del entorno
cd simulation
docker compose down && docker compose up -d --wait
# Esperar ~30 segundos
docker compose ps
```

### Si GitHub Actions está lento:

- Tener screenshots pre-capturados del pipeline en verde
- Mostrar los logs del pipeline en el file system local como backup

### Si el pipeline tarda más de 10 min:

- Mientras espera, mostrar los bloques de Reporteo y Calendarización
- Volver al pipeline cuando haya completado

---

## 📁 Recursos de la Demo

| Recurso | Ubicación |
|---------|-----------|
| Repositorio PoC | `C:\Users\jcunha\Documents\Optare\Clientes\AT_T\QA\PoC\att-poc-paymentbox` |
| Scripts de ruptura | `demo\break-contract.ps1`, `demo\break-behavior.ps1` |
| Script de restauración | `demo\restore.ps1` |
| Docker Compose entorno | `simulation\docker-compose.yml` |
| Documentación Framework | `C:\Users\jcunha\Documents\Optare\Clientes\AT_T\QA\04_Framework\` |
| GitLab Proyecto QA_POC | `https://git.optare.net/jcunha/QA_POC_ATT` |
| GitHub Actions | Repositorio att-poc-paymentbox → Tab Actions |
