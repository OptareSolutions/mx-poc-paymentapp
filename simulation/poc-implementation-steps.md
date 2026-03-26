# Plan de Implementación: Flujo Recarga PaymentBox

El agente debe implementar los siguientes pasos de automatización en cada commit:

1. **Job: Build & Quality**
   - Ejecutar Gradle + SonarQube + Veracode (Pipeline Scan).
2. **Job: Integration (La Simulación)**
   - Levantar contenedor Docker con Base de Datos.
   - Ejecutar scripts JDBC para validar el Paso 3 (Montos) y Paso 5 (Métodos de Pago).
3. **Job: Functional E2E (Karate DSL)**
   - **Paso 2:** Validar búsqueda de cliente (API Robusta) usando Billy 1.
   - **Paso 4:** Validar integración con API Operador (via Mock).
   - **Paso 7/8:** Validar persistencia del pago y recibo.
4. **Job: UI Validation (Selenium)**
   - Validar Paso 1 (Menús visibles) en el entorno desplegado.