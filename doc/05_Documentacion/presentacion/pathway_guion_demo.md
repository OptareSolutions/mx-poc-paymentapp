# PathWay — Guión de Presentación Demo AT&T
## PoC de Calidad Declarativa | Optare Solutions

> **Cliente:** AT&T (Telco Operator)
> **Proyecto:** PaymentBox — PoC de Calidad Declarativa
> **Versión:** 3.0 (PathWay WOW)
> **Fecha:** Mayo 2026
> **Presentador:** Optare Solutions — QE & DevSecOps
> **Duración estimada:** 60–75 minutos

---

## El PathWay: Narrativa de la Presentación

La presentación sigue un camino (*pathway*) de tres actos que conecta emocionalmente con los retos reales del comité AT&T:

```
ACTO I — EL PROBLEMA        → "Así están las cosas hoy"   (hacerles decir "sí, eso es exactamente lo que nos pasa")
ACTO II — LA SOLUCIÓN        → "Así funciona nuestra propuesta"  (sorpresa y alivio)
ACTO III — LA DIFERENCIACIÓN → "Por qué Optare es la respuesta"  (confianza y urgencia)
```

Cada escenario de demo refuerza el mismo mensaje: **la calidad no es una etapa, es una propiedad del sistema.**

---

## Mapa de Momentos WOW

> Esta tabla es la guía rápida del presentador. Cada WOW está diseñado para impactar sobre una necesidad específica del cliente, no para impresionar tecnológicamente.

| # | Momento WOW | Cuándo | Necesidad AT&T que resuelve |
|---|-------------|--------|-----------------------------|
| **WOW 1** | La Pregunta que Duele | Apertura | Activa la memoria del problema. El comité se reconoce. |
| **WOW 2** | El Número Real | Acto I cierre | Cuantifica el dolor en horas/coste antes de ver la solución |
| **WOW 3** | El Verde Total | Acto II flujo verde | Confianza: "el sistema funciona y es rápido" |
| **WOW 4** | El Rojo Controlado | DEMO BREAK 1 | Impacto: "atrapamos automáticamente lo que antes tardaba días" |
| **WOW 5** | La IA en vivo | Acto III IA | Sorpresa: genera tests desde una historia del propio comité |
| **WOW 6** | El Cierre ROI | Acto III final | Urgencia: "esto es dinero real que ya están perdiendo" |

---

## Checklist Pre-Demo (30 min antes del inicio)

### Entorno técnico
- [ ] Docker Compose levantado: `cd C:\Users\jcunha\Documents\Optare\Clientes\AT_T\QA\PoC\att-poc-paymentbox\simulation && docker compose up -d`
- [ ] Verificar servicios sanos: `docker compose ps` → todos en estado "healthy"
- [ ] Scripts demo preparados: `demo\break-contract.ps1`, `demo\break-behavior.ps1`, `demo\restore.ps1`

### Navegador (Chrome/Edge con perfiles sin extensiones)
| Tab | URL | Propósito |
|-----|-----|-----------|
| 1 | https://github.com/OptareSolutions/mx-poc-paymentapp | Repositorio GitHub |
| 2 | GitHub Actions → último run verde de pipeline-microservice-a | CI/CD en acción |
| 3 | `http://localhost:8080/swagger-ui.html` | Swagger microservice-a |
| 4 | `http://localhost:8081/swagger-ui.html` | Swagger microservice-b |
| 5 | `http://localhost:4200` | UI PaymentBox |
| 6 | SonarCloud dashboard | Calidad de código |

### Terminal / VS Code
- [ ] PowerShell abierto en la raíz del repositorio
- [ ] VS Code abierto con los ficheros de demo listos
- [ ] Grabación de pantalla de respaldo de un run verde completo (contingencia)

---

## ACTO I — El Problema (10 min)

### Segmento 1.1 — ★ WOW 1: La Pregunta que Duele (3 min)

> **[Nota presentador]** Antes de abrir cualquier pantalla ni herramienta. Solo el presentador y el comité.

> *"Buenos días. Antes de empezar la demo, quiero hacerles una pregunta directa:"*

**⏸ PAUSA — mirar al comité:**

