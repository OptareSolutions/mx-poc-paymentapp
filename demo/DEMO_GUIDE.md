# Guía de Demo — Telco Operator PaymentBox PoC (rama `E`)

> Flujo de referencia: **`feature/*` → `E` → `A` → `F` → `PRODUCCION`**.  
> Detalle de pipelines, PRs y casos *verde/rojo*: [`doc/02_CI_CD/gitflow-pipeline-strategy.md`](../doc/02_CI_CD/gitflow-pipeline-strategy.md).

---

## Arquitectura local (entorno simulado)

```
Browser ──────────────────────────────► ui-paymentbox (Angular) :4200
                                              │ /api/*
                                              ▼
                              microservice-a (PaymentBox Core) :8080
                             ╱              │              ╲
                            ▼              ▼               ▼
              microservice-b        mock-operador     mock-recibo
         (Customer Profile) :8081    (Prism) :4010    (Prism) :4011
                  │
                  ▼
            PostgreSQL TDM :5432
           (Perfiles Billy 1-5)
```

Levantar stack:

```bash
cd simulation
docker compose pull
docker compose up -d
```

- **UI PaymentBox:** http://localhost:4200  
- **API microservice-a:** http://localhost:8080/swagger-ui.html  
- **API microservice-b:** http://localhost:8081/swagger-ui.html  

---

## Pipelines en GitHub (rama `E`)

Cada microservicio tiene su **caller** (`pipeline-microservice-a.yml` / `b`) que invoca el reusable **`reusable-microservice-pipeline.yml`**. No es un único “pipeline de 4 jobs” monolítico: hay **dos** CICD en paralelo si cambian ambos servicios.

Etapas típicas del reusable (resumen):

| Etapa | Contenido |
|-------|-----------|
| Build | JAR Gradle |
| Test | Unitarios + JaCoCo (≥ 80 %) |
| Quality gates | Gitleaks, Sonar, Trivy FS *(según evento/rama; en `push` a `feature/**` este job no corre)* |
| Publish | Imagen Docker, Trivy imagen CRITICAL, push GHCR *(solo `push` a `E` / `A` / `F` / `PRODUCCION` o manual)* |
| OPERACIONES | Aprobación en GitHub Environments *(solo en `push` a `A` / `F` / `PRODUCCION`)* |
| Deliver | Karate E2E (ms-a) o smoke contrato (ms-b), actualización GitOps |

Además:

- **`testing-factory.yml`** — `push` en `feature/**` y **`pull_request`** con base **`E`**: API (reusable), k6 smoke, RPA informativo.
- **`golden-pipeline-testing.yml`** — en **`push`** a ramas de ambiente y **PR** hacia **`A`** / **`F`** / **`PRODUCCION`**.
- **`pipeline-contrato-openapi.yml`** — breaking changes OpenAPI en PR (y push según `paths`).
- **`pipeline-integration.yml`** — **manual** (`workflow_dispatch`): promoción **`E→A`**, **`A→F`** o **`F→PRODUCCION`** con gates de contrato + E2E antes de copiar tags entre overlays.

---

## Escenario base — todo en verde

Con código compatible y PRs limpios, los workflows llegan a completar según rama (sin Deliver en `feature/**` hasta integrar en `E`).

---

## DEMO BREAK 1 — Ruptura de contrato

### Contexto

**microservice-a** consume el API público de **microservice-b**. Los tests **Karate** y/o **oasdiff** asumen campos como `telefono`, `nombre`, `status`. El script **renombra** el DTO a `phone`, `fullName`, etc., y ajusta el **test unitario** de **microservice-b** para que **compile** (el pipeline unitario del servicio B sigue en verde). La ruptura se detecta al validar **contrato entre equipos**.

### Camino recomendado (automático, shift-left)

1. Desde **`E`:**  
   `git fetch origin && git checkout -b feature/demo-break1 origin/E`
2. Ejecutar:  
   `.\demo\break-contract.ps1`
3. Commit y push:  
   `git add . && git commit -m "demo: BREAK 1 contrato" && git push -u origin feature/demo-break1`
4. Abrir **PR → base `E`**.

**Qué observar**

- **`testing-factory.yml`** / **`reusable-api-testing.yml`**: fallo en pasos **Karate @contract** u **OpenAPI breaking** cuando aplica.
- Opcionalmente **`pipeline-contrato-openapi.yml`** si los `paths:` incluyen tus cambios en `openapi*.yaml` o `src/main/java/**`.

Ejemplo típico (Karate):

```
match response.telefono == '4544'
  actual: { phone: '4544', fullName: '...', ... }
```

**Publish / Deliver aún no aplican** en el PR: el merge bloqueado evita integrar el cambio roto.

### Camino alternativo (manual, promoción)

Tras tener imágenes coherentes en el overlay de origen:

1. **Actions →** `pipeline-integration.yml` **→ Run workflow**  
2. **promote_from:** `E` — **promote_to:** `A` (u otra combinación válida: `A→F`, `F→PRODUCCION`)  
3. El job de **tests de contrato** puede fallar con el mismo síntoma si el código roto ya está en la imagen de origen.

*(La validación de inputs del workflow fue alineada a ramas `E` / `A` / `F` / `PRODUCCION`.)*

### Restaurar

```powershell
.\demo\restore.ps1
git add .
git commit -m "demo: restaurar contrato"
git push
```

---

## DEMO BREAK 2 — Ruptura de comportamiento (E2E)

### Contexto

Se activa una **validación de negocio** (monto mínimo **$100**) en **microservice-a** sin actualizar Karate. Los flujos Billy usan **$20** → **HTTP 400**. Los **unit tests** pueden seguir pasando.

### Camino recomendado

1. `git checkout -b feature/demo-break2 origin/E`
2. `.\demo\break-behavior.ps1`
3. `git add . && git commit -m "demo: BREAK 2 comportamiento" && git push -u origin feature/demo-break2`
4. **PR → `E`** y **merge** cuando quieras mostrar el fallo en integración.

**Qué observar**

En el **`push` a `E`** tras el merge, el reusable ejecuta **Publish** (si aplica) y luego **Deliver**. El paso:

`Deliver · DEMO BREAK 2 - Karate E2E · Flujo Completo 8 Pasos`

falla (por ejemplo esperaba **201** y recibe **400** con mensaje de monto mínimo). El manifiesto GitOps **no** debe actualizarse si el job falla.

### Restaurar

```powershell
.\demo\restore.ps1
git add .
git commit -m "demo: restaurar comportamiento"
git push
```

---

## Mensaje clave para la demo

> *El repo unifica negocio, tests y contratos. Un cambio que rompe el **contrato** entre servicios se detecta en **Testing Factory / contrato OpenAPI** en el **PR hacia `E`**. Un cambio que rompe el **flujo de negocio** completo se detecta en **Deliver (Karate E2E)** cuando el código se integra en rama de ambiente. Los scripts bajo `demo/` reproducen ambos casos.*
