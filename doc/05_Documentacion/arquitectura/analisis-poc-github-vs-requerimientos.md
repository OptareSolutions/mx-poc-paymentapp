# Análisis PoC GitHub (mx-poc-paymentapp) vs Requerimientos Demo AT&T

**Fecha:** 2026-05-07  
**Repositorio:** https://github.com/OptareSolutions/mx-poc-paymentapp  
**Analizado por:** Principal Software Engineer Agent (OPT-145)  
**Issue padre:** OPT-130  

---

## Resumen Ejecutivo

El repositorio `mx-poc-paymentapp` contiene una implementación **sólida y bien estructurada** de la base de la PoC, cubriendo los escenarios de CI/CD, testing funcional, de contrato y performance smoke. Sin embargo, hay **3 áreas completamente pendientes** y **2 áreas parcialmente implementadas** que requieren trabajo antes del demo AT&T.

### Estado por Escenario

| Escenario | Issue | Estado | Cobertura |
|-----------|-------|--------|-----------|
| RPA Salesforce | OPT-131 | ❌ PENDIENTE | 0% |
| CI/CD Pipeline | OPT-132 | ✅ IMPLEMENTADO | ~95% |
| API Testing Funcional (Smoke) | OPT-133 | ✅ IMPLEMENTADO | ~90% |
| API Testing Integración E2E | OPT-134 | ✅ IMPLEMENTADO | ~90% |
| API Testing Contrato | OPT-135 | ✅ IMPLEMENTADO | ~90% |
| k6 Performance Smoke | OPT-136 | ✅ IMPLEMENTADO | ~90% |
| RPA en CI/CD | OPT-137 | ⚠️ PARCIAL | ~40% |
| Quality Gates | OPT-138 | ⚠️ PARCIAL | ~70% |
| Performance 2k VUs/3600s | OPT-139 | ❌ PENDIENTE | 0% |
| Script HTTPS grabado | OPT-140 | ❌ PENDIENTE | 0% |
| Framework Orquestación | OPT-141 | ⚠️ PARCIAL | ~70% |
| Integración IA | OPT-142 | ❌ PENDIENTE | 0% |

---

## Análisis Detallado por Escenario

### OPT-131: [RPA] Automatización flujo ventas Salesforce
**Estado: ❌ PENDIENTE**

**Hallazgos:**
- No existe ningún script RPA en el repositorio
- No hay carpeta `rpa/`, ni ficheros `.robot` (Robot Framework), ni scripts Playwright/Selenium para Salesforce
- Existe un módulo `tests/ui-selenium/` con `RecargaUiTest.java` pero está orientado al UI del PaymentBox (Angular), NO a Salesforce
- El pipeline no incluye ningún step de RPA para Salesforce

**Pendiente:**
- Implementar script RPA para automatizar el flujo de ventas en Salesforce (login, búsqueda cliente, registro de recarga)
- Tecnología sugerida: Robot Framework + Browser Library o Playwright Python
- Definir flujo específico: qué pasos de Salesforce cubrir en el demo

---

### OPT-132: [CI/CD] Pipeline GitHub Actions orquestador AT&T PoC
**Estado: ✅ IMPLEMENTADO**

**Hallazgos:**
- **4 pipelines** presentes en `.github/workflows/`:
  1. `pipeline-microservice-a.yml`: CI/CD completo Team A (4 jobs secuenciales con path trigger `microservice-a/**`)
  2. `pipeline-microservice-b.yml`: CI/CD completo Team B (4 jobs secuenciales con path trigger `microservice-b/**`)
  3. `pipeline-integration.yml`: Promoción manual entre ambientes (develop→qa→uat→main) via `workflow_dispatch`
  4. `pipeline.yml`: LEGACY (conservado como referencia, solo `workflow_dispatch`)
- Triggers correctos: push en branches [develop, qa, uat, main] con path filters
- Estructura de 4 jobs: Build+Quality → Security → Image Ops → E2E+GitOps
- Ambientes mapeados: develop→env-e, qa→env-a, uat→env-u, main→prod

**Pendiente menor:**
- Los escenarios DEMO BREAK están bien preparados con scripts PowerShell (`demo/break-contract.ps1`, `demo/break-behavior.ps1`, `demo/restore.ps1`)
- SonarCloud requiere `SONAR_TOKEN` configurado como secret en el repositorio