> *"¿Cuántos días tardaron la última vez en detectar que un equipo había roto la integración con otro? No desde que se generó el error — desde que alguien lo reportó en QA hasta que encontraron la causa raíz."*

> **[Dejar que respondan. Escuchar. Asentir.]**

> *"Dos días. Tres días. Una semana en algún caso. Eso es exactamente lo que vamos a eliminar hoy. No en teoría — en vivo, delante de ustedes."*

> *"Les voy a mostrar cómo ese mismo error — el que tardaron [X días] en encontrar — se detecta en menos de 3 minutos de forma automática. Y cómo el entorno de QA se protege solo, sin que nadie tenga que hacer nada."*

> **[Pausa. Dejar que eso asiente.]**

---

### Segmento 1.2 — ★ WOW 2: El Número Real (4 min)

**[Mostrar esta tabla — se puede preparar en una diapositiva simple o escribirla en la pizarra]**

> *"Antes de mostrar la solución, quiero que compartamos el mismo diagnóstico. Porque si no coincidimos en el problema, ninguna solución va a parecer suficientemente buena."*

**Cálculo en vivo:**

| Métrica | Valor AT&T | Referencia |
|---------|-----------|------------|
| Validaciones manuales por ciclo | **5.200** | Compartido por AT&T |
| Tiempo promedio por validación manual | **~15 min** | Estimación conservadora |
| Horas totales por ciclo de validación | **~1.300 h** | 5.200 × 15 min / 60 |
| Coste por hora QA | **~$XX USD** | Ajustar con cifras AT&T |
| Coste por ciclo | **~$XX.000 USD** | A completar con AT&T |
| Errores que llegan a QA antes de detección | **~30%** | Basado en escenario descrito |
| Retraso promedio por error detectado en QA | **2–3 días/sprint** | Compartido por AT&T |

> *"Este no es el costo de la automatización. Este es el costo de **no tenerla**. Lo que vamos a mostrar no es un gasto — es la recuperación de 1.300 horas por ciclo."*

> **[Pausa. Dejar que el número asiente antes de continuar.]**

---

### Segmento 1.3 — Los tres retos y el flujo de negocio (3 min)

> *"Construimos la PoC alrededor de un flujo crítico de AT&T: la Recarga por PaymentBox. Ocho pasos que encadenan dos microservicios, una base de datos y una interfaz Angular — exactamente la complejidad de integración que tienen en producción.*
>
> *Los tres retos que resolvemos son precisamente los que ustedes plantearon:"*

| Reto | Problema AT&T | Lo que demostramos hoy |
|------|--------------|------------------------|
| **RPA** | Más lento que manual. Mantenimiento costoso. Sin framework. | RPA estable, integrado en CI, reporteo unificado |
| **CI/CD** | Solo seguridad/estilo. Errores funcionales llegan a QA. | Contratos, integración E2E, comportamiento — bloqueantes |
| **Performance** | JMeter falla a 4k VUs. Grabación HTTPS imposible. | k6: 2k VUs/3600s. Grabación nativa HTTPS. |

> *"Para hacer la demo realista, la organizamos en dos equipos — Team A y Team B — trabajando en paralelo, como sus fábricas de software. El framework detecta y protege automáticamente los errores de coordinación entre equipos. Van a verlo en vivo."*

---

## ACTO II — La Solución (35 min)

### Segmento 2.1 — Arquitectura de la solución (5 min)

**[Abrir diagrama en 05_Documentacion\arquitectura\arquitectura_solucion.md — VS Code, modo pantalla completa]**

> *"La arquitectura tiene tres capas. Una frase por capa:"*

- **Capa aplicación:** Dos microservicios Java Spring Boot, frontend Angular, PostgreSQL con perfiles de clientes sintéticos — el flujo PaymentBox real.
- **Capa calidad:** Tres pipelines GitHub Actions. Cada commit dispara validación completa: unit tests, seguridad, API testing en tres niveles, performance smoke. Sin intervención humana.
- **Capa GitOps:** Los manifiestos Kubernetes son la única fuente de verdad. **Solo un pipeline verde puede promover código.** Si algo falla, el entorno no avanza. Punto.

