# IA Aplicada al Testing — Framework de Testing QA

> Capacidades de Inteligencia Artificial: generación de casos de prueba, datos sintéticos y automatización asistida

---

## 🚀 Implementación Funcional

Este directorio contiene una **implementación funcional y ejecutable** de las dos capacidades principales de IA:

| Módulo | Archivo | Estado |
|--------|---------|--------|
| Historias de Usuario → Karate Tests | `user_story_to_tests.py` | ✅ Funcional |
| Generación de Datos Sintéticos | `synthetic_data_generator.py` | ✅ Funcional |
| Demo ejecutable | `demo.py` | ✅ Funcional |

### Ejecución rápida

```bash
cd C:\Users\jcunha\Documents\Optare\Clientes\AT_T\QA\04_Framework\ia
pip install -r requirements.txt
python demo.py
```

### Con historia personalizada

```bash
python demo.py --story "Como agente quiero buscar un cliente para verificar su estado activo"
```

### Solo datos sintéticos (reproducible con seed)

```bash
python demo.py --data-only --clientes 50 --pagos 100 --seed 2024
```

### Con IA real (OpenAI)

```bash
$env:OPENAI_API_KEY = "sk-..."
python demo.py  # Usa GPT-4o-mini automáticamente si hay API key
```

**Sin API key** → modo template-based con reglas de dominio PaymentBox (funciona offline).

---

---

## Capacidades de IA en el Framework

El framework integra IA en **tres áreas clave**:

1. **Generación de Casos de Prueba** — a partir de historias de usuario o especificaciones OpenAPI
2. **Datos Sintéticos bajo Demanda** — generación de perfiles realistas para testing
3. **Análisis de Resultados** — detección de patrones de fallo y recomendaciones

---

## 1. Procesamiento de Historias de Usuario → Casos de Prueba

### Flujo de Trabajo

```
Historia de Usuario (Jira/Linear/Issue)
         │
         ▼
    IA Parser (LLM)
         │
         ▼
  Casos de Prueba (BDD Gherkin)
         │
         ▼
  Feature File Karate (.feature)
         │
         ▼
  Pipeline CI/CD (validación automática)
```

### Ejemplo — Historia de Usuario a Feature Karate

**Input (Historia de Usuario):**
```
Como cliente de AT&T,
quiero poder recargar saldo a mi teléfono,
para poder seguir usando mis servicios de datos.

Criterios de aceptación:
- El cliente debe poder ingresar con su número de teléfono
- El monto mínimo de recarga es $20
- La recarga debe reflejarse en < 3 segundos
- Se debe emitir un recibo en PDF
- El cliente INACTIVO no puede recargar
```

**Output generado por IA (Gherkin):**
```gherkin
Feature: Recarga de Saldo PaymentBox

  Background:
    * url baseUrl
    * def billy1 = {telefono: '4544', nombre: 'Billy 1 - Cortes', status: 'ACTIVO'}

  Scenario: Recarga exitosa para cliente ACTIVO
    Given path '/api/clientes', billy1.telefono
    When method GET
    Then status 200
    And match response.status == 'ACTIVO'
    
    Given path '/api/pagos/registrar'
    And request {telefono: '#(billy1.telefono)', monto: 50}
    When method POST
    Then status 201
    And match response.recibo != null
    And responseTime < 3000

  Scenario: Recarga con monto mínimo ($20)
    Given request {telefono: '4544', monto: 20}
    When POST /api/pagos/registrar
    Then status 201

  Scenario: Recarga rechazada por cliente INACTIVO (negativo)
    Given path '/api/pagos/registrar'
    And request {telefono: '4547', monto: 50}
    When method POST
    Then status 400
    And match response.message contains 'INACTIVO'

  Scenario: Recarga rechazada por monto insuficiente (negativo)
    Given request {telefono: '4544', monto: 5}
    When POST /api/pagos/registrar
    Then status 400
    And match response.message contains 'mínimo'
```

---

## 2. Generación de Datos Sintéticos

### Tipos de Datos Soportados

| Tipo de Dato | Descripción | Ejemplo |
|-------------|-------------|---------|
| **Perfiles de Cliente** | Nombre, teléfono, estado, saldo | `{nombre: "María García", telefono: "4549", status: "ACTIVO"}` |
| **Transacciones** | Montos, fechas, métodos de pago | `{monto: 75.00, metodo: "TARJETA", fecha: "2026-05-07"}` |
| **Documentos de Identidad** | INE, pasaporte (formato sintético) | Hash/UUID para pruebas de carga documental |
| **Datos de Pago** | Tarjetas sintéticas (Luhn válido) | `4111111111111111` (VISA test) |

### Generación bajo Demanda (TDM Seeder)

El módulo TDM (`simulation/tdm-seeders/`) permite generar perfiles adicionales:

```sql
-- 01_schema.sql — Estructura de la BD
CREATE TABLE clientes (
  id SERIAL PRIMARY KEY,
  telefono VARCHAR(20) UNIQUE NOT NULL,
  nombre VARCHAR(100) NOT NULL,
  status VARCHAR(20) CHECK (status IN ('ACTIVO','INACTIVO','BLOQUEADO')),
  saldo NUMERIC(10,2) DEFAULT 0.00
);

-- 02_billy_profiles.sql — 5 perfiles base
INSERT INTO clientes VALUES
  (1, '4544', 'Billy 1 - Cortes', 'ACTIVO', 150.00),
  (2, '4545', 'Billy 2 - Cortes', 'ACTIVO', 200.00),
  (3, '4546', 'Billy 3 - Cortes', 'ACTIVO', 75.00),
  (4, '4547', 'Billy 4 - Pineda', 'INACTIVO', 0.00),
  (5, '4548', 'Billy 5 - Bloqueado', 'BLOQUEADO', 50.00);
```

