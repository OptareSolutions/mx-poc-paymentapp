# ══════════════════════════════════════════════════════════════════════════════
# DEMO RESTORE: Revertir cambios locales de BREAK 1 y BREAK 2
# ══════════════════════════════════════════════════════════════════════════════
#
# Restaura respecto al ultimo commit:
#   BREAK 1 -> CustomerProfileDto.java + CustomerControllerTest.java (microservice-b)
#   BREAK 2 -> RecargaService.java (microservice-a)
# ══════════════════════════════════════════════════════════════════════════════

$ErrorActionPreference = "Stop"

Write-Host "Restaurando archivos via git checkout..." -ForegroundColor Cyan

Push-Location (Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path))

git checkout -- `
    "microservice-b/src/main/java/com/att/paymentbox/customerprofile/dto/CustomerProfileDto.java" `
    "microservice-b/src/test/java/com/att/paymentbox/customerprofile/controller/CustomerControllerTest.java" `
    "microservice-a/src/main/java/com/att/paymentbox/service/RecargaService.java"

Pop-Location

Write-Host "OK Archivos restaurados al HEAD del repo" -ForegroundColor Green
Write-Host ""
Write-Host "Siguiente:" -ForegroundColor Cyan
Write-Host "  git status"
Write-Host "  git commit -am `"demo: restaurar estado verde`"   # o git add + commit"
Write-Host "  git push"
Write-Host ""
Write-Host "Si ya mergeaste un BREAK a E, puede hacer falta revert del merge en lugar de este script." -ForegroundColor DarkYellow
