# Skills: Entorno de Desarrollo y Simulación

## Skill 1: Mocking de Microservicios (Efecto Dominó)
- Al detectar un cambio en el "Microservicio A", el agente debe ser capaz de:
  - Crear un mock de la API del Operador (Paso 4 del flujo) usando **Prism CLI**.
  - Simular la API de Emisión de Recibo (Paso 8) para retornar PDFs sintéticos.

## Skill 2: Gestión de Repositorios GitHub
- Estructurar el repositorio con:
  - `/app`: Código fuente del microservicio.
  - `/mocks`: Definiciones OpenAPI/Swagger para simulación.
  - `/.github/workflows`: Pipeline multi-stage (Build -> Contract -> Image -> E2E).

## Skill 3: Inyección de Datos Sintéticos (TDM)
- Implementar lógica de "Seeders": antes de los tests funcionales, el agente debe poblar una base de datos temporal (GitHub Services) con los perfiles "Billy" definidos en la reunión con Telco Operator.

## Skill 4: Validación Multinivel
- **Unitaria:** JUnit + JaCoCo (Cobertura > 80%).
- **Contrato:** Pact (verificar si el Microservicio A rompió el contrato con el BSS).
- **Funcional:** Karate DSL ejecutando el flujo de 8 pasos.
- **UI:** Selenium Headless validando los menús de recarga.