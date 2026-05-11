# PaymentBox HTTPS — Script de Performance por Grabación

## Descripción

Script de performance generado mediante grabación en protocolo **HTTPS** para el flujo completo E2E de PaymentBox Telco Operator (AT&T PoC).

Este es el **segundo script de performance**, complementario al script k6 (`smoke_performance.js`), diseñado con la herramienta **Apache JMeter** usando grabación HTTPS para capturar fielmente las APIs, headers y bodies reales del sistema.

---

## Archivos

| Archivo | Descripción |
|---------|-------------|
| `paymentbox_https_recording.jmx` | Plan de prueba JMeter (grabación HTTPS) |
| `datos_usuarios.csv` | Datos parametrizados de usuarios de prueba |
| `README.md` | Este documento |

---

## APIs incluidas (Flujo E2E — 8 pasos)

| Paso | Método | Endpoint | Body / Params |
|------|--------|----------|---------------|
| 1 | POST | `https://{auth_url}:{auth_port}/auth/login` | `{"username": "${authUser}", "password": "${authPass}"}` |
| 2 | GET | `https://{base_url}/api/clientes/buscar` | `?telefono=${telefono}` |
| 3 | GET | `https://{base_url}/api/recargas/montos` | `?operador=${operador}` |
| 4 | POST | `https://{base_url}/api/recargas/validar-operador` | `?telefono=${telefono}&operador=${operador}` |
| 5 | GET | `https://{base_url}/api/pagos/metodos` | — |
| 6+7 | POST | `https://{base_url}/api/pagos/registrar` | `{"telefonoCliente": "...", "monto": ..., "metodoPago": "...", "numeroOrden": "..."}` |
| 8 | POST | `https://{base_url}/api/recibos/emitir` | `?folio=${folio}&numeroOrden=${numeroOrden}` |

### Headers capturados (grabación HTTPS)

```
Content-Type: application/json
Accept: application/json
Accept-Encoding: gzip, deflate, br
Connection: keep-alive
Authorization: Bearer {access_token}   ← inyectado tras paso 1
```

### Datos extraídos entre pasos (correlación)

| Variable JMeter | Extracción | Uso |
|----------------|-----------|-----|
| `access_token` | JSONPath `$.access_token` tras paso 1 | Header `Authorization: Bearer` en pasos 2-8 |
| `refresh_token` | JSONPath `$.refresh_token` tras paso 1 | Renovación de sesión |
| `clienteId` | JSONPath `$.id` tras paso 2 | Trazabilidad |
| `folio` | JSONPath `$.folio` tras pasos 6+7 | Parámetro en paso 8 |

---

## Parametrización de datos

Los datos variables se externalizan en `datos_usuarios.csv`. Columnas:

```
user_id, telefono, nombre, operador, monto, metodoPago, authUser, authPass
```

El CSV contiene **20 usuarios** que se distribuyen en round-robin entre los hilos virtuales. Para añadir más usuarios, agregar filas al CSV respetando el formato.

---

## Configuración del plan de prueba

| Parámetro | Valor por defecto | Descripción |
|-----------|-------------------|-------------|
| `base_url` | `localhost` | Host del servidor principal |
| `base_port` | `8443` | Puerto HTTPS microservice-a |
| `auth_url` | `localhost` | Host del servidor de autenticación |
| `auth_port` | `9443` | Puerto HTTPS auth server |
| `thread_count` | `20` | Usuarios virtuales concurrentes |
| `ramp_up` | `60` | Tiempo de arranque en segundos |
| `duration` | `420` | Duración total en segundos (7 min) |
| `csv_file` | `datos_usuarios.csv` | Ruta al archivo CSV de datos |

---

## Proceso de grabación HTTPS

### Requisitos previos

1. Apache JMeter 5.6+ instalado
2. JDK 11+ (variable `JAVA_HOME` configurada)
3. Servidor(es) levantados en entorno de pruebas (no producción)
4. Certificado SSL del servidor importado en el truststore de JMeter (para entornos con certificado auto-firmado)

### Pasos para regrabar el tráfico

