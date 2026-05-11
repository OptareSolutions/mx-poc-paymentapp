# API Contract Testing — Detección de Breaking Changes OpenAPI

**Proyecto**: AT&T PaymentBox PoC  
**Herramienta**: [oasdiff](https://github.com/tufin/oasdiff)  
**Integración**: GitHub Actions  

---

## Objetivo

Detectar automáticamente **breaking changes** (cambios incompatibles) en las especificaciones OpenAPI/Swagger de los microservicios antes de que lleguen a producción.

Un breaking change rompe la compatibilidad con los consumidores existentes de la API, por ejemplo:
- Renombrar o eliminar un campo de response (`telefono` → `phone`)
- Eliminar un endpoint existente
- Cambiar el tipo de un campo (`string` → `integer`)
- Añadir un campo requerido en el request body
- Eliminar un valor de enum existente

---

## Arquitectura de la Solución

```
PR / Push
    │
    ▼
┌─────────────────────────────────────────────────────┐
│  pipeline-contrato-openapi.yml                      │
│                                                     │
│  Job 0: Detectar qué servicios tienen cambios       │
│         (git diff contra rama base)                 │
│                                                     │
│  Job 1: microservice-a                              │
│    ├── Cargar spec actual (docs/openapi.yaml)       │
│    ├── Obtener baseline (rama base / main)          │
│    ├── Instalar oasdiff                             │
│    ├── oasdiff breaking base.yaml revision.yaml     │
│    └── ❌ FAIL si hay breaking changes              │
│                                                     │
│  Job 2: microservice-b (igual que Job 1)            │
│                                                     │
│  Job 3: Resumen global                              │
└─────────────────────────────────────────────────────┘
```

---

## Estructura de Archivos

```
att-poc-paymentbox/
├── .github/
│   └── workflows/
│       └── pipeline-contrato-openapi.yml   ← Workflow principal
│
├── microservice-a/
│   └── docs/
│       ├── openapi-baseline.yaml           ← Contrato estable de referencia
│       └── openapi.yaml                    ← Spec actual (generada/mantenida)
│
└── microservice-b/
    └── docs/
        ├── openapi-baseline.yaml           ← Contrato estable de referencia
        └── openapi.yaml                    ← Spec actual (generada/mantenida)
```

---

## Flujo de Trabajo

### 1. Estado inicial (baseline)

Los archivos `docs/openapi-baseline.yaml` contienen el **contrato estable** de referencia:

- **microservice-b**: `CustomerProfileDto` con campos `telefono` y `nombre`
- **microservice-a**: Todos los endpoints + `CustomerProfileDto` con `telefono` y `nombre`

### 2. Cuando un desarrollador cambia la API

```bash
# Developer cambia microservice-b: renombra "telefono" → "phone"
# Debe actualizar docs/openapi.yaml para reflejar el cambio
```

El pipeline detecta el cambio y ejecuta `oasdiff breaking`:

```
❌ PIPELINE BLOQUEADO — Breaking Changes Detectados
   Servicio: microservice-b
   Breaking changes: 2

   response-property-removed: DELETE /api/customers/{telefono} 200 telefono
   response-property-removed: DELETE /api/customers/{telefono} 200 nombre
```

### 3. Opciones para el desarrollador

| Opción | Descripción |
|--------|-------------|
| **Non-breaking** | Añadir nuevos campos `phone`/`fullName` manteniendo `telefono`/`nombre` |
| **Versioning** | Crear `/v2/api/customers/{telefono}` con nuevos campos |
| **Coordinación** | Coordinar actualización simultánea de todos los consumidores |

---

## Cómo Generar la Spec OpenAPI

### Opción A: Plugin Gradle (recomendado)

Añadir al `build.gradle`:

```groovy
plugins {
    id 'org.springdoc.openapi-gradle-plugin' version '1.9.0'
}

openApi {
    apiDocsUrl.set("http://localhost:8080/v3/api-docs")
    outputDir.set(file("docs"))
    outputFileName.set("openapi.yaml")
    waitTimeInSeconds.set(30)
}
```

Generar:
```bash
# Requiere DB activa o perfil H2
SPRING_PROFILES_ACTIVE=test gradle generateOpenApiDocs
```

### Opción B: Spec estática (manual)

Mantener `docs/openapi.yaml` actualizada manualmente con cada cambio de API.

### Opción C: Springdoc endpoint

```bash
# Con el servicio corriendo localmente:
curl http://localhost:8081/v3/api-docs -o microservice-b/docs/openapi.yaml
```

---

## Triggers del Pipeline

| Evento | Condición |
|--------|-----------|
| `pull_request` → main/uat/qa/develop | Cambios en `docs/openapi*.yaml` o `src/main/java/**` |
| `push` → develop/qa/uat | Cambios en `docs/openapi*.yaml` |
| `workflow_dispatch` | Manual, selección de servicio |

---

## Tipos de Breaking Changes Detectados por oasdiff

| Categoría | Ejemplo |
|-----------|---------|
| **Endpoints eliminados** | `DELETE /api/customers/{telefono} GET` |
| **Campos response eliminados** | `response-property-removed` |
| **Campos request requeridos añadidos** | `request-body-schema-new-required-property` |
| **Tipo de dato cambiado** | `response-property-type-changed` |
| **Enum: valores eliminados** | `response-property-enum-value-removed` |
| **Parámetro requerido añadido** | `request-parameter-new-required` |
| **Parámetro eliminado** | `request-parameter-removed` |

---

## Demo: Romper y Detectar el Contrato

### Simular breaking change (microservice-b)

```bash
# 1. Modificar CustomerProfileDto.java:
#    private String phone;    // era: telefono
#    private String fullName; // era: nombre

# 2. Actualizar docs/openapi.yaml para reflejar el cambio

# 3. Crear un PR → el pipeline fallará con:
#    ❌ PIPELINE BLOQUEADO — Breaking Changes Detectados
#       response-property-removed: telefono
#       response-property-removed: nombre
```

---

## Herramienta: oasdiff

- **Repositorio**: https://github.com/tufin/oasdiff
- **Versión usada**: v1.10.20
- **Comandos principales**:
  ```bash
  # Ver todas las diferencias
  oasdiff diff base.yaml revision.yaml --format text

  # Solo breaking changes (falla con exit code 1 si los hay)
  oasdiff breaking base.yaml revision.yaml --format text

  # Changelog completo
  oasdiff changelog base.yaml revision.yaml --format text
  ```

---

## Seguridad del Workflow

- ✅ Acciones pinadas a SHAs completos (inmutables)
- ✅ Permisos mínimos (`contents: read`, `pull-requests: write`)
- ✅ Concurrencia controlada (cancela ejecuciones duplicadas)
- ✅ Retención de artefactos limitada (30 días)
- ✅ Sin credenciales en el código

---

## Archivos en este Directorio

| Archivo | Descripción |
|---------|-------------|
| `pipeline-contrato-openapi.yml` | GitHub Actions workflow |
| `openapi-baseline-microservice-a.yaml` | Contrato estable microservice-a |
| `openapi-baseline-microservice-b.yaml` | Contrato estable microservice-b |
| `README.md` | Esta documentación |
