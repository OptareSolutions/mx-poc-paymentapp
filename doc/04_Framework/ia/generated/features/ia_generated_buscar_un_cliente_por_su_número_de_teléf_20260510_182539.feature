@ia-generated
Feature: Buscar un cliente por su número de teléfono - Generado por IA
  # Historia: Como agente de Telco Operator quiero buscar un cliente por su número de teléfono para verificar que está activo antes de procesar una recarga
  # Generado: 2026-05-10T18:25:39.522248 | Modo: template

  Background:
    * url baseUrl
    * def telefonoBilly1 = '4544'
    * def telefonoBilly2 = '4545'
    * def telefonoInactivo = '4547'
    * def telefonoBloqueado = '4548'
    * def operador = 'BLUE'
    * def montoValido = 50.00
    * def montoInvalido = 5.00

  @smoke @positive
  Scenario Outline: Buscar cliente activo por teléfono - caso exitoso
    Given path '/api/clientes/buscar'
    And param telefono = '<telefono>'
    When method GET
    Then status 200
    And match response.phone == '<telefono>'
    And match response.status == 'ACTIVO'
    And match response.fullName == '#string'

    Examples:
      | telefono |
      | 4544 |
      | 4545 |
      | 4546 |

  @negative
  Scenario: Buscar cliente inexistente retorna 404
    Given path '/api/clientes/buscar'
    And param telefono = '9999'
    When method GET
    Then status 404

  @negative
  Scenario: Buscar cliente inactivo retorna error de negocio
    Given path '/api/clientes/buscar'
    And param telefono = telefonoInactivo
    When method GET
    Then status 404
    # Cliente INACTIVO no puede realizar recargas

  @negative
  Scenario: Buscar cliente bloqueado retorna error de negocio
    Given path '/api/clientes/buscar'
    And param telefono = telefonoBloqueado
    When method GET
    Then status 404
    # Cliente BLOQUEADO no puede realizar recargas

  @edge
  Scenario: Buscar cliente con teléfono vacío retorna 400
    Given path '/api/clientes/buscar'
    And param telefono = ''
    When method GET
    Then status 400

  @smoke @positive
  Scenario: Registrar recarga con datos válidos
    Given path '/api/pagos/registrar'
    And request { telefono: '#(telefonoBilly1)', monto: #(montoValido), operador: '#(operador)', metodoPago: 'EFECTIVO' }
    When method POST
    Then status 201
    And match response.status == 'PENDIENTE'
    And match response.id == '#number'
    And match response.folio == '#string'

  @negative
  Scenario: Registrar recarga con monto fuera de rango retorna 400
    Given path '/api/pagos/registrar'
    And request { telefono: '#(telefonoBilly1)', monto: #(montoInvalido), operador: '#(operador)', metodoPago: 'EFECTIVO' }
    When method POST
    Then status 400
    And match response.error == '#string'

  @negative
  Scenario: Registrar recarga para cliente inexistente retorna 404
    Given path '/api/pagos/registrar'
    And request { telefono: '0000', monto: #(montoValido), operador: '#(operador)', metodoPago: 'EFECTIVO' }
    When method POST
    Then status 404

  @smoke @positive
  Scenario: Listar montos de recarga disponibles para operador BLUE
    Given path '/api/recargas/montos'
    And param operador = operador
    When method GET
    Then status 200
    And match response == '#[_ > 0]'
    And match each response == { id: '#number', monto: '#number', operador: '#string' }

  @edge
  Scenario: Listar montos para operador desconocido retorna vacío
    Given path '/api/recargas/montos'
    And param operador = 'INEXISTENTE'
    When method GET
    Then status 404
