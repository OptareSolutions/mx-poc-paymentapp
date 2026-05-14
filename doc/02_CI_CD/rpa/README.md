# AT&T QA – RPA Automation (Playwright + GitHub Actions) — PoC

> Smoke **TRA-34** (2026-05-14): cambio mínimo en doc RPA para validar disparadores en `feature/*`.

Automatización web liviana integrada en el pipeline CI/CD usando [Playwright](https://playwright.dev/) en modo headless.

---

## Estructura

```
rpa/
├── .github/
│   └── workflows/
│       └── rpa.yml          # Workflow de GitHub Actions
├── scripts/
│   └── rpa-flow.js          # Script RPA principal
├── results/                 # Resultados JSON + capturas (generado en runtime)
├── package.json
└── README.md
```

---

## Flujo automatizado

| Paso | Acción |
|------|--------|
| 1 | Navegar a la URL de la aplicación web |
| 2 | Login con credenciales (via secretos de GitHub) |
| 3 | Consultar registro por ID |
| 4 | Validar que el dato no esté vacío |
| - | Guardar resultado JSON + captura de pantalla |

---

## Configuración

### Variables de entorno / Secretos GitHub

| Variable | Descripción | Secret? |
|----------|-------------|---------|
| `RPA_BASE_URL`  | URL base de la app web     | ✅ Sí |
| `RPA_USERNAME`  | Usuario de login            | ✅ Sí |
| `RPA_PASSWORD`  | Contraseña de login         | ✅ Sí |
| `RPA_RECORD_ID` | ID del registro a consultar | Opcional (default: `1`) |
| `RPA_TIMEOUT_MS`| Timeout en ms               | Opcional (default: `30000`) |

### Configurar secretos en GitHub

```
Settings → Secrets and variables → Actions → New repository secret
```

Crear: `RPA_BASE_URL`, `RPA_USERNAME`, `RPA_PASSWORD`

---

## Ejecución local

```bash
cd rpa
npm install
npx playwright install chromium --with-deps

# Con variables de entorno:
RPA_BASE_URL=https://mi-app.com \
RPA_USERNAME=user \
RPA_PASSWORD=pass \
RPA_RECORD_ID=42 \
node scripts/rpa-flow.js
```

---

## Ejecución en pipeline

El workflow se activa en:
- **Push** a cualquier rama (excepto `main`) que modifique archivos en `rpa/` o `.github/workflows/rpa.yml`
- **Manual** (`workflow_dispatch`) con parámetro opcional de `record_id`

### Artefactos generados

Disponibles 30 días en la pestaña **Actions → Artifacts**:
- `rpa-result-<timestamp>.json` – resultado del flujo con estado de cada paso
- `step2-logged-in.png` – captura tras login
- `step3-record.png` – captura del registro consultado
- `error-screenshot.png` – captura en caso de error (si aplica)

---

## Seguridad

- Acciones pinadas a SHA completo para evitar supply-chain attacks
- Credenciales exclusivamente via secretos de GitHub (nunca en código)
- Permisos mínimos: `contents: read`
- Chromium headless con `--no-sandbox` para compatibilidad con runners Linux
- Retención de artefactos: 30 días

---

## Adaptar el script

Edita `scripts/rpa-flow.js` y ajusta los selectores CSS en los pasos 2 y 3 según la aplicación real:

```js
// Paso 2 – Login
await page.fill('input[name="username"]', CONFIG.username);

// Paso 3 – Navegar al registro
await page.goto(`${CONFIG.baseUrl}/records/${CONFIG.recordId}`);
```
