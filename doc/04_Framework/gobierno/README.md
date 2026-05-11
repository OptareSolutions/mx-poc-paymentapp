# Gobierno y Estándares — Framework de Testing QA

> Reglas, buenas prácticas, mantenibilidad y proceso de desarrollo

---

## Principios de Gobierno

El framework se rige por los siguientes principios:

1. **Shift-Left**: Detectar defectos lo más temprano posible en el ciclo
2. **Calidad Declarativa**: Los criterios de calidad son código, versionados y auditables
3. **GitOps**: El estado del entorno es determinístico a partir del repositorio
4. **No Push a Main**: Nunca se hace commit/push directo a `main`
5. **Separación de Equipos**: Cada equipo tiene su pipeline, sus paths y su responsabilidad

---

## Reglas de Branching

```
main ─────────────────────────────────────── (PRODUCCIÓN - solo GitOps)
 └── uat ──────────────────────────────────── (UAT - promoción desde qa)
      └── qa ──────────────────────────────── (QA - promoción desde develop)
           └── develop ──────────────────────── (Integración)
                └── feature/{nombre} ─────────── (Desarrollo)
                └── fix/{ticket} ─────────────── (Correcciones)
                └── demo/{nombre} ────────────── (Demos y PoC)
```

### Reglas por Rama

| Rama | Protegida | Push Directo | Requiere PR | Requiere CI Verde |
|------|-----------|-------------|------------|-----------------|
| `main` | ✅ | ❌ | ✅ (2 approvals) | ✅ |
| `uat` | ✅ | ❌ | ✅ (1 approval) | ✅ |
| `qa` | ✅ | ❌ | ✅ (1 approval) | ✅ |
| `develop` | ✅ | ❌ | ✅ (1 approval) | ✅ |
| `feature/*` | ❌ | ✅ | — | — |

---

## Quality Gates

Los quality gates son **bloqueantes**: si no se cumplen, el pipeline falla y la promoción no ocurre.

### Gate 1 — Cobertura de Código

```yaml
# build.gradle
jacocoTestCoverageVerification {
  violationRules {
    rule {
      limit {
        minimum = 0.80   // 80% mínimo
      }
    }
  }
}
```

### Gate 2 — Seguridad (Trivy)

```yaml
# pipeline config
trivy fs . \
  --severity CRITICAL,HIGH \
  --exit-code 1 \    # Falla el job si encuentra vulnerabilidades
  --format sarif
```

### Gate 3 — Contrato entre Servicios (Karate)

El contrato se valida en `pipeline-integration.yml` antes de cualquier promoción. Si `microservice-b` cambia su API pública, el contrato falla **antes** de construir imágenes.

### Gate 4 — E2E Funcional (Karate 8 pasos)

Todos los 8 pasos del flujo PaymentBox deben pasar antes de actualizar el overlay de Kustomize.

### Gate 5 — Performance (k6 Thresholds)

```javascript
// smoke_recarga.js
export const options = {
  thresholds: {
    'http_req_duration{scenario:flujo_completo}': ['p(95)<3000'],
    'http_req_failed': ['rate<0.01'],
    'http_req_duration{step:login}': ['p(95)<700'],
    'http_req_duration{step:consulta}': ['p(95)<900'],
    'http_req_duration{step:actualizacion}': ['p(95)<1200'],
  },
};
```

---

## Convenciones de Nomenclatura

### Tests

| Tipo | Convención | Ejemplo |
|------|-----------|---------|
| Features Karate | `kebab-case.feature` | `recarga_flow.feature` |
| Clases JUnit | `PascalCase + Test/Spec` | `RecargaServiceTest.java` |
| Scenarios Karate | Frase descriptiva | `Billy recarga $50 exitosamente` |
| Scripts k6 | `snake_case.js` | `smoke_recarga.js` |

### Commits

Usar **Conventional Commits**:

```
feat(microservice-a): añadir validación de monto mínimo
fix(karate): corregir match en contrato telefono vs phone
test(e2e): añadir escenario Billy 4 (INACTIVO)
ci(pipeline): añadir daily smoke cron
docs(framework): actualizar README gobierno
refactor(service): extraer lógica de validación
demo: BREAK 1 - romper contrato DTO
restore: revertir cambios demo
```

