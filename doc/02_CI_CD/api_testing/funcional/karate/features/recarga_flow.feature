@e2e
Feature: Recarga PaymentBox - Flujo Completo (8 Pasos)
  Como agente de Telco Operator
  Quiero procesar una recarga completa en PaymentBox
  Para validar el ciclo end-to-end sin intervención manual

  Background:
    * url baseUrl
    * def telefonoBilly1 = '4544'
    * def operador = 'BLUE'
    * def montoRecarga = 20.00
    * def metodoPago = 'EFECTIVO'
    * def numeroOrden = '111816681'

  # ─────────────────────────────────────────────────────────────────────────────
  # PASO 2: Focalizar Cliente — clientes activos (data-driven)
  # ─────────────────────────────────────────────────────────────────────────────
  @smoke @paso2
  Scenario Outline: Paso 2 - Focalizar cliente activo <nombre>
    Given path '/api/clientes/buscar'
    And param telefono = '<telefono>'
    When method GET
    Then status 200
    And match response.telefono == '<telefono>'
    And match response.status == 'ACTIVO'
    And match response.nombre contains 'Billy'

    Examples:
      | telefono | nombre   |
      | 4544     | Billy 1  |
      | 4545     | Billy 2  |
      | 4546     | Billy 3  |

  # ─────────────────────────────────────────────────────────────────────────────
  # PASO 2: Clientes negativos — inactivo y bloqueado
  # ─────────────────────────────────────────────────────────────────────────────
  @negative @paso2
  Scenario Outline: Paso 2 - Cliente no activo retorna 404 (<nombre>)
    Given path '/api/clientes/buscar'
    And param telefono = '<telefono>'
    When method GET
    Then status 404

    Examples:
      | telefono | nombre           |
      | 4547     | Billy 4 INACTIVO |
      | 4548     | Billy 5 BLOQUEADO|

  # ─────────────────────────────────────────────────────────────────────────────
  # PASO 3: Selección de Monto (validado con DB)
  # ─────────────────────────────────────────────────────────────────────────────
  @smoke @paso3
  Scenario: Paso 3 - Obtener montos de recarga desde DB para operador BLUE
    Given path '/api/recargas/montos'
    And param operador = operador
    When method GET
    Then status 200
    And match response == '#[_ > 0]'
    And match each response == { id: '#number', monto: '#number', operador: '#string' }
    # Validar que el monto $20 del UI existe en la DB
    * def montos = $response[*].monto
    * assert karate.filter(montos, function(m){ return m == montoRecarga }).length > 0

  @negative @paso3
  Scenario: Paso 3 - Operador inexistente retorna lista vacía o 404
    Given path '/api/recargas/montos'
    And param operador = 'OPERADOR_INEXISTENTE'
    When method GET
    Then status 404

  # ─────────────────────────────────────────────────────────────────────────────
  # PASO 4: Validar API Operador (Contrato via Prism Mock)
  # ─────────────────────────────────────────────────────────────────────────────
  @smoke @paso4
  Scenario: Paso 4 - Validar contrato API Operador via Mock Prism
    Given path '/api/recargas/validar-operador'
    And param telefono = telefonoBilly1
    And param operador = operador
    When method POST
    Then status 200
    And match response.valido == true
    And match response.operador == operador

  # ─────────────────────────────────────────────────────────────────────────────
  # PASO 5: Métodos de Pago disponibles
  # ─────────────────────────────────────────────────────────────────────────────
  @smoke @paso5
  Scenario: Paso 5 - Verificar métodos de pago disponibles en PaymentBox
    Given path '/api/pagos/metodos'
    When method GET
    Then status 200
    And match response contains 'TARJETA'
    And match response contains 'EFECTIVO'
    And match response contains 'OODI'

  # ─────────────────────────────────────────────────────────────────────────────
  # PASOS 6 & 7: Registrar Pago + Persistencia en DB (Ambiente A)
  # ─────────────────────────────────────────────────────────────────────────────
  @smoke @paso6 @paso7
  Scenario: Pasos 6 y 7 - Registrar pago y verificar persistencia
    Given path '/api/pagos/registrar'
    And request { telefonoCliente: '#(telefonoBilly1)', monto: #(montoRecarga), metodoPago: '#(metodoPago)', numeroOrden: '#(numeroOrden)' }
    When method POST
    Then status 201
    And match response.status == 'APLICADO'
    And match response.folio == '#regex B-[A-Z0-9]+'
    And match response.numeroOrden == numeroOrden
    And match response.mensaje contains 'exitosamente'
    * def folioGenerado = response.folio

  @negative @paso6
  Scenario: Paso 6 - Cliente inexistente no puede pagar
    Given path '/api/pagos/registrar'
    And request { telefonoCliente: '9999', monto: 20.00, metodoPago: 'EFECTIVO', numeroOrden: '000000000' }
    When method POST
    Then status 404

  # ─────────────────────────────────────────────────────────────────────────────
  # PASO 8: Emitir Recibo (via Prism Mock)
  # ─────────────────────────────────────────────────────────────────────────────
  @smoke @paso8
  Scenario: Paso 8 - Emitir recibo PDF via API Mock (Prism)
    Given path '/api/pagos/registrar'
    And request { telefonoCliente: '#(telefonoBilly1)', monto: #(montoRecarga), metodoPago: '#(metodoPago)', numeroOrden: '#(numeroOrden)' }
    When method POST
    Then status 201
    * def folio = response.folio

    Given path '/api/recibos/emitir'
    And param folio = folio
    And param numeroOrden = numeroOrden
    When method POST
    Then status 200
    And match response.status == 'EMITIDO'
    And match response.url_pdf == '#string'

  # ─────────────────────────────────────────────────────────────────────────────
  # FLUJO COMPLETO (Ruta Crítica): Pasos 2 → 3 → 4 → 5 → 7 → 8
  # ─────────────────────────────────────────────────────────────────────────────
  @smoke @critical-path
  Scenario: Ruta Crítica - Flujo completo de recarga Billy 1
    # Paso 2
    Given path '/api/clientes/buscar'
    And param telefono = telefonoBilly1
    When method GET
    Then status 200
    And match response.status == 'ACTIVO'

    # Paso 3
    Given path '/api/recargas/montos'
    And param operador = operador
    When method GET
    Then status 200
    And assert response.length > 0

    # Paso 4
    Given path '/api/recargas/validar-operador'
    And param telefono = telefonoBilly1
    And param operador = operador
    When method POST
    Then status 200

    # Paso 5
    Given path '/api/pagos/metodos'
    When method GET
    Then status 200

    # Pasos 6 & 7
    Given path '/api/pagos/registrar'
    And request { telefonoCliente: '#(telefonoBilly1)', monto: #(montoRecarga), metodoPago: '#(metodoPago)', numeroOrden: '#(numeroOrden)' }
    When method POST
    Then status 201
    * def folio = response.folio

    # Paso 8
    Given path '/api/recibos/emitir'
    And param folio = folio
    And param numeroOrden = numeroOrden
    When method POST
    Then status 200
    And match response.status == 'EMITIDO'

  # ─────────────────────────────────────────────────────────────────────────────
  # PASO 3: Selección de Monto (validado con DB)
  # ─────────────────────────────────────────────────────────────────────────────
  Scenario: Paso 3 - Obtener montos de recarga desde DB para operador BLUE
    Given path '/api/recargas/montos'
    And param operador = operador
    When method GET
    Then status 200
    And match response == '#[_ > 0]'
    And match each response == { id: '#number', monto: '#number', operador: '#string' }
    # Validar que el monto $20 del UI existe en la DB
    * def montos = $response[*].monto
    * assert karate.filter(montos, function(m){ return m == montoRecarga }).length > 0

  # ─────────────────────────────────────────────────────────────────────────────
  # PASO 4: Validar API Operador (Contrato via Prism Mock)
  # ─────────────────────────────────────────────────────────────────────────────
  Scenario: Paso 4 - Validar contrato API Operador via Mock Prism
    Given path '/api/recargas/validar-operador'
    And param telefono = telefonoBilly1
    And param operador = operador
    When method POST
    Then status 200
    And match response.valido == true
    And match response.operador == operador

  # ─────────────────────────────────────────────────────────────────────────────
  # PASO 5: Métodos de Pago disponibles
  # ─────────────────────────────────────────────────────────────────────────────
  Scenario: Paso 5 - Verificar métodos de pago disponibles en PaymentBox
    Given path '/api/pagos/metodos'
    When method GET
    Then status 200
    And match response contains 'TARJETA'
    And match response contains 'EFECTIVO'
    And match response contains 'OODI'

  # ─────────────────────────────────────────────────────────────────────────────
  # PASOS 6 & 7: Registrar Pago + Persistencia en DB (Ambiente A)
  # ─────────────────────────────────────────────────────────────────────────────
  Scenario: Pasos 6 y 7 - Registrar pago y verificar persistencia
    Given path '/api/pagos/registrar'
    And request { telefonoCliente: '#(telefonoBilly1)', monto: #(montoRecarga), metodoPago: '#(metodoPago)', numeroOrden: '#(numeroOrden)' }
    When method POST
    Then status 201
    And match response.status == 'APLICADO'
    And match response.folio == '#regex B-[A-Z0-9]+'
    And match response.numeroOrden == numeroOrden
    And match response.mensaje contains 'exitosamente'
    # Guardar folio para el Paso 8
    * def folioGenerado = response.folio

  # ─────────────────────────────────────────────────────────────────────────────
  # PASO 8: Emitir Recibo (via Prism Mock)
  # ─────────────────────────────────────────────────────────────────────────────
  Scenario: Paso 8 - Emitir recibo PDF via API Mock (Prism)
    # Registrar pago primero para obtener folio real
    Given path '/api/pagos/registrar'
    And request { telefonoCliente: '#(telefonoBilly1)', monto: #(montoRecarga), metodoPago: '#(metodoPago)', numeroOrden: '#(numeroOrden)' }
    When method POST
    Then status 201
    * def folio = response.folio

    # Ahora emitir el recibo con ese folio
    Given path '/api/recibos/emitir'
    And param folio = folio
    And param numeroOrden = numeroOrden
    When method POST
    Then status 200
    And match response.status == 'EMITIDO'
    And match response.url_pdf == '#string'

  # ─────────────────────────────────────────────────────────────────────────────
  # FLUJO COMPLETO (Ruta Crítica): Pasos 2 → 3 → 4 → 5 → 7 → 8
  # ─────────────────────────────────────────────────────────────────────────────
  Scenario: Ruta Crítica - Flujo completo de recarga Billy 1
    # Paso 2
    Given path '/api/clientes/buscar'
    And param telefono = telefonoBilly1
    When method GET
    Then status 200
    And match response.status == 'ACTIVO'

    # Paso 3
    Given path '/api/recargas/montos'
    And param operador = operador
    When method GET
    Then status 200
    And assert response.length > 0

    # Paso 4
    Given path '/api/recargas/validar-operador'
    And param telefono = telefonoBilly1
    And param operador = operador
    When method POST
    Then status 200
    And match response.valido == true

    # Paso 5
    Given path '/api/pagos/metodos'
    When method GET
    Then status 200
    And match response contains metodoPago

    # Pasos 6 & 7
    Given path '/api/pagos/registrar'
    And request { telefonoCliente: '#(telefonoBilly1)', monto: #(montoRecarga), metodoPago: '#(metodoPago)', numeroOrden: '#(numeroOrden)' }
    When method POST
    Then status 201
    And match response.status == 'APLICADO'
    * def folioFinal = response.folio

    # Paso 8
    Given path '/api/recibos/emitir'
    And param folio = folioFinal
    And param numeroOrden = numeroOrden
    When method POST
    Then status 200
    And match response.status == 'EMITIDO'
