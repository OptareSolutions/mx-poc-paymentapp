# RPA — Flujo de Ventas Salesforce (AT&T Demo)

## Descripción

Script de automatización RPA del flujo de ventas end-to-end en Salesforce para la demo AT&T.  
Implementado con **Python + Playwright** (sin Selenium, más estable y moderno).

---

## Flujo Automatizado (9 pasos, ~5-10 min)

| # | Paso | Descripción |
|---|------|-------------|
| 1 | **Login** | Autenticación en Salesforce Lightning |
| 2 | **Crear Account** | Empresa cliente con datos del demo |
| 3 | **Crear Contact** | Persona de contacto vinculada a la Account |
| 4 | **Crear Oportunidad** | Opportunity con fecha de cierre y monto estimado |
| 5 | **Asignar Producto** | Plan AT&T Empresarial 5G — 5 líneas × $1,500 MXN |
| 6 | **Carga Documento ID** | Subida de documento de identidad biométrica |
| 7 | **Verificación Crediticia** | Registro de actividad de crédito aprobado |
| 8 | **Proceso de Pago** | Configuración de método de pago (transferencia BBVA) |
| 9 | **Cierre de Venta** | Actualización a **Closed Won** |

---

## Estructura de archivos

```
01_RPA/
├── scripts/
│   ├── salesforce_flow.py   # Script principal del flujo
│   ├── config.py            # Configuración y parámetros
│   ├── utils.py             # Funciones auxiliares
│   └── requirements.txt     # Dependencias Python
├── evidencias/              # Capturas de pantalla automáticas
│   └── *.png                # Generadas en cada ejecución
└── documentacion/
    └── README.md            # Este archivo
```

---

## Pre-requisitos

```bash
# Python 3.9+
pip install -r scripts/requirements.txt
playwright install chromium
```

---

## Configuración (variables de entorno)

| Variable | Descripción | Obligatoria |
|----------|-------------|-------------|
| `SF_URL` | URL de Salesforce (ej: `https://org.my.salesforce.com`) | ✅ |
| `SF_USERNAME` | Usuario/email de Salesforce | ✅ |
| `SF_PASSWORD` | Contraseña Salesforce | ✅ |
| `SF_SECURITY_TOKEN` | Token de seguridad Salesforce | ✅ |
| `ID_DOCUMENT_PATH` | Ruta al documento de identidad a subir | Opcional |
| `RPA_HEADLESS` | `true` = sin ventana, `false` = ventana visible | Opcional |
| `RPA_SLOW_MO` | Milisegundos de espera entre acciones (default: 800) | Opcional |

### Configurar en Windows (PowerShell)

```powershell
$env:SF_URL = "https://tuorg.my.salesforce.com"
$env:SF_USERNAME = "usuario@tuorg.com"
$env:SF_PASSWORD = "tupassword"
$env:SF_SECURITY_TOKEN = "tutoken"
```

---

## Ejecución

### Modo visual (demo en vivo — navegador visible)

```bash
cd scripts
python salesforce_flow.py
```

### Modo headless (CI/CD)

```bash
cd scripts
python salesforce_flow.py --headless
```

---

## Evidencias

Las capturas de pantalla se guardan automáticamente en:

```
C:\Users\jcunha\Documents\Optare\Clientes\AT_T\QA\01_RPA\evidencias\
```

Formato: `YYYYMMDD_HHMMSS_<etiqueta>.png`

Capturas generadas por paso:
- `01_login_ok.png`
- `02a_account_form.png` / `02b_account_saved.png`
- `03a_contact_form.png` / `03b_contact_saved.png`
- `04a_opportunity_form.png` / `04b_opportunity_saved.png`
- `05a_product_search.png` / `05b_product_config.png` / `05c_product_saved.png`
- `06a_id_upload.png` / `06b_id_uploaded.png`
- `07a_credit_check_form.png` / `07b_credit_check_saved.png`
- `08a_payment_config.png` / `08b_payment_saved.png`
- `09a_close_sale_form.png` / `09b_sale_closed_won.png`

---

## Pipeline CI/CD

El workflow de GitHub Actions está en:

```
02_CI_CD/rpa/pipeline-rpa-salesforce.yml
```

Ejecución automática: lunes a viernes a las 08:00 UTC  
También se puede ejecutar manualmente desde GitHub Actions → `workflow_dispatch`

Secrets necesarios en el repositorio:
- `SF_URL`
- `SF_USERNAME`  
- `SF_PASSWORD`
- `SF_SECURITY_TOKEN`

---

## Datos de Demo

### Cliente

| Campo | Valor |
|-------|-------|
| Nombre | Carlos García López |
| Email | carlos.garcia@demo-att.com |
| Teléfono | 5512345678 |
| Empresa | Empresa Demo AT&T |
| RFC | GALC850101AAA |
| ID | MX-DEMO-123456 |

### Producto AT&T

| Campo | Valor |
|-------|-------|
| Nombre | AT&T Plan Empresarial 5G |
| Código | ATT-EMP-5G-001 |
| Líneas | 5 |
| Plan | Ilimitado Plus |
| Precio mensual | $1,500.00 MXN |
| Contrato | 24 meses |
| Total | $36,000.00 MXN |

### Crédito y Pago

| Campo | Valor |
|-------|-------|
| Score mínimo | 650 |
| Método | Transferencia Bancaria |
| Banco | BBVA México |
| CLABE (demo) | 012180015310087229 |

---

## Notas técnicas

- El script usa **esperas dinámicas** (`networkidle`, selectores visibles) en lugar de `time.sleep()` fijos para mayor robustez.
- Los pasos son independientes: si uno falla, los demás continúan (resiliencia para demo en vivo).
- Los **selectores de Salesforce Lightning** pueden variar según la versión y configuración del org; ajustar en `utils.py` si es necesario.
- El modo visual (`--no headless`) con `SLOW_MO=800ms` es óptimo para presentaciones (~8-10 min).
- El modo headless es para pipelines CI/CD (~4-5 min).

---

## Troubleshooting

**Error: "Credenciales no configuradas"**  
→ Verificar que las variables de entorno `SF_USERNAME` y `SF_PASSWORD` estén exportadas.

**Error en un paso concreto**  
→ Revisar captura de pantalla en `evidencias/error_<paso>.png`  
→ Ajustar selectores en `utils.py` para el org específico de AT&T.

**Selector no encontrado**  
→ Salesforce puede usar selectores dinámicos. Usar DevTools en el navegador para inspeccionar y actualizar en `salesforce_flow.py`.

---

*Última actualización: 2026-05-07*  
*Proyecto: QA_POC_ATT*
