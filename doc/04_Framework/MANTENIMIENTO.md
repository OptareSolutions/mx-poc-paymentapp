# Plan de Mantenimiento — Framework de Testing QA

> Plan de continuidad, costes estimados y proceso de actualización de scripts

---

## Resumen Ejecutivo

El framework de testing requiere mantenimiento regular para garantizar su continuidad y eficacia. Este documento define el **proceso de mantenimiento**, los **roles responsables** y los **costes estimados** para sostener el framework en producción.

---

## Tipos de Mantenimiento

| Tipo | Frecuencia | Esfuerzo | Descripción |
|------|-----------|---------|-------------|
| **Correctivo** | Bajo demanda | 2-8h/incidente | Reparar tests rotos por cambios en la aplicación |
| **Preventivo** | Mensual | 4h/mes | Revisión de estabilidad, limpieza de artefactos |
| **Adaptativo** | Por sprint | 4-8h/sprint | Actualizar tests cuando cambian requisitos |
| **Perfectivo** | Trimestral | 8-16h/trimestre | Refactoring, mejoras de rendimiento |
| **Evolutivo** | Semestral | 16-40h/semestre | Nuevas capacidades, upgrade de herramientas |

---

## Actividades de Mantenimiento

### Mantenimiento Diario (Automático)

Las siguientes actividades son **automáticas** y no requieren intervención humana:

