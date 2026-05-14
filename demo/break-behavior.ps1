# ══════════════════════════════════════════════════════════════════════════════
# DEMO BREAK 2: Ruptura de Comportamiento (Regla de Negocio)
# ══════════════════════════════════════════════════════════════════════════════
# Efecto:    Deliver - Karate E2E (reusable-microservice-pipeline) FALLA en push a E
# Ramas:     feature/* con PR merge a E (recomendado) — NO hace falta rama qa/develop
# Causa:     Validacion monto minimo ($100) en RecargaService; Billy usa $20 -> HTTP 400.
#            Unit tests de microservice-a pueden seguir pasando.
#
# Timeline demo:
#   1. git checkout -b feature/demo-break2 origin/E
#   2. Este script
#   3. git add/commit/push feature; PR -> E; merge
#   4. En push a E: Publish (si aplica) + Deliver -> paso "DEMO BREAK 2 - Karate E2E" FALLA
#   5. restore.ps1 + commit en la misma rama o revert del merge
# ══════════════════════════════════════════════════════════════════════════════

$ErrorActionPreference = "Stop"
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot  = Split-Path -Parent $scriptDir

$serviceFile = Join-Path $repoRoot "microservice-a\src\main\java\com\att\paymentbox\service\RecargaService.java"

Write-Host "[DEMO BREAK 2] Activando validacion minimo `$100 en RecargaService..." -ForegroundColor Yellow

$content = Get-Content $serviceFile -Raw

$content = $content `
    -replace '    //     if \(request\.getMonto\(\)', '    if (request.getMonto()' `
    -replace '    //         throw new ResponseStatusException\(HttpStatus\.BAD_REQUEST, "Monto mínimo \$100"\);', '        throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Monto mínimo $100");'

[System.IO.File]::WriteAllText($serviceFile, $content, [System.Text.Encoding]::UTF8)

Write-Host "OK Validacion de monto minimo activada" -ForegroundColor Green
Write-Host ""
Write-Host "Pasos sugeridos:" -ForegroundColor Cyan
Write-Host "  git checkout -b feature/demo-break2 origin/E   # si aun no"
Write-Host "  git add ."
Write-Host "  git commit -m `"demo: BREAK 2 - validacion monto minimo`""
Write-Host "  git push -u origin feature/demo-break2"
Write-Host "  # PR hacia E, merge; en Actions ver Deliver / Karate E2E en rojo"
Write-Host ""
Write-Host "Karate esperaba 201 en registro de pago; recibiras 400 (monto minimo)." -ForegroundColor Red