1. **Configurar proxy de grabación JMeter**:
   - En JMeter, ir a `Workbench` → agregar `HTTP(S) Test Script Recorder`
   - Port: `8888`
   - Target Controller: `Thread Group > PaymentBox E2E`
   - Marcar `HTTPS Domains`: `localhost` (o el dominio del servidor)

2. **Importar certificado JMeter en el navegador/cliente**:
   ```bash
   # El certificado se genera automáticamente en:
   %JMETER_HOME%\bin\ApacheJMeterTemporaryRootCA.crt
   # Importarlo en: Configuración del navegador → Certificados → Importar CA
   ```

3. **Configurar el cliente (navegador o Postman) para usar el proxy**:
   - Proxy HTTP/HTTPS: `127.0.0.1:8888`

4. **Ejecutar el flujo manualmente** siguiendo los 8 pasos:
   - Autenticarse: `POST /auth/login`
   - Buscar cliente por teléfono
   - Consultar montos disponibles
   - Validar operador
   - Consultar métodos de pago
   - Registrar pago
   - Emitir recibo

5. **Detener grabación** en JMeter → el plan se rellena con los samplers capturados

6. **Añadir parametrización**:
   - Reemplazar valores fijos por variables del CSV (`${telefono}`, `${operador}`, etc.)
   - Añadir extractores para `access_token` y `folio`
   - Configurar assertions de respuesta

7. **Guardar** como `paymentbox_https_recording.jmx`

---

## Ejecución

### Modo GUI (para verificación)

```bash
jmeter -t paymentbox_https_recording.jmx
```

### Modo no-GUI (ejecución de performance)

```bash
# Ejecución básica
jmeter -n \
  -t paymentbox_https_recording.jmx \
  -l ../resultados/resultado_$(date +%Y%m%d_%H%M%S).jtl \
  -e -o ../reportes/html/

# Con parámetros personalizados
jmeter -n \
  -t paymentbox_https_recording.jmx \
  -Jbase_url=api.paymentbox.att.com \
  -Jbase_port=443 \
  -Jauth_url=auth.paymentbox.att.com \
  -Jauth_port=443 \
  -Jthread_count=50 \
  -Jramp_up=120 \
  -Jduration=3600 \
  -Jcsv_file=datos_usuarios.csv \
  -l ../resultados/resultado_$(date +%Y%m%d_%H%M%S).jtl \
  -e -o ../reportes/html/
```

### Generar reporte HTML desde resultados existentes

```bash
jmeter -g ../resultados/resultado_YYYYMMDD_HHMMSS.jtl \
       -o ../reportes/html/
```

---

## Thresholds de aceptación

Alineados con el script k6 (`smoke_performance.js`):

| Métrica | Umbral |
|---------|--------|
| Flujo completo p95 | < 3000 ms |
| Login (paso 1+2) p95 | < 700 ms |
| Consulta (pasos 3+4) p95 | < 900 ms |
| Pago (pasos 6+7) p95 | < 1200 ms |
| Tasa de error | < 1 % |

---

## Comparación con script k6

| Característica | k6 (`smoke_performance.js`) | JMeter (este script) |
|---|---|---|
| Protocolo | HTTP | **HTTPS** |
| Origen | Scripting manual | **Grabación** |
| Auth | Sin token | **Bearer token OAuth2** |
| Parametrización | `users.json` | **CSV** |
| Formato resultados | JSON custom | **JTL + HTML** |
| GUI | No | Sí (JMeter) |

---

## Notas importantes

- **NO ejecutar contra rama `main`** del proyecto GitLab/GitHub
- Para entornos con certificado auto-firmado, añadir propiedad: `-Djavax.net.ssl.trustAll=true` (solo desarrollo)
- Los passwords del CSV deben actualizarse con credenciales reales antes de ejecutar
- Resultados se almacenan en `../resultados/` (relativo a `scripts/`)
- Reportes HTML en `../reportes/html/`

---

## Autores

- **Script**: GitHub Actions Expert (Multica Agent)
- **PoC**: AT&T QA — Optare Solutions
- **Versión**: 1.0.0 — Mayo 2026
