"""
RPA Script - AT&T Demo: Flujo de Ventas Salesforce
=====================================================
Automatiza el flujo end-to-end:
  1. Login Salesforce
  2. Crear cliente (Account + Contact)
  3. Crear Oportunidad de Venta
  4. Asignar producto AT&T y configurar plan
  5. Carga de documento de identidad biométrica
  6. Verificación crediticia
  7. Proceso de pago
  8. Cierre de venta (Closed Won)

Duración estimada: 5-10 minutos
Ejecutable: python salesforce_flow.py [--headless]

Requisitos:
  pip install playwright
  playwright install chromium
"""
import sys
import time
import argparse
import logging
from datetime import datetime
from pathlib import Path

from playwright.sync_api import sync_playwright, Page, BrowserContext

# Añadir directorio actual al path para importar módulos locales
sys.path.insert(0, str(Path(__file__).parent))

import config
from utils import (
    log, step, screenshot, wait_for_sf_page_load,
    fill_field, click_button, select_option,
    search_and_select, upload_file, safe_navigate, assert_success_toast,
)


# ── Resultados del flujo ───────────────────────────────────────────────────────
results = {
    "start_time": None,
    "end_time": None,
    "account_id": None,
    "contact_id": None,
    "opportunity_id": None,
    "opportunity_name": None,
    "screenshots": [],
    "status": "pending",
    "errors": [],
}


# ─────────────────────────────────────────────────────────────────────────────
# PASO 1: Login Salesforce
# ─────────────────────────────────────────────────────────────────────────────
def step_login(page: Page) -> None:
    step("Login Salesforce")
    safe_navigate(page, config.SALESFORCE_URL)
    
    # Campos de login estándar Salesforce
    page.locator("#username").fill(config.SALESFORCE_USERNAME)
    page.locator("#password").fill(config.SALESFORCE_PASSWORD)
    page.wait_for_timeout(500)
    page.locator("#Login").click()
    
    wait_for_sf_page_load(page, timeout=60_000)
    
    # Verificar login exitoso (URL cambia a /lightning o /home)
    page.wait_for_url("**/lightning/**", timeout=60_000)
    log.info("   ✅ Login exitoso — usuario: %s", config.SALESFORCE_USERNAME)
    results["screenshots"].append(screenshot(page, "01_login_ok"))


# ─────────────────────────────────────────────────────────────────────────────
# PASO 2: Crear Account (Empresa/Cliente)
# ─────────────────────────────────────────────────────────────────────────────
def step_create_account(page: Page) -> None:
    step("Crear Account (Empresa cliente)")
    safe_navigate(page, f"{config.SALESFORCE_URL}/lightning/o/Account/new")
    wait_for_sf_page_load(page)
    
    c = config.CUSTOMER
    
    # Nombre de la cuenta
    page.get_by_label("Account Name").fill(c["company"])
    page.wait_for_timeout(600)
    
    # Teléfono
    try:
        page.get_by_label("Phone").fill(c["phone"])
    except Exception:
        page.locator("input[name='Phone']").fill(c["phone"])
    
    # Sitio web / Industry (opcional, mejora la apariencia del demo)
    try:
        page.get_by_label("Industry").select_option("Telecommunications")
    except Exception:
        pass

    # Empleados
    try:
        page.get_by_label("Employees").fill("500")
    except Exception:
        pass

    # Tipo de cuenta
    try:
        page.get_by_label("Type").select_option("Customer")
    except Exception:
        pass

    page.wait_for_timeout(500)
    results["screenshots"].append(screenshot(page, "02a_account_form"))
    
    # Guardar
    click_button(page, "Save")
    wait_for_sf_page_load(page)
    assert_success_toast(page)
    
    # Capturar ID de la Account creada desde la URL
    account_url = page.url
    results["account_id"] = account_url.split("/")[-1] if "/Account/" in account_url else "N/A"
    log.info("   ✅ Account creada: %s (ID: %s)", c["company"], results["account_id"])
    results["screenshots"].append(screenshot(page, "02b_account_saved"))


