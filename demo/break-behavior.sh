#!/usr/bin/env bash
# DEMO BREAK 2 — inserta validación de monto mínimo en RecargaService (macOS / Linux).
# Requiere: bash, python3.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
export REPO_ROOT="$ROOT"

python3 <<'PY'
import os
import sys
from pathlib import Path

root = Path(os.environ["REPO_ROOT"])
path = root / "microservice-a/src/main/java/com/att/paymentbox/service/RecargaService.java"
if not path.is_file():
    sys.exit(f"No existe: {path}")

text = path.read_text(encoding="utf-8")
needle = """        buscarClienteActivo(request.getTelefonoCliente());

        String folio"""
insert = """        buscarClienteActivo(request.getTelefonoCliente());

        if (request.getMonto().compareTo(new java.math.BigDecimal("100")) < 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Monto mínimo $100");
        }

        String folio"""

marker = 'if (request.getMonto().compareTo(new java.math.BigDecimal("100")) < 0)'
if marker in text:
    idx = text.find("public PagoResponse registrarPago")
    if idx != -1:
        next_m = text.find("\n    public ", idx + 10)
        block = text[idx : next_m if next_m != -1 else len(text)]
        if marker in block:
            print("DEMO BREAK 2: la validación de monto ya está en registrarPago. Ejecuta ./demo/restore.sh primero.", file=sys.stderr)
            sys.exit(1)

if needle not in text:
    print("No se encontró el bloque esperado en registrarPago. ¿cambió RecargaService.java?", file=sys.stderr)
    sys.exit(1)

path.write_text(text.replace(needle, insert, 1), encoding="utf-8")
print("[DEMO BREAK 2] Validación de monto mínimo $100 insertada en registrarPago().")
PY

cat <<'EOS'

Pasos sugeridos:
  git checkout -b feature/demo-break2 origin/E
  git add microservice-a/src/main/java/com/att/paymentbox/service/RecargaService.java
  git commit -m "demo: BREAK 2 - validación monto mínimo"
  git push -u origin feature/demo-break2
  # PR → E, merge; en Actions revisar Deliver / Karate E2E

EOS
