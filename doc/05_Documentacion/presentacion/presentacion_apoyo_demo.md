# PoC AT&T PaymentBox — Presentación de Apoyo
## Calidad Declarativa en CI/CD

> **Instrucciones de uso:** Este documento se usa como soporte visual durante la ejecución de la demo. Cada sección = una diapositiva. Los bloques `[ACCIÓN]` indican cuándo actuar en pantalla.

---

---

## DIAPOSITIVA 1 — PORTADA

```
╔══════════════════════════════════════════════════════════════════╗
║                                                                  ║
║          PAYMENTBOX — PoC de Calidad Declarativa                 ║
║                                                                  ║
║                  Optare Solutions para AT&T                      ║
║                                                                  ║
║    "La calidad no es una etapa. Es una propiedad del sistema."   ║
║                                                                  ║
║                          Mayo 2026                               ║
╚══════════════════════════════════════════════════════════════════╝
```

---

---

## DIAPOSITIVA 2 — EL PROBLEMA (★ WOW 1)

**[ACCIÓN: Hacer la pregunta antes de mostrar nada]**

> *"¿Cuántos días tardaron la última vez en detectar que un equipo rompió la integración con otro?"*

---

### Los 3 retos de AT&T

| # | Área | Problema actual |
|---|------|----------------|
| 🤖 | **RPA** | Scripts más lentos que ejecución manual. Sin framework centralizado. |
| 🔄 | **CI/CD** | Los errores se detectan tarde, ya en ambientes de QA. |
| ⚡ | **Performance** | JMeter no escala a 4k+ VUs. Grabación HTTPS bloqueada por tokens. |

---

---

## DIAPOSITIVA 3 — EL COSTE REAL (★ WOW 2)

**[ACCIÓN: Escribir/mostrar el cálculo en vivo]**

```
5.200 validaciones manuales
       × 15 minutos promedio
       ─────────────────────
     = 1.300 horas por ciclo
```

> *"Ese es el coste de la validación manual hoy. No en teoría — en horas reales de su equipo."*

---

**Nuestra propuesta elimina ese coste mediante calidad declarativa:**
- Cada commit activa el ciclo completo de validación
- Sin intervención humana
- En menos de 10 minutos

---

---

## DIAPOSITIVA 4 — ARQUITECTURA (3 capas)

**[ACCIÓN: Mostrar diagrama arquitectura_solucion.md]**

```
┌─────────────────────────────────────────────┐
│           CAPA DE APLICACIÓN                │
│  microservice-a │ microservice-b │ UI Angular│
│  (PaymentBox)   │ (Customer)     │ (Nginx)  │
└─────────────────────────────────────────────┘
                      ↕
┌─────────────────────────────────────────────┐
│           CAPA DE CALIDAD                   │
│  Unit Tests │ Karate API │ Selenium │ k6    │
│  JaCoCo 80% │ Contrato   │ RPA      │ Perf  │
└─────────────────────────────────────────────┘
                      ↕
┌─────────────────────────────────────────────┐
│           CAPA GITOPS                       │
│  develop → env-e │ qa → env-a │ uat → env-u │
│  Kustomize overlays │ ArgoCD sync            │
└─────────────────────────────────────────────┘
```

**Principio:** El manifiesto K8s solo se actualiza si el pipeline está 100 % verde.

---

---

## DIAPOSITIVA 5 — FLUJO DE 8 PASOS