> *"Cuatro entornos: develop → qa → uat → producción. La promoción entre entornos siempre es declarativa. Nadie puede saltarse la validación. El sistema se bloquea solo."*

---

### Segmento 2.2 — ★ WOW 3: El Verde Total — DEMO Flujo Verde (10 min)

**[Abrir GitHub Actions → pipeline-microservice-a → último run verde]**

> *"Voy a mostrarles el flujo normal. Un cambio en microservice-a. Push a `develop`. El pipeline se activa."*

**[Señalar los 4 jobs en secuencia mientras van avanzando — si es en vivo, esperar. Si es run previo, narrar sobre el run grabado.]**

> *"Job 1 — Build & Quality: compilación, 100% tests en verde, cobertura JaCoCo al 83%. Si cae por debajo del 80%, el pipeline para aquí. SonarCloud analizando en paralelo.*
>
> *Job 2 — Seguridad: Trivy escanea. Cero CVEs críticos o altos. Si hay una CVE, nadie construye una imagen hasta que se corrige.*
>
> *Job 3 — Image Ops: build multi-stage. Solo el JRE Alpine en la imagen final. Imagen inmutable etiquetada con el SHA del commit — `env-e-{sha}`. Cada commit, su imagen. Trazabilidad total.*
>
> *Job 4 — E2E + GitOps: Karate ejecuta los 8 pasos del flujo PaymentBox completo. Cliente Billy 1. Recarga, pago, recibo. Todo verde."*

**⏸ PAUSA cuando todos los jobs estén en verde — 3 segundos en silencio, mirando los checkmarks verdes.**

> *"Esto acaba de ejecutar, de forma completamente automática, lo que antes requería coordinación en QA. En menos de 10 minutos. En cada commit. De todos los desarrolladores, en paralelo."*

**[Mostrar SonarCloud dashboard — histórico de calidad]**

> *"Y esto es lo que ve el área de gobernanza de AT&T: el historial de calidad acumulado en el tiempo. No una foto de hoy — la evolución sprint a sprint. Transparencia total, sin pedir informes al equipo de QA."*

**Puntos clave:**
- Pipeline completo en menos de 10 minutos → Lead Time for Changes medible
- 100% automático. Sin gatekeepers humanos en el ciclo
- Evidencia descargable por cada commit como artefacto permanente de GitHub Actions

---

### Segmento 2.3 — ★ WOW 4: El Rojo Controlado — DEMO BREAK 1: Ruptura de Contrato (10 min)

> **[Nota presentador]** Este es el momento más importante de la demo. Construir tensión antes del rojo. Hablar despacio.

> *"Ahora reproduzco el escenario que ustedes describieron. Team B necesita hacer un cambio en su API. Es un cambio técnicamente válido. Sus tests unitarios pasan. ¿Quién lo para?"*

**⏸ PAUSA — dejar la pregunta en el aire 3 segundos.**

> *"Hoy: nadie. Lo para alguien en QA, 2–3 días después."*

> *"Vamos a verlo en tiempo real."*

**[Acción en PowerShell]**

```powershell
cd C:\Users\jcunha\Documents\Optare\Clientes\AT_T\QA\PoC\att-poc-paymentbox
.\demo\break-contract.ps1
```

> *"Team B acaba de renombrar el campo `telefono` a `phone` en el DTO de microservice-b. Válido. Sus tests pasan — conocen el nuevo nombre."*

```powershell
git add .
git commit -m "demo: BREAK 1 - romper contrato DTO"
git push origin develop
```

**[Mostrar GitHub Actions — pipelines individuales de Team A y Team B en verde]**

> *"Pipelines individuales: verde. La imagen se construye. Todo parece correcto."*

**[Ejecutar pipeline-integration via workflow_dispatch. Esperar. Dejar crecer la tensión.]**

**[Job 1 aparece en rojo — ★ PAUSA DRAMÁTICA 5 segundos sin hablar]**

> *"..."*

