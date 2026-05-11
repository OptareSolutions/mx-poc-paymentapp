"""
Generador de Datos Sintéticos para el dominio PaymentBox.

Genera datos realistas pero ficticios para:
  - Clientes (teléfono, nombre, status)
  - Pagos (monto, método de pago, status, folio)
  - Órdenes de recarga
  - Perfiles de carga para tests parametrizados

Salidas soportadas:
  - JSON (fixtures para Karate/JUnit)
  - SQL INSERT (para TDM seeders)
  - CSV (para data-driven testing)
"""

import json
import csv
import random
import string
import os
import sys
from dataclasses import dataclass, asdict
from datetime import datetime, timedelta
from typing import Optional

try:
    from faker import Faker
    from faker.providers import BaseProvider
    FAKER_AVAILABLE = True
except ImportError:
    FAKER_AVAILABLE = False
    print("⚠️  Faker no disponible. Usando generador básico. Instale con: pip install faker")

from config import DEFAULT_LOCALE, DATA_DIR


# ─── Custom Faker Provider ────────────────────────────────────────────────────

if FAKER_AVAILABLE:
    class TelcoProvider(BaseProvider):
        """Proveedor de datos específicos del dominio Telco/PaymentBox."""

        OPERADORES = ["BLUE", "RED", "GREEN", "SILVER"]
        METODOS_PAGO = ["TARJETA", "EFECTIVO", "OODI"]
        ESTADOS_CLIENTE = ["ACTIVO", "INACTIVO", "BLOQUEADO"]
        MONTOS_BLUE = [10.0, 20.0, 30.0, 50.0, 70.0, 100.0, 120.0, 150.0, 200.0, 300.0, 500.0, 600.0, 800.0]
        ESTADOS_PAGO = ["PENDIENTE", "APLICADO", "CANCELADO", "FALLIDO"]

        def telefono_cliente(self) -> str:
            """Genera número de teléfono local de 4-10 dígitos (no real)."""
            return str(random.randint(1000, 9999))

        def operador_telco(self) -> str:
            return random.choice(self.OPERADORES)

        def metodo_pago(self) -> str:
            return random.choice(self.METODOS_PAGO)

        def monto_recarga(self, operador: str = "BLUE") -> float:
            return random.choice(self.MONTOS_BLUE)

        def folio_pago(self) -> str:
            prefix = random.choice(["B", "R", "P", "X"])
            num = random.randint(10000, 99999)
            return f"{prefix}-{num}"

        def numero_orden(self) -> str:
            return "".join(random.choices(string.digits, k=9))

        def status_cliente(self, peso_activo: float = 0.7) -> str:
            r = random.random()
            if r < peso_activo:
                return "ACTIVO"
            elif r < 0.85:
                return "INACTIVO"
            else:
                return "BLOQUEADO"

        def status_pago(self, peso_aplicado: float = 0.75) -> str:
            r = random.random()
            if r < peso_aplicado:
                return "APLICADO"
            elif r < 0.85:
                return "PENDIENTE"
            elif r < 0.95:
                return "CANCELADO"
            else:
                return "FALLIDO"


# ─── Data models ─────────────────────────────────────────────────────────────

@dataclass
class ClienteSintetico:
    id: int
    nombre: str
    telefono: str
    status: str
    email: str
    fecha_registro: str

    def to_sql_insert(self) -> str:
        return (
            f"INSERT INTO clientes (nombre, telefono, status) VALUES "
            f"('{self.nombre}', '{self.telefono}', '{self.status}');"
        )

    def to_karate_fixture(self) -> dict:
        return {
            "telefono": self.telefono,
            "fullName": self.nombre,
            "status": self.status,
        }


@dataclass
class PagoSintetico:
    id: int
    numero_orden: str
    telefono_cliente: str
    monto: float
    metodo_pago: str
    status: str
    folio: Optional[str]
    fecha_pago: str
    operador: str

    def to_sql_insert(self) -> str:
        folio_val = f"'{self.folio}'" if self.folio else "NULL"
        return (
            f"INSERT INTO pagos (numero_orden, telefono_cliente, monto, metodo_pago, status, folio, fecha_pago) "
            f"VALUES ('{self.numero_orden}', '{self.telefono_cliente}', {self.monto}, "
            f"'{self.metodo_pago}', '{self.status}', {folio_val}, '{self.fecha_pago}');"
        )

    def to_karate_fixture(self) -> dict:
        return {
            "numeroOrden": self.numero_orden,
            "telefono": self.telefono_cliente,
            "monto": self.monto,
            "metodoPago": self.metodo_pago,
            "status": self.status,
            "folio": self.folio,
            "operador": self.operador,
        }


