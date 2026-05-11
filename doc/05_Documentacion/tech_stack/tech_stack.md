# Tech Stack — PoC AT&T Quality Assurance

> **Cliente:** AT&T (Telco Operator)  
> **Proyecto:** PaymentBox — PoC de Calidad Declarativa  
> **Versión:** 1.0  
> **Fecha:** Mayo 2026  
> **Autor:** Optare Solutions — QE & DevSecOps

---

## Escenario 1 — RPA (Automatización Web)

| Herramienta | Versión | Rol | Justificación |
|------------|---------|-----|---------------|
| **Selenium WebDriver** | 4.x (Headless) | Automatización de UI (Pasos 1, 3, 5) | Estándar de facto para RPA web; sin coste de licencia; integración nativa con JUnit 5 y Maven |
| **Java** | 17 (Temurin) | Lenguaje de los scripts Selenium | Madurez del ecosistema, soporte LTS, compatibilidad con Spring Boot |
| **Maven** | 3.9+ | Gestión de dependencias y ejecución | Estándar en proyectos Java enterprise; integración con GitHub Actions |
| **JUnit 5** | 5.10 | Framework de tests para Selenium | Parallel execution, extensions, parametrized tests; integración JaCoCo |

### Flujo RPA en el PoC

```
Paso 1: Selenium abre http://localhost:4200 → valida menú Recarga visible
Paso 3: Selenium selecciona monto coherente con BD (validación cruzada)
Paso 5: Selenium selecciona método de pago en el formulario UI
```

### RPA en CI/CD Pipeline

El pipeline incluye un job `rpa-ci` que lanza Selenium headless en el runner `ubuntu-latest`:

```yaml
rpa-ci:
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-java@v4
      with: { java-version: '17', distribution: temurin }
    - run: |
        cd tests/ui-selenium
        mvn test -Dapp.url=http://localhost:8080 --no-transfer-progress
```

---

## Escenario 2 — CI/CD

### 2.1 Pipeline & Orquestación

| Herramienta | Versión | Rol | Justificación |
|------------|---------|-----|---------------|
| **GitHub Actions** | — | Orquestador CI/CD | Integración nativa con el repositorio; runners gestionados; soporte path triggers; sin infraestructura adicional |
| **Docker** | 24+ | Build y packaging de microservicios | Portabilidad total entre entornos; multi-stage builds reducen tamaño de imagen (Builder → JRE Alpine) |
| **GHCR** (GitHub Container Registry) | — | Registro de imágenes Docker | Integrado con GitHub; permisos OIDC automáticos; sin coste adicional en plan actual |
| **Kustomize** | 5.x | Gestión de manifiestos K8s por entorno | Overlays sin duplicación YAML; etiquetas de imagen actualizadas por pipeline |
| **ArgoCD** | sim. | GitOps sync (simulado en PoC) | Representación del modelo objetivo; manifiestos como fuente de verdad |

### 2.2 API Testing

| Herramienta | Versión | Rol | Justificación |
|------------|---------|-----|---------------|
| **Karate DSL** | 1.4+ | Pruebas funcionales, integración y contrato de APIs | Sintaxis BDD sin código Java; reportes HTML nativos; soporte OpenAPI/Swagger; ejecuta SQL para validar persistencia |
| **Prism CLI** | 4.x | Mock server OpenAPI (Pasos 4 y 8) | Genera mocks fieles al contrato OpenAPI; sin código de implementación; detecta desviaciones en tiempo real |
| **Prism Contract Validation** | 4.x | Validación de contratos (DEMO BREAK 1) | Compara respuesta real vs especificación OpenAPI; falla en campo renombrado; integrado en pipeline |
| **Maven** | 3.9+ | Ejecución de tests Karate | Estándar del ecosistema; integración con JaCoCo y SonarCloud |

#### Tipos de pruebas API en el pipeline

| Tipo | Descripción | Herramienta | Cuándo se ejecuta |
|------|-------------|-------------|-------------------|
| **Funcional (Smoke)** | Valida endpoints críticos: códigos HTTP esperados, body cuando aplica | Karate DSL | Job 4 — cada push |
| **Integración E2E** | Flujo completo de 8 pasos; transporta IDs entre respuestas; valida persistencia en BD | Karate DSL + SQL | Job 4 (msvc-a) + Job 2 integración |
| **Contrato** | Detecta breaking changes comparando respuesta real vs OpenAPI spec | Karate DSL + Prism | Job 1 pipeline-integration |

