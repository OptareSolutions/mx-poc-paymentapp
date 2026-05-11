# Guión de Presentación — PoC AT&T Quality Assurance

> **Cliente:** AT&T (Telco Operator)  
> **Proyecto:** PaymentBox — PoC de Calidad Declarativa  
> **Versión:** 1.0  
> **Fecha:** Mayo 2026  
> **Presentador:** Optare Solutions — QE & DevSecOps  
> **Duración estimada total:** 45–60 minutos

---

## Checklist Pre-Demo (30 min antes)

- [ ] Entorno simulado levantado: `cd simulation && docker compose up -d`
- [ ] Todos los servicios sanos: `docker compose ps` → todos "healthy"
- [ ] Repositorio GitHub abierto en Chrome/Edge (tab 1)
- [ ] GitHub Actions tab abierto con último run verde (tab 2)
- [ ] Swagger UI microservice-a abierto: `http://localhost:8080/swagger-ui.html` (tab 3)
- [ ] Swagger UI microservice-b abierto: `http://localhost:8081/swagger-ui.html` (tab 4)
- [ ] UI PaymentBox abierta: `http://localhost:4200` (tab 5)
- [ ] SonarCloud dashboard abierto (tab 6)
- [ ] VS Code abierto en la carpeta del repositorio
- [ ] PowerShell listo en la raíz del repositorio

---

## Estructura de la Presentación

| Bloque | Contenido | Tiempo |
|--------|-----------|--------|
| 1 | Contexto y problemática AT&T | 5 min |
| 2 | Arquitectura de la solución | 8 min |
| 3 | DEMO: Flujo verde (pipeline OK) | 10 min |
| 4 | DEMO BREAK 1: Ruptura de contrato | 8 min |
| 5 | DEMO BREAK 2: Ruptura de comportamiento | 8 min |
| 6 | Escenario Performance (k6) | 5 min |
| 7 | Framework y reporteo unificado | 5 min |
| 8 | Q&A y diferenciación Optare | 10 min |

---

## Bloque 1 — Contexto y Problemática AT&T (5 min)

### Guión

> "AT&T realiza más de 5.200 validaciones manuales para flujos de negocio que incluyen simulaciones de venta, postventa y verificación de productos. Estas validaciones se distribuyen en fábricas de software que gestionan proyectos con mejoras de plataforma y nuevos productos.
>
> Los principales retos que nos han presentado son tres:
>
> **RPA:** Las soluciones actuales superan en tiempo a una ejecución manual en algunos casos, el mantenimiento por cambios es costoso, no existe un framework centralizado y el reporte en tiempo real es complejo.
>
> **CI/CD:** Las validaciones de seguridad actuales (Veracode, SonarQube) no detectan errores funcionales a tiempo. Los hallazgos se descubren tarde, cuando ya están en ambientes de prueba, generando retrasos significativos.
>
> **Performance:** JMeter presenta limitaciones con más de 4.000 usuarios virtuales por 3.600 segundos, y la creación de scripts es manual por la arquitectura de seguridad (tokens entre nubes y ubicaciones).
>
> Nuestra propuesta resuelve los tres escenarios en un único flujo declarativo."

### Puntos clave a destacar

- 5.200 validaciones manuales = costo operativo enorme
- La automatización existente tiene adopción baja porque es lenta e inestable
- No hay framework unificado → fragmentación de resultados
- Nosotros entregamos: calidad desde el primer commit, sin intervención manual

---

## Bloque 2 — Arquitectura de la Solución (8 min)

### Guión

> "Les presento la arquitectura de nuestra PoC. Hemos construido un sistema de **calidad declarativa** donde la calidad no es una etapa final, sino un requisito que cada commit debe cumplir para avanzar al siguiente entorno.
>
> La solución tiene tres capas principales."

### [Mostrar diagrama arquitectura]