@dataclass
class DataSet:
    """Conjunto de datos sintéticos generados."""
    clientes: list[ClienteSintetico]
    pagos: list[PagoSintetico]
    generado_en: str
    parametros: dict

    def summary(self) -> dict:
        return {
            "total_clientes": len(self.clientes),
            "clientes_activos": sum(1 for c in self.clientes if c.status == "ACTIVO"),
            "clientes_inactivos": sum(1 for c in self.clientes if c.status == "INACTIVO"),
            "clientes_bloqueados": sum(1 for c in self.clientes if c.status == "BLOQUEADO"),
            "total_pagos": len(self.pagos),
            "pagos_aplicados": sum(1 for p in self.pagos if p.status == "APLICADO"),
            "pagos_pendientes": sum(1 for p in self.pagos if p.status == "PENDIENTE"),
            "monto_total": sum(p.monto for p in self.pagos),
        }


# ─── Generator ───────────────────────────────────────────────────────────────

class SyntheticDataGenerator:
    """Generador de datos sintéticos con soporte Faker y fallback básico."""

    def __init__(self, locale: str = DEFAULT_LOCALE, seed: Optional[int] = None):
        self.locale = locale

        if FAKER_AVAILABLE:
            self.faker = Faker(locale)
            if seed is not None:
                Faker.seed(seed)
                random.seed(seed)
            self.faker.add_provider(TelcoProvider)
            self._use_faker = True
        else:
            if seed is not None:
                random.seed(seed)
            self._use_faker = False

        self._telefono_counter = 5000  # Start after Billy 1-5 (4544-4548)

    # ── Nombre generation ─────────────────────────────────────────────────

    def _nombre(self) -> str:
        if self._use_faker:
            return self.faker.name()
        return f"Usuario {random.randint(100, 999)}"

    def _email(self, nombre: str) -> str:
        if self._use_faker:
            return self.faker.email()
        slug = nombre.lower().replace(" ", ".").replace("-", "")[:15]
        return f"{slug}@test.invalid"

    # ── Cliente generation ────────────────────────────────────────────────

    def _next_telefono(self) -> str:
        """Genera teléfonos únicos sin repetir los Billy 1-5."""
        self._telefono_counter += random.randint(1, 10)
        return str(self._telefono_counter)

    def generate_cliente(
        self,
        idx: int,
        status: Optional[str] = None,
        telefono: Optional[str] = None,
    ) -> ClienteSintetico:
        tel = telefono or self._next_telefono()
        nombre = self._nombre()
        st = status or (
            self.faker.status_cliente() if self._use_faker
            else random.choice(["ACTIVO", "ACTIVO", "ACTIVO", "INACTIVO", "BLOQUEADO"])
        )
        fecha = (
            self.faker.date_time_between(start_date="-2y", end_date="now").isoformat()
            if self._use_faker
            else datetime.now().isoformat()
        )

        return ClienteSintetico(
            id=idx,
            nombre=nombre,
            telefono=tel,
            status=st,
            email=self._email(nombre),
            fecha_registro=fecha,
        )

    def generate_clientes(
        self,
        n: int = 10,
        include_negatives: bool = True,
    ) -> list[ClienteSintetico]:
        """
        Genera n clientes sintéticos.

        Args:
            n: Número de clientes a generar
            include_negatives: Incluir clientes INACTIVO y BLOQUEADO
        """
        clientes = []

        if include_negatives and n >= 3:
            # Garantizar al menos 1 INACTIVO y 1 BLOQUEADO para tests negativos
            clientes.append(self.generate_cliente(1, status="ACTIVO"))
            clientes.append(self.generate_cliente(2, status="INACTIVO"))
            clientes.append(self.generate_cliente(3, status="BLOQUEADO"))
            for i in range(4, n + 1):
                clientes.append(self.generate_cliente(i))
        else:
            for i in range(1, n + 1):
                clientes.append(self.generate_cliente(i, status="ACTIVO"))

        return clientes

    # ── Pago generation ───────────────────────────────────────────────────

    def generate_pago(
        self,
        idx: int,
        telefono: Optional[str] = None,
        monto: Optional[float] = None,
        status: Optional[str] = None,
    ) -> PagoSintetico:
        montos_blue = [10.0, 20.0, 30.0, 50.0, 70.0, 100.0, 120.0, 150.0, 200.0, 300.0]
        st = status or (
            self.faker.status_pago() if self._use_faker
            else random.choice(["APLICADO", "APLICADO", "APLICADO", "PENDIENTE", "CANCELADO"])
        )
        folio = (
            (self.faker.folio_pago() if self._use_faker else f"B-{random.randint(10000, 99999)}")
            if st == "APLICADO"
            else None
        )
        orden = (
            self.faker.numero_orden() if self._use_faker
            else "".join(random.choices(string.digits, k=9))
        )
        fecha = (
            self.faker.date_time_between(start_date="-30d", end_date="now").isoformat()
            if self._use_faker
            else (datetime.now() - timedelta(days=random.randint(0, 30))).isoformat()
        )

        return PagoSintetico(
            id=idx,
            numero_orden=orden,
            telefono_cliente=telefono or "4544",
            monto=monto or random.choice(montos_blue),
            metodo_pago=(
                self.faker.metodo_pago() if self._use_faker
                else random.choice(["TARJETA", "EFECTIVO", "OODI"])
            ),
            status=st,
            folio=folio,
            fecha_pago=fecha,
            operador="BLUE",
        )

    def generate_pagos(
        self,
        n: int = 10,
        clientes: Optional[list[ClienteSintetico]] = None,
        include_negatives: bool = True,
    ) -> list[PagoSintetico]:
        """
        Genera n pagos sintéticos.

        Args:
            n: Número de pagos a generar
            clientes: Lista de clientes para asignar teléfonos
            include_negatives: Incluir pagos CANCELADO y FALLIDO
        """
        pagos = []
        activos = (
            [c for c in clientes if c.status == "ACTIVO"]
            if clientes
            else None
        )

        for i in range(1, n + 1):
            tel = random.choice(activos).telefono if activos else "4544"

            if include_negatives and n >= 3:
                if i == 2:
                    pagos.append(self.generate_pago(i, telefono=tel, status="CANCELADO"))
                    continue
                elif i == 3:
                    pagos.append(self.generate_pago(i, telefono=tel, status="FALLIDO"))
                    continue

            pagos.append(self.generate_pago(i, telefono=tel))

        return pagos

    # ── Dataset ───────────────────────────────────────────────────────────

    def generate_dataset(
        self,
        n_clientes: int = 10,
        n_pagos: int = 20,
        seed: Optional[int] = None,
        context: str = "test",
    ) -> DataSet:
        """
        Genera un dataset completo de datos sintéticos.

        Args:
            n_clientes: Número de clientes
            n_pagos: Número de pagos
            seed: Semilla para reproducibilidad
            context: Contexto del dataset (test, performance, demo)
        """
        if seed is not None:
            random.seed(seed)
            if FAKER_AVAILABLE:
                Faker.seed(seed)

        print(f"\n🔧 Generando dataset sintético ({context}):")
        print(f"   Clientes: {n_clientes} | Pagos: {n_pagos}")

        clientes = self.generate_clientes(n_clientes)
        pagos = self.generate_pagos(n_pagos, clientes=clientes)

        dataset = DataSet(
            clientes=clientes,
            pagos=pagos,
            generado_en=datetime.now().isoformat(),
            parametros={
                "n_clientes": n_clientes,
                "n_pagos": n_pagos,
                "seed": seed,
                "context": context,
                "locale": self.locale,
                "faker_version": "20+" if FAKER_AVAILABLE else "N/A",
            },
        )

        summary = dataset.summary()
        print(f"\n📊 Resumen del dataset:")
        for k, v in summary.items():
            print(f"   {k}: {v}")

        return dataset

    # ── Export methods ────────────────────────────────────────────────────

    def export_json(self, dataset: DataSet, output_dir: Optional[str] = None) -> str:
        """Exporta el dataset a JSON (fixtures para Karate/JUnit)."""
        output_dir = output_dir or DATA_DIR
        os.makedirs(output_dir, exist_ok=True)

        ts = datetime.now().strftime("%Y%m%d_%H%M%S")
        filepath = os.path.join(output_dir, f"synthetic_data_{ts}.json")

        data = {
            "metadata": {
                "generado_en": dataset.generado_en,
                "parametros": dataset.parametros,
                "summary": dataset.summary(),
            },
            "clientes": [c.to_karate_fixture() for c in dataset.clientes],
            "pagos": [p.to_karate_fixture() for p in dataset.pagos],
        }

        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False, default=str)

        print(f"\n📄 JSON exportado: {filepath}")
        return filepath

    def export_sql(self, dataset: DataSet, output_dir: Optional[str] = None) -> str:
        """Exporta el dataset a SQL INSERT statements (TDM seeder)."""
        output_dir = output_dir or DATA_DIR
        os.makedirs(output_dir, exist_ok=True)

        ts = datetime.now().strftime("%Y%m%d_%H%M%S")
        filepath = os.path.join(output_dir, f"synthetic_seeder_{ts}.sql")

        lines = [
            "-- ============================================================",
            f"-- TDM Seeder Sintético: att_paymentbox",
            f"-- Generado: {dataset.generado_en}",
            f"-- Contexto: {dataset.parametros.get('context', 'test')}",
            f"-- NO usar en producción - datos sintéticos",
            "-- ============================================================",
            "",
            "BEGIN;",
            "",
            "-- Clientes sintéticos",
        ]

        for c in dataset.clientes:
            lines.append(c.to_sql_insert())

        lines.append("")
        lines.append("-- Pagos sintéticos")

        for p in dataset.pagos:
            lines.append(p.to_sql_insert())

        lines.append("")
        lines.append("COMMIT;")

        with open(filepath, "w", encoding="utf-8") as f:
            f.write("\n".join(lines) + "\n")

        print(f"📄 SQL exportado: {filepath}")
        return filepath

    def export_csv(self, dataset: DataSet, output_dir: Optional[str] = None) -> tuple[str, str]:
        """Exporta el dataset a CSV (data-driven testing en Karate)."""
        output_dir = output_dir or DATA_DIR
        os.makedirs(output_dir, exist_ok=True)

        ts = datetime.now().strftime("%Y%m%d_%H%M%S")

        # Clientes CSV
        clientes_path = os.path.join(output_dir, f"clientes_{ts}.csv")
        with open(clientes_path, "w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=["telefono", "fullName", "status"])
            writer.writeheader()
            for c in dataset.clientes:
                writer.writerow(c.to_karate_fixture())

        # Pagos CSV
        pagos_path = os.path.join(output_dir, f"pagos_{ts}.csv")
        with open(pagos_path, "w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(
                f,
                fieldnames=["numeroOrden", "telefono", "monto", "metodoPago", "status", "folio", "operador"],
            )
            writer.writeheader()
            for p in dataset.pagos:
                writer.writerow(p.to_karate_fixture())

        print(f"📄 CSV exportado: {clientes_path}")
        print(f"📄 CSV exportado: {pagos_path}")
        return clientes_path, pagos_path

    def generate_karate_examples_table(
        self,
        n: int = 5,
        status_filter: Optional[str] = "ACTIVO",
    ) -> str:
        """
        Genera una tabla Examples para usar directamente en Scenario Outline Karate.

        Args:
            n: Número de filas
            status_filter: Filtrar por status de cliente
        """
        clientes = self.generate_clientes(n, include_negatives=(status_filter is None))
        if status_filter:
            clientes = [c for c in clientes if c.status == status_filter][:n]

        lines = ["    Examples:"]
        lines.append("      | telefono | nombre                 | status  |")
        for c in clientes:
            nombre_padded = c.nombre[:20].ljust(22)
            lines.append(f"      | {c.telefono:<8} | {nombre_padded} | {c.status:<7} |")

        return "\n".join(lines)


# ─── Public API ──────────────────────────────────────────────────────────────

def generate_synthetic_data(
    n_clientes: int = 10,
    n_pagos: int = 20,
    output_formats: list[str] = ["json", "sql", "csv"],
    seed: Optional[int] = None,
    context: str = "test",
    output_dir: Optional[str] = None,
) -> DataSet:
    """
    Genera y exporta datos sintéticos para el dominio PaymentBox.

    Args:
        n_clientes: Número de clientes a generar
        n_pagos: Número de pagos a generar
        output_formats: Formatos de salida (json, sql, csv)
        seed: Semilla para resultados reproducibles
        context: Contexto del dataset (test, performance, demo)
        output_dir: Directorio de salida

    Returns:
        DataSet generado
    """
    generator = SyntheticDataGenerator(seed=seed)
    dataset = generator.generate_dataset(n_clientes, n_pagos, seed=seed, context=context)

    print(f"\n💾 Exportando datos en formatos: {output_formats}")

    if "json" in output_formats:
        generator.export_json(dataset, output_dir)
    if "sql" in output_formats:
        generator.export_sql(dataset, output_dir)
    if "csv" in output_formats:
        generator.export_csv(dataset, output_dir)

    return dataset


if __name__ == "__main__":
    # Ejemplo de uso directo
    import argparse

    parser = argparse.ArgumentParser(description="Generador de datos sintéticos PaymentBox")
    parser.add_argument("--clientes", type=int, default=10, help="Número de clientes")
    parser.add_argument("--pagos", type=int, default=20, help="Número de pagos")
    parser.add_argument("--seed", type=int, default=None, help="Semilla para reproducibilidad")
    parser.add_argument("--context", default="test", help="Contexto: test, performance, demo")
    parser.add_argument("--formats", default="json,sql,csv", help="Formatos de salida")
    args = parser.parse_args()

    generate_synthetic_data(
        n_clientes=args.clientes,
        n_pagos=args.pagos,
        output_formats=args.formats.split(","),
        seed=args.seed,
        context=args.context,
    )
