"""
Generador de Casos de Prueba desde Historias de Usuario.

Convierte historias de usuario en formato estándar:
  "Como [rol] quiero [acción] para [beneficio]"

a casos de prueba detallados (positivos, negativos, bordes) en formato Karate DSL.

Modos de operación:
  1. AI (OpenAI/compatible): genera casos con LLM si OPENAI_API_KEY está configurado
  2. Template-based: genera casos usando reglas y plantillas (fallback sin API key)
"""

import re
import json
import os
import sys
from dataclasses import dataclass, field
from typing import Optional
from datetime import datetime

try:
    import openai
    OPENAI_AVAILABLE = True
except ImportError:
    OPENAI_AVAILABLE = False

from config import OPENAI_API_KEY, OPENAI_BASE_URL, OPENAI_MODEL, has_ai_backend, FEATURES_DIR


# ─── Domain Knowledge ────────────────────────────────────────────────────────

DOMAIN_CONTEXT = """
Dominio: Sistema PaymentBox de Telco Operator (AT&T).
Entidades principales:
  - Cliente: telefono (clave), fullName, status (ACTIVO, INACTIVO, BLOQUEADO)
  - Recarga: monto (10-800 MXN), operador (BLUE), metodo_pago (TARJETA, EFECTIVO, OODI)
  - Pago: numero_orden, folio, status (PENDIENTE, APLICADO, CANCELADO, FALLIDO)
  - Recibo: folio, PDF sintético

APIs disponibles:
  - GET  /api/clientes/buscar?telefono={tel}  → buscar cliente
  - GET  /api/recargas/montos?operador={op}   → listar montos disponibles
  - POST /api/recargas/validar-operador       → validar operador externo
  - POST /api/pagos/registrar                 → registrar pago
  - POST /api/pagos/{id}/aplicar              → aplicar pago
  - GET  /api/recibos/{folio}                 → obtener recibo

Teléfonos de prueba Billy:
  4544 (ACTIVO), 4545 (ACTIVO), 4546 (ACTIVO), 4547 (INACTIVO), 4548 (BLOQUEADO)
"""

KARATE_SYSTEM_PROMPT = f"""Eres un experto en QA y testing de APIs REST. Generas casos de prueba
en formato Karate DSL a partir de historias de usuario.

{DOMAIN_CONTEXT}

INSTRUCCIONES:
- Genera casos POSITIVOS (happy path), NEGATIVOS (datos inválidos, errores) y de BORDE (límites, vacíos)
- Usa @tags apropiados: @smoke @positive @negative @edge @e2e
- Incluye validaciones concretas de campos y status HTTP
- Usa los teléfonos de prueba Billy cuando aplique
- Formato: Feature > Background (si necesario) > Scenarios

Responde ÚNICAMENTE con el contenido del archivo .feature (sin bloques markdown)."""


# ─── Data model ──────────────────────────────────────────────────────────────

@dataclass
class UserStory:
    raw: str
    role: str = ""
    action: str = ""
    benefit: str = ""
    context: str = ""

    def parse(self) -> "UserStory":
        """Parsea la historia de usuario en sus componentes."""
        # Standard format: "Como [rol] quiero [acción] para [beneficio]"
        pattern = r"[Cc]omo\s+(.+?)\s+quiero\s+(.+?)\s+para\s+(.+?)[\.\n]?"
        m = re.search(pattern, self.raw, re.DOTALL | re.IGNORECASE)
        if m:
            self.role = m.group(1).strip()
            self.action = m.group(2).strip()
            self.benefit = m.group(3).strip()
        else:
            # Fallback: use the whole text as action
            self.action = self.raw.strip()
        return self


@dataclass
class TestCase:
    name: str
    tags: list[str]
    steps: list[str]
    scenario_type: str  # "positive", "negative", "edge"
    examples: list[dict] = field(default_factory=list)


