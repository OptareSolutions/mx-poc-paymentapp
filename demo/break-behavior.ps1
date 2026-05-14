# ══════════════════════════════════════════════════════════════════════════════
# DEMO BREAK 2: Ruptura de Comportamiento (Regla de Negocio)
# ══════════════════════════════════════════════════════════════════════════════
# Efecto:    Deliver - Karate E2E (reusable-microservice-pipeline) FALLA en push a E
# Ramas:     feature/* con PR merge a E (recomendado)
# Causa:     Validacion monto minimo ($100) en RecargaService; Billy usa $20 -> HTTP 400.
# ══════════════════════════════════════════════════════════════════════════════

$ErrorActionPreference = "Stop"
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot  = Split-Path -Parent $scriptDir

$serviceFile = Join-Path $repoRoot "microservice-a\src\main\java\com\att\paymentbox\service\RecargaService.java"

Write-Host "[DEMO BREAK 2] Insertando validacion monto minimo en registrarPago()..." -ForegroundColor Yellow

$content = [System.IO.File]::ReadAllText($serviceFile)

$marker = 'if (request.getMonto().compareTo(new java.math.BigDecimal("100")) < 0)'
$rgx = [regex]::Match($content, '(?s)public\s+PagoResponse\s+registrarPago.*?\n\s*}\s*\n')
if ($rgx.Success -and $rgx.Value.Contains($marker)) {
    Write-Error "DEMO BREAK 2 ya aplicado. Ejecuta restore.ps1 primero."
    exit 1
}

$needle = @"
        buscarClienteActivo(request.getTelefonoCliente());

        String folio
"@
$insert = @"
        buscarClienteActivo(request.getTelefonoCliente());

        if (request.getMonto().compareTo(new java.math.BigDecimal("100")) < 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Monto mínimo $100");
        }

        String folio
"@

if (-not $content.Contains($needle)) {
    Write-Error "No se encontro el bloque esperado en RecargaService.java (cambio manual previo?)."
    exit 1
}

$content = $content.Replace($needle, $insert)
[System.IO.File]::WriteAllText($serviceFile, $content, [System.Text.UTF8Encoding]::new($false))

Write-Host "OK Validacion insertada" -ForegroundColor Green
Write-Host ""
Write-Host "Pasos sugeridos:" -ForegroundColor Cyan
Write-Host "  git checkout -b feature/demo-break2 origin/E   # si aun no"
Write-Host "  git add ."
Write-Host "  git commit -m `"demo: BREAK 2 - validacion monto minimo`""
Write-Host "  git push -u origin feature/demo-break2"
Write-Host "  # PR hacia E, merge; en Actions ver Deliver / Karate E2E en rojo"
