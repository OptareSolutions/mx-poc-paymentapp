# ══════════════════════════════════════════════════════════════════════════════
# DEMO BREAK 1: Ruptura de Contrato Inter-Servicios
# ══════════════════════════════════════════════════════════════════════════════
# Efecto:    Karate / oasdiff en CI detectan consumo roto (Testing Factory o Golden)
# Ramas:     feature/* -> PR base E (recomendado); opcional pipeline-integration manual
# Causa:     microservice-b renombra DTO publico (telefono->phone, nombre->fullName).
#            Tests unitarios de B se actualizan en este script => pipeline de B puede
#            pasar build+test en feature; la ruptura aparece al validar contrato entre MS.
#
# Timeline demo (recomendado):
#   1. git checkout -b feature/demo-break1 origin/E
#   2. Ejecutar este script
#   3. git add . ; git commit -m "demo: BREAK 1 contrato" ; git push -u origin feature/demo-break1
#   4. Abrir PR hacia E
#   5. testing-factory / reusable-api-testing y/o pipeline-contrato-openapi FALLAN
#   6. restore.ps1 + commit + push
#
# Alternativa manual: pipeline-integration (workflow_dispatch) E->A con imagen origen
# que ya contenga este cambio; falla en job de contrato Karate.
# ══════════════════════════════════════════════════════════════════════════════

$ErrorActionPreference = "Stop"
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot  = Split-Path -Parent $scriptDir

$dtoFile  = Join-Path $repoRoot "microservice-b\src\main\java\com\att\paymentbox\customerprofile\dto\CustomerProfileDto.java"
$testFile = Join-Path $repoRoot "microservice-b\src\test\java\com\att\paymentbox\customerprofile\controller\CustomerControllerTest.java"

# --- Romper el DTO publico ---
Write-Host "[DEMO BREAK 1] Renombrando campos del contrato en CustomerProfileDto..." -ForegroundColor Yellow

$content = Get-Content $dtoFile -Raw

if ($content -notmatch 'private String telefono;' -and $content -match 'private String phone;') {
    Write-Error "El DTO ya parece roto (phone/fullName). Ejecuta restore.ps1 o partes de E limpio."
    exit 1
}

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
Write-Host "OK DTO modificado: telefono -> phone, nombre -> fullName" -ForegroundColor Green

# --- Actualizar test unitario de microservice-b (compila; CI de contrato sigue rojo) ---
Write-Host "Actualizando CustomerControllerTest para compilar con nuevo DTO..." -ForegroundColor Yellow

$testContent = Get-Content $testFile -Raw

$testContent = $testContent `
    -replace 'assertThat\(dto\.getTelefono\(\)\)', 'assertThat(dto.getPhone())' `
    -replace 'assertThat\(dto\.getNombre\(\)\)',   'assertThat(dto.getFullName())' `
    -replace 'result\.get\(0\)\.getTelefono\(\)', 'result.get(0).getPhone()'

[System.IO.File]::WriteAllText($testFile, $testContent, [System.Text.Encoding]::UTF8)
Write-Host "OK Test unitario actualizado" -ForegroundColor Green

Write-Host ""
Write-Host "Pasos sugeridos:" -ForegroundColor Cyan
Write-Host "  git checkout -b feature/demo-break1 origin/E   # si aun no"
Write-Host "  git add ."
Write-Host "  git commit -m `"demo: BREAK 1 - romper contrato DTO`""
Write-Host "  git push -u origin feature/demo-break1"
Write-Host "  # Abrir PR con base E y observar testing-factory / contrato OpenAPI"
Write-Host ""
Write-Host "Opcional: Actions -> pipeline-integration.yml -> E -> A (con codigo ya integrado)." -ForegroundColor DarkGray