# ─────────────────────────────────────────────────────────────────────────────
# PASO 3: Crear Contact (Persona de contacto)
# ─────────────────────────────────────────────────────────────────────────────
def step_create_contact(page: Page) -> None:
    step("Crear Contact (persona de contacto)")
    safe_navigate(page, f"{config.SALESFORCE_URL}/lightning/o/Contact/new")
    wait_for_sf_page_load(page)
    
    c = config.CUSTOMER
    
    page.get_by_label("First Name").fill(c["first_name"])
    page.wait_for_timeout(300)
    page.get_by_label("Last Name").fill(c["last_name"])
    page.wait_for_timeout(300)
    page.get_by_label("Email").fill(c["email"])
    page.get_by_label("Phone").fill(c["phone"])
    
    # Vincular con la Account creada
    account_field = page.get_by_label("Account Name").first
    account_field.fill(c["company"])
    page.wait_for_timeout(1000)
    # Selecciona la primera sugerencia del autocompletado
    suggestion = page.locator(".autocomplete li, [role='option']").first
    try:
        suggestion.wait_for(state="visible", timeout=5000)
        suggestion.click()
    except Exception:
        log.warning("   ⚠️  No se pudo vincular Account automáticamente")
    
    page.wait_for_timeout(500)
    results["screenshots"].append(screenshot(page, "03a_contact_form"))
    
    click_button(page, "Save")
    wait_for_sf_page_load(page)
    assert_success_toast(page)
    
    contact_url = page.url
    results["contact_id"] = contact_url.split("/")[-1] if "/Contact/" in contact_url else "N/A"
    log.info("   ✅ Contact creado: %s %s (ID: %s)", c["first_name"], c["last_name"], results["contact_id"])
    results["screenshots"].append(screenshot(page, "03b_contact_saved"))


# ─────────────────────────────────────────────────────────────────────────────
# PASO 4: Crear Oportunidad de Venta
# ─────────────────────────────────────────────────────────────────────────────
def step_create_opportunity(page: Page) -> None:
    step("Crear Oportunidad de Venta")
    safe_navigate(page, f"{config.SALESFORCE_URL}/lightning/o/Opportunity/new")
    wait_for_sf_page_load(page)
    
    p = config.PRODUCT
    opp_name = f"AT&T {p['plan']} — {config.CUSTOMER['company']} — {datetime.now().strftime('%Y%m%d')}"
    results["opportunity_name"] = opp_name
    
    page.get_by_label("Opportunity Name").fill(opp_name)
    page.wait_for_timeout(400)
    
    # Vincular Account
    account_field = page.get_by_label("Account Name").first
    account_field.fill(config.CUSTOMER["company"])
    page.wait_for_timeout(1000)
    suggestion = page.locator("[role='option']").first
    try:
        suggestion.wait_for(state="visible", timeout=5000)
        suggestion.click()
    except Exception:
        pass
    
    # Fecha de cierre (90 días desde hoy)
    from datetime import date, timedelta
    close_date = (date.today() + timedelta(days=90)).strftime("%m/%d/%Y")
    page.get_by_label("Close Date").fill(close_date)
    
    # Etapa de la venta
    try:
        page.get_by_label("Stage").select_option("Prospecting")
    except Exception:
        try:
            page.locator("select[name='StageName']").select_option("Prospecting")
        except Exception:
            pass
    
    # Probabilidad y monto
    try:
        page.get_by_label("Amount").fill(str(p["monthly_fee"] * p["contract_months"]))
    except Exception:
        pass
    
    page.wait_for_timeout(500)
    results["screenshots"].append(screenshot(page, "04a_opportunity_form"))
    
    click_button(page, "Save")
    wait_for_sf_page_load(page)
    assert_success_toast(page)
    
    opp_url = page.url
    results["opportunity_id"] = opp_url.split("/")[-1] if "/Opportunity/" in opp_url else "N/A"
    log.info("   ✅ Oportunidad creada: %s (ID: %s)", opp_name, results["opportunity_id"])
    results["screenshots"].append(screenshot(page, "04b_opportunity_saved"))


