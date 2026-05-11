# Calendarización — Framework de Testing QA

> Programación y ejecución periódica de suites de prueba

---

## Tipos de Ejecución

El framework soporta **tres modalidades de ejecución**:

| Modalidad | Trigger | Casos de Uso |
|-----------|---------|-------------|
| **Automática (push)** | Cada push/PR | Validación continua de cambios |
| **Calendarizada (cron)** | Schedule GitHub Actions | Ejecuciones nocturnas, smoke test diario |
| **Manual (dispatch)** | workflow_dispatch | Promoción de entornos, demos bajo demanda |

---

## Configuración de Ejecuciones Calendarizadas

### Suite Diaria — Smoke Test (07:00 AM UTC)

Ejecuta el flujo E2E básico contra `develop` cada mañana para detectar regresiones nocturnas.

```yaml
# Añadir al pipeline-microservice-a.yml o pipeline separado
on:
  schedule:
    - cron: '0 7 * * 1-5'   # Lunes a Viernes a las 07:00 UTC
  workflow_dispatch:          # También permite ejecución manual

jobs:
  daily-smoke:
    name: "Daily Smoke Test — E2E 8 pasos"
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          ref: develop
      - name: Levantar entorno simulado
        run: docker compose -f simulation/docker-compose.yml up -d
      - name: Esperar servicios healthy
        run: docker compose -f simulation/docker-compose.yml ps
      - name: Ejecutar Karate E2E
        run: cd tests/functional-karate && mvn test -Dkarate.env=smoke
      - name: Ejecutar k6 Smoke
        run: k6 run --env BASE_URL=http://localhost:8080 tests/k6/smoke_recarga.js
      - name: Notificar resultado
        if: failure()
        uses: actions/github-script@v7
        with:
          script: |
            github.rest.issues.create({
              owner: context.repo.owner,
              repo: context.repo.repo,
              title: '🔴 Daily Smoke Test FAILED - ' + new Date().toISOString().slice(0,10),
              labels: ['test-failure', 'automated']
            })
```

---

### Suite Semanal — Regresión Completa (Domingo 22:00 UTC)

Ejecuta la suite de regresión completa incluyendo todos los tipos de prueba.

```yaml
on:
  schedule:
    - cron: '0 22 * * 0'    # Domingos a las 22:00 UTC

jobs:
  weekly-regression:
    name: "Weekly Full Regression Suite"
    strategy:
      matrix:
        environment: [develop, qa]
    steps:
      - name: Full E2E + Contract + Performance
        run: |
          mvn test -Dkarate.env=${{ matrix.environment }}
          k6 run tests/k6/smoke_recarga.js
```

---

### Suite Mensual — Performance Completa (Primer lunes del mes)

Ejecuta prueba de carga completa con k VUs por 1600+ segundos.

```yaml
on:
  schedule:
    - cron: '0 6 1-7 * 1'   # Primer lunes del mes a las 06:00 UTC

jobs:
  monthly-performance:
    name: "Monthly Performance Test — 1k+ VUs"
    runs-on: ubuntu-latest
    steps:
      - name: k6 Performance Full
        run: |
          k6 run \
            --vus 1000 \
            --duration 1600s \
            --out json=results/monthly-perf-$(date +%Y%m).json \
            tests/k6/smoke_recarga.js
```

---

## Calendario de Ejecuciones

| Suite | Frecuencia | Entorno | Duración Est. | Notificación |
|-------|-----------|---------|--------------|-------------|
| **Smoke Diario** | L-V 07:00 UTC | develop | ~5 min | Solo en fallo |
| **Regresión Semanal** | Dom 22:00 UTC | develop + qa | ~20 min | Siempre |
| **Performance Mensual** | 1er lunes 06:00 UTC | qa | ~30 min | Siempre |
| **Seguridad Diaria** | 03:00 UTC | main | ~10 min | Solo CRITICAL |

---

## Política de Notificaciones

### Canales de Notificación

```yaml
# Notificación por email/Slack en fallo
- name: Notify on Failure
  if: failure()
  uses: slackapi/slack-github-action@v1.26
  with:
    channel-id: '#qa-alerts'
    slack-message: |
      🔴 *Suite ${{ github.workflow }} FALLÓ*
      Entorno: ${{ github.ref_name }}
      Run: ${{ github.server_url }}/${{ github.repository }}/actions/runs/${{ github.run_id }}
  env:
    SLACK_BOT_TOKEN: ${{ secrets.SLACK_BOT_TOKEN }}
```

### Creación Automática de Issues

Cuando falla una ejecución calendarizada, se crea automáticamente un Issue en GitHub con:
- Título: `🔴 [Suite] FAILED — YYYY-MM-DD`
- Labels: `test-failure`, `automated`, `{entorno}`
- Body: Logs del step fallido + link al run

---

## Parametrización de Suites

### Variables de Entorno por Suite

```yaml
env:
  KARATE_ENV: develop        # Entorno Karate (dev/qa/uat/prod)
  K6_VUS: 20                 # Virtual Users para smoke
  K6_DURATION: 5m            # Duración del test k6
  DB_URL: localhost:5432      # Base de datos de prueba
  BASE_URL: http://localhost:8080  # URL del servicio bajo prueba
```

### Datos de Prueba por Entorno

| Entorno | Perfil Billy | BD | Mock Operador |
|---------|-------------|-----|--------------|
| develop (env-e) | Billy 1-5 | postgresql:5432 | Prism :4010 |
| qa (env-a) | Billy 1-5 | postgresql-qa:5432 | Prism :4010 |
| uat (env-u) | Billy 1-3 | postgresql-uat:5432 | API real (staging) |

---

## Gestión de Retención de Resultados

| Artefacto | Retención | Política |
|-----------|-----------|---------|
| Resultados smoke diario | 7 días | Auto-delete |
| Resultados regresión semanal | 30 días | Conservar último por rama |
| Resultados performance mensual | 180 días | Comparativa histórica |
| Reportes de seguridad (SARIF) | 90 días | Requerimiento compliance |

---

## Ejecución Manual bajo Demanda

Para ejecutar una suite específica manualmente:

```bash
# Trigger manual de pipeline-integration (promoción develop → qa)
gh workflow run pipeline-integration.yml \
  -f promote_from=develop \
  -f promote_to=qa

# Trigger manual de smoke test en rama específica
gh workflow run pipeline-microservice-a.yml \
  --ref qa

# Ver estado de ejecuciones en curso
gh run list --workflow=pipeline-microservice-a.yml

# Seguir logs en tiempo real
gh run watch
```

---

## Estado de Ejecuciones en Tiempo Real

La vista de **GitHub Actions** permite:
- Ver todas las ejecuciones activas en paralelo
- Inspeccionar cada job y cada step individualmente
- Cancelar ejecuciones en curso
- Re-ejecutar jobs fallidos (`Re-run failed jobs`)
- Descargar artefactos al finalizar

```bash
# Monitorear estado desde CLI
gh run list --limit 20
gh run view <run_id> --log
```