---

### OPT-133: [CI/CD][API] Implementar pruebas funcionales smoke tests
**Estado: ✅ IMPLEMENTADO**

**Hallazgos:**
- `tests/functional-karate/src/test/resources/features/recarga_flow.feature`: Feature Karate con **@smoke tags** en todos los pasos del flujo (2-8)
- Cobertura smoke por paso:
  - Paso 2: GET /api/clientes/buscar (3 Billy activos, 2 negativos)
  - Paso 3: GET /api/recargas/montos (operador BLUE)
  - Paso 4: POST /api/recargas/validar-operador (Prism mock)
  - Paso 5: GET /api/pagos/metodos
  - Pasos 6&7: POST /api/pagos/registrar (ruta crítica)
  - Paso 8: POST /api/recibos/emitir (Prism mock)
- Data-driven con perfiles Billy (TDM integrado)
- k6 smoke: `tests/k6/smoke_recarga.js` (1 VU, 60s, thresholds p95<2s)

**Pendiente menor:**
- Confirmar que RecargaFlowRunner ejecuta tag @smoke de forma independiente en CI

---

### OPT-134: [CI/CD][API] Implementar pruebas de integración E2E
**Estado: ✅ IMPLEMENTADO**

**Hallazgos:**
- `recarga_flow.feature` con tag **@e2e** cubre el flujo completo de 8 pasos encadenados
- Entorno simulado: `simulation/docker-compose.yml` levanta microservice-a, microservice-b, db-simulado, mock-operador, mock-recibo
- TDM: SQL seeders con 5 perfiles Billy (`simulation/tdm-seeders/01_schema.sql`, `02_billy_profiles.sql`)
- Pipeline-integration.yml Job E2E Full: health checks + Karate 8 pasos + k6 sobre entorno real dockerizado
- Pipeline-microservice-a.yml Job 4: E2E contra entorno simulado en cada push

**Pendiente menor:**
- Los tests de Selenium UI (Paso 1) tienen `continue-on-error: true`, por lo que no bloquean si fallan

---

### OPT-135: [CI/CD][API] Implementar pruebas de contrato (breaking changes OpenAPI)
**Estado: ✅ IMPLEMENTADO**

**Hallazgos:**
- `tests/functional-karate/src/test/resources/features/contract_microservices.feature`:
  - Valida campos públicos de microservice-b: `phone`, `fullName`, `status`
  - Tags: @contract, @demo-break, @smoke, @negative
  - Escenarios positivos y negativos (404, status INACTIVO/BLOQUEADO)
- Prism mocks OpenAPI: `simulation/prism-mocks/operador.yaml` y `recibo.yaml`
- DEMO BREAK 1 intencionalmente rompe contrato (`telefono→phone`, `nombre→fullName`)
- Pipeline-integration.yml Job 1 (contract-tests) es BLOQUEANTE: promoción no ocurre si falla

**Pendiente menor:**
- Validar que la spec OpenAPI de microservice-b está publicada y versionada (no solo mockeada)

---

### OPT-136: [CI/CD][PERF] Integrar k6 smoke performance en GitHub Actions
**Estado: ✅ IMPLEMENTADO**

**Hallazgos:**
- `tests/k6/smoke_recarga.js`: script k6 completo con:
  - 1 VU, 1 minuto (smoke)
  - Thresholds: `http_req_duration p(95)<2000ms`, `http_req_failed rate<0.01`, `pago_latencia_ms p(95)<1500ms`
  - Métricas DORA: Change Failure Rate, MTTR
  - Cubre pasos 2, 3, 4, 5, 6&7, 8 del flujo
  - Summary handler genera `tests/k6/results/smoke_summary.json`
- Integrado en:
  - `pipeline-microservice-a.yml` Job 4 (E2E+k6)
  - `pipeline-integration.yml` Job E2E Full

**Pendiente menor:**
- Verificar que el step k6 falla el pipeline cuando los thresholds no se cumplen (debería ser el comportamiento por defecto de k6)

---

### OPT-137: [CI/CD][RPA] Automatización web liviana en pipeline CI/CD
**Estado: ⚠️ PARCIALMENTE IMPLEMENTADO**

