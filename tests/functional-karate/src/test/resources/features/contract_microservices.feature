@contract
Feature: Contrato entre Microservicios - microservice-a consume microservice-b

  Background:
    * url customerProfileUrl

  @contract @demo-break
  Scenario Outline: CONTRATO - Perfil <nombre> contiene todos los campos requeridos
    Given path "/api/customers/<telefono>"
    When method GET
    Then status 200
    And match response.phone    == "<telefono>"
    And match response.fullName == "#string"
    And match response.status   == "#string"

    Examples:
      | telefono | nombre  |
      | 4544     | Billy 1 |
      | 4545     | Billy 2 |
      | 4546     | Billy 3 |

  @contract @smoke
  Scenario Outline: CONTRATO - Clientes activos tienen status ACTIVO
    Given path "/api/customers/<telefono>"
    When method GET
    Then status 200
    And match response.status == "ACTIVO"

    Examples:
      | telefono |
      | 4544     |
      | 4545     |
      | 4546     |

  @contract @negative
  Scenario: CONTRATO - Cliente inexistente debe retornar 404
    Given path "/api/customers/0000"
    When method GET
    Then status 404

  @contract @negative
  Scenario Outline: CONTRATO - Clientes no activos devuelven su status real
    Given path "/api/customers/<telefono>"
    When method GET
    Then status 200
    And match response.status == "<status>"

    Examples:
      | telefono | status    |
      | 4547     | INACTIVO  |
      | 4548     | BLOQUEADO |