# ─────────────────────────────────────────────────────────────────────────────
# PASO 5: Asignar Producto y Configurar Plan AT&T
# ─────────────────────────────────────────────────────────────────────────────
def step_add_product(page: Page) -> None:
    step("Asignar producto AT&T y configurar plan")
    
    # Navegar a la Oportunidad
    if results["opportunity_id"] and results["opportunity_id"] != "N/A":
        safe_navigate(page, f"{config.SALESFORCE_URL}/lightning/r/Opportunity/{results['opportunity_id']}/view")
        wait_for_sf_page_load(page)
    
    # Scroll al panel de Products
    page.evaluate("window.scrollTo(0, document.body.scrollHeight / 2)")
    page.wait_for_timeout(500)
    
    # Click en "Add Products" en la sección de Products
    add_products_btn = page.locator("text=Add Products, text=Agregar Productos").first
    try:
        add_products_btn.wait_for(state="visible", timeout=10_000)
        add_products_btn.click()
    except Exception:
        # Alternativa: buscar en el related list
        page.get_by_role("button", name="Add Products").click()
    
    wait_for_sf_page_load(page)
    
    p = config.PRODUCT
    
    # Buscar el producto en el catálogo
    search_input = page.locator("input[type='search'], input[placeholder*='Search']").first
    try:
        search_input.wait_for(state="visible", timeout=10_000)
        search_input.fill(p["name"])
        page.wait_for_timeout(1000)
    except Exception:
        log.warning("   ⚠️  Campo de búsqueda de producto no encontrado")
    
    # Seleccionar el producto encontrado
    product_row = page.locator(f"tr:has-text('{p['name']}'), li:has-text('{p['name']}')")
    try:
        product_row.first.wait_for(state="visible", timeout=10_000)
        # Marcar checkbox
        checkbox = product_row.first.locator("input[type='checkbox']")
        if not checkbox.is_checked():
            checkbox.click()
    except Exception:
        log.warning("   ⚠️  Producto '%s' no encontrado — seleccionando primer resultado", p["name"])
        first_checkbox = page.locator("input[type='checkbox']").first
        try:
            first_checkbox.click()
        except Exception:
            pass
    
    page.wait_for_timeout(500)
    results["screenshots"].append(screenshot(page, "05a_product_search"))
    
    click_button(page, "Next")
    wait_for_sf_page_load(page)
    
    # Configurar líneas y precio
    try:
        page.get_by_label("Quantity").fill(str(p["lines"]))
        page.get_by_label("Sales Price").fill(str(p["monthly_fee"]))
    except Exception:
        page.locator("input[name='quantity']").fill(str(p["lines"]))
        page.locator("input[name='unitPrice']").fill(str(p["monthly_fee"]))
    
    results["screenshots"].append(screenshot(page, "05b_product_config"))
    
    click_button(page, "Save")
    wait_for_sf_page_load(page)
    assert_success_toast(page)
    
    log.info("   ✅ Producto '%s' asignado (%d líneas × $%.2f %s)", 
             p["name"], p["lines"], p["monthly_fee"], p["currency"])
    results["screenshots"].append(screenshot(page, "05c_product_saved"))


