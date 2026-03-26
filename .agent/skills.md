# Skills: Ambiente de Desenvolvimento & Simulação

## Skill 1: Mocking de Microserviços (Efeito Dominó)
- Ao detetar uma alteração no "Microserviço A", o agente deve ser capaz de:
  - Criar um mock da API do Operador (Passo 4 do fluxo) usando **Prism CLI**.
  - Simular a API de Emissão de Recibo (Passo 8) para retornar PDFs sintéticos.

## Skill 2: Gestão de Repositórios GitHub
- Estruturar o repositório com:
  - `/app`: Código fonte do microserviço.
  - `/mocks`: Definições OpenAPI/Swagger para simulação.
  - `/.github/workflows`: Pipeline multi-stage (Build -> Contract -> Image -> E2E).

## Skill 3: Injeção de Dados Sintéticos (TDM)
- Implementar lógica de "Seeders": antes dos testes funcionais, o agente deve popular uma base de dados temporária (GitHub Services) com os perfis "Billy" definidos na reunião com a AT&T.

## Skill 4: Validação Multinível
- **Unitária:** JUnit + JaCoCo (Cobertura > 80%).
- **Contrato:** Pact (verificar se o Microserviço A quebrou o contrato com o BSS).
- **Funcional:** Karate DSL executando o fluxo de 8 passos.
- **UI:** Selenium Headless validando os menus de recarga.