> "**Capa de aplicación:** Dos microservicios Java Spring Boot que simulan el flujo de negocio PaymentBox de AT&T. Un frontend Angular que representa la interfaz del operador. Una base de datos PostgreSQL con perfiles de clientes sintéticos.
>
> **Capa de calidad:** Tres pipelines GitHub Actions que ejecutan automáticamente: tests unitarios con cobertura ≥ 80%, análisis de seguridad con Trivy (zero tolerance a CVEs críticos), pruebas de API con Karate DSL en tres niveles —funcional, integración y contrato—, pruebas de UI con Selenium headless, y smoke performance con k6.
>
> **Capa GitOps:** Los manifiestos Kubernetes son la única fuente de verdad. Un pipeline verde es el único mecanismo que puede actualizar la etiqueta de imagen en el overlay del entorno destino. Si algo falla, el entorno de producción no se toca."

### [Mostrar multi-ambiente]

> "Tenemos cuatro entornos: develop → qa → uat → main/producción. La promoción entre entornos es siempre manual y declarativa. Nadie puede saltarse la validación."

### Puntos clave

- "Shift-Left" real: calidad en el primer commit, no al final del sprint
- GitOps: el manifiesto no cambia si hay un fallo → protección automática del entorno
- Separación de equipos: Team A y Team B trabajan en paralelo sin bloquearse

---

## Bloque 3 — DEMO: Flujo Verde (10 min)

### Guión

> "Voy a mostrarles el flujo normal. Un desarrollador hace push a la rama `develop` con un cambio en microservice-a."

### [Acción: mostrar un push reciente o ejecutar `workflow_dispatch`]

> "El pipeline se activa automáticamente. Vamos a ver los cuatro jobs ejecutándose."

### [Mostrar GitHub Actions — pipeline-microservice-a]

**Job 1 — Build & Quality:**
> "En menos de 2 minutos tenemos: compilación, 100% de tests unitarios en verde, y cobertura JaCoCo al 83%. SonarCloud ya está analizando el código. Si la cobertura cae por debajo del 80%, el pipeline falla aquí."

**Job 2 — Seguridad:**
> "Trivy escanea el sistema de archivos: cero vulnerabilidades críticas o altas. Si hubiera una CVE en una dependencia, el pipeline se detiene aquí. Nadie construye una imagen insegura."

**Job 3 — Image Ops:**
> "Docker build multi-stage: primero Gradle compila el JAR, luego solo el JRE Alpine se incluye en la imagen final. Trivy vuelve a escanear la imagen. La imagen se sube al registry con el tag `env-e-{sha}`. Cada commit tiene su propia imagen inmutable."

**Job 4 — E2E + GitOps:**
> "Karate ejecuta los 8 pasos del flujo completo: localiza al cliente Billy 1, selecciona el monto, valida contra el mock del operador, registra el pago, verifica en base de datos, emite el recibo. Todo en verde. El pipeline actualiza automáticamente el manifiesto Kustomize con la nueva etiqueta de imagen. En un entorno real, ArgoCD sincronizaría esto a Kubernetes."

### [Mostrar SonarCloud dashboard]

> "Aquí vemos el histórico de calidad: cobertura, bugs detectados, security hotspots. Es el panel de control del equipo de desarrollo."

### Puntos clave

- Pipeline completo en < 10 minutos → Lead Time for Changes bajo
- Proceso 100% automático, sin intervención humana
- Evidencia trazable por cada commit

---

## Bloque 4 — DEMO BREAK 1: Ruptura de Contrato (8 min)

### Guión

> "Ahora voy a mostrarles el escenario más común en ambientes multi-equipo: Team B modifica una API sin coordinar con Team A."

### [Acción en VS Code / PowerShell]

```powershell
cd C:\...\att-poc-paymentbox
demo\break-contract.ps1
```

> "Hemos renombrado el campo `telefono` a `phone` en el DTO público de microservice-b. Este cambio es perfectamente válido en los tests unitarios de Team B, que conocen el nuevo nombre. Los tests pasan. La imagen se construye. Pero..."

### [Push y mostrar pipelines]