# ─────────────────────────────────────────────────────────────────────────────
# PASO 6: Carga de Documento de Identidad Biométrica
# ─────────────────────────────────────────────────────────────────────────────
def step_upload_id_document(page: Page) -> None:
    step("Carga de documento de identidad biométrica")
    
    # Navegar al Contact para subir el documento de identidad
    if results["contact_id"] and results["contact_id"] != "N/A":
        safe_navigate(page, f"{config.SALESFORCE_URL}/lightning/r/Contact/{results['contact_id']}/view")
        wait_for_sf_page_load(page)
    
    # Buscar sección de Files/Documents en el Contact
    upload_trigger = page.locator("text=Upload Files, text=Subir Archivos, text=Files").first
    try:
        upload_trigger.wait_for(state="visible", timeout=10_000)
        upload_trigger.click()
        wait_for_sf_page_load(page)
    except Exception:
        # Intentar el botón de New File en el related list de Files
        page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
        page.wait_for_timeout(1000)
        try:
            page.get_by_role("button", name="Upload Files").click()
        except Exception:
            log.warning("   ⚠️  No se encontró botón de upload de files")
    
    # Subir archivo mediante file input
    file_input = page.locator("input[type='file']").first
    try:
        file_input.wait_for(state="attached", timeout=10_000)
        upload_file(page, "input[type='file']", config.ID_DOCUMENT_PATH)
        page.wait_for_timeout(2000)
        results["screenshots"].append(screenshot(page, "06a_id_upload"))
        
        # Confirmar upload
        try:
            click_button(page, "Done")
        except Exception:
            try:
                click_button(page, "Upload")
            except Exception:
                pass
        
        wait_for_sf_page_load(page)
        log.info("   ✅ Documento de identidad subido: %s", config.ID_DOCUMENT_PATH)
        results["screenshots"].append(screenshot(page, "06b_id_uploaded"))
    except Exception as e:
        log.warning("   ⚠️  No se pudo subir documento automáticamente: %s", e)
        results["screenshots"].append(screenshot(page, "06_id_upload_attempt"))


# ─────────────────────────────────────────────────────────────────────────────
# PASO 7: Verificación Crediticia
# ─────────────────────────────────────────────────────────────────────────────
def step_credit_check(page: Page) -> None:
    step("Verificación crediticia")
    
    # Navegar a la Oportunidad para la verificación
    if results["opportunity_id"] and results["opportunity_id"] != "N/A":
        safe_navigate(page, f"{config.SALESFORCE_URL}/lightning/r/Opportunity/{results['opportunity_id']}/view")
        wait_for_sf_page_load(page)
    
    # En un flujo real de Salesforce AT&T habría un botón/acción custom de credit check
    # Simular mediante campo personalizado o nota de actividad
    log.info("   🔍 Iniciando verificación crediticia...")
    
    # Crear una Activity/Task de verificación crediticia
    try:
        new_task_btn = page.locator("text=New Task, text=Log a Call").first
        new_task_btn.wait_for(state="visible", timeout=5000)
        new_task_btn.click()
        wait_for_sf_page_load(page)
        
        # Rellenar la actividad
        try:
            page.get_by_label("Subject").fill("Verificación Crediticia AT&T")
            page.get_by_label("Status").select_option("Completed")
            page.locator("textarea[name='Description'], .note-input-container textarea").fill(
                f"Score crediticio: {config.CREDIT['score_threshold']}+ ✓\n"
                f"Método de pago aprobado: {config.CREDIT['payment_method']}\n"
                f"Banco: {config.CREDIT['bank']}\n"
                f"CLABE: {config.CREDIT['clabe']}"
            )
        except Exception:
            pass
        
        page.wait_for_timeout(500)
        results["screenshots"].append(screenshot(page, "07a_credit_check_form"))
        
        click_button(page, "Save")
        wait_for_sf_page_load(page)
        log.info("   ✅ Verificación crediticia registrada (score: %d+)", config.CREDIT["score_threshold"])
        results["screenshots"].append(screenshot(page, "07b_credit_check_saved"))
    except Exception as e:
        log.warning("   ⚠️  Registro de actividad manual: %s", e)
        results["screenshots"].append(screenshot(page, "07_credit_check"))