**[ACCIÓN: Mostrar UI en http://localhost:4200]**

| Paso | Tipo | Herramienta | Acción |
|------|------|-------------|--------|
| **1** | UI | Selenium | Menú Recarga visible |
| **2** | API | Karate | Localizar Cliente Billy 1 (tel: 4544) |
| **3** | UI/DB | Karate + SQL | Seleccionar monto (coherencia BD) |
| **4** | Mock | Prism | API Operador BLUE — crédito aprobado |
| **5** | UI | Selenium | Seleccionar método de pago |
| **6** | Perf | k6 smoke | Registrar pago (p95 < 2s) |
| **7** | DB | Karate | Verificar persistencia |
| **8** | Mock | Prism | Emitir recibo PDF |

---

---

## DIAPOSITIVA 6 — DEMO: FLUJO VERDE (★ WOW 3)

**[ACCIÓN: Mostrar GitHub Actions — pipeline-microservice-a — último run verde]**

```
Job 1 — Build & Quality    ✅  2 min
         Unit tests 100 % │ JaCoCo 83 % │ SonarCloud OK

Job 2 — Security           ✅  1 min
         Trivy: 0 CVEs críticos/altos

Job 3 — Image Ops          ✅  3 min
         Docker multi-stage → GHCR: env-e-{sha}

Job 4 — E2E + GitOps       ✅  4 min
         Karate 8 pasos OK → kustomization.yaml actualizado
```

> **[PAUSA 3 segundos mirando los checkmarks verdes]**

> *"Este es el estado base. Cada push genera este resultado. Automáticamente."*

---

---

## DIAPOSITIVA 7 — DEMO BREAK 1: Contrato (★ WOW 4)

**[ACCIÓN: Ejecutar en PowerShell]**

```powershell
.\demo\break-contract.ps1
git add .
git commit -m "demo: BREAK 1 - romper contrato"
git push origin develop
```

---

### ¿Qué ocurre?

```
pipeline-microservice-b  ✅  (sus tests unitarios pasan)
pipeline-integration     ❌  Job 2 — Contrato FALLA

FAILED: match response.telefono == '4544'
  actual: {phone: '4544', fullName: 'Billy 1 - Cortes'}
  ← el campo 'telefono' ya no existe

PROMOCIÓN A QA → BLOQUEADA
```

---

> **[PAUSA DRAMÁTICA 5 segundos]**

> *"47 segundos vs 2–3 días. El entorno de QA nunca se tocó. El equipo recibe la notificación directa. La solución, sin nuestra herramienta: descubrir esto en QA, analizar, asignar, corregir, volver a desplegar."*

---

**[ACCIÓN: Restaurar]**
```powershell
.\demo\restore.ps1
git add .
git commit -m "demo: restaurar contrato"
git push origin develop
```

---

---

## DIAPOSITIVA 8 — DEMO BREAK 2: Comportamiento

**[ACCIÓN: Ejecutar en PowerShell]**

```powershell
.\demo\break-behavior.ps1
git add .
git commit -m "demo: BREAK 2 - monto minimo 100"
git push origin qa
```

---

### ¿Qué ocurre?

```
Job 1 — Build & Quality  ✅  (unit tests no cubren monto mínimo)
Job 2 — Security         ✅
Job 3 — Image Ops        ✅  imagen env-a-{sha} construida

Job 4 — E2E Karate       ❌  FALLA

  POST /api/pagos/registrar  monto=20
  expected: 201  →  actual: 400 "Monto mínimo $100"

k8s/overlays/env-a/kustomization.yaml → NO ACTUALIZADO
```

---

> *"El entorno de QA sigue apuntando a la versión que funcionaba. La imagen rota nunca llegó al overlay. GitOps protege el ambiente automáticamente."*

---

**[ACCIÓN: Restaurar]**
```powershell
.\demo\restore.ps1
git add .
git commit -m "demo: restaurar comportamiento"
git push origin qa
```

---

---

## DIAPOSITIVA 9 — PERFORMANCE CON k6

**[ACCIÓN: Mostrar script k6 en VS Code o ejecutar localmente]**

```powershell
cd tests\k6
k6 run smoke-test.js
```

---

### Por qué k6 vs JMeter

| | k6 | JMeter |
|--|-------|--------|
| **Escala** | 2.000+ VUs sin degradación | Limitado a ~4k VUs |
| **Grabación HTTPS** | Nativa, con tokens entre nubes | Bloqueada por arquitectura de AT&T |
| **Scripting** | JavaScript (mantenible) | XML/GUI (frágil) |
| **CI/CD** | Binario standalone, integración directa | Requiere plugin y JVM extra |

---

### Smoke test integrado en cada push

```
20 VUs / 5 minutos  →  p95 < 2 segundos  →  PASS / FAIL bloqueante
```

> Si el umbral se supera: **Job 4 falla → overlay no se actualiza**

---

---

## DIAPOSITIVA 10 — FRAMEWORK Y IA (★ WOW 5)

**[ACCIÓN: Ejecutar demo.py con historia del comité]**

```powershell
cd tests\ia
python demo.py
```

---

### Pedir al comité una historia de usuario (en vivo)

> Ejemplo: *"Como operador, quiero que el sistema rechace recargas de clientes bloqueados."*

**→ El framework genera 10–15 casos de prueba Karate en segundos**

---

### Capacidades del Framework

| Capacidad | Mecanismo |
|-----------|-----------|
| **Governance** | Estándares codificados en el pipeline (no dependientes de disciplina) |
| **Reporteo unificado** | SonarCloud + JaCoCo + Karate HTML + k6 JSON → artefactos descargables |
| **Calendarización** | Cron jobs para regresión nocturna completa |
| **IA integrada** | Generación de tests + datos sintéticos desde historias de usuario |

---

---

## DIAPOSITIVA 11 — CIERRE ROI (★ WOW 6)

**[ACCIÓN: Mostrar este cálculo]**

```
1.300 h por ciclo  ×  40 % automatización conservadora
                   ─────────────────────────────────────
                 = 520 horas recuperadas por ciclo

Coste promedio hora QA: ~$50
                   ─────────────────────────────────────
                 = $26.000 recuperados por ciclo de validación
```

---

> **[PAUSA. Mirar al comité.]**

> *"¿Cuántos ciclos de validación ejecutan al año? Multipliquen ese número por $26.000. Eso es lo que ya están perdiendo."*

> *"¿Cuánto tiempo más pueden permitirse que los errores lleguen a QA?"*

---

---

## DIAPOSITIVA 12 — DIFERENCIACIÓN

| Diferenciador | Optare | Alternativa típica |
|--------------|--------|--------------------|
| Modelo de calidad | Declarativo — todo en código, trazable | Ad-hoc por equipo |
| Detección de contratos | En pipeline, antes de QA | Manual, en QA o producción |
| Performance en CI | Smoke en cada push + histórico | Pruebas aisladas |
| Seguridad | Zero CVEs bloqueante | Escaneo periódico desvinculado |
| GitOps | Manifiestos inmutables, rollback automático | Deploy y rollback manuales |
| IA | Framework preparado para generación de tests | No integrado |
| Coste | 100 % open-source (excepto SonarCloud freemium) | Herramientas comerciales |

---

---

## DIAPOSITIVA 13 — Q&A (Respuestas preparadas)

**P: ¿Por qué k6 y no JMeter?**
> k6 escala a 2k+ VUs, graba HTTPS nativo, se integra en GitHub Actions como binario.

**P: ¿Cómo gestionamos secretos de AT&T en el pipeline?**
> GitHub Actions Secrets (cifrado en reposo y tránsito). Auto-hosted runners dentro de la red AT&T para entornos productivos.

**P: ¿Funciona con nuestra infraestructura multi-cloud/VPN?**
> Self-hosted runners dentro de la infraestructura AT&T, transparentes al proveedor de nube.

**P: ¿Cuánto tiempo lleva adoptar este framework?**
> 3 sprints para el primer equipo. Los siguientes heredan el template en 1 sprint.

**P: ¿Qué pasa si un microservicio no tiene OpenAPI?**
> Karate graba el comportamiento base y lo convierte en el contrato de referencia. Migración incremental.

**P: ¿La IA es determinista en los quality gates?**
> Los gates son siempre deterministas (umbrales numéricos, OpenAPI, tests). La IA asiste al equipo de QA, no reemplaza los gates.

---

---

## ORDEN DE EJECUCIÓN (referencia rápida)

```
[APERTURA]     WOW 1 — La Pregunta que Duele        → 3 min
[ACTO I]       Contexto AT&T + WOW 2 Número Real    → 7 min
[ACTO II-a]    Arquitectura (diagrama)               → 5 min
[ACTO II-b]    WOW 3 — Flujo Verde en GitHub Actions → 10 min
[ACTO II-c]    WOW 4 — DEMO BREAK 1 (contrato)      → 8 min
               WOW 4 — DEMO BREAK 2 (comportamiento) → 8 min
[ACTO II-d]    Performance k6                        → 5 min
[ACTO III]     Framework + WOW 5 — IA en vivo        → 10 min
[CIERRE]       WOW 6 — ROI + Q&A                     → 10 min
                                              TOTAL: ~66 min
```

---

## PLAN DE CONTINGENCIA

| Problema | Solución |
|----------|---------|
| Docker Compose no levanta | Usar grabación de pantalla del run anterior |
| Pipeline tarda más de lo esperado | Profundizar en arquitectura con diagrama mientras corre |
| Sin conexión a internet | Los mocks Prism funcionan completamente offline |
| Script de demo falla | `.\demo\restore.ps1` y mostrar el resultado con `git log --oneline` |

---

*Documento generado para uso interno — Optare Solutions — Mayo 2026*
