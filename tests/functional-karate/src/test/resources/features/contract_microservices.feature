Feature: Contrato entre Microservicios — microservice-a consume microservice-b

  # ══════════════════════════════════════════════════════════════════════════
  # Este test valida el CONTRATO PÚBLICO de microservice-b (Customer Profile).
  #
  # ⚠️  DEMO BREAK 1 → falla aquí (Job 2) cuando un desarrollador renombra en
  #     microservice-b los campos del DTO:
  #       'telefono' → 'phone'
  #       'nombre'   → 'fullName'
  #
  # microservice-a depende de estos nombres exactos para deserializar la
  # respuesta de CustomerProfileClient.getCustomerProfile().
  # ══════════════════════════════════════════════════════════════════════════

  Background:
    * url customerProfileUrl

  Scenario: CONTRATO - Perfil Billy 1 debe contener campos 'telefono', 'nombre', 'status'
    Given path '/api/customers/4544'
    When method GET
    Then status 200
    And match response.telefono == '4544'
    And match response.nombre  == '#string'
    And match response.status  == '#string'

  Scenario: CONTRATO - Campo 'status' del perfil activo debe ser 'ACTIVO'
    Given path '/api/customers/4544'
    When method GET
    Then status 200
    And match response.status == 'ACTIVO'

  Scenario: CONTRATO - Cliente inexistente debe retornar 404
    Given path '/api/customers/0000'
    When method GET
    Then status 404
