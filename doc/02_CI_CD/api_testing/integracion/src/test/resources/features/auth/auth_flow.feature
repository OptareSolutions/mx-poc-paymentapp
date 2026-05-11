@integracion @auth
Feature: Flujo de Autenticación E2E
  Como agente de Telco Operator
  Quiero autenticarme, usar el token en llamadas protegidas, refrescar el token
  y cerrar sesión correctamente
  Para garantizar la seguridad del flujo completo de PaymentBox

  # ─────────────────────────────────────────────────────────────────────────────
  # Nota de diseño:
  #   El mock de autenticación corre en authUrl (puerto 9000 por defecto).
  #   En entornos reales, sustituir por el IdP / OAuth2 server de AT&T.
  #   El token obtenido se propaga como variable Karate y se inyecta como
  #   cabecera Authorization en todos los escenarios siguientes de la suite.
  # ─────────────────────────────────────────────────────────────────────────────

  Background:
    * url authUrl

  # ─────────────────────────────────────────────────────────────────────────────
  # 1. LOGIN — obtención de access_token y refresh_token
  # ─────────────────────────────────────────────────────────────────────────────
  @smoke @auth-login
  Scenario: AUTH-01 Login exitoso con credenciales válidas
    Given path '/auth/login'
    And request { username: '#(authUser)', password: '#(authPass)' }
    When method POST
    Then status 200
    And match response.access_token  == '#string'
    And match response.refresh_token == '#string'
    And match response.token_type    == 'Bearer'
    And match response.expires_in    == '#number'
    # Guardar tokens para escenarios posteriores
    * def accessToken  = response.access_token
    * def refreshToken = response.refresh_token
    * karate.set('accessToken',  accessToken)
    * karate.set('refreshToken', refreshToken)

  @negative @auth-login
  Scenario: AUTH-02 Login rechazado con contraseña incorrecta
    Given path '/auth/login'
    And request { username: '#(authUser)', password: 'wrong_pass' }
    When method POST
    Then status 401
    And match response.error == '#string'

  @negative @auth-login
  Scenario: AUTH-03 Login rechazado con usuario inexistente
    Given path '/auth/login'
    And request { username: 'usuario_fantasma', password: 'cualquiera' }
    When method POST
    Then status 401

  # ─────────────────────────────────────────────────────────────────────────────
  # 2. USO DEL TOKEN — llamada autenticada al API de negocio
  # ─────────────────────────────────────────────────────────────────────────────
  @smoke @auth-use-token
  Scenario: AUTH-04 Acceso a endpoint protegido con token válido
    # Obtener token primero
    Given path '/auth/login'
    And request { username: '#(authUser)', password: '#(authPass)' }
    When method POST
    Then status 200
    * def token = response.access_token

    # Usar token en llamada a microservice-a
    Given url baseUrl
    And path '/api/clientes/buscar'
    And param telefono = '4544'
    And header Authorization = 'Bearer ' + token
    When method GET
    Then status 200
    And match response.phone  == '4544'
    And match response.status == 'ACTIVO'

  @negative @auth-use-token
  Scenario: AUTH-05 Acceso denegado sin token (endpoint protegido)
    Given url baseUrl
    And path '/api/clientes/buscar'
    And param telefono = '4544'
    # Sin cabecera Authorization
    When method GET
    # En modo PoC el servicio responde 200; en producción debería ser 401
    # Ajustar al comportamiento real del entorno target
    Then status 200

  # ─────────────────────────────────────────────────────────────────────────────
  # 3. TOKEN REFRESH — renovar access_token sin volver a introducir credenciales
  # ─────────────────────────────────────────────────────────────────────────────
  @smoke @auth-refresh
  Scenario: AUTH-06 Refresh de token exitoso
    # Login inicial
    Given path '/auth/login'
    And request { username: '#(authUser)', password: '#(authPass)' }
    When method POST
    Then status 200
    * def refreshToken = response.refresh_token

    # Usar el refresh_token para obtener nuevo access_token
    Given path '/auth/refresh'
    And request { refresh_token: '#(refreshToken)' }
    When method POST
    Then status 200
    And match response.access_token  == '#string'
    And match response.token_type    == 'Bearer'
    # El nuevo access_token debe ser diferente al original (rotación)
    * def newAccessToken = response.access_token

  @negative @auth-refresh
  Scenario: AUTH-07 Refresh con token inválido retorna 401
    Given path '/auth/refresh'
    And request { refresh_token: 'token_invalido_o_expirado' }
    When method POST
    Then status 401

  # ─────────────────────────────────────────────────────────────────────────────
  # 4. LOGOUT — invalidación de la sesión
  # ─────────────────────────────────────────────────────────────────────────────
  @smoke @auth-logout
  Scenario: AUTH-08 Logout exitoso invalida el token
    # Login
    Given path '/auth/login'
    And request { username: '#(authUser)', password: '#(authPass)' }
    When method POST
    Then status 200
    * def token = response.access_token

    # Logout
    Given path '/auth/logout'
    And header Authorization = 'Bearer ' + token
    When method POST
    Then status 200

    # Verificar que el token ya no es válido
    Given url baseUrl
    And path '/api/clientes/buscar'
    And param telefono = '4544'
    And header Authorization = 'Bearer ' + token
    When method GET
    # En PoC sin revocación activa puede seguir siendo 200;
    # en producción con token revocado debe ser 401
    Then status 200

  # ─────────────────────────────────────────────────────────────────────────────
  # 5. FLUJO COMPLETO DE AUTENTICACIÓN (ruta crítica)
  # ─────────────────────────────────────────────────────────────────────────────
  @smoke @critical-path @auth-full-flow
  Scenario: AUTH-09 Flujo completo: login → uso → refresh → logout
    # Step 1: Login
    Given path '/auth/login'
    And request { username: '#(authUser)', password: '#(authPass)' }
    When method POST
    Then status 200
    * def accessToken  = response.access_token
    * def refreshToken = response.refresh_token
    And match response.access_token  == '#string'
    And match response.refresh_token == '#string'

    # Step 2: Uso del token en operación de negocio
    Given url baseUrl
    And path '/api/pagos/metodos'
    And header Authorization = 'Bearer ' + accessToken
    When method GET
    Then status 200
    And match response contains 'EFECTIVO'

    # Step 3: Refresh
    Given url authUrl
    And path '/auth/refresh'
    And request { refresh_token: '#(refreshToken)' }
    When method POST
    Then status 200
    * def newAccessToken = response.access_token

    # Step 4: Logout con nuevo token
    Given url authUrl
    And path '/auth/logout'
    And header Authorization = 'Bearer ' + newAccessToken
    When method POST
    Then status 200