> *"Job 1 — Tests de Contrato — **FALLA**. En 47 segundos.*
>
> *Karate intentó acceder a `response.telefono`. El campo ya no existe — ahora se llama `phone`.*
>
> *En su entorno actual: este error llegaría a QA. Alguien abriría un ticket. Team B investigaría. 2–3 días.*
>
> *Aquí: 47 segundos. El responsable recibe la notificación con el contexto exacto del fallo. La promoción a QA está BLOQUEADA. Automáticamente."*

**[Restaurar]**

```powershell
.\demo\restore.ps1
git add .
git commit -m "restore: contrato restaurado"
git push origin develop
```

---

### Segmento 2.4 — DEMO BREAK 2: Ruptura de Comportamiento (7 min)

> *"El segundo escenario es más sutil — un cambio de comportamiento de negocio. Team A implementa una validación: monto mínimo $100. Sus tests pasan."*

**[Acción en PowerShell]**

```powershell
.\demo\break-behavior.ps1
git add .
git commit -m "demo: BREAK 2 - validación monto mínimo $100"
git push origin qa
```

**[Mostrar Jobs 1-3 en verde, Job 4 fallando]**

> *"Jobs 1, 2 y 3: verde. La imagen se construye. Pero Job 4 — E2E — falla. Karate ejecuta el flujo con Billy 1, recarga de $20. La API responde HTTP 400. El manifiesto `k8s/overlays/env-a` NO se actualiza. QA sigue en la versión anterior — la que funcionaba.*
>
> *El entorno se protege solo. No hay rollback manual. El estado anterior del manifiesto ES el rollback."*

```powershell
.\demo\restore.ps1
git add .
git commit -m "restore: comportamiento restaurado"
git push origin qa
```
- Carga 2k VUs/3600s disponible para ejecución bajo demanda

---

## ACTO III — El Framework y la Diferenciación (20 min)

### Segmento 3.1 — Framework: Orquestación, Reporteo y Gobierno (5 min)

**[Mostrar GitHub Actions — vista general de todos los workflows]**

> *"Todo lo que hemos visto — RPA, CI/CD con API testing, performance — está unificado en un único framework con gobierno y estándares codificados.*
>
> *Un solo repositorio. Tres pipelines coordinados. Cuatro entornos declarativos.*
>
> *Los estándares de calidad no son recomendaciones — son condiciones de paso. Cobertura < 80%: falla. CVE crítico: falla. Contrato roto: falla. Performance degradada: falla. El gobierno no depende de la disciplina individual del desarrollador — está codificado en el sistema.*
>
> *Los pipelines incluyen triggers cron para regresiones nocturnas completas. El equipo de QA llega cada mañana con un informe del estado de todos los ambientes. Sin ejecutar nada manualmente."*

---

### Segmento 3.2 — ★ WOW 5: La IA en vivo (8 min)

> **[Nota presentador]** Este es el momento más memorable de la demo. Hacer participar al comité.

> *"Antes de cerrar, quiero mostrarles algo que no suelen ver en una presentación de QA."*

**⏸ Dirigirse al comité directamente:**

> *"¿Alguien del comité puede darme una historia de usuario? Cualquiera — no tiene que ser técnica. Del tipo: 'Como [rol] quiero [acción] para [beneficio]'."*

**[Esperar. Tomar la historia que den. Si no proponen ninguna, usar:]**
> *"Usamos esta: 'Como agente de AT&T quiero registrar una recarga de monto válido para un cliente activo para generar un comprobante de pago.'"*

**[Abrir PowerShell, navegar a la carpeta de IA]**

```powershell
Set-Location "C:\Users\jcunha\Documents\Optare\Clientes\AT_T\QA\04_Framework\ia"
$env:PYTHONIOENCODING = "utf-8"
python demo.py --force-template --story "HISTORIA_QUE_DIO_EL_COMITÉ" --tests-only
```

**[Mostrar output en pantalla — casos de prueba generados]**

> *"En segundos: 10–15 escenarios de prueba Karate DSL. Positivos, negativos, casos borde. Listos para revisión por el QA Engineer. Lo que antes llevaba dos días de diseño de pruebas.*
>
> *Y ahora, datos sintéticos bajo demanda. Sin Billy fijos. Los datos que necesite el equipo de QA, cuando los necesite."*