### 2.3 Performance (Smoke en CI)

| Herramienta | Versión | Rol | Justificación |
|------------|---------|-----|---------------|
| **k6** | 0.46+ | Smoke performance en CI (Paso 6) | Scripting en JavaScript moderno; umbrales integrados; salida JSON/CSV para comparaciones |
| **k6 Cloud / k6 OSS** | — | Ejecución en pipeline y local | Sin dependencias externas; compatible con `ubuntu-latest` runners |

#### Configuración del smoke test CI

| Parámetro | Valor |
|-----------|-------|
| Duración | 5–10 min |
| Usuarios virtuales | 20 |
| Think time | 1–3 s entre pasos |
| Datos de prueba | Parametrizados (perfiles Billy) |
| Threshold: flujo p95 | < 3 s |
| Threshold: error rate | < 1 % |
| Threshold: login p95 | < 700 ms |
| Threshold: consulta p95 | < 900 ms |
| Threshold: actualización p95 | < 1200 ms |

### 2.4 Calidad de Código

| Herramienta | Versión | Rol | Justificación |
|------------|---------|-----|---------------|
| **JaCoCo** | 0.8.11 | Cobertura de código (gate ≥ 80 %) | Standard de facto en proyectos Java; integración nativa Gradle; reportes XML para SonarCloud |
| **SonarCloud** | — | Análisis estático de código | Detección de bugs, code smells, security hotspots; dashboard centralizado; comentarios en PRs |
| **Trivy** | latest | Análisis de seguridad (FS + imagen) | Detecta CVEs en dependencias y capas Docker; BLOQUEANTE para CRITICAL+HIGH; sin licencia |

### 2.5 Quality Gates

```
Build & Test  →  JUnit pass + JaCoCo ≥ 80 %  →  ❌ BLOQUEA si no cumple
Security      →  Trivy 0 CRITICAL/HIGH        →  ❌ BLOQUEA si vulnerabilidades
Image         →  Trivy image scan pass         →  ❌ BLOQUEA si CVEs en imagen
E2E           →  Karate 8 pasos verdes         →  ❌ GitOps NO actualiza si falla
Contrato      →  Prism/Karate sin breaking     →  ❌ Promoción BLOQUEADA si falla
Performance   →  k6 umbrales p95 < 3s         →  ❌ BLOQUEA si se supera umbral
```

---

## Escenario 3 — Performance Testing

| Herramienta | Versión | Rol | Justificación |
|------------|---------|-----|---------------|
| **k6** | 0.46+ | Pruebas de carga E2E (2k VUs / 3600s) | Scripting moderno; soporte protocolo HTTPS; parametrización de datos; exporta métricas Prometheus/InfluxDB |
| **k6 Scripting por grabación** | — | Generación de scripts desde tráfico HTTPS | Protocolo HTTPS con tokens y headers complejos; scripts reutilizables en framework |

#### Configuración de carga completa

| Parámetro | Valor |
|-----------|-------|
| Herramienta | k6 (open-source) |
| VUs | 2,000 |
| Duración | 3,600 s (1 hora) |
| Protocolo | HTTPS (APIs enlazadas) |
| Patrón | Flujo E2E con IDs encadenados entre peticiones |
| Ejecución | Secuencial (login → consulta → actualización) |

#### Métricas de reporte

| Métrica | Descripción |
|---------|-------------|
| Latencia promedio | Media de tiempo de respuesta por endpoint |
| Códigos de respuesta | Distribución 2xx/4xx/5xx |
| Mensajes de respuesta | Errores y mensajes detallados |
| Respuestas exitosas vs errores | Ratio de éxito |
| p95 por endpoint crítico | Percentil 95 tiempo de respuesta |
| Comparación vs baseline | Delta respecto a ejecución anterior |

---

## Escenario 4 — Framework de Automatización

