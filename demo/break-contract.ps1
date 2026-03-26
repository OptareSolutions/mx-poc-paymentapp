# ══════════════════════════════════════════════════════════════════════════════
# DEMO BREAK 1: Ruptura de Contrato Inter-Servicios
# ══════════════════════════════════════════════════════════════════════════════
# Efecto: Job 2 (Integration & Contract) FALLA
# Causa:  microservice-b renombra los campos del DTO público sin avisar a
#         microservice-a ni actualizar los tests de contrato.
#
# Timeline demo:
#   1. Pipeline en verde ✅
#   2. Ejecutar este script
#   3. git push → Pipeline falla en Job 2 ❌
#   4. Ejecutar restore.ps1 → Pipeline vuelve a verde ✅
# ══════════════════════════════════════════════════════════════════════════════

$ErrorActionPreference = "Stop"
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot  = Split-Path -Parent $scriptDir

$dtoFile = Join-Path $repoRoot "microservice-b\src\main\java\com\att\paymentbox\customerprofile\dto\CustomerProfileDto.java"

Write-Host "⚠️  [DEMO BREAK 1] Renombrando campos del contrato en CustomerProfileDto..." -ForegroundColor Yellow

$content = Get-Content $dtoFile -Raw

# Renombrar campos y getters/setters
$content = $content `
    -replace 'private String telefono;', 'private String phone;       // BROKEN: era "telefono"' `
    -replace 'private String nombre;',   'private String fullName;    // BROKEN: era "nombre"' `
    -replace 'getTelefono\(\)',           'getPhone()' `
    -replace 'setTelefono\(String telefono\)', 'setPhone(String phone)' `
    -replace 'this\.telefono = telefono', 'this.phone = phone' `
    -replace 'return telefono;',          'return phone;' `
    -replace 'getNombre\(\)',              'getFullName()' `
    -replace 'setNombre\(String nombre\)', 'setFullName(String fullName)' `
    -replace 'this\.nombre = nombre',     'this.fullName = fullName' `
    -replace 'return nombre;',            'return fullName;'

[System.IO.File]::WriteAllText($dtoFile, $content, [System.Text.Encoding]::UTF8)

Write-Host "✅ DTO modificado: 'telefono' → 'phone', 'nombre' → 'fullName'" -ForegroundColor Green
Write-Host ""
Write-Host "📋 Ahora ejecuta:" -ForegroundColor Cyan
Write-Host "   git add . && git commit -m 'demo: romper contrato (DEMO BREAK 1)' && git push"
Write-Host ""
Write-Host "🔍 Pipeline fallará en: Job 2 → '⚠️ DEMO BREAK 1 → Karate Contrato'"
Write-Host "   Karate: match response.telefono == '4544'  ← field 'telefono' ya no existe"