```powershell
python demo.py --force-template --data-only --clientes 50 --pagos 100 --seed 2026
```

> *"50 perfiles de clientes sintéticos realistas. 100 pagos. En 3 segundos. Para el equipo de AT&T con 5.200 validaciones manuales, esto significa no volver a crear datos de prueba a mano.*
>
> *La IA no toma decisiones de deployment. Los quality gates son siempre deterministas. La IA asiste al equipo de QA, no reemplaza el juicio humano."*

---

### Segmento 3.3 — Tabla de Diferenciación (3 min)

| Diferenciador | Optare Solutions | Alternativa típica |
|---------------|------------------|-------------------|
| **Modelo de calidad** | Declarativo — codificado en pipeline, trazable | Ad-hoc por equipo |
| **Detección de contratos** | En pipeline, antes de QA — 47 segundos | Manual, en QA — 2-3 días |
| **Performance en CI** | Smoke en cada push + comparación histórica | Pruebas de carga aisladas, bajo demanda |
| **Seguridad** | Zero CVEs CRITICAL/HIGH, bloqueante, por commit | Escaneo periódico desvinculado del desarrollo |
| **GitOps** | Manifiestos inmutables, rollback automático | Deploy manual, rollback manual |
| **RPA en CI/CD** | Integrado en el pipeline, reporteo unificado | Standalone, reporteo separado |
| **IA** | Generación de tests + datos sintéticos, en vivo | No integrado |
| **Adopción** | Incremental por equipos, 2–3 sprints por equipo | Implementación big-bang, alto riesgo |
| **Coste** | Stack 100% open-source (SonarCloud freemium) | Herramientas comerciales (LoadRunner, etc.) |

---

### Segmento 3.4 — ★ WOW 6: El Cierre con ROI (2 min)

> **[Nota presentador]** No cerrar con tecnología. Cerrar con el negocio de AT&T.

> *"Permítanme cerrar con los números de ustedes, no los nuestros."*

> *"Ustedes tienen 5.200 validaciones manuales por ciclo. Si migran el 40% a este framework — una adopción conservadora — son 2.080 validaciones automatizadas. A 15 minutos promedio cada una, son **520 horas recuperadas por ciclo**.*
>
> *El error de integración que tardaba 2–3 días en detectarse: ahora se detecta en 47 segundos. Cada sprint. En todos los equipos.*
>
> *La pregunta que les dejo no es '¿funciona la tecnología?' — acabamos de demostrar que sí. La pregunta es: **'¿cuánto tiempo más pueden permitirse que los errores lleguen a QA?'"***

**⏸ PAUSA FINAL — 3 segundos. Dejar que la pregunta cierre la sala.**

---

### Segmento 3.5 — Q&A Preparado

**P: "¿Por qué k6 y no JMeter o LoadRunner, que ya conocemos?"**
> *"JMeter tiene limitaciones documentadas por encima de 4k VUs y no soporta grabación HTTPS con autenticación compleja entre nubes — exactamente el problema que reportaron. k6 resuelve los tres: escala, grabación y reporteo. El coste es cero. LoadRunner resolvería la escala pero añade licenciamiento significativo sin resolver la grabación."*

**P: "¿Cómo gestionamos los secretos y credenciales de AT&T en el pipeline?"**
> *"GitHub Actions Secrets cifra credenciales en reposo y en tránsito — nunca aparecen en logs. Para producción, integramos con AWS Secrets Manager o HashiCorp Vault según la política de AT&T."*

**P: "¿El sistema funciona con nuestra infraestructura — múltiples nubes, VPN?"**
> *"Los runners de GitHub Actions pueden ser self-hosted, instalados dentro de la infraestructura de AT&T, eliminando cualquier restricción de red. El runner se despliega en la red de AT&T y accede a los sistemas internos sin exponer nada al exterior."*

**P: "¿Qué pasa si un microservicio no tiene OpenAPI/Swagger definido?"**
> *"Karate funciona con y sin OpenAPI. Sin spec: graba el comportamiento base y lo convierte en el contrato de referencia. La migración es incremental."*