**Hallazgos:**
- Selenium Headless: `tests/ui-selenium/src/test/java/com/att/paymentbox/ui/RecargaUiTest.java`
  - Existe integración en pipeline-microservice-a.yml Job 4
  - Ejecuta con `continue-on-error: true` → NO es bloqueante (no actúa como quality gate real)
- NO hay RPA de Salesforce en el pipeline
- El "RPA liviano" entendido como Selenium UI está implementado, pero desactivado como gate

**Pendiente:**
- Cambiar `continue-on-error: false` para que Selenium sea bloqueante (o documentar por qué es opcional)
- Implementar integración RPA Salesforce si se requiere en el pipeline demo
- Crear un job específico para RPA en el pipeline con artefactos de reporte

---

### OPT-138: [CI/CD] Configurar quality gates para todos los tipos de pruebas
**Estado: ⚠️ PARCIALMENTE IMPLEMENTADO**

**Hallazgos:**
| Gate | Configurado | Bloqueante |
|------|-------------|-----------|
| JaCoCo cobertura ≥80% | ✅ | ✅ Sí |
| Trivy filesystem CRITICAL+HIGH | ✅ | ✅ Sí |
| Trivy image scan | ✅ | ⚠️ Informativo (exit-code 0) |
| SonarCloud | ✅ | ⚠️ Requiere SONAR_TOKEN |
| Karate E2E | ✅ | ✅ Sí |
| k6 thresholds | ✅ | ✅ Sí (por defecto k6) |
| Selenium UI | ⚠️ | ❌ continue-on-error: true |

**Pendiente:**
- Hacer Trivy image scan bloqueante (`exit-code: '1'`)
- Hacer Selenium bloqueante o eliminarlo del gate
- Verificar configuración de SonarCloud (quality gate en Quality Profiles)
- Documentar explícitamente todos los gates con sus umbrales

---

### OPT-139: [PERF] Suite de carga 2k VUs/3600s flujo E2E APIs enlazadas
**Estado: ❌ PENDIENTE**

**Hallazgos:**
- Solo existe `tests/k6/smoke_recarga.js` (1 VU, 60s) — smoke test, NO load test
- No hay ningún script de carga con 2000 VUs y 3600 segundos
- No hay carpeta `tests/k6/load/` ni scripts adicionales

**Pendiente:**
- Crear `tests/k6/load_2k_vus.js` con configuración:
  - Stages: ramp-up → steady 2000 VUs → ramp-down
  - Duración total: 3600s
  - Flujo E2E enlazado: pasos 2→3→4→5→6/7→8 con correlación de datos
  - Thresholds: definir por requerimientos AT&T
- Decidir si se integra en pipeline o solo se ejecuta manualmente

---

### OPT-140: [PERF] Script grabación HTTPS con APIs y bodies parametrizados
**Estado: ❌ PENDIENTE**

**Hallazgos:**
- `smoke_recarga.js` fue creado manualmente, NO por grabación
- No hay archivos HAR (`*.har`) en el repositorio
- No hay evidencia de uso de k6 Browser o k6 recorder
- No hay scripts parametrizados generados desde grabación

**Pendiente:**
- Grabar flujo con k6 recorder o mediante captura HAR (browser DevTools → Export HAR)
- Convertir HAR a script k6 con `k6 convert` o `har-to-k6`
- Parametrizar bodies con datos TDM (perfiles Billy)
- Documentar el proceso de grabación para la demo

---

### OPT-141: [FRAMEWORK] Demostrar capacidades de orquestación, reporteo y gobierno
**Estado: ⚠️ PARCIALMENTE IMPLEMENTADO**

**Hallazgos:**
- **Orquestación**: ✅ Bien implementada (4 jobs secuenciales, gates declarativos, DEMO BREAK scenarios)
- **Reporteo**:
  - Karate: genera reports HTML en `target/surefire-reports/` → subidos como GitHub Actions artifacts ✅
  - k6: genera `tests/k6/results/smoke_summary.json` ✅
  - GitHub Actions Job Summary: pipeline-integration.yml tiene summary markdown ✅
  - Falta: dashboard unificado o reporte consolidado
- **Gobierno/GitOps**: ✅ Kustomization.yaml actualizado automáticamente, ArgoCD simulado
- **DORA Metrics**: documentadas en README (Deployment Frequency, Lead Time, CFR, MTTR) ✅

