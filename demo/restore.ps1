# ══════════════════════════════════════════════════════════════════════════════
# DEMO RESTORE: Revertir todos los cambios de demo
# ══════════════════════════════════════════════════════════════════════════════
#
# Reverte:
#   DEMO BREAK 1 (contrato)    → CustomerProfileDto.java + CustomerControllerTest.java
#   DEMO BREAK 2 (comportamiento) → RecargaService.java
# ══════════════════════════════════════════════════════════════════════════════

$ErrorActionPreference = "Stop"

Write-Host "🔄 Restaurando archivos originales via git checkout..." -ForegroundColor Cyan

Push-Location (Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path))

git checkout -- `
    "microservice-b/src/main/java/com/att/paymentbox/customerprofile/dto/CustomerProfileDto.java" `
    "microservice-b/src/test/java/com/att/paymentbox/customerprofile/controller/CustomerControllerTest.java" `
    "microservice-a/src/main/java/com/att/paymentbox/service/RecargaService.java"

Pop-Location

Write-Host "✅ Archivos restaurados al estado original" -ForegroundColor Green
Write-Host ""
Write-Host "📋 Ahora ejecuta:" -ForegroundColor Cyan
Write-Host "   # Para restaurar env-e (develop):"
Write-Host "   git add . ; git commit -m 'demo: restaurar estado verde' ; git push origin develop"
Write-Host ""
Write-Host "   # Para restaurar env-a (qa) si se corrió BREAK 2 en branch qa:"
Write-Host "   git add . ; git commit -m 'demo: restaurar estado verde' ; git push origin qa"
Write-Host ""
Write-Host "🔍 Pipeline volverá a verde en todos los jobs ✅"
Write-Host "   BREAK 1: pipeline-microservice-b + pipeline-integration (develop→qa)"
Write-Host "   BREAK 2: pipeline-microservice-a Job 4 (branch qa)"