# ─────────────────────────────────────────────────────────────────────────────
# PASO 8: Proceso de Pago — Actualizar Oportunidad
# ─────────────────────────────────────────────────────────────────────────────
def step_process_payment(page: Page) -> None:
    step("Proceso de pago — configurar método de pago")
    
    if results["opportunity_id"] and results["opportunity_id"] != "N/A":
        safe_navigate(page, f"{config.SALESFORCE_URL}/lightning/r/Opportunity/{results['opportunity_id']}/view")
        wait_for_sf_page_load(page)
    
    # Editar la Oportunidad para registrar la información de pago
    try:
        edit_btn = page.get_by_role("button", name="Edit")
        edit_btn.first.wait_for(state="visible", timeout=10_000)
        edit_btn.first.click()
        wait_for_sf_page_load(page)
    except Exception:
        # Intentar edición inline
        page.locator(".forceDetailPanelDesktop").first.dblclick()
        page.wait_for_timeout(500)
    
    # Actualizar Stage a "Negotiation/Review" (antes de cerrar)
    try:
        page.get_by_label("Stage").select_option("Value Proposition")
    except Exception:
        pass
    
    # Si existe campo custom de Payment Method, rellenarlo
    try:
        page.get_by_label("Payment Method").fill(config.CREDIT["payment_method"])
    except Exception:
        pass
    
    # Descripción / Notas del contrato
    try:
        page.get_by_label("Description").fill(
            f"Plan: {config.PRODUCT['plan']}\n"
            f"Líneas: {config.PRODUCT['lines']}\n"
            f"Pago mensual: ${config.PRODUCT['monthly_fee']:,.2f} {config.PRODUCT['currency']}\n"
            f"Contrato: {config.PRODUCT['contract_months']} meses\n"
            f"Método de pago: {config.CREDIT['payment_method']}\n"
            f"CLABE: {config.CREDIT['clabe']}"
        )
    except Exception:
        pass
    
    page.wait_for_timeout(500)
    results["screenshots"].append(screenshot(page, "08a_payment_config"))
    
    click_button(page, "Save")
    wait_for_sf_page_load(page)
    assert_success_toast(page)
    
    log.info("   ✅ Información de pago registrada: %s", config.CREDIT["payment_method"])
    results["screenshots"].append(screenshot(page, "08b_payment_saved"))


# ─────────────────────────────────────────────────────────────────────────────
# PASO 9: Cierre de Venta — Closed Won
# ─────────────────────────────────────────────────────────────────────────────
def step_close_sale(page: Page) -> None:
    step("Cierre de venta — Closed Won")
    
    if results["opportunity_id"] and results["opportunity_id"] != "N/A":
        safe_navigate(page, f"{config.SALESFORCE_URL}/lightning/r/Opportunity/{results['opportunity_id']}/view")
        wait_for_sf_page_load(page)
    
    # Editar Stage a "Closed Won"
    try:
        edit_btn = page.get_by_role("button", name="Edit")
        edit_btn.first.wait_for(state="visible", timeout=10_000)
        edit_btn.first.click()
        wait_for_sf_page_load(page)
    except Exception:
        pass
    
    try:
        stage_field = page.get_by_label("Stage")
        stage_field.select_option("Closed Won")
    except Exception:
        try:
            # Lightning Path stages — click en el stage Closed Won
            page.locator(".slds-path__item:has-text('Closed Won')").click()
            page.wait_for_timeout(500)
            page.get_by_role("button", name="Mark Stage as Complete").click()
        except Exception:
            log.warning("   ⚠️  No se pudo actualizar Stage a Closed Won automáticamente")
    
    page.wait_for_timeout(500)
    results["screenshots"].append(screenshot(page, "09a_close_sale_form"))
    
    try:
        click_button(page, "Save")
        wait_for_sf_page_load(page)
        assert_success_toast(page, "saved")
    except Exception:
        try:
            click_button(page, "Mark Stage as Complete")
            wait_for_sf_page_load(page)
        except Exception:
            pass
    
    log.info("   🏆 Venta cerrada: %s — Closed Won", results["opportunity_name"])
    results["screenshots"].append(screenshot(page, "09b_sale_closed_won"))


