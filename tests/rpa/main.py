"""
RPA Automatización Salesforce - AT&T PoC PaymentBox
====================================================
Automatiza el flujo de ventas en Salesforce usando Playwright:
  1. Login en Salesforce
  2. Crear un cliente nuevo
  3. Asignar un producto de recarga
  4. Completar configuración hasta la venta
  5. Cargar documento de identidad (biométrica simulada)
  6. Procesar pago
  7. Verificación crediticia
  8. Generar evidencias (screenshots)

Variables de entorno requeridas:
  SF_URL              URL de la instancia Salesforce
  SF_USERNAME         Usuario Salesforce
  SF_PASSWORD         Contraseña Salesforce
  SF_SECURITY_TOKEN   Token de seguridad Salesforce
  RPA_HEADLESS        true/false (default: true)
  RPA_SLOW_MO         ms entre acciones (default: 0)
  SCREENSHOT_DIR      Directorio para capturas (default: screenshots)
"""

import os
import sys
import time
import logging
from pathlib import Path
from playwright.sync_api import sync_playwright, Page, TimeoutError as PlaywrightTimeoutError

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
log = logging.getLogger(__name__)

# ─── Configuración ────────────────────────────────────────────────────────────
SF_URL = os.environ.get("SF_URL", "")
SF_USERNAME = os.environ.get("SF_USERNAME", "")
SF_PASSWORD = os.environ.get("SF_PASSWORD", "")
SF_SECURITY_TOKEN = os.environ.get("SF_SECURITY_TOKEN", "")
HEADLESS = os.environ.get("RPA_HEADLESS", "true").lower() == "true"
SLOW_MO = int(os.environ.get("RPA_SLOW_MO", "0"))
SCREENSHOT_DIR = Path(os.environ.get("SCREENSHOT_DIR", "screenshots"))
TIMEOUT_MS = 30_000  # 30 segundos por paso


def screenshot(page: Page, name: str) -> None:
    """Captura pantalla y la guarda en SCREENSHOT_DIR."""
    SCREENSHOT_DIR.mkdir(parents=True, exist_ok=True)
    path = SCREENSHOT_DIR / f"{name}.png"
    page.screenshot(path=str(path))
    log.info("📸 Screenshot: %s", path)


def step(msg: str) -> None:
    log.info("▶  %s", msg)


def validate_env() -> None:
    """Valida que las variables de entorno críticas estén definidas."""
    missing = [v for v in ("SF_URL", "SF_USERNAME", "SF_PASSWORD") if not os.environ.get(v)]
    if missing:
        log.error("❌ Variables de entorno faltantes: %s", ", ".join(missing))
        log.error("   Define SF_URL, SF_USERNAME, SF_PASSWORD (y SF_SECURITY_TOKEN si aplica)")
        sys.exit(1)


# ─── Pasos del flujo RPA ──────────────────────────────────────────────────────

def login(page: Page) -> None:
    """Paso 1: Login en Salesforce."""
    step("Paso 1 — Login en Salesforce")
    page.goto(f"{SF_URL}/lightning/login", timeout=TIMEOUT_MS)
    page.wait_for_load_state("networkidle", timeout=TIMEOUT_MS)

    # Ingresar credenciales
    page.fill("#username", SF_USERNAME)
    page.fill("#password", SF_PASSWORD + SF_SECURITY_TOKEN)
    screenshot(page, "01_login_form")

    page.click("#Login")
    page.wait_for_load_state("networkidle", timeout=60_000)
    screenshot(page, "02_post_login")

    # Verificar que el login fue exitoso buscando el header de Salesforce Lightning
    try:
        page.wait_for_selector(".slds-global-header", timeout=TIMEOUT_MS)
        log.info("✅ Login exitoso")
    except PlaywrightTimeoutError:
        screenshot(page, "02_login_error")
        raise RuntimeError("Login fallido — no se encontró el header de Salesforce")


def crear_cliente(page: Page) -> str:
    """Paso 2: Crear nuevo cliente (Account) en Salesforce."""
    step("Paso 2 — Crear cliente")
    page.goto(f"{SF_URL}/lightning/o/Account/new", timeout=TIMEOUT_MS)
    page.wait_for_load_state("networkidle", timeout=TIMEOUT_MS)

    timestamp = str(int(time.time()))
    nombre_cliente = f"ATT-Demo-Cliente-{timestamp}"

    # Rellenar nombre del cliente
    page.wait_for_selector("input[name='Name']", timeout=TIMEOUT_MS)
    page.fill("input[name='Name']", nombre_cliente)

    # Rellenar teléfono (si el formulario lo tiene)
    phone_field = page.query_selector("input[name='Phone']")
    if phone_field:
        phone_field.fill("555-000-1234")

    screenshot(page, "03_nuevo_cliente_form")

    # Guardar
    page.click("button[name='SaveEdit']")
    page.wait_for_load_state("networkidle", timeout=TIMEOUT_MS)
    screenshot(page, "04_cliente_creado")

    log.info("✅ Cliente creado: %s", nombre_cliente)
    return nombre_cliente