@dataclass
class TestSuite:
    feature_name: str
    user_story: UserStory
    background: list[str]
    test_cases: list[TestCase]
    generated_at: str = field(default_factory=lambda: datetime.now().isoformat())
    generation_mode: str = "template"

    def to_karate_feature(self) -> str:
        """Convierte la suite a formato Karate .feature"""
        lines = []

        # Header tags
        all_tags = set()
        for tc in self.test_cases:
            all_tags.update(tc.tags)
        feature_tags = ["@ia-generated"]
        if "@e2e" in all_tags:
            feature_tags.append("@e2e")
        elif "@smoke" in all_tags:
            feature_tags.append("@smoke")

        lines.append(" ".join(feature_tags))
        lines.append(f"Feature: {self.feature_name}")
        lines.append(f"  # Historia: {self.user_story.raw.strip()}")
        lines.append(f"  # Generado: {self.generated_at} | Modo: {self.generation_mode}")

        # Background
        if self.background:
            lines.append("")
            lines.append("  Background:")
            for step in self.background:
                lines.append(f"    {step}")

        # Scenarios
        for tc in self.test_cases:
            lines.append("")
            tag_line = " ".join(f"@{t}" for t in tc.tags)
            lines.append(f"  {tag_line}")

            # Use Scenario Outline if there are examples
            if tc.examples:
                lines.append(f"  Scenario Outline: {tc.name}")
                for step in tc.steps:
                    lines.append(f"    {step}")
                lines.append("")
                lines.append("    Examples:")
                if tc.examples:
                    headers = list(tc.examples[0].keys())
                    lines.append("      | " + " | ".join(headers) + " |")
                    for ex in tc.examples:
                        lines.append("      | " + " | ".join(str(ex[h]) for h in headers) + " |")
            else:
                lines.append(f"  Scenario: {tc.name}")
                for step in tc.steps:
                    lines.append(f"    {step}")

        return "\n".join(lines) + "\n"


# ─── AI-based generation ─────────────────────────────────────────────────────

def generate_with_ai(story: UserStory, additional_context: str = "") -> str:
    """Genera feature file usando OpenAI."""
    if not OPENAI_AVAILABLE or not OPENAI_API_KEY:
        raise RuntimeError("OpenAI no disponible. Configure OPENAI_API_KEY.")

    client = openai.OpenAI(api_key=OPENAI_API_KEY, base_url=OPENAI_BASE_URL)

    user_prompt = f"""Historia de usuario:
{story.raw}

Contexto adicional: {additional_context or 'Ninguno'}

Genera un archivo .feature completo con casos positivos, negativos y de borde."""

    response = client.chat.completions.create(
        model=OPENAI_MODEL,
        messages=[
            {"role": "system", "content": KARATE_SYSTEM_PROMPT},
            {"role": "user", "content": user_prompt},
        ],
        temperature=0.3,
        max_tokens=2000,
    )

    content = response.choices[0].message.content.strip()
    # Strip markdown code blocks if present
    content = re.sub(r"^```[a-z]*\n?", "", content)
    content = re.sub(r"\n?```$", "", content)
    return content


# ─── Template-based generation ───────────────────────────────────────────────

def _detect_entities(story: UserStory) -> dict:
    """Detecta entidades del dominio en la historia."""
    text = (story.action + " " + story.benefit + " " + story.raw).lower()
    entities = {
        "has_cliente": any(w in text for w in ["cliente", "usuario", "telefono", "teléfono", "buscar"]),
        "has_recarga": any(w in text for w in ["recarga", "monto", "recargar", "recharge"]),
        "has_pago": any(w in text for w in ["pago", "pagar", "cobrar", "payment", "registrar"]),
        "has_recibo": any(w in text for w in ["recibo", "receipt", "folio", "comprobante"]),
        "has_operador": any(w in text for w in ["operador", "blue", "operator"]),
        "has_validacion": any(w in text for w in ["validar", "validación", "verificar", "check"]),
    }
    return entities


def _build_background(entities: dict) -> list[str]:
    """Construye la sección Background según las entidades detectadas."""
    steps = ["* url baseUrl"]
    if entities["has_cliente"]:
        steps.append("* def telefonoBilly1 = '4544'")
        steps.append("* def telefonoBilly2 = '4545'")
        steps.append("* def telefonoInactivo = '4547'")
        steps.append("* def telefonoBloqueado = '4548'")
    if entities["has_recarga"]:
        steps.append("* def operador = 'BLUE'")
        steps.append("* def montoValido = 50.00")
        steps.append("* def montoInvalido = 5.00")
    return steps


