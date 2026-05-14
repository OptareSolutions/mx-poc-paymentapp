# Demo — scripts y guía (PaymentBox PoC)

Esta carpeta contiene **guiones reproducibles** para mostrar gates de calidad en la rama **`E`** (GitFlow `E` → `A` → `F` → `PRODUCCION`).

| Archivo | Uso |
|---------|-----|
| [**DEMO_GUIDE.md**](DEMO_GUIDE.md) | Narrativa completa: arquitectura local, pipelines en GitHub, escenarios verde y **DEMO BREAK 1 / 2**. |
| **`break-contract.ps1`** | Rompe el contrato público de **microservice-b** (campos DTO); el CI detecta el fallo en **PR → `E`** o en **`pipeline-integration.yml`**. |
| **`break-behavior.ps1`** | Activa validación de monto mínimo en **microservice-a**; el fallo típico aparece en **Deliver · Karate E2E** tras **merge a `E`**. |
| **`restore.ps1`** | Descarta cambios locales en los tres archivos tocados por los scripts (vía `git checkout --`). |

Documentación alineada con los workflows actuales:

- [Estrategia GitFlow y matrices de ejecución](../doc/02_CI_CD/gitflow-pipeline-strategy.md) (incluye tabla *verde vs rojo*).
- [README del repositorio](../README.md).

**Requisitos:** PowerShell en Windows (o `pwsh`), Git, y permisos para pushear una rama `feature/*` y abrir PR hacia **`E`**.
