@integracion @e2e @cliente
Feature: Flujo E2E — Validación de Servicios Externos y Perfil de Cliente
  Como sistema de integración
  Quiero validar la comunicación entre microservice-a y microservice-b
  Para garantizar que los datos del cliente son coherentes entre servicios

  # ─────────────────────────────────────────────────────────────────────────────
  # Nota de diseño:
  #   microservice-a (puerto 8080) consume microservice-b (puerto 8081/18081 en CI).
  #   Esta suite valida la integración end-to-end entre ambos servicios:
  #     1. Consulta directa a microservice-b (dependencia externa)
  #     2. Consulta a microservice-a que internamente llama a microservice-b
  #     3. Consistencia de datos entre ambas respuestas
  #     4. Propagación de errores cuando el servicio externo falla/devuelve error
  # ─────────────────────────────────────────────────────────────────────────────

  # ─────────────────────────────────────────────────────────────────────────────
  # 1. VALIDACIÓN DIRECTA de microservice-b (servicio externo)
  # ─────────────────────────────────────────────────────────────────────────────
  @smoke @dep-externo
  Scenario Outline: DEP-01 Consulta directa a microservice-b para cliente <nombre>
    Given url customerProfileUrl
    And path '/api/customers/<telefono>'
    When method GET
    Then status 200
    And match response.telefono == '<telefono>'
    And match response.nombre   == '#string'
    And match response.status   == '#string'

    Examples:
      | telefono | nombre  |
      | 4544     | Billy 1 |
      | 4545     | Billy 2 |
      | 4546     | Billy 3 |

  @negative @dep-externo
  Scenario: DEP-02 microservice-b retorna 404 para cliente inexistente
    Given url customerProfileUrl
    And path '/api/customers/9999'
    When method GET
    Then status 404

  # ─────────────────────────────────────────────────────────────────────────────
  # 2. COHERENCIA DE DATOS entre microservice-a y microservice-b
  #    microservice-a refleja los mismos nombres JSON que microservice-b (telefono, nombre)
  # ─────────────────────────────────────────────────────────────────────────────
  @smoke @coherencia
  Scenario: DEP-03 Los datos de cliente son coherentes entre microservice-a y microservice-b
    # Consulta directa a microservice-b
    Given url customerProfileUrl
    And path '/api/customers/4544'
    When method GET
    Then status 200
    * def profileFromB = response
    # Guardar datos de microservice-b para comparación
    * def telefono_b  = profileFromB.telefono
    * def nombre_b    = profileFromB.nombre
    * def status_b    = profileFromB.status

    # Consulta a microservice-a (que internamente llama a microservice-b)
    Given url baseUrl
    And path '/api/clientes/buscar'
    And param telefono = telefono_b
    When method GET
    Then status 200
    # Validar coherencia entre servicios
    And match response.telefono == telefono_b
    And match response.nombre   == nombre_b
    And match response.status   == status_b

  @smoke @coherencia
  Scenario Outline: DEP-04 Coherencia de status para clientes especiales (<tipo>)
    # Paso 1: obtener datos del perfil en microservice-b
    Given url customerProfileUrl
    And path '/api/customers/<telefono>'
    When method GET
    Then status 200
    * def statusEnB = response.status

    # Paso 2: consulta en microservice-a debe reflejar el mismo status
    Given url baseUrl
    And path '/api/clientes/buscar'
    And param telefono = '<telefono>'
    When method GET
    # Si el cliente no está ACTIVO, microservice-a devuelve 404
    Then status <statusCode>

    Examples:
      | telefono | tipo      | statusCode |
      | 4544     | ACTIVO    | 200        |
      | 4547     | INACTIVO  | 404        |
      | 4548     | BLOQUEADO | 404        |

  # ─────────────────────────────────────────────────────────────────────────────
  # 3. TRANSPORTE DE IDs ENTRE SERVICIOS
  #    Obtener ID de cliente en microservice-b y usarlo en microservice-a
  # ─────────────────────────────────────────────────────────────────────────────
  @smoke @id-transport
  Scenario: DEP-05 El folio generado por microservice-a identifica unívocamente el pago
    # Paso 1: obtener perfil de cliente (microservice-b)
    Given url customerProfileUrl
    And path '/api/customers/4544'
    When method GET
    Then status 200
    * def clienteTelefono = response.telefono
    * def clienteStatus   = response.status
    And match clienteStatus == 'ACTIVO'

    # Paso 2: registrar recarga con el teléfono obtenido del perfil
    Given url baseUrl
    And path '/api/pagos/registrar'
    And request
      """
      {
        "telefonoCliente": "#(clienteTelefono)",
        "monto": 50.00,
        "metodoPago": "TARJETA",
        "numeroOrden": "INT-TEST-001"
      }
      """
    When method POST
    Then status 201
    And match response.status      == 'APLICADO'
    And match response.folio       == '#regex B-[A-Z0-9]+'
    And match response.numeroOrden == 'INT-TEST-001'
    # Guardar folio para el siguiente paso
    * def folioGenerado = response.folio

    # Paso 3: emitir recibo usando el folio obtenido (encadenamiento de IDs)
    Given url baseUrl
    And path '/api/recibos/emitir'
    And param folio       = folioGenerado
    And param numeroOrden = 'INT-TEST-001'
    When method POST
    Then status 200
    And match response.status  == 'EMITIDO'
    And match response.url_pdf == '#string'

  # ─────────────────────────────────────────────────────────────────────────────
  # 4. PROPAGACIÓN DE ERRORES DEL SERVICIO EXTERNO
  # ─────────────────────────────────────────────────────────────────────────────
  @negative @dep-externo
  Scenario: DEP-06 microservice-a propaga error cuando cliente no existe en microservice-b
    Given url baseUrl
    And path '/api/clientes/buscar'
    And param telefono = '0000'
    When method GET
    Then status 404

  @negative @dep-externo
  Scenario: DEP-07 Pago rechazado cuando el cliente no existe en el sistema
    Given url baseUrl
    And path '/api/pagos/registrar'
    And request
      """
      {
        "telefonoCliente": "0000",
        "monto": 20.00,
        "metodoPago": "EFECTIVO",
        "numeroOrden": "INT-ERR-001"
      }
      """
    When method POST
    Then status 404

  # ─────────────────────────────────────────────────────────────────────────────
  # 5. VALIDACIÓN DE DISPONIBILIDAD DE SERVICIOS EXTERNOS (health checks)
  # ─────────────────────────────────────────────────────────────────────────────
  @smoke @health
  Scenario: DEP-08 microservice-a y microservice-b están disponibles y saludables
    # Health check microservice-a
    Given url baseUrl
    And path '/actuator/health'
    When method GET
    Then status 200
    And match response.status == 'UP'

    # Health check microservice-b
    Given url customerProfileUrl
    And path '/actuator/health'
    When method GET
    Then status 200
    And match response.status == 'UP'