def _build_test_cases_for_buscar_cliente(story: UserStory) -> list[TestCase]:
    """Genera casos de prueba para historias relacionadas con buscar clientes."""
    return [
        TestCase(
            name="Buscar cliente activo por teléfono - caso exitoso",
            tags=["smoke", "positive"],
            steps=[
                "Given path '/api/clientes/buscar'",
                "And param telefono = '<telefono>'",
                "When method GET",
                "Then status 200",
                "And match response.phone == '<telefono>'",
                "And match response.status == 'ACTIVO'",
                "And match response.fullName == '#string'",
            ],
            scenario_type="positive",
            examples=[
                {"telefono": "4544"},
                {"telefono": "4545"},
                {"telefono": "4546"},
            ],
        ),
        TestCase(
            name="Buscar cliente inexistente retorna 404",
            tags=["negative"],
            steps=[
                "Given path '/api/clientes/buscar'",
                "And param telefono = '9999'",
                "When method GET",
                "Then status 404",
            ],
            scenario_type="negative",
        ),
        TestCase(
            name="Buscar cliente inactivo retorna error de negocio",
            tags=["negative"],
            steps=[
                "Given path '/api/clientes/buscar'",
                "And param telefono = telefonoInactivo",
                "When method GET",
                "Then status 404",
                "# Cliente INACTIVO no puede realizar recargas",
            ],
            scenario_type="negative",
        ),
        TestCase(
            name="Buscar cliente bloqueado retorna error de negocio",
            tags=["negative"],
            steps=[
                "Given path '/api/clientes/buscar'",
                "And param telefono = telefonoBloqueado",
                "When method GET",
                "Then status 404",
                "# Cliente BLOQUEADO no puede realizar recargas",
            ],
            scenario_type="negative",
        ),
        TestCase(
            name="Buscar cliente con teléfono vacío retorna 400",
            tags=["edge"],
            steps=[
                "Given path '/api/clientes/buscar'",
                "And param telefono = ''",
                "When method GET",
                "Then status 400",
            ],
            scenario_type="edge",
        ),
    ]


def _build_test_cases_for_recarga(story: UserStory) -> list[TestCase]:
    """Genera casos de prueba para historias relacionadas con recargas."""
    return [
        TestCase(
            name="Registrar recarga con datos válidos",
            tags=["smoke", "positive"],
            steps=[
                "Given path '/api/pagos/registrar'",
                "And request { telefono: '#(telefonoBilly1)', monto: #(montoValido), operador: '#(operador)', metodoPago: 'EFECTIVO' }",
                "When method POST",
                "Then status 201",
                "And match response.status == 'PENDIENTE'",
                "And match response.id == '#number'",
                "And match response.folio == '#string'",
            ],
            scenario_type="positive",
        ),
        TestCase(
            name="Registrar recarga con monto fuera de rango retorna 400",
            tags=["negative"],
            steps=[
                "Given path '/api/pagos/registrar'",
                "And request { telefono: '#(telefonoBilly1)', monto: #(montoInvalido), operador: '#(operador)', metodoPago: 'EFECTIVO' }",
                "When method POST",
                "Then status 400",
                "And match response.error == '#string'",
            ],
            scenario_type="negative",
        ),
        TestCase(
            name="Registrar recarga para cliente inexistente retorna 404",
            tags=["negative"],
            steps=[
                "Given path '/api/pagos/registrar'",
                "And request { telefono: '0000', monto: #(montoValido), operador: '#(operador)', metodoPago: 'EFECTIVO' }",
                "When method POST",
                "Then status 404",
            ],
            scenario_type="negative",
        ),
        TestCase(
            name="Listar montos de recarga disponibles para operador BLUE",
            tags=["smoke", "positive"],
            steps=[
                "Given path '/api/recargas/montos'",
                "And param operador = operador",
                "When method GET",
                "Then status 200",
                "And match response == '#[_ > 0]'",
                "And match each response == { id: '#number', monto: '#number', operador: '#string' }",
            ],
            scenario_type="positive",
        ),
        TestCase(
            name="Listar montos para operador desconocido retorna vacío",
            tags=["edge"],
            steps=[
                "Given path '/api/recargas/montos'",
                "And param operador = 'INEXISTENTE'",
                "When method GET",
                "Then status 404",
            ],
            scenario_type="edge",
        ),
    ]


