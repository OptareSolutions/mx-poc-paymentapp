"""
RPA Configuration - AT&T Salesforce Demo
Configuración de variables de entorno y parámetros del flujo.
"""
import os

# ── Salesforce Connection ──────────────────────────────────────────────────────
SALESFORCE_URL = os.getenv("SF_URL", "https://login.salesforce.com")
SALESFORCE_USERNAME = os.getenv("SF_USERNAME", "")
SALESFORCE_PASSWORD = os.getenv("SF_PASSWORD", "")
SALESFORCE_SECURITY_TOKEN = os.getenv("SF_SECURITY_TOKEN", "")

# ── Demo Customer Data ─────────────────────────────────────────────────────────
CUSTOMER = {
    "first_name": "Carlos",
    "last_name": "García López",
    "email": "carlos.garcia@demo-att.com",
    "phone": "5512345678",
    "company": "Empresa Demo AT&T",
    "tax_id": "GALC850101AAA",       # RFC / Tax ID
    "id_number": "MX-DEMO-123456",  # Número de identificación biométrica
    "address": {
        "street": "Av. Insurgentes Sur 1234",
        "city": "Ciudad de México",
        "state": "CDMX",
        "country": "México",
        "postal_code": "06600",
    },
}

# ── AT&T Product Configuration ─────────────────────────────────────────────────
PRODUCT = {
    "name": "AT&T Plan Empresarial 5G",
    "code": "ATT-EMP-5G-001",
    "lines": 5,
    "plan": "Ilimitado Plus",
    "monthly_fee": 1500.00,
    "currency": "MXN",
    "contract_months": 24,
}

# ── Identity Document ──────────────────────────────────────────────────────────
ID_DOCUMENT_PATH = os.getenv(
    "ID_DOCUMENT_PATH",
    r"C:\Users\jcunha\Documents\Optare\Clientes\AT_T\QA\01_RPA\evidencias\id_documento_demo.jpg",
)

# ── Credit & Payment ───────────────────────────────────────────────────────────
CREDIT = {
    "score_threshold": 650,
    "payment_method": "Transferencia Bancaria",
    "bank": "BBVA México",
    "clabe": "012180015310087229",  # CLABE demo (no real)
}

# ── Execution Settings ─────────────────────────────────────────────────────────
HEADLESS = os.getenv("RPA_HEADLESS", "false").lower() == "true"
SLOW_MO_MS = int(os.getenv("RPA_SLOW_MO", "800"))   # ms entre acciones
SCREENSHOT_DIR = r"C:\Users\jcunha\Documents\Optare\Clientes\AT_T\QA\01_RPA\evidencias"
TIMEOUT_MS = 30_000   # 30 s timeout por elemento
