# Guía de Demo — AT&T PaymentBox QA PoC

## Arquitectura del Entorno

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

## Pipeline CI/CD (4 Jobs)

| Job | Nombre | Qué valida |
|-----|--------|-----------|
| 1 | Build & Quality | Unit tests + JaCoCo ≥80% (microservice-a **y** microservice-b) |
| 2 | Integration & Contract | DB seeders, mocks Prism, **contrato A↔B (Karate)** |
| 3 | Image Ops | Build y push Docker: microservice-a, microservice-b, ui-paymentbox |
| 4 | Functional E2E | Ambiente completo, **Karate 8 pasos**, Selenium, k6 |

---

## Escenario Base — Todo en Verde ✅

El pipeline pasa los 4 jobs. La UI en `http://localhost:4200` muestra el flujo completo de recarga.

Para levantar el ambiente local:
```bash
cd simulation
docker compose pull
docker compose up -d
```

Accede a:
- **UI PaymentBox**: http://localhost:4200
- **API microservice-a**: http://localhost:8080/swagger-ui.html
- **API microservice-b**: http://localhost:8081/swagger-ui.html

---

## DEMO BREAK 1 — Ruptura de Contrato (falla en Job 2)

### Contexto

`microservice-a` llama a `microservice-b` para obtener el perfil del cliente. El contrato
público de `microservice-b` es: responder con campos `telefono`, `nombre`, `status`.

Un desarrollador **renombra los campos** del DTO sin avisar ni actualizar los consumidores.

### Ejecutar

```powershell
.\demo\break-contract.ps1
git add .
git commit -m "demo: romper contrato inter-servicios"
git push
```

### Qué falla

**Job 2** — paso `⚠️ DEMO BREAK 1 → Karate Contrato microservice-a↔microservice-b`:

```
FAILED - contract_microservices.feature:27
match response.telefono == '4544'
  actual: {phone: '4544', fullName: 'Billy 1 - Cortes', status: 'ACTIVO'}
  expected: response.telefono to exist
```

**Jobs 3 y 4 nunca se ejecutan** → el pipeline se detiene aquí (shift-left).

### Restaurar

```powershell
.\demo\restore.ps1
git add .
git commit -m "demo: restaurar contrato"
git push
```

---

## DEMO BREAK 2 — Ruptura de Comportamiento (falla en Job 4)

### Contexto

Un desarrollador añade una **validación de negocio** (monto mínimo $100) en
`RecargaService` sin actualizar los tests. Los perfiles Billy usan montos de $20.

### Ejecutar

```powershell
.\demo\break-behavior.ps1
git add .
git commit -m "demo: agregar monto mínimo $100"
git push
```

### Qué falla

**Job 4** — paso `⚠️ DEMO BREAK 2 → Karate DSL - Tests Funcionales`:

```
FAILED - recarga_flow.feature:60 (Pasos 6 y 7 - Registrar pago)
  POST /api/pagos/registrar
  expected: status 201
  actual:   status 400  {"message": "Monto mínimo $100"}
```

**Jobs 1, 2 y 3 pasan** — el defecto llega hasta E2E (más costoso de detectar).
Esto demuestra **por qué el contrato** (Job 2) es una capa de calidad anterior.

### Restaurar

```powershell
.\demo\restore.ps1
git add .
git commit -m "demo: restaurar comportamiento"
git push
```

---

## Mensaje Clave para AT&T

> *"El mismo repositorio contiene la lógica de negocio, los tests, el contrato
> entre servicios, y la UI. Cualquier cambio que rompa el contrato **se detecta
> en Job 2**, antes de construir imágenes o desplegar. Cualquier cambio que
> rompa el comportamiento **se detecta en Job 4**, con Karate ejecutando el
> flujo real de los 8 pasos contra el ambiente simulado completo."*