def _build_test_cases_for_pago(story: UserStory) -> list[TestCase]:
    """Genera casos de prueba para historias relacionadas con pagos."""
    return [
        TestCase(
            name="Aplicar pago pendiente correctamente",
            tags=["smoke", "positive"],
            steps=[
                "# Paso 1: registrar pago",
                "Given path '/api/pagos/registrar'",
                "And request { telefono: '#(telefonoBilly1)', monto: 50.00, operador: '#(operador)', metodoPago: 'EFECTIVO' }",
                "When method POST",
                "Then status 201",
                "* def pagoId = response.id",
                "",
                "# Paso 2: aplicar el pago",
                "Given path '/api/pagos/' + pagoId + '/aplicar'",
                "When method POST",
                "Then status 200",
                "And match response.status == 'APLICADO'",
                "And match response.folio == '#string'",
            ],
            scenario_type="positive",
        ),
        TestCase(
            name="Aplicar pago con ID inexistente retorna 404",
            tags=["negative"],
            steps=[
                "Given path '/api/pagos/99999/aplicar'",
                "When method POST",
                "Then status 404",
            ],
            scenario_type="negative",
        ),
        TestCase(
            name="Verificar persistencia del pago en base de datos",
            tags=["e2e", "positive"],
            steps=[
                "# Verificar que el pago quedó registrado en DB",
                "Given path '/api/pagos/registrar'",
                "And request { telefono: '#(telefonoBilly1)', monto: 100.00, operador: '#(operador)', metodoPago: 'TARJETA' }",
                "When method POST",
                "Then status 201",
                "* def ordenId = response.id",
                "",
                "# Consultar el pago por orden",
                "Given path '/api/pagos/' + ordenId",
                "When method GET",
                "Then status 200",
                "And match response.status == 'PENDIENTE'",
                "And match response.monto == 100.00",
            ],
            scenario_type="positive",
        ),
    ]


def _build_test_cases_for_recibo(story: UserStory) -> list[TestCase]:
    """Genera casos de prueba para historias relacionadas con recibos."""
    return [
        TestCase(
            name="Obtener recibo de pago aplicado",
            tags=["smoke", "positive"],
            steps=[
                "Given path '/api/recibos/B-89301'",
                "When method GET",
                "Then status 200",
                "And match response.folio == 'B-89301'",
                "And match response.monto == '#number'",
                "And match response.telefono == '#string'",
            ],
            scenario_type="positive",
        ),
        TestCase(
            name="Obtener recibo con folio inexistente retorna 404",
            tags=["negative"],
            steps=[
                "Given path '/api/recibos/INEXISTENTE-000'",
                "When method GET",
                "Then status 404",
            ],
            scenario_type="negative",
        ),
    ]


def _build_generic_test_cases(story: UserStory) -> list[TestCase]:
    """Genera casos genéricos cuando no se detectan entidades específicas."""
    action_slug = story.action[:50].replace(" ", "_").lower()
    return [
        TestCase(
            name=f"Caso positivo: {story.action[:60]}",
            tags=["smoke", "positive"],
            steps=[
                "# TODO: Definir endpoint y request body según el dominio",
                "Given path '/api/...'",
                "When method GET",
                "Then status 200",
                "And match response == '#notnull'",
            ],
            scenario_type="positive",
        ),
        TestCase(
            name=f"Caso negativo: datos inválidos para {story.action[:40]}",
            tags=["negative"],
            steps=[
                "# TODO: Definir datos inválidos y endpoint",
                "Given path '/api/...'",
                "When method POST",
                "Then status 400",
                "And match response.error == '#string'",
            ],
            scenario_type="negative",
        ),
        TestCase(
            name=f"Caso borde: recurso inexistente para {story.action[:40]}",
            tags=["edge"],
            steps=[
                "# TODO: Definir ID/parámetro inexistente",
                "Given path '/api/.../99999'",
                "When method GET",
                "Then status 404",
            ],
            scenario_type="edge",
        ),
    ]


