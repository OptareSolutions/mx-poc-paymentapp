# 🚀 k6 Smoke Performance — PaymentBox CI/CD

Integración de k6 en GitHub Actions para pruebas de smoke performance con comparación histórica de resultados.

## Estructura de Archivos

```
performance/
├── smoke_performance.js          # Script k6 principal (20 VUs, 7 min)
├── data/
│   └── users.json                # Datos de prueba parametrizados
├── scripts/
│   └── compare-results.js        # Script de comparación histórica
├── workflows/
│   └── performance-smoke.yml     # Workflow GitHub Actions
└── README.md                     # Este documento
```

## Configuración del Test

| Parámetro | Valor |
|-----------|-------|
| Usuarios virtuales (VUs) | 20 |
| Duración | 7 minutos |
| Think time entre pasos | 1–3 segundos (aleatorio) |
| Datos de prueba | Parametrizados (5 perfiles Billy) |

## Thresholds Configurados

| Métrica | Límite | Descripción |
|---------|--------|-------------|
| Flujo completo p95 | < 3000 ms | 95% del flujo de 8 pasos < 3s |
| Login p95 | < 700 ms | Paso 2: Focalizar cliente |
| Consulta p95 | < 900 ms | Pasos 3+4: Montos + validación operador |
| Actualización p95 | < 1200 ms | Pasos 6+7: Registrar pago |
| Error rate | < 1% | Tasa de errores del flujo completo |

## Flujo de 8 Pasos Cubiertos

1. _(sin cobertura — inicio UI)_
2. **Focalizar Cliente** — `GET /api/clientes/buscar?telefono=...`
3. **Obtener Montos DB** — `GET /api/recargas/montos?operador=...`
4. **Validar Operador** — `POST /api/recargas/validar-operador`
5. **Métodos de Pago** — `GET /api/pagos/metodos`
6. **Registrar Pago** — `POST /api/pagos/registrar` _(ruta crítica)_
7. _(incluido en Paso 6)_
8. **Emitir Recibo** — `POST /api/recibos/emitir`

## Ejecución Local

```bash
# Instalar k6: https://k6.io/docs/get-started/installation/

# Ejecutar con valores por defecto (1 VU para smoke básico)
k6 run tests/k6/smoke_performance.js

# Ejecutar con configuración completa
k6 run \
  --env BASE_URL=http://localhost:8080 \
  --env ENVIRONMENT=local \
  tests/k6/smoke_performance.js
```

## Ejecución en GitHub Actions

El workflow `performance-smoke.yml` se puede disparar:

- **Manual** (`workflow_dispatch`): desde la UI de GitHub Actions con parámetros configurables
- **Programado** (`schedule`): automáticamente cada día a las 02:00 UTC
- **Por llamada** (`workflow_call`): desde `pipeline-integration.yml` como gate de calidad

### Parámetros del workflow_dispatch

| Parámetro | Descripción | Valor por defecto |
|-----------|-------------|-------------------|
| `base_url` | URL del servicio | `http://localhost:8080` |
| `environment` | Entorno objetivo | `develop` |
| `vus` | Usuarios virtuales | `20` |
| `duration` | Duración del test | `7m` |
| `update_baseline` | Actualizar baseline | `false` |

## Comparación Histórica

### Cómo funciona

1. Cada ejecución genera `smoke_performance_latest.json` con las métricas
2. El baseline se almacena como artefacto de GitHub Actions (`k6-performance-baseline`)
3. En cada ejecución se descarga el baseline y se compara con los resultados actuales
4. Si hay regresión (> 20% de deterioro), el job falla con detalle del problema
5. El baseline se actualiza automáticamente en ejecuciones programadas si todos los thresholds pasan

### Actualizar el Baseline Manualmente

Ejecutar el workflow con el parámetro `update_baseline = true`. Solo se actualiza si todos los thresholds pasan.

### Script de Comparación Local

```bash
node tests/k6/scripts/compare-results.js \
  --current  tests/k6/results/smoke_performance_latest.json \
  --baseline tests/k6/results/baseline.json \
  --output   tests/k6/results/comparison_report.md
```

**Exit codes:**
- `0` — Sin regresiones, todos los thresholds cumplen
- `1` — Regresión o fallo de threshold detectado
- `2` — Error de argumentos o archivos no encontrados

## Artefactos Generados

| Artefacto | Retención | Descripción |
|-----------|-----------|-------------|
| `k6-performance-results-{run_id}` | 90 días | Resultados de cada ejecución |
| `k6-performance-baseline` | 365 días | Baseline histórico de referencia |

## Integración con Pipeline Principal

Para usar este workflow como gate en `pipeline-integration.yml`:

```yaml
performance-check:
  name: "Performance Gate"
  uses: ./.github/workflows/performance-smoke.yml
  with:
    base_url: http://microservice-a:8080
    environment: qa
```

## Seguridad

- Actions pinados a commit SHA completo con etiqueta de versión
- Permisos mínimos: `contents: read`, `actions: read`
- Sin credenciales hardcodeadas
- Concurrencia controlada (sin ejecuciones paralelas por entorno)

---

## Performance Comercial — Alternativas (1k–2k VUs / 3600s)

El repositorio incluye `performance-load-2k.yml` con k6 (open source) para carga de 2000 VUs × 3600s. Si el proyecto requiere herramienta comercial, el mismo workflow puede adaptarse:

### JMeter (self-hosted runner)

```yaml
- name: Run JMeter load test
  run: |
    jmeter -n \
      -t tests/jmeter/att-paymentbox-e2e.jmx \
      -l results/jmeter_results.jtl \
      -e -o results/jmeter-html-report \
      -Jbase_url=${{ env.BASE_URL }} \
      -Jvus=2000 \
      -Jduration=3600
```

### LoadView / BlazeMeter (cloud)

Reemplazar el step de k6 con la CLI de BlazeMeter o su GitHub Action nativa, apuntando al script JMX. La configuración de umbrales se pasa como parámetros de la ejecución cloud.

### Métricas requeridas en todos los casos

| Métrica | Descripción |
|---------|-------------|
| Latencia promedio y p95 por endpoint | Base para comparación vs baseline |
| Códigos de respuesta (2xx / 4xx / 5xx) | Tasa de éxito del flujo |
| Mensajes de respuesta en errores | Diagnóstico de fallos |
| Respuestas exitosas vs errores | Ratio global |
| Comparación vs baseline anterior | Detección de regresiones |

El workflow `performance-load-2k.yml` ya registra estas métricas en JSON estructurado listo para dashboard (Grafana, DataDog) o comparación manual. Los artifacts se retienen 90 días con el nombre `load-test-results-{run_id}`.