| Herramienta | Versión | Rol | Justificación |
|------------|---------|-----|---------------|
| **GitHub Actions** | — | Orquestación central + calendarización | Workflows reutilizables (reusable workflows); calendarización con cron; sin infraestructura adicional |
| **Docker Compose** | 2.x | Entorno de simulación local completo | Levanta toda la stack (6 servicios) en 1 comando; reproducible en CI y local |
| **PostgreSQL** | 14 (Alpine) | TDM — Test Data Management | Datos sintéticos (Billy 1–5); seeders automáticos al init; salud verificable vía healthcheck |
| **Prism** | 4.x | Mock de servicios externos | Simula APIs de terceros (Operador BLUE, servicio de recibos) sin dependencia externa |
| **SonarCloud** | — | Reporteo de calidad continuo | Dashboard unificado; histórico de métricas; integración con GitHub PRs |
| **JaCoCo HTML Reports** | 0.8.11 | Reporteo de cobertura | Artefactos descargables desde GitHub Actions; histórico por ejecución |
| **Karate HTML Reports** | 1.4+ | Reporteo de pruebas API | Reportes HTML con evidencias detalladas por escenario |
| **k6 JSON/CSV Output** | — | Reporteo de performance | Comparaciones entre ejecuciones; detección de degradaciones |

### Gobierno y Estándares

| Área | Estándar |
|------|---------|
| Branching | `develop → qa → uat → main` (GitFlow simplificado) |
| Commits | Conventional Commits: `feat:`, `fix:`, `test:`, `demo:`, `restore:` |
| Tags de imagen | `{env-prefix}-{7-char-sha}` por entorno |
| Cobertura | Gate ≥ 80 % sobre código de negocio (excluye DTOs, config, modelos) |
| Seguridad | 0 CVEs CRITICAL/HIGH en FS e imagen (Trivy) |
| Promoción | Manual + declarativa; solo pipeline verde actualiza manifiestos |
| Secrets | GitHub Actions Secrets (`SONAR_TOKEN`); nunca hardcodeados |

### Plan de Mantenimiento

| Actividad | Frecuencia | Responsable |
|-----------|-----------|-------------|
| Actualización de dependencias | Mensual | DevSecOps |
| Revisión de quality gates | Por sprint | QE Lead |
| Renovación de datos TDM | Según cambio de BD | QE |
| Actualización de mocks OpenAPI | Por cambio de contrato | Team B |
| Renovación de imagen base (Alpine) | Mensual (Trivy alerta) | DevSecOps |
| Revisión de umbrales k6 | Trimestral o post-cambio infra | Performance QE |

### Integración con IA (Escenario 4)

| Capacidad | Herramienta / Enfoque | Estado en PoC |
|-----------|----------------------|----------------|
| Historias de usuario → Casos de prueba | LLM + Karate DSL templates | Demostrado conceptualmente |
| Datos sintéticos bajo demanda | SQL seeders + generación paramétrica | Implementado (Billy 1–5 + extensible) |
| Análisis de resultados de ejecución | SonarCloud + k6 dashboards | Disponible |

---

## Resumen de Versiones y Dependencias

| Componente | Tecnología | Versión | Licencia |
|-----------|-----------|---------|---------|
| microservice-a | Spring Boot | 3.2.5 | Apache 2.0 |
| microservice-b | Spring Boot | 3.2.5 | Apache 2.0 |
| ui-paymentbox | Angular | Latest | MIT |
| Servidor web UI | Nginx | Alpine | BSD-2 |
| Base de datos | PostgreSQL | 14 Alpine | PostgreSQL License |
| ORM / JPA | Spring Data JPA (Hibernate) | Boot-managed | LGPL |
| API Docs | SpringDoc OpenAPI | 2.5.0 | Apache 2.0 |
| Tests unitarios | JUnit 5 + Mockito | Boot-managed | EPL 2.0 / MIT |
| Cobertura | JaCoCo | 0.8.11 | EPL 2.0 |
| Build tool | Gradle | 8.x | Apache 2.0 |
| Tests API | Karate DSL | 1.4+ | MIT |
| Tests UI | Selenium WebDriver | 4.x | Apache 2.0 |
| Performance | k6 | 0.46+ | AGPL 3.0 |
| Mock server | Prism CLI | 4.x | Apache 2.0 |
| Container | Docker | 24+ | Apache 2.0 |
| Registry | GHCR | — | — |
| Security scan | Trivy | Latest | Apache 2.0 |
| Static analysis | SonarCloud | — | Comercial (freemium) |
| CI/CD | GitHub Actions | — | — |
| GitOps (sim.) | Kustomize + ArgoCD | 5.x / 2.x | Apache 2.0 |
| Runtime | Java 17 Temurin JRE | 17 | GPL+CE |
