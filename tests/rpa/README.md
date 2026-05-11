# RPA Automatización Salesforce — AT&T PoC

Automatiza el flujo completo de ventas en Salesforce usando **Python + Playwright**.

## Flujo automatizado

| Paso | Acción | Screenshot |
|------|--------|-----------|
| 1 | Login en Salesforce | `01_login_form.png`, `02_post_login.png` |
| 2 | Crear cliente nuevo | `03_nuevo_cliente_form.png`, `04_cliente_creado.png` |
| 3 | Asignar producto de recarga | `05_asignar_producto_form.png`, `06_producto_asignado.png` |
| 4 | Cargar documento de identidad (biométrica) | `07_carga_documento_identidad.png` |
| 5 | Proceso de pago | `08_proceso_pago.png` |
| 6 | Verificación crediticia | `09_verificacion_crediticia.png` |
| 7 | Resultado de la venta | `10_venta_completada.png` |

## Variables de entorno requeridas

```bash
SF_URL=https://your-instance.salesforce.com
SF_USERNAME=user@example.com
SF_PASSWORD=your_password
SF_SECURITY_TOKEN=your_security_token   # opcional si IP está en allowlist
RPA_HEADLESS=true                        # false para depuración local
RPA_SLOW_MO=0                           # ms entre acciones (útil para demo: 500)
SCREENSHOT_DIR=screenshots
```

## Ejecución local

```bash
cd tests/rpa
pip install -r requirements.txt
playwright install chromium
python main.py
```

## Ejecución en CI/CD

El pipeline `ci-cd-att.yml` ejecuta este script cuando la variable de repositorio `RPA_ENABLED=true`.

Los secrets de Salesforce deben configurarse en **Settings → Secrets and variables → Actions**:
- `SF_URL`
- `SF_USERNAME`
- `SF_PASSWORD`
- `SF_SECURITY_TOKEN`

## Evidencias

Las capturas de pantalla se guardan en `screenshots/` y se publican como artefactos del pipeline.
