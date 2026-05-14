#!/usr/bin/env bash
# DEMO BREAK 1 — mismo efecto que break-contract.ps1 (macOS / Linux).
# Requiere: bash, python3 (incluido en macOS).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
export REPO_ROOT="$ROOT"

python3 <<'PY'
import os
import sys
from pathlib import Path

root = Path(os.environ["REPO_ROOT"])
dto = root / "microservice-b/src/main/java/com/att/paymentbox/customerprofile/dto/CustomerProfileDto.java"
test = root / "microservice-b/src/test/java/com/att/paymentbox/customerprofile/controller/CustomerControllerTest.java"

for p in (dto, test):
    if not p.is_file():
        raise SystemExit(f"No existe: {p}")

print("[DEMO BREAK 1] Modificando DTO y test unitario (microservice-b)...")
c = dto.read_text(encoding="utf-8")

if "private String telefono;" not in c and "private String phone;" in c:
    print("El DTO ya parece en modo 'roto' (phone/fullName). Ejecuta ./demo/restore.sh o git checkout desde E limpio.", file=sys.stderr)
    sys.exit(1)

repl = [
    ("private String telefono;", 'private String phone;       // BROKEN: era "telefono"'),
    ("private String nombre;", 'private String fullName;    // BROKEN: era "nombre"'),
    ("getTelefono()", "getPhone()"),
    ("setTelefono(String telefono)", "setPhone(String phone)"),
    ("this.telefono = telefono", "this.phone = phone"),
    ("return telefono;", "return phone;"),
    ("getNombre()", "getFullName()"),
    ("setNombre(String nombre)", "setFullName(String fullName)"),
    ("this.nombre = nombre", "this.fullName = fullName"),
    ("return nombre;", "return fullName;"),
]
for a, b in repl:
    if a not in c:
        print(f"Advertencia: no se encontró literal exacto: {a!r}")
    c = c.replace(a, b)
dto.write_text(c, encoding="utf-8")

t = test.read_text(encoding="utf-8")
for a, b in [
    ("assertThat(dto.getTelefono())", "assertThat(dto.getPhone())"),
    ("assertThat(dto.getNombre())", "assertThat(dto.getFullName())"),
    ("result.get(0).getTelefono()", "result.get(0).getPhone()"),
]:
    t = t.replace(a, b)
test.write_text(t, encoding="utf-8")
print("OK Archivos actualizados.")
PY

cat <<'EOS'

Pasos sugeridos:
  git checkout -b feature/demo-break1 origin/E    # si aún no
  git add microservice-b
  git commit -m "demo: BREAK 1 - romper contrato DTO"
  git push -u origin feature/demo-break1
  # Abrir PR con base E → observar Testing Factory / contrato OpenAPI

EOS
