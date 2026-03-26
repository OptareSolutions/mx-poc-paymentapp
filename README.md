# AT&T PaymentBox — PoC de Qualidade Declarativa

> **Optare Solutions** para AT&T | Arquitecto: QE & DevSecOps  
> Validado com: Evelyn Pineda & Billy Cortes

[![Pipeline Status](../../actions/workflows/pipeline.yml/badge.svg)](../../actions/workflows/pipeline.yml)

---

## Objectivo

Demonstrar que **uma alteração no Microserviço A desencadeia automaticamente um ciclo completo de validação** sem intervenção humana (UAT manual eliminado), cobrindo os 8 passos do fluxo "Recarga por PaymentBox".

---

## Fluxo de 8 Passos Automatizado

| Passo | Tipo | Ferramenta | Descrição |
|-------|------|-----------|-----------|
| **1** | UI | Selenium Headless | Menus de Recarga visíveis |
| **2** | API | Karate DSL | Focalizar Cliente (Billy 1 — `tel: 4544`) |
| **3** | UI/DB | Karate DSL + SQL | Selecionar Montante (consistência DB) |
| **4** | Mock/Contrato | Prism CLI | API Operador BLUE (validação de contrato) |
| **5** | UI | Selenium Headless | Selecionar Método de Pagamento |
| **6** | Performance | k6 Smoke Test | Rota Crítica — thresholds p95 < 2s |
| **7** | DB | Karate DSL | Persistência do pagamento no Ambiente A |
| **8** | Mock/API | Prism CLI | Emissão do recibo (PDF sintético) |

---

## Estrutura do Repositório

```
att-poc-paymentbox/
├── .github/workflows/
│   └── pipeline.yml          # Pipeline declarativo de 4 estágios
├── microservice-a/
│   ├── src/
│   │   ├── main/java/        # Spring Boot (controller, service, model)
│   │   ├── test/java/        # JUnit 5 + Mockito (cobertura ≥ 80%)
│   │   ├── main/resources/
│   │   │   └── application.yml
│   │   └── Dockerfile        # Multi-stage (gradle build → JRE alpine)
│   ├── build.gradle          # Gradle + JaCoCo
│   └── settings.gradle
├── simulation/
│   ├── docker-compose.yml    # Ambiente A completo (4 serviços)
│   ├── prism-mocks/
│   │   ├── operador.yaml     # OpenAPI mock — Passo 4
│   │   └── recibo.yaml       # OpenAPI mock — Passo 8
│   └── tdm-seeders/
│       ├── 01_schema.sql     # Schema da BD simulada
│       └── 02_billy_profiles.sql  # Perfis Billy 1-5 (dados sintéticos)
└── tests/
    ├── functional-karate/    # Karate DSL — passos 2, 3, 4, 5, 7, 8
    │   └── src/test/resources/features/recarga_flow.feature
    ├── ui-selenium/          # Selenium Headless — passos 1, 3, 5
    │   └── src/test/java/.../RecargaUiTest.java
    └── k6/
        └── smoke_recarga.js  # Performance Smoke — Passo 6 (rota crítica)
```

---

## Pipeline GitHub Actions (4 Estágios)

```
Push/PR
  │
  ▼
┌─────────────────────────────────┐
│  1 · Build & Quality (Shift-Left)│  ← JUnit + JaCoCo (≥80%) + SAST simulado
└────────────────┬────────────────┘
                 │ needs
                 ▼
┌─────────────────────────────────┐
│  2 · Integration & Contract     │  ← TDM Seed + Prism mock validation
└────────────────┬────────────────┘
                 │ needs
                 ▼
┌─────────────────────────────────┐
│  3 · Image Ops                  │  ← Docker Build + Push para GHCR
└────────────────┬────────────────┘
                 │ needs
                 ▼
┌─────────────────────────────────┐
│  4 · Functional E2E & Deploy    │  ← Karate + Selenium + k6 Smoke
└─────────────────────────────────┘
```

**Artefactos publicados por cada run:**
- `unit-test-results` — relatórios JUnit + JaCoCo HTML
- `karate-report` — resultados Karate DSL
- `selenium-report` — resultados Selenium
- `k6-smoke-results` — sumário JSON do teste de performance

---

## Como Testar no GitHub

### 1. Criar repositório e fazer push

```bash
# Dentro da pasta att-poc-paymentbox/
git init
git add .
git commit -m "feat: PoC AT&T PaymentBox - Fluxo 8 passos automatizado"
git branch -M main
git remote add origin https://github.com/<SEU-USER>/att-poc-paymentbox.git
git push -u origin main
```

### 2. Verificar o pipeline

1. Ir a **Actions** no repositório GitHub
2. Clicar no workflow **"AT&T PaymentBox - Pipeline Declarativo PoC"**
3. Cada push dispara os 4 estágios automaticamente

### 3. Ver artefactos

Após cada run, descarregar os relatórios em **Actions → run → Artifacts**.

---

## Testar Localmente (Ambiente A Completo)

```bash
# 1. Subir o Ambiente A simulado
cd simulation
docker compose up -d --wait
docker compose ps   # todos os serviços devem estar "healthy"

# 2. Testar a API via Swagger
open http://localhost:8080/swagger-ui.html

# 3. Correr testes Karate
cd tests/functional-karate
mvn test

# 4. Correr testes Selenium (headless)
cd tests/ui-selenium
mvn test -Dapp.url=http://localhost:8080

# 5. Correr smoke test k6 (requer k6 instalado)
k6 run --env BASE_URL=http://localhost:8080 tests/k6/smoke_recarga.js

# 6. Parar o ambiente
cd simulation && docker compose down -v
```

---

## Dados Sintéticos (TDM)

| Perfil | Telefone | Status | Uso |
|--------|----------|--------|-----|
| Billy 1 - Cortes | `4544` | ACTIVO | Cenário principal |
| Billy 2 - Cortes | `4545` | ACTIVO | Cenários alternativos |
| Billy 3 - Cortes | `4546` | ACTIVO | Cenários alternativos |
| Billy 4 - Pineda | `4547` | INACTIVO | Teste negativo |
| Billy 5 - Bloqueado | `4548` | BLOQUEADO | Teste negativo |

---

## DORA Metrics — Objectivos desta PoC

| Métrica | Objectivo | Mecanismo |
|---------|----------|-----------|
| **Deployment Frequency** | Cada push | Pipeline automático on push |
| **Lead Time for Changes** | < 10 min pipeline | Jobs paralelos onde possível |
| **Change Failure Rate** | < 1% | JaCoCo ≥80% + Karate E2E + k6 threshold |
| **MTTR** | Automático | Rollback via `docker compose down -v` |
