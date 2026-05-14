# Demo — scripts y guía (PaymentBox PoC)

Esta carpeta contiene **guiones reproducibles** para mostrar gates de calidad en la rama **`E`** (GitFlow `E` → `A` → `F` → `PRODUCCION`).

## Windows (PowerShell)

| Archivo | Uso |
|---------|-----|
| [**DEMO_GUIDE.md**](DEMO_GUIDE.md) | Narrativa completa: arquitectura local, pipelines en GitHub, escenarios verde y **DEMO BREAK 1 / 2**. |
| **`break-contract.ps1`** | Rompe el contrato público de **microservice-b** (campos DTO); el CI detecta el fallo en **PR → `E`** o en **`pipeline-integration.yml`**. |
| **`break-behavior.ps1`** | Inserta validación de monto mínimo en **microservice-a**; el fallo típico aparece en **Deliver · Karate E2E** tras **merge a `E`**. |
| **`restore.ps1`** | Descarta cambios locales en los tres archivos tocados por los scripts (vía `git checkout --`). |

Ejemplo: `.\demo\break-contract.ps1` desde la raíz del repo (PowerShell).

## macOS y Linux (Bash + Python 3)

| Archivo | Uso |
|---------|-----|
| **`break-contract.sh`** | Mismo efecto que `break-contract.ps1` (usa **Python 3** para edits UTF-8 seguros). |
| **`break-behavior.sh`** | Mismo efecto que `break-behavior.ps1`. |
| **`restore.sh`** | Mismo efecto que `restore.ps1`. |

La primera vez, marca ejecutables:

```bash
chmod +x demo/break-contract.sh demo/break-behavior.sh demo/restore.sh
```

Ejemplo desde la raíz del clon:

```bash
./demo/break-contract.sh
```

**Requisito:** `python3` en `PATH` (en macOS viene con Xcode CLT o Xcode).

---

Documentación alineada con los workflows actuales:

- [Estrategia GitFlow y matrices de ejecución](../doc/02_CI_CD/gitflow-pipeline-strategy.md) (incluye tabla *verde vs rojo*).
- [README del repositorio](../README.md).

Para abrir PR hacia **`E`** hace falta Git y push al remoto configurado.