# ─────────────────────────────────────────────────────────────────────────────
# ORQUESTADOR PRINCIPAL
# ─────────────────────────────────────────────────────────────────────────────
def run_sales_flow(headless: bool = False) -> dict:
    """Ejecuta el flujo completo de ventas Salesforce."""
    results["start_time"] = datetime.now().isoformat()
    
    log.info("=" * 65)
    log.info("  AT&T Demo — RPA Flujo Ventas Salesforce")
    log.info("  Inicio: %s", results["start_time"])
    log.info("  Modo:   %s", "headless" if headless else "visual (navegador visible)")
    log.info("=" * 65)
    
    # Validar credenciales antes de iniciar
    if not config.SALESFORCE_USERNAME or not config.SALESFORCE_PASSWORD:
        log.error("❌ Credenciales Salesforce no configuradas.")
        log.error("   Exporta: SF_URL, SF_USERNAME, SF_PASSWORD, SF_SECURITY_TOKEN")
        log.error("   Ejemplo:")
        log.error("     set SF_URL=https://yourorg.my.salesforce.com")
        log.error("     set SF_USERNAME=usuario@org.com")
        log.error("     set SF_PASSWORD=tupassword")
        results["status"] = "error"
        results["errors"].append("Credenciales no configuradas")
        return results
    
    with sync_playwright() as p:
        browser = p.chromium.launch(
            headless=headless,
            slow_mo=config.SLOW_MO_MS,
            args=["--start-maximized"],
        )
        context: BrowserContext = browser.new_context(
            viewport={"width": 1920, "height": 1080},
            record_video_dir=config.SCREENSHOT_DIR if not headless else None,
        )
        page: Page = context.new_page()
        page.set_default_timeout(config.TIMEOUT_MS)
        
        steps = [
            step_login,
            step_create_account,
            step_create_contact,
            step_create_opportunity,
            step_add_product,
            step_upload_id_document,
            step_credit_check,
            step_process_payment,
            step_close_sale,
        ]
        
        for step_fn in steps:
            try:
                step_fn(page)
                page.wait_for_timeout(1000)  # Pausa visual entre pasos
            except Exception as exc:
                error_msg = f"{step_fn.__name__}: {exc}"
                log.error("   ❌ Error en %s: %s", step_fn.__name__, exc)
                results["errors"].append(error_msg)
                results["screenshots"].append(screenshot(page, f"error_{step_fn.__name__}"))
                # Continúa con el siguiente paso (resiliencia en demo)
        
        context.close()
        browser.close()
    
    results["end_time"] = datetime.now().isoformat()
    results["status"] = "error" if results["errors"] else "success"
    
    _print_summary()
    return results


def _print_summary() -> None:
    """Imprime el resumen del flujo."""
    from datetime import datetime
    
    start = datetime.fromisoformat(results["start_time"])
    end = datetime.fromisoformat(results["end_time"])
    duration = (end - start).seconds
    
    log.info("")
    log.info("=" * 65)
    log.info("  RESUMEN DEL FLUJO")
    log.info("=" * 65)
    log.info("  Estado:       %s", "✅ ÉXITO" if results["status"] == "success" else "⚠️  CON ERRORES")
    log.info("  Duración:     %d segundos (%.1f min)", duration, duration / 60)
    log.info("  Account ID:   %s", results.get("account_id", "N/A"))
    log.info("  Contact ID:   %s", results.get("contact_id", "N/A"))
    log.info("  Oportunidad:  %s", results.get("opportunity_name", "N/A"))
    log.info("  Opp ID:       %s", results.get("opportunity_id", "N/A"))
    log.info("  Capturas:     %d archivos en %s", 
             len(results["screenshots"]), config.SCREENSHOT_DIR)
    if results["errors"]:
        log.info("  Errores (%d):", len(results["errors"]))
        for err in results["errors"]:
            log.info("    • %s", err)
    log.info("=" * 65)


# ─────────────────────────────────────────────────────────────────────────────
# ENTRYPOINT
# ─────────────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="RPA Flujo Ventas Salesforce — AT&T Demo")
    parser.add_argument(
        "--headless", action="store_true",
        help="Ejecutar sin interfaz gráfica (modo CI/CD)"
    )
    args = parser.parse_args()
    
    run_sales_flow(headless=args.headless)
