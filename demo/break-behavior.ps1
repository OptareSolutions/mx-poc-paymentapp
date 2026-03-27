# ══════════════════════════════════════════════════════════════════════════════
# DEMO BREAK 2: Ruptura de Comportamiento (Regla de Negocio)
# ══════════════════════════════════════════════════════════════════════════════
# Efecto:    pipeline-microservice-a.yml Job 4 (E2E Karate) FALLA en env-a (QA)
# Branch:    qa
# Causa:     Un desarrollador agrega una validación de monto mínimo ($100) en
#            RecargaService sin actualizar los tests ni avisar al equipo de QA.
#            Billy usa $20 → la recarga se rechaza con HTTP 400.
#            Los tests unitarios de microservice-a PASAN (no cubren este escenario).
#            La falla solo se detecta en los tests E2E con el ambiente completo.
#
# Timeline demo:
#   1. Pipelines en verde ✅ (develop ya promovido a env-a/QA)
#   2. Ejecutar este script
#   3. git add . && git commit -m "demo: BREAK 2 comportamiento" && git push origin qa
#   4. pipeline-microservice-a.yml en branch 'qa' arranca automáticamente
#      → Job 1 Build+Quality PASA ✅ (unit tests no testean monto mínimo)
#      → Job 2 Security PASA ✅
#      → Job 3 Image Ops PASA ✅ (imagen env-a-{sha} en GHCR)
#      → Job 4 E2E+GitOps FALLA ❌ — "⚠️ DEMO BREAK 2 → Karate E2E"
#         Karate Paso 6/7: POST /api/pagos/registrar monto=20 → HTTP 400 (espera 201)
#   5. El overlay de env-a NO se actualiza (GitOps protege el ambiente)
#   6. Ejecutar restore.ps1 → vuelve a verde ✅
# ══════════════════════════════════════════════════════════════════════════════

$ErrorActionPreference = "Stop"
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot  = Split-Path -Parent $scriptDir

$serviceFile = Join-Path $repoRoot "microservice-a\src\main\java\com\att\paymentbox\service\RecargaService.java"

Write-Host "⚠️  [DEMO BREAK 2] Inyectando validación mínimo de `$100 en RecargaService..." -ForegroundColor Yellow

$content = Get-Content $serviceFile -Raw

# Uncomment the DEMO BREAK 2 lines (remove the // comment prefix)
$content = $content `
    -replace '    //     if \(request\.getMonto\(\)', '    if (request.getMonto()' `
    -replace '    //         throw new ResponseStatusException\(HttpStatus\.BAD_REQUEST, "Monto mínimo \$100"\);', '        throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Monto mínimo $100");'

[System.IO.File]::WriteAllText($serviceFile, $content, [System.Text.Encoding]::UTF8)

Write-Host "✅ Validación de monto mínimo `$100 activada en RecargaService" -ForegroundColor Green
Write-Host ""
Write-Host "📋 Pasos a seguir para la demo:" -ForegroundColor Cyan
Write-Host "   1. git add . ; git commit -m 'demo: BREAK 2 - validación monto mínimo' ; git push origin qa"
Write-Host "   2. pipeline-microservice-a.yml dispara automáticamente en branch 'qa'"
Write-Host "   3. Jobs 1-3 PASAN ✅ — imagen env-a-{sha} construida"
Write-Host "   4. Job 4 '⚠️ DEMO BREAK 2 → Karate E2E' FALLA ❌"
Write-Host ""
Write-Host "🔍 Karate recarga_flow.feature — Paso 6/7:"
Write-Host "   POST /api/pagos/registrar  monto=20 (Billy usa \$20)" -ForegroundColor Red
Write-Host "   Respuesta: HTTP 400 Bad Request  ← se esperaba HTTP 201"
Write-Host "   Mensaje:   'Monto mínimo \$100'"
Write-Host ""
Write-Host "🛡️  El manifesto k8s/overlays/env-a/kustomization.yaml NO se actualiza."
Write-Host "   GitOps protege env-a: la imagen rota nunca llega al overlay."
