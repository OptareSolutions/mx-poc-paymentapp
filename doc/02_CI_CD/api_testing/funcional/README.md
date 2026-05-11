# API Testing Funcional — Smoke Tests

## Propósito
Tests de humo (smoke tests) funcionales sobre los endpoints críticos de la API del PoC AT&T PaymentBox. Validan que el sistema está operativo y los contratos básicos se cumplen en cada push al pipeline.

## Proyecto
- **Repositorio**: https://github.com/OptareSolutions/mx-poc-paymentapp
- **Issue**: OPT-133 — [CI/CD][API] Implementar pruebas funcionales smoke tests
- **Rama**: `feature/api-smoke-tests-OPT-133`
- **Workflow**: `.github/workflows/api-smoke-tests.yml`

## Herramienta: Karate DSL (v1.4.0) + JUnit 5 + Maven

## Endpoints validados (tag @smoke)

| Endpoint | Método | Paso | HTTP esperado | Validación Body |
|----------|--------|------|---------------|-----------------|
| `/api/clientes/buscar?telefono=4544` | GET | Paso 2 | 200 | `status=ACTIVO`, `fullName contains 'Billy'` |
| `/api/clientes/buscar?telefono=4545` | GET | Paso 2 | 200 | `status=ACTIVO` |
| `/api/clientes/buscar?telefono=4546` | GET | Paso 2 | 200 | `status=ACTIVO` |
| `/api/recargas/montos?operador=BLUE` | GET | Paso 3 | 200 | Array no vacío con `{id, monto, operador}` |
| `/api/recargas/validar-operador` | POST | Paso 4 | 200 | `valido=true`, `operador=BLUE` |
| `/api/pagos/metodos` | GET | Paso 5 | 200 | Contiene `TARJETA`, `EFECTIVO`, `OODI` |
| `/api/pagos/registrar` | POST | Pasos 6-7 | 201 | `status=APLICADO`, folio formato `B-[A-Z0-9]+` |
| `/api/recibos/emitir` | POST | Paso 8 | 200 | `status=EMITIDO`, `url_pdf` es string |
| `/api/customers/{telefono}` | GET | Contrato | 200 | `status=ACTIVO` (Billy 1-3) |
| Ruta crítica 8 pasos | GET+POST | E2E | 200/201 | Flujo completo encadenado |

## Estructura de archivos

```
tests/functional-karate/
├── pom.xml                                  # Maven + Karate 1.4.0
└── src/test/
    ├── java/com/att/paymentbox/
    │   └── RecargaFlowRunner.java           # Runner: testSmoke() → @smoke tag
    └── resources/
        ├── karate-config.js                 # baseUrl por entorno (local/ci)
        └── features/
            ├── recarga_flow.feature         # Pasos 2-8 @smoke @negative @critical-path
            └── contract_microservices.feature  # Contrato microservice-a ↔ microservice-b
```

## Ejecución local

```bash
# Pre-requisito: entorno simulado corriendo
cd simulation && docker compose up -d --build

# Ejecutar solo @smoke tests
cd tests/functional-karate
mvn test -Dkarate.env=ci -Dtest=RecargaFlowRunner#testSmoke

# Reportes en: target/surefire-reports/ y target/karate-reports/
```

## Integración CI/CD (GitHub Actions)

**Workflow**: `.github/workflows/api-smoke-tests.yml`

**Triggers**:
- Push a `develop`, `qa`, `uat` cuando hay cambios en microservices, tests o simulación
- Pull Requests hacia esas ramas
- `workflow_dispatch` (manual)

**Jobs**:
1. Checkout + JDK 17 + Maven cache
2. `docker compose up -d --build` (entorno simulado completo)
3. Health checks microservice-a (`:8080`) y microservice-b (`:18081`)
4. `mvn test -Dtest=RecargaFlowRunner#testSmoke -Dkarate.env=ci`
5. Upload artifacts: `surefire-reports/` + `karate-reports/` (retención 30 días)
6. Job Summary con resumen de resultados
7. `docker compose down -v`

**Seguridad**:
- Todas las acciones pinadas a SHA inmutable (supply-chain security)
- Permisos mínimos: `contents: read`
- Sin credenciales hardcodeadas

## Resultados en GitHub Actions

Los resultados están visibles en:
1. **Job Summary**: tabla con endpoints validados y contador pasados/fallidos
2. **Artifacts**: `api-smoke-results-{rama}-{run_id}` (HTML Karate + XML Surefire)
3. **Annotations**: fallos marcados directamente en la UI de GitHub Actions

## Fecha de implementación
2026-05-07

## Tarea relacionada
[OPT-133] — [CI/CD][API] Implementar pruebas funcionales smoke tests