def generate_with_templates(story: UserStory) -> TestSuite:
    """Genera casos de prueba usando plantillas y reglas de dominio."""
    entities = _detect_entities(story)
    background = _build_background(entities)

    test_cases: list[TestCase] = []

    # Add domain-specific cases
    if entities["has_cliente"]:
        test_cases.extend(_build_test_cases_for_buscar_cliente(story))
    if entities["has_recarga"]:
        test_cases.extend(_build_test_cases_for_recarga(story))
    if entities["has_pago"]:
        test_cases.extend(_build_test_cases_for_pago(story))
    if entities["has_recibo"]:
        test_cases.extend(_build_test_cases_for_recibo(story))

    if not test_cases:
        test_cases = _build_generic_test_cases(story)

    # Feature name
    action_title = story.action.capitalize() if story.action else story.raw[:60]
    feature_name = f"{action_title} - Generado por IA"

    return TestSuite(
        feature_name=feature_name,
        user_story=story,
        background=background,
        test_cases=test_cases,
        generation_mode="template",
    )


# ─── Public API ──────────────────────────────────────────────────────────────

def generate_test_cases(
    user_story_text: str,
    additional_context: str = "",
    force_template: bool = False,
    output_dir: Optional[str] = None,
) -> str:
    """
    Genera casos de prueba Karate a partir de una historia de usuario.

    Args:
        user_story_text: Historia de usuario (formato "Como... quiero... para...")
        additional_context: Contexto adicional (endpoint, entidad, etc.)
        force_template: Forzar modo template aunque haya API key
        output_dir: Directorio de salida (default: generated/features/)

    Returns:
        Contenido del archivo .feature generado
    """
    story = UserStory(raw=user_story_text).parse()

    print(f"\n🤖 Generando casos de prueba para:")
    print(f"   Rol:     {story.role or '(no detectado)'}")
    print(f"   Acción:  {story.action or '(no detectada)'}")
    print(f"   Beneficio: {story.benefit or '(no detectado)'}")

    feature_content = ""
    mode = "template"

    if has_ai_backend() and not force_template:
        try:
            print(f"\n   Modo: IA (OpenAI {OPENAI_MODEL})")
            feature_content = generate_with_ai(story, additional_context)
            mode = "ai"
        except Exception as e:
            print(f"   ⚠️  Fallback a templates: {e}")

    if not feature_content:
        print(f"\n   Modo: Template-based (reglas de dominio)")
        suite = generate_with_templates(story)
        feature_content = suite.to_karate_feature()

    # Count scenarios
    scenario_count = feature_content.count("Scenario")
    positive_count = feature_content.count("@positive") + feature_content.count("@smoke")
    negative_count = feature_content.count("@negative")
    edge_count = feature_content.count("@edge")

    print(f"\n✅ Generados {scenario_count} escenarios:")
    print(f"   + Positivos: {positive_count}")
    print(f"   - Negativos: {negative_count}")
    print(f"   ~ Bordes:    {edge_count}")

    # Save to file
    if output_dir is None:
        output_dir = FEATURES_DIR
    os.makedirs(output_dir, exist_ok=True)

    safe_name = re.sub(r"[^\w\-]", "_", story.action[:40] if story.action else "generated")
    filename = f"ia_generated_{safe_name}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.feature"
    filepath = os.path.join(output_dir, filename)

    with open(filepath, "w", encoding="utf-8") as f:
        f.write(feature_content)

    print(f"\n📄 Archivo generado: {filepath}")
    return feature_content


if __name__ == "__main__":
    # Ejemplo de uso directo
    stories = [
        "Como agente de Telco Operator quiero buscar un cliente por su número de teléfono para verificar que está activo antes de procesar una recarga",
        "Como agente de Telco Operator quiero registrar una recarga de monto válido para un cliente activo para generar un comprobante de pago",
        "Como cliente quiero obtener el recibo de mi recarga para tener un comprobante del pago realizado",
    ]

    test_story = stories[0] if len(sys.argv) < 2 else " ".join(sys.argv[1:])
    generate_test_cases(test_story)
