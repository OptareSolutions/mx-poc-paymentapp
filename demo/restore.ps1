# ══════════════════════════════════════════════════════════════════════════════
# DEMO RESTORE: Revertir todos los cambios de demo
# ══════════════════════════════════════════════════════════════════════════════

$ErrorActionPreference = "Stop"

Write-Host "🔄 Restaurando archivos originales via git checkout..." -ForegroundColor Cyan

Push-Location (Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path))

git checkout -- `
    "microservice-b/src/main/java/com/att/paymentbox/customerprofile/dto/CustomerProfileDto.java" `
    "microservice-a/src/main/java/com/att/paymentbox/service/RecargaService.java"

Pop-Location

Write-Host "✅ Archivos restaurados al estado original" -ForegroundColor Green
Write-Host ""
Write-Host "📋 Ahora ejecuta:" -ForegroundColor Cyan
Write-Host "   git add . && git commit -m 'demo: restaurar estado verde' && git push"
Write-Host ""
Write-Host "🔍 Pipeline volverá a verde en todos los jobs ✅"
