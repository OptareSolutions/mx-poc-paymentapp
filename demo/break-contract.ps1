# ══════════════════════════════════════════════════════════════════════════════
# DEMO BREAK 1: Ruptura de Contrato Inter-Servicios
# ══════════════════════════════════════════════════════════════════════════════
# Efecto:    pipeline-integration.yml Job 2 (Testes Contrato) FALLA
# Branch:    develop
# Causa:     microservice-b renombra campos del DTO público (telefono→phone,
#            nombre→fullName). El propio pipeline de microservice-b PASA (sus
#            tests unitarios se actualizan en este script). La ruptura solo se
#            detecta en el pipeline de integración al intentar promover env-e→env-a.
#
# Timeline demo:
#   1. Pipelines en verde ✅ (todos los ambientes)
#   2. Ejecutar este script  (actualizan DTO + test unitario de microservice-b)
#   3. git add . && git commit -m "demo: BREAK 1 contrato" && git push origin develop
#   4. pipeline-microservice-b.yml → Job 1 PASA ✅ (tests unitarios actualizados)
#      → Job 3 pusha imagen env-e-{sha} al GHCR   ✅
#   5. Trigger manual: pipeline-integration.yml  (develop → qa)
#   6. Job 2 (Testes Contrato) FALLA ❌
#      Karate: match response.telefono == '4544'  ← field 'telefono' ya no existe
#      La promoción a env-a/QA queda BLOQUEADA
#   7. Ejecutar restore.ps1 → vuelve a verde ✅
# ══════════════════════════════════════════════════════════════════════════════

$ErrorActionPreference = "Stop"
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot  = Split-Path -Parent $scriptDir

$dtoFile  = Join-Path $repoRoot "microservice-b\src\main\java\com\att\paymentbox\customerprofile\dto\CustomerProfileDto.java"
$testFile = Join-Path $repoRoot "microservice-b\src\test\java\com\att\paymentbox\customerprofile\controller\CustomerControllerTest.java"

# ── Paso 1: Romper el DTO público ────────────────────────────────────────────
Write-Host "⚠️  [DEMO BREAK 1] Renombrando campos del contrato en CustomerProfileDto..." -ForegroundColor Yellow

$content = Get-Content $dtoFile -Raw

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

# ── Paso 2: Actualizar el test unitario de microservice-b para que compile ───
#    NOTA: El test se actualiza para que el pipeline de microservice-b PASE.
#          La ruptura de contrato solo se detecta en pipeline-integration.yml.
Write-Host "🔧 Actualizando CustomerControllerTest para compilar con nuevo DTO..." -ForegroundColor Yellow

$testContent = Get-Content $testFile -Raw

$testContent = $testContent `
    -replace 'assertThat\(dto\.getTelefono\(\)\)', 'assertThat(dto.getPhone())' `
    -replace 'assertThat\(dto\.getNombre\(\)\)',   'assertThat(dto.getFullName())' `
    -replace 'result\.get\(0\)\.getTelefono\(\)', 'result.get(0).getPhone()'

[System.IO.File]::WriteAllText($testFile, $testContent, [System.Text.Encoding]::UTF8)
Write-Host "✅ Test unitario actualizado — seguirá compilando y pasando" -ForegroundColor Green

# ── Indicaciones ─────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "📋 Pasos a seguir para la demo:" -ForegroundColor Cyan
Write-Host "   1. git add . && git commit -m 'demo: BREAK 1 - romper contrato DTO' && git push origin develop"
Write-Host "   2. Esperar pipeline-microservice-b.yml → PASA ✅ (imagen env-e-{sha} en GHCR)"
Write-Host "   3. GitHub Actions → Run workflow → pipeline-integration.yml"
Write-Host "      promote_from: develop  |  promote_to: qa"
Write-Host "   4. Observar Job 2 '⚠️ DEMO BREAK 1 → Testes Contrato' FALLA ❌"
Write-Host ""
Write-Host "🔍 El campo 'telefono' ya no existe en la respuesta JSON de microservice-b"
Write-Host "   Karate: match response.telefono == '4544'  ← FAIL"
Write-Host "   La promoción a env-a (QA) queda BLOQUEADA hasta que microservice-b"
Write-Host "   corrija el contrato o microservice-a adapte su client." -ForegroundColor Red