```powershell
git add .
git commit -m "demo: BREAK 1 - romper contrato DTO"
git push origin develop
```

> "Los pipelines individuales de Team A y Team B pasan en verde, porque cada equipo solo prueba su propio código. Ahora triggereamos el pipeline de integración para promover develop a qa."

### [Mostrar GitHub Actions — pipeline-integration, Job 1 falla en rojo]

> "¡Y aquí lo tenemos! Job 1 — Tests de Contrato — FALLA. Karate intenta acceder a `response.telefono` que ya no existe. El campo ahora se llama `phone`. La promoción a qa está BLOQUEADA.
>
> Este error, en el mundo real de AT&T, habría llegado al ambiente de pruebas, habría requerido un análisis de 2-3 días para identificar la causa, habría retrasado el sprint del otro equipo.
>
> Con nuestra solución, el error se detecta en **segundos**, antes de que una sola imagen insegura llegue a QA. El equipo responsable recibe la notificación directa en GitHub."

### [Restaurar]

```powershell
demo\restore.ps1
git add .
git commit -m "restore: contrato restaurado"
git push origin develop
```

### Puntos clave

- Los contratos de API son ciudadanos de primera clase en el pipeline
- La detección es automática, no depende de la comunicación entre equipos
- El pipeline es la red de seguridad que protege todos los entornos

---

## Bloque 5 — DEMO BREAK 2: Ruptura de Comportamiento (8 min)

### Guión

> "El segundo escenario es más sutil y más común: un comportamiento nuevo que los tests unitarios no cubren."

### [Acción en VS Code / PowerShell]

```powershell
demo\break-behavior.ps1
```

> "Team A acaba de activar una validación de negocio: el monto mínimo de recarga es $100. Tiene sentido desde el negocio. Los tests unitarios de Team A se han actualizado para cubrir este caso. Los tests pasan. La imagen se construye y se sube."

### [Push a rama qa]

```powershell
git add .
git commit -m "demo: BREAK 2 - validación monto mínimo"
git push origin qa
```

> "Aquí es donde cambia la dinámica. Jobs 1, 2 y 3 pasan en verde. Todo parece normal. Pero Job 4..."

### [Mostrar Job 4 fallando]

> "¡Job 4 falla! Karate intenta ejecutar el Paso 6 con el perfil de prueba Billy 1, recarga de $20. La API responde HTTP 400 — el monto es inferior al mínimo. Karate esperaba HTTP 201.
>
> El overlay `k8s/overlays/env-a` NO se actualiza. El ambiente de QA sigue apuntando a la versión anterior, que funcionaba. El entorno de QA está protegido automáticamente.
>
> ¿Qué pasa ahora? El equipo de QA revisa el reporte Karate, identifica el cambio de comportamiento, coordina con Team A para decidir: ¿es intencional? ¿Se actualiza el test? ¿Se revierte el cambio? La decisión es humana y consciente, no un accidente."

### [Restaurar]

```powershell
demo\restore.ps1
git add .
git commit -m "restore: comportamiento restaurado"
git push origin qa
```

### Puntos clave

- Los E2E tests son la última línea de defensa antes de GitOps
- El entorno no avanza hasta que todo el flujo de negocio es válido
- MTTR automático: rollback es el estado anterior del manifiesto

---

## Bloque 6 — Escenario Performance con k6 (5 min)

### Guión

> "Para el escenario de performance, usamos k6, que resuelve los problemas que tienen con JMeter."

### [Mostrar código del script k6 en VS Code o ejecutar localmente]

> "k6 es una herramienta de performance moderna, scriptada en JavaScript. El script parametriza automáticamente los datos de prueba —perfiles Billy— y encadena las peticiones transportando IDs entre respuestas, simulando un flujo real.
>
> En la PoC, el smoke test corre dentro del pipeline en cada push: 20 usuarios virtuales durante 5 minutos. Si el p95 supera 3 segundos, el pipeline falla antes de llegar a GitOps.
>
> Para la demo completa de carga, el script está configurado para 2.000 VUs durante 3.600 segundos, en protocolo HTTPS. La grabación por protocolo HTTPS resuelve el problema de los tokens y las conexiones entre distintas nubes que hoy impide la grabación con JMeter."