**P: "¿Cómo se integra con Jira/ServiceNow?"**
> *"GitHub Actions publica resultados a Jira vía API, crea tickets automáticos cuando un gate falla, y los cierra cuando el pipeline vuelve a verde. Se configura como un job adicional — sin cambios en el framework base."*

**P: "¿Cuánto tiempo lleva adoptar este framework en nuestros equipos?"**
> *"El primer equipo puede estar operativo en 2–3 sprints: pipeline base (sprint 1), API testing Karate (sprint 2), performance y GitOps (sprint 3). Los equipos siguientes heredan el template y se incorporan en 1 sprint."*

**P: "Las acciones de IA, ¿son deterministas?"**
> *"Los quality gates son siempre deterministas — umbrales numéricos, validaciones OpenAPI, resultados de tests. La IA genera propuestas que el QA Engineer aprueba. No hay ningún punto donde una IA pueda enviar código a producción sin supervisión humana."*

**P: "¿El RPA no va a ser tan lento e inestable como lo que tenemos ahora?"**
> *"La inestabilidad del RPA actual viene de los tiempos de espera fijos. Playwright usa esperas automáticas — espera activamente al elemento hasta que está interaccionable. En los flujos que hemos automatizado, la estabilidad supera el 95%."*

---

## Notas del Presentador

### Gestión del ritmo y las pausas

Las pausas son tan importantes como las palabras. El silencio crea espacio para que el impacto aterrice.

| Segmento | Tono | Ritmo |
|----------|------|-------|
| WOW 1 — La Pregunta que Duele | Empático, curioso | Lento. Dejar que respondan. |
| WOW 2 — El Número Real | Serio, directo | Mostrar la tabla. Silencio. |
| WOW 3 — El Verde Total | Confiado | Narrar fluidamente. PAUSA 3s en verde. |
| WOW 4 — El Rojo Controlado | Tenso, luego aliviado | Hablar despacio antes del push. PAUSA 5s ante el rojo. |
| WOW 5 — La IA en vivo | Sorpresa, juego | Hacer participar al comité. Sonreír. |
| WOW 6 — El Cierre ROI | Serio, directo | Última frase. PAUSA 3s. No añadir más. |

### Contingencias técnicas

| Fallo | Plan B |
|-------|--------|
| Docker Compose no arranca | Abrir grabación de pantalla de un run verde completo |
| Pipeline tarda más de lo esperado | Mostrar diagrama de arquitectura y profundizar en los DEMO BREAK conceptualmente |
| Conexión a internet falla | Los mocks locales Prism funcionan completamente offline |
| SonarCloud no carga | Usar capturas de pantalla en `06_Evidencias/` |
| Python / IA no ejecuta | Mostrar el output pre-generado en `04_Framework\ia\generated\` |

### Mensajes de cierre — solo uno de estos, el que sienta más natural

> *"La pregunta no es si esto funciona. Acaban de verlo. La pregunta es cuánto tiempo más pueden permitirse que los errores lleguen a QA."*

> *"Lo que construimos no es un prototipo — es el framework que sus equipos usarían desde el primer sprint. El template está listo para clonarse."*

---

## Materiales de Referencia

| Documento | Ruta |
|-----------|------|
| Guión original (v1.0) | `05_Documentacion\presentacion\guion_presentacion.md` |
| Arquitectura de la solución | `05_Documentacion\arquitectura\arquitectura_solucion.md` |
| Análisis PoC GitHub vs requerimientos | `05_Documentacion\arquitectura\analisis-poc-github-vs-requerimientos.md` |
| Tech Stack justificado | `05_Documentacion\tech_stack\tech_stack.md` |
| Repositorio GitHub PoC | https://github.com/OptareSolutions/mx-poc-paymentapp |
| Demo break scripts | `PoC\att-poc-paymentbox\demo\` |
| Script k6 carga 2k VUs | `03_Performance_Testing\scripts\load_test_2k_vus.js` |
| Scripts RPA Salesforce | `01_RPA\scripts\salesforce_flow.py` |
| Scripts IA | `04_Framework\ia\` |

---

*Versión PathWay 2.0 — Optare Solutions — Mayo 2026*