- [ ] Smoke test diario (GitHub Actions cron 07:00 UTC L-V)
- [ ] Limpieza de artefactos expirados (> 30 días)
- [ ] Notificación de fallos al equipo (#qa-alerts)
- [ ] Escaneo de seguridad (Trivy en cron 03:00 UTC)

### Mantenimiento Semanal (Manual — 2h)

| Actividad | Responsable | Tiempo |
|-----------|-------------|--------|
| Revisar fallos de la semana en GitHub Actions | QA Lead | 30 min |
| Analizar tests flaky (si los hay) | QA Automation | 45 min |
| Verificar thresholds de performance vs baseline | QA Lead | 30 min |
| Actualizar artefactos de evidencia para compliance | QA Tester | 15 min |

### Mantenimiento Mensual (Manual — 4h)

| Actividad | Responsable | Tiempo |
|-----------|-------------|--------|
| Ejecutar suite de performance completa (1k VUs) | QA Automation | 30 min |
| Revisar cobertura de requisitos (análisis de gaps) | QA Lead | 1h |
| Actualizar dependencias (pom.xml, package.json) | Dev/QA | 1h |
| Revisar y rotar tokens/secrets de CI | DevOps | 30 min |
| Crear informe mensual de calidad | QA Lead | 1h |

---

## Proceso de Actualización de Scripts

### Escenario A — Cambio de Contrato API (Breaking Change)

**Trigger:** Team B renombra o elimina campos del DTO público

```
1. Pipeline-integration.yml Job 1 falla con error de contrato
2. QA Lead recibe notificación (#qa-alerts)
3. QA Lead crea issue: "fix(contrato): actualizar match response.X"
4. QA Automation actualiza el feature:
   - contract_microservices.feature: cambiar match assertion
   - recarga_flow.feature: ajustar cualquier referencia al campo
5. PR con el fix → develop
6. Pipeline valida → merge
7. Re-ejecutar pipeline-integration.yml → OK
8. Registrar cambio en CHANGELOG.md
```

**Tiempo estimado:** 2-4 horas

---

### Escenario B — Cambio de Comportamiento en Servicio

**Trigger:** Servicio cambia lógica de negocio (ej: nuevo monto mínimo, nueva validación)

```
1. Job 4 (E2E Karate) falla con status inesperado (ej: 400 en vez de 201)
2. QA Automation analiza el log de Karate
3. Determina si es un defecto (reportar bug) o cambio intencional (actualizar test)
4. Si es cambio intencional:
   a. Actualizar el feature con el nuevo comportamiento esperado
   b. Actualizar los seeders TDM si cambian los datos de prueba
   c. PR → develop con explicación del cambio de comportamiento
5. Si es un defecto:
   a. Crear issue en GitHub con evidencia del fallo
   b. Asignar al equipo correspondiente
   c. No modificar el test (mantiene el fallo como evidencia)
```

**Tiempo estimado:** 1-3 horas

---

### Escenario C — Actualización de Dependencias

Ejecución mensual para mantener dependencias actualizadas:

```bash
# Actualizar dependencias Java (microservice-a, microservice-b)
cd microservice-a
./gradlew dependencyUpdates -Drevision=release

# Actualizar pom.xml de Karate
cd tests/functional-karate
mvn versions:display-dependency-updates

# Actualizar k6 (si hay nueva versión)
# → Actualizar en pipeline YAML: k6/k6:{version}

# Actualizar Trivy action
# → Actualizar en pipeline YAML: aquasecurity/trivy-action@{version}

# Actualizar Prism (mocks)
npm update @stoplight/prism-cli

# Commit con todos los updates
git commit -m "chore: actualizar dependencias $(date +%Y-%m)"
```

---

### Escenario D — Nueva Funcionalidad / Historia de Usuario

```
1. Product Owner crea issue con criterios de aceptación
2. QA Lead diseña casos de prueba (o delega a IA)
3. QA Automation implementa feature Karate o test Selenium
4. Dev implementa el código con tests unitarios
5. PR → develop
6. CI pipeline valida cobertura ≥ 80% + E2E OK
7. Merge → promote a qa → uat → main
```

---

## Gestión de Mocks y Datos de Prueba

### Actualización de Mocks Prism

Los mocks deben actualizarse cuando cambia el contrato de los servicios externos:

```bash
# Editar spec OpenAPI
vim simulation/prism-mocks/operador.yaml

# Validar la spec
prism validate simulation/prism-mocks/operador.yaml

# Reiniciar mock en entorno local
docker compose restart mock-operador

# Ejecutar tests de contrato
cd tests/functional-karate && mvn test -Dkarate.options="--tags @contrato"
```

### Actualización de Seeders TDM

```bash
# Añadir nuevo perfil de prueba
vim simulation/tdm-seeders/02_billy_profiles.sql

# Regenerar BD local
cd simulation
docker compose down -v   # Borra volúmenes
docker compose up -d     # Recrea con nuevos seeders
docker compose logs postgresql | tail -20  # Verificar seed OK
```

---

## Costes Estimados de Mantenimiento

### Recursos Humanos

| Rol | Dedicación | Costo/hora | Costo mensual |
|-----|-----------|-----------|--------------|
| QA Lead | 8h/mes | $50/h | $400/mes |
| QA Automation Engineer | 12h/mes | $45/h | $540/mes |
| DevOps (pipelines/infra) | 4h/mes | $55/h | $220/mes |
| **Total RRHH** | **24h/mes** | — | **$1,160/mes** |

### Infraestructura / Licencias

| Servicio | Plan | Costo mensual |
|---------|------|--------------|
| GitHub Actions (minutes) | Teams: 3,000 min/mes | ~$50/mes (si excede free) |
| SonarCloud | Open Source: Free | $0 |
| GitHub Container Registry | Incluido | $0 |
| Prism CLI (open source) | Free | $0 |
| k6 (open source) | Free | $0 |
| **Total Infraestructura** | — | **~$50/mes** |

### **Costo Total Estimado: ~$1,210/mes**

---

## SLA del Framework

| Componente | Disponibilidad Target | Tiempo Recuperación |
|-----------|----------------------|-------------------|
| Pipelines CI/CD | 99.5% | < 2h |
| Entorno Simulado (local) | 99% | < 30min |
| Reportes y Artefactos | 99.9% | < 1h |
| Mocks Prism | 99.5% | < 1h |

---

## Escalabilidad

### Capacidad Actual (PoC)
- 48 scenarios automatizados (8 flujos × 6 variantes)
- ~1% del universo total de 5,200 validaciones
- Tiempo total de pipeline: ~10 min

### Roadmap de Escalabilidad

| Fase | Periodo | Casos Cubiertos | Costo Adicional |
|------|---------|----------------|----------------|
| PoC (actual) | Q1-Q2 2026 | 48 (~1%) | Base |
| Fase 1 | Q3 2026 | ~500 (~10%) | +$2,000/mes RRHH |
| Fase 2 | Q4 2026 | ~1,500 (~29%) | +$4,000/mes RRHH |
| Fase 3 | Q1 2027 | ~3,000 (~58%) | +$6,000/mes RRHH |
| Objetivo | Q3 2027 | ~5,200 (~100%) | +$10,000/mes RRHH |

---

## Gestión de Incidentes

### Niveles de Severidad

| Nivel | Descripción | Tiempo Respuesta | Tiempo Resolución |
|-------|-------------|-----------------|-----------------|
| **P1 - Crítico** | Pipeline de producción bloqueado | 15 min | 2h |
| **P2 - Alto** | Pipeline de QA/UAT bloqueado | 1h | 8h |
| **P3 - Medio** | Test flaky o degradación de performance | 4h | 24h |
| **P4 - Bajo** | Mejora o actualización preventiva | 1 semana | Sprint |

### Proceso de Escalación

```
Fallo detectado
    │
    ▼
Notificación automática (#qa-alerts)
    │
    ▼
QA Automation analiza (< 1h)
    │
    ├── Corrección trivial → Fix inmediato + PR
    │
    └── Impacto alto → Escalar a QA Lead
                           │
                           ├── Coordinar con Dev team
                           └── Comunicar a stakeholders
```

---

## Documentación a Mantener

| Documento | Frecuencia de Actualización | Responsable |
|-----------|---------------------------|-------------|
| `README.md` (framework) | Cuando cambia arquitectura | QA Lead |
| `orquestacion/README.md` | Cuando cambia pipeline | DevOps |
| `reporteo/README.md` | Mensual (nuevas métricas) | QA Lead |
| `calendarizacion/README.md` | Cuando cambia schedule | QA Automation |
| `gobierno/README.md` | Trimestral | QA Lead |
| `ia/README.md` | Cuando hay nuevas capacidades | QA Lead |
| `DEMO_SCRIPT.md` | Antes de cada demo | QA Lead |
| `MANTENIMIENTO.md` (este doc) | Semestral o tras incidente | QA Lead |
| `CHANGELOG.md` | Cada cambio significativo | QA Automation |