### Pull Requests

```
[Tipo] Descripción corta (#ticket)

Ejemplos:
[feat] Añadir validación monto mínimo en RecargaService (#234)
[fix] Corregir contrato API microservice-b (#235)
[ci] Añadir weekly regression suite (#236)
```

---

## Estándares de Código

### Java (microservice-a / microservice-b)

| Regla | Configuración |
|-------|---------------|
| Checkstyle | Google Java Style Guide |
| SonarCloud | Quality Gate "Sonar way" |
| Cobertura mínima | 80% (JaCoCo, bloqueante) |
| Code Smells | ≤ 10 por análisis |
| Duplicación | ≤ 3% |
| Complejidad ciclomática | ≤ 15 por método |

### Karate DSL

```
tests/functional-karate/src/test/resources/features/
├── recarga_flow.feature         ← E2E 8 pasos
├── contract_microservices.feature  ← Contrato A↔B
├── api_smoke.feature            ← Smoke test APIs
└── tdm/
    └── create_data.feature      ← Generación datos sintéticos
```

**Buenas prácticas Karate:**
- Variables de entorno en `karate-config.js` por entorno
- Reutilizar features con `call read('...')`
- No hardcodear URLs; usar `karate.env`
- Asertar tipos además de valores: `match response.monto == '#number'`

---

## Proceso de Desarrollo

### Flujo para Nueva Funcionalidad

```
1. Crear rama feature/nombre desde develop
2. Implementar código + tests unitarios (≥80% cobertura)
3. Ejecutar localmente: gradle test jacocoTestReport
4. Crear PR → develop
   - CI pipeline ejecuta automáticamente
   - Reviewer aprueba
5. Merge a develop
   - pipeline-microservice-{a|b} ejecuta E2E
6. Cuando develop está estable → PR a qa
7. Trigger pipeline-integration.yml (develop → qa)
8. Si OK → overlay env-a actualizado automáticamente
```

### Flujo para Hotfix

```
1. Crear rama fix/descripcion desde qa (o main si es urgente)
2. Implementar fix + test de regresión
3. PR con fast-track review
4. Merge → rama base
5. Pipeline ejecuta automáticamente
6. Promoción acelerada si pasa CI
```

---

## Mantenibilidad

### Índice de Mantenibilidad

El framework se diseñó para minimizar el coste de mantenimiento:

| Factor | Estrategia | Beneficio |
|--------|-----------|-----------|
| **Mock externos** | Prism mocks en lugar de llamar a servicios reales | Tests estables ante cambios externos |
| **Datos sintéticos** | TDM seeders versionados | Reproducibilidad garantizada |
| **Path triggers** | Pipelines solo se ejecutan cuando cambia código relevante | Menor costo en minutos de CI |
| **Contrato versionado** | OpenAPI specs en repo | Cambios de API son detectados automáticamente |
| **GitOps** | Kustomize overlays | Estado de entorno es código, no configuración manual |

### Actualización de Scripts de Prueba

Ver [`MANTENIMIENTO.md`](../MANTENIMIENTO.md) para el proceso completo de actualización.

---

## Roles y Responsabilidades

| Rol | Responsabilidad |
|-----|----------------|
| **QA Automation Lead** | Arquitectura del framework, quality gates, governance |
| **Team A (microservice-a)** | Tests unitarios msvc-a, E2E pasos 1,3,5 (Selenium) |
| **Team B (microservice-b)** | Tests unitarios msvc-b, contrato API pública |
| **DevOps/SRE** | Pipelines GitHub Actions, ArgoCD, Docker/K8s |
| **QA Tester** | Diseño de casos de prueba, validación de reportes |

---

## Auditoría y Compliance

Todos los runs de pipeline generan un **registro inmutable** en GitHub Actions con:
- Timestamp exacto de inicio/fin
- Usuario que disparó el pipeline (o sistema para crons)
- Resultados por job y step
- Artefactos descargables como evidencia
- SARIF de seguridad integrado en GitHub Security Tab

Retención mínima recomendada: **90 días** para fines de auditoría.
