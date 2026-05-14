@integracion @e2e @recarga
Feature: Flujo E2E de Recarga — Integración Completa entre Servicios
  Como agente de Telco Operator
  Quiero ejecutar el flujo completo de recarga encadenando todos los endpoints
  Para validar que la integración entre microservice-a, microservice-b y los mocks
  externos funciona correctamente de extremo a extremo

  # ─────────────────────────────────────────────────────────────────────────────
  # Nota de diseño:
  #   Este flujo encadena 8 pasos de negocio pasando IDs y tokens entre llamadas:
  #     Paso 2: Focalizar cliente (microservice-a → microservice-b)
  #     Paso 3: Selección de montos (microservice-a → DB)
  #     Paso 4: Validación con operador (microservice-a → mock operador)
  #     Paso 5: Métodos de pago (microservice-a)
  #     Pasos 6+7: Registrar pago con folio (microservice-a → DB)
  #     Paso 8: Emitir recibo usando folio (microservice-a → mock recibo)
  #
  #   Variables transportadas entre pasos:
  #     telefono_cliente → del perfil obtenido en paso 2
  #     folio            → generado en pasos 6+7, usado en paso 8
  # ─────────────────────────────────────────────────────────────────────────────

  Background:
    * url baseUrl
    * def operador       = 'BLUE'
    * def montoRecarga   = 20.00
    * def metodoPago     = 'EFECTIVO'
    * def numeroOrden    = 'E2E-INT-' + java.lang.System.currentTimeMillis()

  # ─────────────────────────────────────────────────────────────────────────────
  # FLUJO CRÍTICO COMPLETO — 8 pasos encadenados con transporte de IDs
  # ─────────────────────────────────────────────────────────────────────────────
  @smoke @critical-path @flujo-completo
  Scenario: REC-INT-01 Flujo E2E completo de recarga Billy 1 (8 pasos encadenados)

    # ── PASO 2: Focalizar cliente (microservice-a → microservice-b) ─────────────
    Given path '/api/clientes/buscar'
    And param telefono = '4544'
    When method GET
    Then status 200
    And match response.telefono == '4544'
    And match response.status   == 'ACTIVO'
    And match response.nombre == '#string'
    # Transportar teléfono al siguiente paso
    * def clienteTelefono = response.telefono
    * def clienteNombre   = response.nombre

    # ── PASO 3: Selección de monto desde DB ─────────────────────────────────────
    Given path '/api/recargas/montos'
    And param operador = operador
    When method GET
    Then status 200
    And match response == '#[_ > 0]'
    And match each response == { id: '#number', monto: '#number', operador: '#string' }
    # Verificar que el monto elegido existe en la BD
    * def montosDisponibles = $response[*].monto
    * assert karate.filter(montosDisponibles, function(m){ return m == montoRecarga }).length > 0

    # ── PASO 4: Validar con API Operador (mock externo) ──────────────────────────
    Given path '/api/recargas/validar-operador'
    And param telefono = clienteTelefono
    And param operador = operador
    When method POST
    Then status 200
    And match response.valido   == true
    And match response.operador == operador

    # ── PASO 5: Métodos de pago disponibles ─────────────────────────────────────
    Given path '/api/pagos/metodos'
    When method GET
    Then status 200
    And match response contains 'EFECTIVO'
    And match response contains 'TARJETA'

    # ── PASOS 6 + 7: Registrar pago y verificar persistencia ────────────────────
    Given path '/api/pagos/registrar'
    And request
      """
      {
        "telefonoCliente": "#(clienteTelefono)",
        "monto": #(montoRecarga),
        "metodoPago": "#(metodoPago)",
        "numeroOrden": "#(numeroOrden)"
      }
      """
    When method POST
    Then status 201
    And match response.status      == 'APLICADO'
    And match response.folio       == '#regex B-[A-Z0-9]+'
    And match response.numeroOrden == '#(numeroOrden)'
    And match response.mensaje     contains 'exitosamente'
    # Transportar folio al paso 8
    * def folioGenerado = response.folio

    # ── PASO 8: Emitir recibo usando folio obtenido ──────────────────────────────
    Given path '/api/recibos/emitir'
    And param folio       = folioGenerado
    And param numeroOrden = numeroOrden
    When method POST
    Then status 200
    And match response.status  == 'EMITIDO'
    And match response.url_pdf == '#string'

  # ─────────────────────────────────────────────────────────────────────────────
  # FLUJO COMPLETO — múltiples clientes (data-driven)
  # ─────────────────────────────────────────────────────────────────────────────
  @smoke @flujo-completo
  Scenario Outline: REC-INT-02 Flujo completo data-driven para cliente <nombre>

    # Paso 2: Focalizar
    Given path '/api/clientes/buscar'
    And param telefono = '<telefono>'
    When method GET
    Then status 200
    And match response.status == 'ACTIVO'
    * def tel = response.telefono

    # Paso 3: Montos
    Given path '/api/recargas/montos'
    And param operador = operador
    When method GET
    Then status 200
    And match response == '#[_ > 0]'

    # Pasos 6+7: Registrar pago
    Given path '/api/pagos/registrar'
    And request
      """
      {
        "telefonoCliente": "#(tel)",
        "monto": #(montoRecarga),
        "metodoPago": "#(metodoPago)",
        "numeroOrden": "DD-<telefono>-001"
      }
      """
    When method POST
    Then status 201
    And match response.status == 'APLICADO'
    * def folio = response.folio

    # Paso 8: Emitir recibo
    Given path '/api/recibos/emitir'
    And param folio       = folio
    And param numeroOrden = 'DD-<telefono>-001'
    When method POST
    Then status 200
    And match response.status == 'EMITIDO'

    Examples:
      | telefono | nombre  |
      | 4544     | Billy 1 |
      | 4545     | Billy 2 |
      | 4546     | Billy 3 |

  # ─────────────────────────────────────────────────────────────────────────────
  # FLUJO NEGATIVO — cliente inactivo/bloqueado no puede completar el flujo
  # ─────────────────────────────────────────────────────────────────────────────
  @negative
  Scenario Outline: REC-INT-03 Flujo bloqueado para cliente <tipo> (<telefono>)
    # Intentar focalizar un cliente no activo
    Given path '/api/clientes/buscar'
    And param telefono = '<telefono>'
    When method GET
    Then status 404

    # Verificar que el pago también falla para ese cliente
    Given path '/api/pagos/registrar'
    And request
      """
      {
        "telefonoCliente": "<telefono>",
        "monto": 20.00,
        "metodoPago": "EFECTIVO",
        "numeroOrden": "NEG-<telefono>-001"
      }
      """
    When method POST
    Then status 404

    Examples:
      | telefono | tipo      |
      | 4547     | INACTIVO  |
      | 4548     | BLOQUEADO |

  # ─────────────────────────────────────────────────────────────────────────────
  # FLUJO CON DIFERENTES MÉTODOS DE PAGO
  # ─────────────────────────────────────────────────────────────────────────────
  @smoke @metodos-pago
  Scenario Outline: REC-INT-04 Recarga exitosa con método de pago <metodo>

    Given path '/api/pagos/registrar'
    And request
      """
      {
        "telefonoCliente": "4544",
        "monto": 10.00,
        "metodoPago": "<metodo>",
        "numeroOrden": "MP-<metodo>-001"
      }
      """
    When method POST
    Then status 201
    And match response.status == 'APLICADO'
    And match response.folio  == '#regex B-[A-Z0-9]+'

    Examples:
      | metodo   |
      | EFECTIVO |
      | TARJETA  |
      | OODI     |

  # ─────────────────────────────────────────────────────────────────────────────
  # TRANSPORTE DE TOKEN ENTRE ETAPAS — folio como token de correlación
  # ─────────────────────────────────────────────────────────────────────────────
  @smoke @token-transport
  Scenario: REC-INT-05 Verificar unicidad del folio generado (no se repiten)
    # Registrar primera recarga
    Given path '/api/pagos/registrar'
    And request
      """
      {
        "telefonoCliente": "4544",
        "monto": 20.00,
        "metodoPago": "EFECTIVO",
        "numeroOrden": "UNIQ-001"
      }
      """
    When method POST
    Then status 201
    * def folio1 = response.folio

    # Registrar segunda recarga (diferente número de orden)
    Given path '/api/pagos/registrar'
    And request
      """
      {
        "telefonoCliente": "4545",
        "monto": 30.00,
        "metodoPago": "TARJETA",
        "numeroOrden": "UNIQ-002"
      }
      """
    When method POST
    Then status 201
    * def folio2 = response.folio

    # Los folios deben ser distintos
    * assert folio1 != folio2

    # Ambos recibos se emiten con sus respectivos folios
    Given path '/api/recibos/emitir'
    And param folio       = folio1
    And param numeroOrden = 'UNIQ-001'
    When method POST
    Then status 200
    And match response.status == 'EMITIDO'

    Given path '/api/recibos/emitir'
    And param folio       = folio2
    And param numeroOrden = 'UNIQ-002'
    When method POST
    Then status 200
    And match response.status == 'EMITIDO'

  # ─────────────────────────────────────────────────────────────────────────────
  # VALIDACIÓN DE OPERADOR EXTERNO — encadenamiento con mock externo
  # ─────────────────────────────────────────────────────────────────────────────
  @smoke @externo-operador
  Scenario: REC-INT-06 Validación de operador externo y uso en flujo de pago

    # Validar operador
    Given path '/api/recargas/validar-operador'
    And param telefono = '4544'
    And param operador = operador
    When method POST
    Then status 200
    And match response.valido   == true
    And match response.operador == '#string'
    * def operadorValidado = response.operador

    # Usar el operador validado en la consulta de montos
    Given path '/api/recargas/montos'
    And param operador = operadorValidado
    When method GET
    Then status 200
    And match response == '#[_ > 0]'

  @negative @externo-operador
  Scenario: REC-INT-07 Operador inexistente bloquea el flujo
    Given path '/api/recargas/montos'
    And param operador = 'OPERADOR_FALSO'
    When method GET
    Then status 404