### [Mostrar output de k6 o ejemplo de reporte]

> "El reporte incluye: latencia promedio, distribución de códigos de respuesta, mensajes de error, p95 por endpoint, y comparación automática contra la ejecución anterior para detectar degradaciones."

### Puntos clave

- k6 supera las limitaciones de JMeter a 4k+ VUs
- Grabación HTTPS nativa → sin problema de tokens y múltiples nubes
- Integrado en CI para comparación histórica automática

---

## Bloque 7 — Framework y Reporteo Unificado (5 min)

### Guión

> "Todo lo que hemos visto —RPA, CI/CD, API testing, performance— está unificado en un único framework con gobierno y estándares definidos."

### [Mostrar GitHub Actions — lista de workflows]

> "Un solo repositorio, tres pipelines coordinados, cuatro entornos declarativos. El framework incluye:
>
> **Calendarización:** Los pipelines se pueden configurar con cron para ejecuciones nocturnas de regresión completa.
>
> **Reporteo unificado:** SonarCloud para calidad de código, JaCoCo para cobertura, Karate HTML para evidencias de API, k6 JSON para performance. Todos los artefactos se almacenan en GitHub Actions como evidencia descargable.
>
> **Gobierno:** branching declarativo, tags de imagen por entorno, zero-tolerance en seguridad, gates de cobertura. El estándar está codificado en el pipeline, no depende de la disciplina individual del desarrollador.
>
> **IA integrada:** El framework está preparado para integrar capacidades de IA: generación de casos de prueba desde historias de usuario, datos sintéticos bajo demanda más allá de los perfiles Billy."

### Puntos clave

- El framework es el activo más valioso, no los scripts individuales
- Governance by code → los estándares no se pueden saltear
- Extensible: RPA adicional, más microservicios, más entornos → sin reescribir el framework

---

## Bloque 8 — Q&A y Diferenciación Optare (10 min)

### Puntos de diferenciación a destacar

| Diferenciador | Nuestra propuesta | Alternativa típica |
|--------------|-------------------|-------------------|
| **Modelo de calidad** | Declarativo (todo en código, trazable) | Ad-hoc por equipo |
| **Detección de contratos** | En el pipeline, antes de QA | Manual, en QA o producción |
| **Performance en CI** | Smoke en cada push, comparación histórica | Pruebas de carga aisladas |
| **Seguridad** | Zero CVEs CRITICAL/HIGH bloqueante | Escaneo periódico desvinculado |
| **GitOps** | Manifiestos inmutables, rollback automático | Deploy manual, rollback manual |
| **IA** | Framework preparado para generación de tests | No integrado |
| **Coste** | Stack 100% open-source (excepto SonarCloud freemium) | Herramientas comerciales (LoadRunner, etc.) |

### Respuestas preparadas a posibles preguntas del comité

**P: ¿Por qué k6 y no JMeter, que ya conocemos?**
> "JMeter tiene limitaciones documentadas por encima de 4k VUs por hora y no soporta grabación HTTPS con autenticación compleja entre nubes. k6 está diseñado para precisamente esos casos, se integra nativo con GitHub Actions y el scripting en JavaScript es más mantenible para el equipo de QA."

**P: ¿Cómo gestionamos los secretos y credenciales de AT&T en el pipeline?**
> "GitHub Actions Secrets cifra todas las credenciales en reposo y en tránsito. Los secrets nunca aparecen en logs. Para ambientes de producción, integramos con AWS Secrets Manager o HashiCorp Vault según la política de AT&T. Los mocks de la PoC no requieren credenciales reales."

