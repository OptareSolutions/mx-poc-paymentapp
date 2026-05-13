#!/usr/bin/env python3
"""Genera LOAD_REPORT.md a partir del summary export de k6, métricas JSON y opcional NDJSON crudo."""

from __future__ import annotations

import json
import math
import os
from collections import defaultdict
from pathlib import Path


def pct(x: float | None, digits: int = 4) -> str:
    return f"{100.0 * x:.{digits}f}%" if x is not None and not math.isnan(x) else "N/A"


def ms(v: float | None) -> str:
    return f"{v:.0f} ms" if v is not None and not math.isnan(v) else "N/A"


def num(v: float | None) -> str:
    if v is None or (isinstance(v, float) and math.isnan(v)):
        return "N/A"
    return str(int(round(v)))


def read_json(path: Path) -> dict | None:
    if not path.is_file():
        return None
    return json.loads(path.read_text(encoding="utf-8"))


def agg_http_status(ndjson_path: Path) -> dict[str, int]:
    """Cuenta códigos HTTP presentes en tags de muestras `Point` del export JSON de k6."""
    counts: dict[str, int] = defaultdict(int)
    if not ndjson_path.is_file():
        return dict(counts)
    with ndjson_path.open(encoding="utf-8", errors="ignore") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                row = json.loads(line)
            except json.JSONDecodeError:
                continue
            if row.get("type") != "Point":
                continue
            data = row.get("data") or {}
            tags = data.get("tags") or data.get("Tags") or {}
            status = tags.get("status") or tags.get("Status")
            if status is None:
                continue
            counts[str(status)] += 1
    return dict(counts)


def pick_metric(summary: dict, name: str) -> dict | None:
    metrics = summary.get("metrics") or {}
    m = metrics.get(name)
    if isinstance(m, dict):
        return m.get("values") or {}
    return None


