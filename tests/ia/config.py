"""
Configuración del módulo IA para el framework de QA.
"""
import os

# OpenAI / compatible API configuration
OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY", "")
OPENAI_BASE_URL = os.environ.get("OPENAI_BASE_URL", "https://api.openai.com/v1")
OPENAI_MODEL = os.environ.get("OPENAI_MODEL", "gpt-4o-mini")

# GitHub Copilot API (alternative to OpenAI)
GITHUB_TOKEN = os.environ.get("GITHUB_TOKEN", os.environ.get("GH_TOKEN", ""))

# Locale para datos sintéticos
DEFAULT_LOCALE = "es_MX"

# Dominio de la PoC
DOMAIN = "paymentbox"

# Paths
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
GENERATED_DIR = os.path.join(BASE_DIR, "generated")
FEATURES_DIR = os.path.join(GENERATED_DIR, "features")
DATA_DIR = os.path.join(GENERATED_DIR, "data")

def has_ai_backend() -> bool:
    """Retorna True si hay un backend de IA configurado."""
    return bool(OPENAI_API_KEY or GITHUB_TOKEN)
