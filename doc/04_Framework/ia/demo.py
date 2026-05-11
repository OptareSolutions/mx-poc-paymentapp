"""
Demo: Integración IA en el Framework de QA - PaymentBox PoC

Demuestra:
  1. Generación de casos de prueba Karate desde historias de usuario
  2. Generación de datos sintéticos bajo demanda

Ejecución:
  python demo.py
  python demo.py --story "Como cliente quiero pagar mi recarga para no quedarme sin servicio"
  python demo.py --data-only --clientes 20 --pagos 50 --seed 42
"""

import argparse
import os
import sys

# ─── Ensure correct working dir ──────────────────────────────────────────────
script_dir = os.path.dirname(os.path.abspath(__file__))
if script_dir not in sys.path:
    sys.path.insert(0, script_dir)

from user_story_to_tests import generate_test_cases
from synthetic_data_generator import generate_synthetic_data, SyntheticDataGenerator
from config import has_ai_backend, OPENAI_MODEL, GENERATED_DIR


DEMO_STORIES = [
    "Como agente de Telco Operator quiero buscar un cliente por su número de teléfono para verificar que está activo antes de procesar una recarga",
    "Como agente de Telco Operator quiero registrar una recarga de monto válido para un cliente activo para generar un comprobante de pago",
    "Como cliente quiero obtener el recibo de mi recarga para tener un comprobante del pago realizado",
]


def banner():
    print("=" * 65)
    print("  🤖 FRAMEWORK QA + IA - Demo PaymentBox (AT&T PoC)")
    print("=" * 65)
    ai_mode = f"OpenAI {OPENAI_MODEL}" if has_ai_backend() else "Template-based (sin API key)"
    print(f"  Backend IA: {ai_mode}")
    print("=" * 65)


def demo_test_generation(stories: list[str], force_template: bool = False):
    print("\n" + "─" * 65)
    print("  CAPACIDAD 1: Historias de Usuario → Casos de Prueba")
    print("─" * 65)

    for i, story in enumerate(stories, 1):
        print(f"\n[Historia {i}/{len(stories)}]")
        print(f"  {story}")
        generate_test_cases(story, force_template=force_template)

    features_dir = os.path.join(GENERATED_DIR, "features")
    generated = [f for f in os.listdir(features_dir) if f.endswith(".feature")] if os.path.exists(features_dir) else []
    print(f"\n✅ Total features generados en esta sesión: {len(generated)}")
    print(f"   Directorio: {features_dir}")


def demo_synthetic_data(n_clientes: int = 10, n_pagos: int = 20, seed: int = 42):
    print("\n" + "─" * 65)
    print("  CAPACIDAD 2: Generación de Datos Sintéticos Bajo Demanda")
    print("─" * 65)

    # Demostrar variaciones de contexto
    contexts = [
        ("test", n_clientes, n_pagos, seed),
        ("demo", 5, 10, seed + 1),
    ]

    for context, nc, np_, s in contexts:
        print(f"\n[Contexto: {context}]")
        generate_synthetic_data(
            n_clientes=nc,
            n_pagos=np_,
            output_formats=["json", "sql", "csv"],
            seed=s,
            context=context,
        )

    # Demostrar generación de tabla Examples para Karate
    print("\n[Karate Examples Table - clientes activos para data-driven testing]")
    gen = SyntheticDataGenerator(seed=seed)
    table = gen.generate_karate_examples_table(n=5, status_filter="ACTIVO")
    print(table)


def main():
    parser = argparse.ArgumentParser(
        description="Demo IA Framework QA PaymentBox",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Ejemplos:
  python demo.py
  python demo.py --story "Como agente quiero buscar un cliente para procesar una recarga"
  python demo.py --data-only --clientes 50 --pagos 100 --seed 2024
  python demo.py --tests-only
  python demo.py --force-template
        """,
    )
    parser.add_argument("--story", type=str, default=None, help="Historia de usuario personalizada")
    parser.add_argument("--tests-only", action="store_true", help="Solo demo de generación de tests")
    parser.add_argument("--data-only", action="store_true", help="Solo demo de datos sintéticos")
    parser.add_argument("--clientes", type=int, default=10, help="Número de clientes (data demo)")
    parser.add_argument("--pagos", type=int, default=20, help="Número de pagos (data demo)")
    parser.add_argument("--seed", type=int, default=42, help="Semilla reproducibilidad")
    parser.add_argument("--force-template", action="store_true", help="Forzar modo template (sin IA)")

    args = parser.parse_args()

    banner()

    stories = [args.story] if args.story else DEMO_STORIES

    if args.data_only:
        demo_synthetic_data(args.clientes, args.pagos, args.seed)
    elif args.tests_only:
        demo_test_generation(stories, force_template=args.force_template)
    else:
        demo_test_generation(stories, force_template=args.force_template)
        demo_synthetic_data(args.clientes, args.pagos, args.seed)

    print("\n" + "=" * 65)
    print("  ✅ Demo completado")
    print(f"  📁 Artefactos generados en: {GENERATED_DIR}")
    print("=" * 65 + "\n")


if __name__ == "__main__":
    main()
