# API Testing — Integration E2E

Suite de tests de integración E2E con Karate, integrada en GitHub Actions.

## Estructura

```
integracion/
├── pom.xml                                      # Proyecto Maven (Karate 1.4.0 + JUnit 5)
├── README.md
├── .github/workflows/
│   └── api-integracion.yml                      # Pipeline GitHub Actions
└── src/test/
    ├── java/com/att/paymentbox/integracion/
    │   └── IntegracionRunner.java               # Runner JUnit 5
    └── resources/
        ├── karate-config.js                     # Config por entorno (local/ci/staging)
        └── features/
            ├── auth/
            │   └── auth_flow.feature            # Flujo autenticación completo
            ├── cliente/
            │   └── cliente_integracion.feature  # Integración msvc-a ↔ msvc-b
            └── recarga/
                └── recarga_integracion_e2e.feature  # Flujo E2E 8 pasos
```

## Escenarios implementados

### 🔐 Auth Flow (`auth/auth_flow.feature`)
| ID | Escenario |
|----|-----------|
| AUTH-01 | Login exitoso → access_token + refresh_token |
| AUTH-02 | Login rechazado con contraseña incorrecta |
| AUTH-03 | Login rechazado con usuario inexistente |
| AUTH-04 | Acceso a endpoint protegido con token válido |
| AUTH-05 | Endpoint sin token (comportamiento esperado) |
| AUTH-06 | Token refresh exitoso (rotación sin re-login) |
| AUTH-07 | Refresh con token inválido → 401 |
| AUTH-08 | Logout e invalidación de token |
| AUTH-09 | **Ruta crítica:** login → uso → refresh → logout |

### 🔗 Integración Cliente (`cliente/cliente_integracion.feature`)
| ID | Escenario |
|----|-----------|
| DEP-01 | Consulta directa a microservice-b |
| DEP-02 | 404 para cliente inexistente en microservice-b |
| DEP-03 | Coherencia de datos entre microservice-a y microservice-b |
| DEP-04 | Coherencia de status (ACTIVO/INACTIVO/BLOQUEADO) |
| DEP-05 | Transporte de ID cliente → registro pago → emisión recibo |
| DEP-06 | Propagación de error de servicio externo |
| DEP-07 | Pago rechazado por cliente inexistente |
| DEP-08 | Health checks de ambos microservicios |

### ♻️ Recarga E2E (`recarga/recarga_integracion_e2e.feature`)
| ID | Escenario |
|----|-----------|
| REC-INT-01 | **Flujo crítico completo** (telefono→folio→recibo, 8 pasos) |
| REC-INT-02 | Flujo completo data-driven (Billy 1, 2, 3) |
| REC-INT-03 | Flujo bloqueado para clientes INACTIVO/BLOQUEADO |
| REC-INT-04 | Recarga con diferentes métodos de pago |
| REC-INT-05 | Unicidad de folios (token de correlación entre llamadas) |
| REC-INT-06 | Operador externo → montos → pago (encadenamiento) |
| REC-INT-07 | Operador inexistente bloquea el flujo |

## Ejecución local

### Prerrequisitos
- JDK 17+
- Maven 3.8+
- Los servicios deben estar levantados (ver `simulation/docker-compose.yml` en el repo del proyecto)

### Comandos

```bash
# Suite completa de integración
mvn test -Dkarate.env=local

# Solo tests de autenticación
mvn test -Dkarate.env=local -Dtest=IntegracionRunner#testAuthFlow

# Solo integración cliente
mvn test -Dkarate.env=local -Dtest=IntegracionRunner#testClienteIntegracion

# Solo recarga E2E
mvn test -Dkarate.env=local -Dtest=IntegracionRunner#testRecargaE2E

# Ruta crítica (smoke)
mvn test -Dkarate.env=local -Dtest=IntegracionRunner#testCriticalPath

# Solo tests negativos
mvn test -Dkarate.env=local -Dtest=IntegracionRunner#testNegative
```

## Pipeline GitHub Actions

El workflow `.github/workflows/api-integracion.yml` ejecuta 4 jobs:

1. **health-check** — Levanta servicios Docker y verifica health
2. **auth-tests** — Flujo completo de autenticación
3. **integracion-e2e** — Tests de integración cliente + recarga (8 pasos)
4. **report** — Consolida evidencias y las publica como artefacto (90 días)

### Triggers
- Push a `develop`, `feature/**`, `release/**`
- Pull Request hacia `develop` o `qa`
- Manual (`workflow_dispatch`) con selección de entorno

### Seguridad del workflow
- ✅ Acciones fijadas a SHA inmutables (no tags mutables)
- ✅ `permissions: contents: read` por defecto
- ✅ Secrets via variables de entorno (no en texto plano)
- ✅ `concurrency.cancel-in-progress: true` para PRs
- ✅ Retención de artefactos: 30 días tests, 90 días evidencias

## Entornos

| Env | baseUrl | customerProfileUrl | authUrl |
|-----|---------|--------------------|---------|
| `local` | http://localhost:8080 | http://localhost:8081 | http://localhost:9000 |
| `ci` | http://localhost:8080 | http://localhost:18081 | http://localhost:9000 |
| `staging` | https://staging-api... | https://staging-profiles... | https://staging-auth... |

## Tags disponibles

| Tag | Uso |
|-----|-----|
| `@integracion` | Todos los tests de esta suite |
| `@smoke` | Tests rápidos para verificar entorno |
| `@critical-path` | Flujos de negocio esenciales |
| `@negative` | Escenarios de error esperados |
| `@auth` | Tests de autenticación |
| `@e2e` | Flujos end-to-end completos |
| `@dep-externo` | Validación de servicios externos |
| `@coherencia` | Coherencia entre microservicios |
| `@id-transport` | Transporte de IDs/tokens entre llamadas |
| `@flujo-completo` | Flujos E2E de recarga completos |
| `@token-transport` | Propagación de folios/tokens de correlación |
