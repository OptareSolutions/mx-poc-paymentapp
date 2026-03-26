# ══════════════════════════════════════════════════════════════════════════════
# DEMO BREAK 2: Ruptura de Comportamiento (Regla de Negocio)
# ══════════════════════════════════════════════════════════════════════════════
# Efecto: Job 4 (Functional E2E - Karate) FALLA
# Causa:  Un desarrollador agrega una validación de monto mínimo ($100) en
#         RecargaService sin actualizar los tests ni avisar al equipo de QA.
#         Billy usa $20 → la recarga se rechaza con HTTP 400.
#
# Timeline demo:
#   1. Pipeline en verde ✅
#   2. Ejecutar este script
#   3. git push → Pipeline falla en Job 4 ❌
#   4. Ejecutar restore.ps1 → Pipeline vuelve a verde ✅
# ══════════════════════════════════════════════════════════════════════════════

$ErrorActionPreference = "Stop"
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot  = Split-Path -Parent $scriptDir

$serviceFile = Join-Path $repoRoot "microservice-a\src\main\java\com\att\paymentbox\service\RecargaService.java"

Write-Host "⚠️  [DEMO BREAK 2] Inyectando validación mínimo de \$100 en RecargaService..." -ForegroundColor Yellow

$content = Get-Content $serviceFile -Raw

# Uncomment the DEMO BREAK 2 lines (remove the // comment prefix)
$content = $content `
    -replace '    //     if \(request\.getMonto\(\)', '    if (request.getMonto()' `
    -replace '    //         throw new ResponseStatusException\(HttpStatus\.BAD_REQUEST, "Monto mínimo \$100"\);', '        throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Monto mínimo $100");'

[System.IO.File]::WriteAllText($serviceFile, $content, [System.Text.Encoding]::UTF8)

Write-Host "✅ Validación de monto mínimo \$100 activada en RecargaService" -ForegroundColor Green
Write-Host ""
Write-Host "📋 Ahora ejecuta:" -ForegroundColor Cyan
Write-Host "   git add . && git commit -m 'demo: romper comportamiento monto mínimo (DEMO BREAK 2)' && git push"
Write-Host ""
Write-Host "🔍 Pipeline fallará en: Job 4 → '⚠️ DEMO BREAK 2 → Karate DSL - Tests Funcionales'"
Write-Host "   Karate: POST /api/pagos/registrar con monto=20 → HTTP 400 (esperaba 201)"