def main() -> None:
    out_dir = Path(os.environ.get("RESULTS_DIR", "tests/k6/results"))
    summary_path = Path(os.environ.get("K6_SUMMARY_PATH", out_dir / "k6_summary.json"))
    nd_path = Path(os.environ.get("K6_NDJSON_PATH", out_dir / "k6_load_raw.json"))
    latest_metrics_path = Path(os.environ.get("LATEST_METRICS_PATH", out_dir / "load_test_latest_metrics.json"))
    baseline_path = Path(os.environ.get("BASELINE_METRICS_PATH", out_dir / "baseline_metrics.json"))
    md_out = Path(os.environ.get("REPORT_MD_PATH", out_dir / "LOAD_REPORT.md"))

    md_lines: list[str] = []

    summary = read_json(summary_path) or {}
    latest = read_json(latest_metrics_path) or {}

    if latest and "thresholds_passed" in latest:
        all_pass = bool(latest["thresholds_passed"])
    else:
        all_pass = all(
            t.get("ok", True)
            for m in summary.get("metrics", {}).values()
            if isinstance(m, dict)
            for t in (m.get("thresholds") or {}).values()
        )

    lm = latest.get("metrics") or {}
    avg_flujo = lm.get("flujo_completo_avg_ms")
    successes = lm.get("flujos_exitosos")
    failed = lm.get("flujos_fallidos")
    err_rate = lm.get("error_rate")
    http_fail = lm.get("http_req_failed_rate")

    md_lines += [
        "## Informe · Load Test 2k VUs · Resumen ejecutivo\n",
        f"- **Umbral global k6**: {'✅ Cumplido' if all_pass else '❌ Incumplido'}\n",
        f"- Run ID GH: `{os.environ.get('GITHUB_RUN_ID','')}`\n",
        f"- Entorno (etiqueta): `{latest.get('environment') or summary.get('test_run_id','')}`\n",
        "\n### Latencias (promedio y críticas)\n",
        "| Métrica | Valor |\n|---------|-------|\n",
        f"| Flujo completo (avg) | {ms(float(avg_flujo)) if avg_flujo is not None else 'N/A'} |\n",
        f"| Flujo completo (p95) | {ms(float(lm.get('flujo_completo_p95_ms'))) if lm.get('flujo_completo_p95_ms') else 'ver summary k6'} |\n",
        f"| Login focalizar cliente (p95) | {ms(float(lm.get('login_p95_ms'))) if lm.get('login_p95_ms') else 'N/A'} |\n",
        f"| Consulta / operador (p95) | {ms(float(lm.get('consulta_p95_ms'))) if lm.get('consulta_p95_ms') else 'N/A'} |\n",
        f"| Registrar pago (p95) | {ms(float(lm.get('pago_p95_ms'))) if lm.get('pago_p95_ms') else 'N/A'} |\n",
        f"| Emitir recibo (p95) | {ms(float(lm.get('recibo_p95_ms'))) if lm.get('recibo_p95_ms') else 'N/A'} |\n",
        "\n### Volumen y resultado de checks\n",
        "| Concepto | Valor |\n|----------|-------|\n",
        f"| Flujos exitosos | {num(float(successes)) if successes is not None else 'N/A'} |\n",
        f"| Flujos fallidos | {num(float(failed)) if failed is not None else 'N/A'} |\n",
        f"| `load_errors` (rate k6 checks) | {pct(float(err_rate)) if err_rate is not None else 'N/A'} |\n",
        f"| `http_req_failed` rate | {pct(float(http_fail)) if http_fail is not None else 'N/A'} |\n",
        f"| HTTP requests (total summary) | {num(float((pick_metric(summary,'http_reqs') or {}).get('count'))) if pick_metric(summary,'http_reqs') else 'N/A'} |\n",
    ]

    statuses = agg_http_status(nd_path)
    md_lines.append("\n### Códigos de respuesta HTTP (puntos etiquetados en NDJSON)\n")
    if not statuses:
        md_lines.append("_Sin agregados (NDJSON ausente o vacío)._\n")
    else:
        md_lines += ["| Agrupador | Requests |\n|-----------|----------|\n"]
        for k in sorted(statuses.keys(), key=lambda x: (-statuses[x], x)):
            md_lines.append(f"| {k} | {statuses[k]} |\n")

    md_lines.append("\n### Principales thresholds y mensajes (resumen export k6)\n")
    thresh_rows = []
    for name, mobj in sorted((summary.get("metrics") or {}).items()):
        if not isinstance(mobj, dict):
            continue
        th = mobj.get("thresholds")
        if not th:
            continue
        bits = []
        for _, tv in sorted(th.items()):
            if isinstance(tv, dict):
                ok = tv.get("ok")
                tb = tv.get("threshold")
                bv = mobj.get("values", {})
                if "rate" in bv and "rate" in str(tb):
                    cur = pct(float(bv.get("rate", 0)))
                elif isinstance(bv.get("avg"), (int, float)):
                    cur = ms(float(bv["avg"]))
                elif isinstance(bv.get("avg"), dict):
                    continue
                else:
                    cur = ""
                bits.append(f"{'✅' if ok else '❌'} `{tb}` → actual {cur}")
        if bits:
            thresh_rows.append((name, "; ".join(bits)))
    if thresh_rows:
        md_lines += ["| Métrica | Estado thresholds |\n|---------|-------------------|\n"]
        for n, txt in thresh_rows:
            md_lines.append(f"| `{n}` | {txt} |\n")
    else:
        md_lines.append("_Sin thresholds procesables en summary._\n")

    baseline = read_json(baseline_path)
    md_lines.append("\n### Degradación frente al baseline anterior (si existe artefacto `load-test-baseline`)\n")
    if baseline and latest:
        b = baseline.get("metrics") or baseline
        def delta(cur, prev):
            if cur is None or prev is None:
                return None
            try:
                cf, pf = float(cur), float(prev)
            except (TypeError, ValueError):
                return None
            return cf - pf

        pairs = [
            ("Flujo p95 (ms)", lm.get("flujo_completo_p95_ms"), b.get("flujo_completo_p95_ms")),
            ("Errores (rate)", lm.get("error_rate"), b.get("error_rate")),
        ]
        md_lines += ["| KPI | Actual | Baseline | Δ |\n|-----|--------|----------|---|\n"]
        for lab, cv, bv in pairs:
            d = delta(cv, bv)
            dv = ""
            if d is not None:
                dv = f"{d:+g}"
                if "p95" in lab and d > 0:
                    dv += " ⚠ degradación mayor latencia"
                if lab.startswith("Errores") and d > 0:
                    dv += " ⚠ mayor tasa errores"
            md_lines.append(
                f"| {lab} | {cv if cv is not None else '-'} | {bv if bv is not None else '-'} | {dv or '-'} |\n"
            )
    else:
        md_lines.append("_Sin baseline disponible para esta corrida — el primer resultado queda sólo como referencia manual._\n")

    md_lines += [
        "\n### Artefactos generados automáticamente\n",
        "- `k6_load_raw.json` — líneas NDJSON brutas (`--out json=...`).\n",
        "- `k6_summary.json` — export resiliente `--summary-export`.\n",
        "- `reportes/dashboard_*.html`, `reportes/dashboard_latest.html` — panel HTML sintético desde el script.\n",
        "- `resultados/load_test_*.json` y `resultados/load_test_latest.json` — métricas agregadas con umbral booleando incluidos.\n",
        "- Este archivo Markdown para adjuntarlo al mismo artefacto y al job summary de GitHub.\n",
    ]

    md_out.parent.mkdir(parents=True, exist_ok=True)
    md_out.write_text("".join(md_lines), encoding="utf-8")
    print(f"Wrote {md_out}")


if __name__ == "__main__":
    main()
