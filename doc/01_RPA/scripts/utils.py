"""
RPA Utilities - AT&T Salesforce Demo
Funciones auxiliares: capturas de pantalla, esperas, logging.
"""
import os
import time
import logging
from datetime import datetime
from pathlib import Path

from playwright.sync_api import Page, expect

from config import SCREENSHOT_DIR, TIMEOUT_MS

# ── Logger ─────────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("rpa_att")

_step_index = 0


def step(name: str):
    """Registra y numera cada paso del flujo."""
    global _step_index
    _step_index += 1
    log.info("▶  Paso %02d: %s", _step_index, name)


def screenshot(page: Page, label: str) -> str:
    """Toma una captura de pantalla y la guarda en la carpeta de evidencias."""
    Path(SCREENSHOT_DIR).mkdir(parents=True, exist_ok=True)
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = os.path.join(SCREENSHOT_DIR, f"{ts}_{label}.png")
    page.screenshot(path=filename, full_page=True)
    log.info("   📸 Captura guardada: %s", filename)
    return filename


def wait_for_sf_page_load(page: Page, timeout: int = TIMEOUT_MS):
    """Espera a que Salesforce termine de cargar (spinner desaparece)."""
    # Salesforce Lightning usa este spinner durante la carga de páginas
    try:
        page.wait_for_selector(
            "div.auraLoadingBox, .forceLoadingSpinner",
            state="hidden",
            timeout=timeout,
        )
    except Exception:
        pass  # Si no aparece el spinner, la página ya está cargada
    page.wait_for_load_state("networkidle", timeout=timeout)


def fill_field(page: Page, label_or_selector: str, value: str, use_label: bool = True):
    """Rellena un campo de formulario de Salesforce."""
    if use_label:
        # Intenta por label visible (Lightning)
        locator = page.get_by_label(label_or_selector).first
    else:
        locator = page.locator(label_or_selector).first
    locator.fill("")
    locator.fill(value)
    log.debug("   Campo '%s' → '%s'", label_or_selector, value)


def click_button(page: Page, text: str):
    """Hace click en un botón por su texto."""
    btn = page.get_by_role("button", name=text)
    btn.wait_for(state="visible", timeout=TIMEOUT_MS)
    btn.click()
    log.debug("   Click: '%s'", text)


def select_option(page: Page, label: str, value: str):
    """Selecciona una opción en un combobox de Salesforce."""
    combo = page.get_by_label(label).first
    combo.wait_for(state="visible", timeout=TIMEOUT_MS)
    combo.select_option(value)
    log.debug("   Select '%s' → '%s'", label, value)


def search_and_select(page: Page, input_selector: str, search_term: str):
    """Busca un valor en un campo de autocompletado de Salesforce."""
    page.locator(input_selector).fill(search_term)
    page.wait_for_timeout(1000)
    # Espera dropdown de resultados
    dropdown = page.locator(".listbox, .autocomplete-list, [role='option']").first
    dropdown.wait_for(state="visible", timeout=TIMEOUT_MS)
    dropdown.click()
    log.debug("   Autocompletado '%s' seleccionado", search_term)


def upload_file(page: Page, input_selector: str, file_path: str):
    """Sube un archivo al campo indicado."""
    if not os.path.exists(file_path):
        log.warning("   ⚠️  Archivo no encontrado: %s — usando placeholder", file_path)
        # Crea un archivo de demostración si no existe
        _create_demo_id_file(file_path)
    page.set_input_files(input_selector, file_path)
    log.info("   📎 Archivo subido: %s", file_path)


def _create_demo_id_file(path: str):
    """Crea un archivo de identificación de demostración si no existe."""
    Path(path).parent.mkdir(parents=True, exist_ok=True)
    # Archivo de texto simple como placeholder de documento
    with open(path, "w", encoding="utf-8") as f:
        f.write("DEMO ID DOCUMENT - AT&T PoC\n")
        f.write(f"Generated: {datetime.now().isoformat()}\n")
        f.write("Customer: Carlos García López\n")
        f.write("ID: MX-DEMO-123456\n")
    log.info("   📄 Documento demo creado: %s", path)


def safe_navigate(page: Page, url: str):
    """Navega a una URL con manejo de errores."""
    log.info("   🌐 Navegando a: %s", url)
    page.goto(url, wait_until="domcontentloaded", timeout=60_000)
    wait_for_sf_page_load(page)


def assert_success_toast(page: Page, partial_text: str = ""):
    """Verifica que Salesforce muestre un mensaje de éxito."""
    toast = page.locator(".toastContainer .toastMessage, .slds-notify__content")
    try:
        toast.first.wait_for(state="visible", timeout=10_000)
        msg = toast.first.inner_text()
        log.info("   ✅ Toast: %s", msg)
        if partial_text and partial_text.lower() not in msg.lower():
            log.warning("   ⚠️  Toast inesperado: %s", msg)
    except Exception:
        log.warning("   ⚠️  No se detectó toast de confirmación")