### Script de Generación Masiva

```python
# tdm_generator.py — Generación de N perfiles sintéticos
import random
import string

def generate_customer_profile(n: int) -> list:
    """Genera N perfiles de cliente sintéticos para pruebas de carga."""
    profiles = []
    statuses = ['ACTIVO', 'ACTIVO', 'ACTIVO', 'INACTIVO', 'BLOQUEADO']  # 60% activos
    
    for i in range(n):
        profiles.append({
            'telefono': str(4550 + i),
            'nombre': f'TestUser {i:04d}',
            'status': random.choice(statuses),
            'saldo': round(random.uniform(0, 500), 2)
        })
    return profiles

# Uso: generar 1000 perfiles para prueba de carga
profiles = generate_customer_profile(1000)
```

---

## 3. Integración con OpenAPI → Tests de Contrato

La IA puede analizar una especificación OpenAPI y generar automáticamente:
- Tests de contrato Karate
- Casos de prueba negativos (campos faltantes, tipos incorrectos)
- Tests de idempotencia para métodos PUT/PATCH

### Ejemplo — OpenAPI → Karate Contract

**Input (OpenAPI spec `microservice-b`):**
```yaml
# simulation/prism-mocks/operador.yaml
paths:
  /api/clientes/{telefono}:
    get:
      responses:
        '200':
          content:
            application/json:
              schema:
                type: object
                required: [telefono, nombre, status]
                properties:
                  telefono: {type: string}
                  nombre: {type: string}
                  status: {enum: [ACTIVO, INACTIVO, BLOQUEADO]}
```

**Output generado (contract test):**
```gherkin
Feature: Contrato API microservice-b (generado desde OpenAPI)

  Scenario: Validar campos obligatorios del response
    Given path '/api/clientes/4544'
    When method GET
    Then status 200
    And match response == {telefono: '#string', nombre: '#string', status: '#string'}
    And match response.status == '#regex (ACTIVO|INACTIVO|BLOQUEADO)'
    And match response contains {telefono: '4544'}
```

---

## 4. Análisis Inteligente de Resultados

### Detección de Tests Inestables (Flaky)

El framework registra los resultados históricos y puede identificar tests flaky:

```
Test: recarga_flow.feature:60 (Paso 7 - Persistencia)
Historial últimas 20 ejecuciones:
  PASS: 17/20 (85%)
  FAIL: 3/20 (15%) ← FLAKY CANDIDATE

Causas potenciales detectadas:
  - Race condition: insert BD tarda > timeout definido
  - Timeout: responseTime definido en 3000ms, p99=2950ms (muy ajustado)
  
Recomendación IA:
  1. Aumentar timeout a 5000ms (margen seguro)
  2. Añadir retry logic en el step de BD
  3. Revisar índice en tabla pagos para acelerar insert
```

---

## 5. Generación de Reporte de Cobertura de Requisitos

La IA puede cruzar los casos de prueba existentes con los requisitos de las historias de usuario para identificar **gaps de cobertura**:

```
Análisis de Cobertura de Requisitos — Sprint 12

Requisito                                          Cobertura  Tests
─────────────────────────────────────────────────────────────────────
REQ-001: Cliente activo puede recargar              100%       3 tests
REQ-002: Monto mínimo $20                            100%       2 tests
REQ-003: Tiempo respuesta < 3 segundos              100%       1 test (k6)
REQ-004: Recibo PDF emitido                          100%       2 tests
REQ-005: Cliente INACTIVO bloqueado                 100%       1 test
REQ-006: Cliente BLOQUEADO bloqueado                  0%       ⚠️ NO CUBIERTO
REQ-007: Saldo insuficiente en operador              50%       1 test parcial
REQ-008: Tiempo máximo por sesión (timeout)           0%       ⚠️ NO CUBIERTO

Gap identificado: 2 requisitos sin cobertura → crear tests para REQ-006 y REQ-008
```

---

## Configuración y Herramientas

### Stack de IA Utilizado

| Capacidad | Herramienta | Modelo |
|-----------|-------------|--------|
| US → Gherkin | GitHub Copilot CLI / LLM | Claude / GPT-4 |
| Datos sintéticos | Python faker/mimesis | — |
| Análisis de flaky tests | Script Python + estadística | — |
| Coverage de requisitos | LLM + análisis de features | Claude / GPT-4 |

### Archivo `.agent/`

El directorio `.agent/` en el repositorio contiene la configuración del agente de IA:

```
.agent/
├── prompts/
│   ├── us-to-gherkin.md        ← Prompt para US → test cases
│   ├── openapi-to-contract.md  ← Prompt para OpenAPI → contrato
│   └── tdm-generator.md        ← Prompt para datos sintéticos
└── config.yaml                 ← Configuración del agente
```

---

## Ejemplo de Uso Completo

```bash
# 1. Crear historia de usuario como issue
gh issue create --title "REQ-009: Cliente puede cancelar recarga" \
  --body "Como cliente, quiero poder cancelar una recarga en progreso..."

# 2. El agente genera automáticamente los tests
# (trigger: label 'generate-tests' en el issue)

# 3. Revisar y ajustar feature generado
cat tests/functional-karate/src/test/resources/features/cancelar_recarga.feature

# 4. El pipeline CI valida automáticamente los nuevos tests
git add . && git commit -m "test(karate): añadir tests generados para REQ-009"
git push origin feature/req-009-cancelar-recarga
```
