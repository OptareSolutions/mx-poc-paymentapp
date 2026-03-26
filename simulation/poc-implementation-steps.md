# Plano de Implementação: Fluxo Recarga PaymentBox

O agente deve implementar os seguintes passos de automação para cada commit:

1. **Job: Build & Quality**
   - Correr Gradle + SonarQube + Veracode (Pipeline Scan).
2. **Job: Integration (The Simulation)**
   - Levantar contentor Docker com Base de Dados.
   - Executar scripts JDBC para validar o Passo 3 (Montantes) e Passo 5 (Métodos de Pagamento).
3. **Job: Functional E2E (Karate DSL)**
   - **Passo 2:** Validar busca de cliente (API Robusta) usando Billy 1.
   - **Passo 4:** Validar integração com API Operador (via Mock).
   - **Passo 7/8:** Validar persistência do pago e recibo.
4. **Job: UI Validation (Selenium)**
   - Validar Passo 1 (Menus visíveis) no ambiente deployado.