**P: ¿El sistema funciona con nuestra infraestructura actual (múltiples nubes, VPN)?**
> "Los runners de GitHub Actions se pueden auto-hospedar (self-hosted runners) dentro de la infraestructura de AT&T, eliminando cualquier restricción de red. La PoC usa runners gestionados por GitHub para simplificar la demo, pero la arquitectura es transparente al proveedor de nube."

**P: ¿Qué sucede si un microservicio no tiene OpenAPI/Swagger definido?**
> "Karate funciona con y sin OpenAPI. Para contratos formales, el OpenAPI spec es el contrato. Para APIs sin spec, Karate graba el comportamiento base y lo convierte en el contrato de referencia. La migración es incremental."

**P: ¿Cómo se integra con nuestra herramienta de gestión de defectos (Jira/ServiceNow)?**
> "GitHub Actions puede publicar resultados de tests directamente a Jira vía API, crear tickets automáticos cuando un gate falla, y cerrarlos cuando el pipeline vuelve a verde. La integración se configura en el pipeline como un job adicional."

**P: ¿Cuánto tiempo lleva adoptar este framework en nuestros equipos?**
> "El framework es incremental. El primer equipo puede estar operativo en 2–3 sprints: sprint 1 para el pipeline base con build y tests unitarios, sprint 2 para API testing Karate, sprint 3 para performance y GitOps. Los equipos siguientes heredan el template y se incorporan en 1 sprint."

**P: Las acciones de IA, ¿son deterministas o pueden introducir variabilidad?**
> "Las acciones de IA en el framework están acotadas a tareas de generación y análisis, no a decisiones de deployment. Los quality gates son siempre deterministas: umbrales numéricos, validaciones OpenAPI, resultados de tests. La IA asiste al equipo de QA, no reemplaza los gates."

---

## Notas del Presentador

### Ritmo y energía

- Bloque 3 (flujo verde): mantener ritmo fluido, no detenerse en cada línea de log
- Bloques 4 y 5 (DEMO BREAK): generar tensión dramática — el pipeline que falla ES el éxito de la demo
- Bloque 8 (Q&A): escuchar antes de responder; si no se sabe la respuesta exacta, comprometerse a seguimiento

### Si algo falla técnicamente

- Si Docker compose falla: tener screenshots/grabación de pantalla de una ejecución anterior lista
- Si el pipeline tarda más de lo esperado: aprovechar el tiempo para profundizar en la arquitectura con el diagrama
- Si la conexión a internet falla: los mocks locales (Prism) funcionan completamente offline

### Materiales de respaldo

- `C:\Users\jcunha\Documents\Optare\Clientes\AT_T\QA\PoC\att-poc-paymentbox\README.md` — detalle técnico completo
- `C:\Users\jcunha\Documents\Optare\Clientes\AT_T\QA\05_Documentacion\arquitectura\arquitectura_solucion.md` — diagramas de arquitectura
- `C:\Users\jcunha\Documents\Optare\Clientes\AT_T\QA\05_Documentacion\tech_stack\tech_stack.md` — tech stack justificado
- `C:\Users\jcunha\Documents\Optare\Clientes\AT_T\QA\Poc-CiCd.pptx` — presentación PowerPoint existente

---

## Orden de Demostración Recomendado

```
1. Abrir entorno local (docker compose up -d)          → 2 min
2. Mostrar README del repo (contexto)                   → 1 min
3. Mostrar arquitectura (diagrama)                      → 3 min
4. Abrir GitHub Actions → último run verde              → 2 min
5. Explicar Job 1 Build+Quality → SonarCloud            → 3 min
6. Explicar Job 2 Seguridad → Trivy                     → 2 min
7. Explicar Job 3 Image Ops → GHCR                      → 2 min
8. Explicar Job 4 E2E Karate → GitOps                   → 3 min
9. DEMO BREAK 1: break-contract.ps1 → push → fallo      → 8 min
10. DEMO BREAK 2: break-behavior.ps1 → push → fallo     → 8 min
11. Mostrar script k6 + métricas                        → 5 min
12. Framework + reporteo unificado                      → 5 min
13. Q&A                                                 → 10 min
```