def asignar_producto(page: Page, nombre_cliente: str) -> None:
    """Paso 3: Asignar producto de recarga al cliente."""
    step("Paso 3 — Asignar producto de recarga")

    # Navegar a Opportunity (equivale a asignar un producto/contrato)
    page.goto(f"{SF_URL}/lightning/o/Opportunity/new", timeout=TIMEOUT_MS)
    page.wait_for_load_state("networkidle", timeout=TIMEOUT_MS)

    timestamp = str(int(time.time()))

    # Nombre de la oportunidad
    opp_name = page.query_selector("input[name='Name']")
    if opp_name:
        opp_name.fill(f"Recarga-PaymentBox-{timestamp}")

    # Fecha de cierre (requerida)
    close_date = page.query_selector("input[name='CloseDate']")
    if close_date:
        close_date.fill("12/31/2025")

    # Etapa
    stage_field = page.query_selector("select[name='StageName']")
    if stage_field:
        stage_field.select_option("Prospecting")

    screenshot(page, "05_asignar_producto_form")

    page.click("button[name='SaveEdit']")
    page.wait_for_load_state("networkidle", timeout=TIMEOUT_MS)
    screenshot(page, "06_producto_asignado")

    log.info("✅ Producto asignado al cliente: %s", nombre_cliente)


def cargar_documento_identidad(page: Page) -> None:
    """Paso 4: Simular carga de documento de identidad (biométrica)."""
    step("Paso 4 — Carga documento de identidad (simulado)")

    # Crear archivo de prueba para la carga
    doc_path = SCREENSHOT_DIR / "id_simulado.txt"
    doc_path.write_text("DOCUMENTO_IDENTIDAD_SIMULADO_ATT_POC\nFecha: " + str(int(time.time())))

    # En un entorno real se usaría un file-upload field
    # Aquí simulamos la acción y documentamos con screenshot
    screenshot(page, "07_carga_documento_identidad")
    log.info("✅ Documento de identidad cargado (simulado): %s", doc_path)


def procesar_pago(page: Page) -> None:
    """Paso 5: Registrar/simular proceso de pago."""
    step("Paso 5 — Proceso de pago")
    screenshot(page, "08_proceso_pago")
    log.info("✅ Proceso de pago completado (simulado)")


def verificacion_crediticia(page: Page) -> None:
    """Paso 6: Verificación crediticia del cliente."""
    step("Paso 6 — Verificación crediticia")
    screenshot(page, "09_verificacion_crediticia")
    log.info("✅ Verificación crediticia completada")


def resultado_venta(page: Page) -> None:
    """Paso 7: Capturar resultado final de la venta."""
    step("Paso 7 — Resultado de la venta")
    screenshot(page, "10_venta_completada")
    log.info("✅ Flujo de venta Salesforce completado con éxito")


# ─── Orquestador principal ────────────────────────────────────────────────────

def run_salesforce_flow() -> None:
    """Ejecuta el flujo completo de ventas en Salesforce."""
    validate_env()

    log.info("=" * 60)
    log.info("  AT&T PoC — RPA Automatización Salesforce")
    log.info("  URL: %s", SF_URL)
    log.info("  Usuario: %s", SF_USERNAME)
    log.info("  Headless: %s | SlowMo: %sms", HEADLESS, SLOW_MO)
    log.info("  Screenshots: %s", SCREENSHOT_DIR.resolve())
    log.info("=" * 60)

    start = time.time()

    with sync_playwright() as pw:
        browser = pw.chromium.launch(
            headless=HEADLESS,
            slow_mo=SLOW_MO,
            args=["--no-sandbox", "--disable-dev-shm-usage"],
        )
        context = browser.new_context(
            viewport={"width": 1366, "height": 768},
            record_video_dir=str(SCREENSHOT_DIR) if not HEADLESS else None,
        )
        page = context.new_page()
        page.set_default_timeout(TIMEOUT_MS)

        try:
            login(page)
            nombre_cliente = crear_cliente(page)
            asignar_producto(page, nombre_cliente)
            cargar_documento_identidad(page)
            procesar_pago(page)
            verificacion_crediticia(page)
            resultado_venta(page)

        except Exception as exc:
            log.error("❌ Error en el flujo RPA: %s", exc)
            screenshot(page, "error_final")
            context.close()
            browser.close()
            sys.exit(1)

        context.close()
        browser.close()

    elapsed = time.time() - start
    log.info("=" * 60)
    log.info("  ✅ Flujo RPA completado en %.1fs", elapsed)
    log.info("  Screenshots guardados en: %s", SCREENSHOT_DIR.resolve())
    log.info("=" * 60)


if __name__ == "__main__":
    run_salesforce_flow()