**Pendiente:**
- Preparar evidencias visuales (capturas de pantalla de pipelines pasados/fallando)
- Considerar integrar Allure Report para reporte unificado multi-herramienta
- Demostrar DORA metrics con datos reales de runs anteriores

---

### OPT-142: [FRAMEWORK][IA] Integración IA: historias usuario a casos de prueba y datos sintéticos
**Estado: ❌ PENDIENTE**

**Hallazgos:**
- No existe ninguna integración de IA en el repositorio
- Los perfiles TDM (Billy 1-5) están definidos manualmente en SQL seeders
- No hay scripts para generación automática de casos de prueba desde historias de usuario
- No hay integración con LLMs (OpenAI, GitHub Copilot API, etc.)

**Pendiente:**
- Definir qué capacidad IA demostrar: generación de test cases desde user stories, generación de datos sintéticos, análisis de resultados
- Implementar pipeline/script que tome una user story y genere escenarios Karate/k6
- Documentar el flujo IA → casos de prueba para la presentación

---

## Lista Priorizada de Puntos Pendientes

### Prioridad Alta (Bloqueantes para Demo)

1. **OPT-139** - Suite k6 carga 2000 VUs/3600s
   - Riesgo: Demo requiere demostrar capacidad de carga real
   - Esfuerzo estimado: 4-6h (script + parametrización + thresholds)

2. **OPT-131** - Script RPA Salesforce
   - Riesgo: Demo específicamente requiere automatización Salesforce
   - Esfuerzo estimado: 8-16h (dependiendo de acceso a instancia Salesforce sandbox)

### Prioridad Media (Mejoras Importantes)

3. **OPT-140** - Script k6 grabado HTTPS
   - Riesgo: Diferenciador técnico para la demo
   - Esfuerzo estimado: 2-4h (grabación + parametrización)

4. **OPT-138** - Completar quality gates
   - Fix rápido: `continue-on-error: false` para Selenium, `exit-code: '1'` para Trivy image
   - Esfuerzo estimado: 1-2h

5. **OPT-137** - RPA en CI/CD (Selenium bloqueante)
   - Dependiente de OPT-138
   - Esfuerzo estimado: 1h

### Prioridad Baja (Valor Añadido)

6. **OPT-142** - Integración IA
   - Complejidad alta, valor demo alto
   - Esfuerzo estimado: 8-16h

7. **OPT-141** - Reporteo unificado
   - Mejora presentación demo pero no es bloqueante
   - Esfuerzo estimado: 4-8h (Allure Report)

---

## Recomendaciones de Orden de Implementación

```
Semana 1:
  1. OPT-138: Fix quality gates (1-2h) → quickwin
  2. OPT-140: Grabación HTTPS k6 (2-4h)
  3. OPT-139: Load test 2k VUs (4-6h)

Semana 2:
  4. OPT-131: RPA Salesforce (8-16h) → requiere acceso sandbox
  5. OPT-142: Integración IA (8-16h) → en paralelo si hay recursos

Pre-Demo:
  6. OPT-141: Reporteo y evidencias visuales (4h)
  7. OPT-144: Documentación GitLab
```

---

## Lo que YA Funciona (Fortalezas de la PoC)

✅ **Arquitectura multi-ambiente** completa y funcional (develop/qa/uat/prod)  
✅ **GitOps** con Kustomize overlays y ArgoCD simulado  
✅ **DEMO BREAKs** preparados (contrato + comportamiento) con scripts PowerShell  
✅ **Karate DSL** cubriendo los 8 pasos del flujo con data-driven tests  
✅ **k6 Smoke** integrado en CI con thresholds DORA  
✅ **Contract testing** con Prism mocks y feature Karate dedicada  
✅ **TDM** con 5 perfiles Billy (3 activos, 1 inactivo, 1 bloqueado)  
✅ **Seguridad**: Trivy filesystem scan bloqueante  
✅ **Cobertura**: JaCoCo gate ≥80% bloqueante  
✅ **Selenium UI** headless (aunque no bloqueante)  
✅ **Documentación** README completo con guía de demo  

---

*Documento generado por análisis automatizado — OPT-145*
