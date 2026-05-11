# Framework de Testing QA — AT&T PoC

> **Optare Solutions** para AT&T | Proyecto: PaymentBox QA PoC  
> Versión: 1.0 | Última actualización: 2026-05-07

---

## Descripción General

Este framework de testing proporciona una plataforma centralizada para la **automatización de pruebas de calidad**, integrando capacidades de orquestación, reporteo, calendarización, gobierno y uso de IA. Está diseñado para cubrir los 5,200+ casos de validación manual que AT&T ejecuta actualmente en sus fábricas de software.

## Capacidades del Framework

| Capacidad | Carpeta | Descripción |
|-----------|---------|-------------|
| **Orquestación** | `orquestacion/` | Flujos automatizados, pipelines CI/CD, ArgoCD GitOps |
| **Reporteo** | `reporteo/` | Dashboard de resultados, KPIs, ROI estimado |
| **Calendarización** | `calendarizacion/` | Programación y ejecución periódica de suites |
| **Gobierno** | `gobierno/` | Reglas, estándares y buenas prácticas |
| **IA** | `ia/` | Generación de casos de prueba y datos sintéticos |

## Stack Tecnológico

```
┌─────────────────────────────────────────────────────────────┐
│                    CAPA DE ORQUESTACIÓN                     │
│          GitHub Actions + ArgoCD + Kustomize                │
├─────────────────────────────────────────────────────────────┤
│                    CAPA DE TESTING                          │
│   Karate DSL  │  Selenium  │  k6  │  JUnit5  │  Prism      │
├─────────────────────────────────────────────────────────────┤
│                    CAPA DE CALIDAD                          │
│         SonarCloud  │  JaCoCo  │  Trivy  │  Veracode        │
├─────────────────────────────────────────────────────────────┤
│                    CAPA DE INFRAESTRUCTURA                  │
│        Docker  │  Kubernetes  │  PostgreSQL  │  GHCR        │
└─────────────────────────────────────────────────────────────┘
```

## Estructura del Repositorio

```
04_Framework/
├── README.md                    ← Este documento
├── DEMO_SCRIPT.md               ← Guión de presentación
├── MANTENIMIENTO.md             ← Plan de mantenimiento
├── orquestacion/
│   └── README.md                ← Flujos y pipelines
├── reporteo/
│   └── README.md                ← Dashboard y KPIs
├── calendarizacion/
│   └── README.md                ← Programación de suites
├── gobierno/
│   └── README.md                ← Estándares y governance
└── ia/
    └── README.md                ← Capacidades de IA
```

## Escenarios de Testing Cubiertos

1. **API Testing** — Funcional, Integración y Contrato (Karate DSL)
2. **UI Testing** — Selenium Headless (Angular PaymentBox)
3. **Performance** — k6 smoke test (p95 < 2s)
4. **Seguridad** — Trivy filesystem y container scanning
5. **Calidad de Código** — SonarCloud + JaCoCo (≥ 80% cobertura)
6. **Contrato entre Servicios** — Prism mocks + Karate contract testing

## Flujo de 8 Pasos (Caso de Uso PaymentBox)

| Paso | Tipo | Herramienta | Descripción |
|------|------|-------------|-------------|
| 1 | UI | Selenium | Menús de Recarga visibles |
| 2 | API | Karate DSL | Localizar Cliente (`tel: 4544`) |
| 3 | UI/DB | Karate + SQL | Seleccionar Monto |
| 4 | Contrato | Prism CLI | Validar API Operador BLUE |
| 5 | UI | Selenium | Seleccionar Método de Pago |
| 6 | Performance | k6 | Ruta Crítica p95 < 2s |
| 7 | DB | Karate DSL | Persistencia del pago |
| 8 | Mock/API | Prism CLI | Emisión del recibo |

## Métricas DORA Target

| Métrica | Objetivo |
|---------|----------|
| Deployment Frequency | Cada push por rama |
| Lead Time for Changes | < 10 min pipeline |
| Change Failure Rate | < 1% |
| MTTR | Automático (GitOps rollback) |

## Documentos Relacionados

- [`orquestacion/README.md`](orquestacion/README.md) — Arquitectura de pipelines
- [`reporteo/README.md`](reporteo/README.md) — Dashboard y métricas
- [`calendarizacion/README.md`](calendarizacion/README.md) — Programación de pruebas
- [`gobierno/README.md`](gobierno/README.md) — Governance y estándares
- [`ia/README.md`](ia/README.md) — IA aplicada al testing
- [`DEMO_SCRIPT.md`](DEMO_SCRIPT.md) — Guión de la demo
- [`MANTENIMIENTO.md`](MANTENIMIENTO.md) — Plan de mantenimiento
