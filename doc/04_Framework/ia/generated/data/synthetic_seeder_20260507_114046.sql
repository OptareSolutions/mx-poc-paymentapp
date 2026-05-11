-- ============================================================
-- TDM Seeder Sintético: att_paymentbox
-- Generado: 2026-05-07T11:40:46.422587
-- Contexto: demo
-- NO usar en producción - datos sintéticos
-- ============================================================

BEGIN;

-- Clientes sintéticos
INSERT INTO clientes (nombre, telefono, status) VALUES ('Hugo Colón Ríos', '5001', 'ACTIVO');
INSERT INTO clientes (nombre, telefono, status) VALUES ('Sra. Micaela Preciado', '5006', 'INACTIVO');
INSERT INTO clientes (nombre, telefono, status) VALUES ('Andrés Carlos Castellanos Núñez', '5009', 'BLOQUEADO');
INSERT INTO clientes (nombre, telefono, status) VALUES ('Julio Teodoro Santillán Jurado', '5017', 'ACTIVO');
INSERT INTO clientes (nombre, telefono, status) VALUES ('Sra. Cristina Ballesteros', '5019', 'ACTIVO');

-- Pagos sintéticos
INSERT INTO pagos (numero_orden, telefono_cliente, monto, metodo_pago, status, folio, fecha_pago) VALUES ('385741883', '5017', 20.0, 'TARJETA', 'APLICADO', 'X-85578', '2026-05-02T20:08:52');
INSERT INTO pagos (numero_orden, telefono_cliente, monto, metodo_pago, status, folio, fecha_pago) VALUES ('813921051', '5019', 10.0, 'TARJETA', 'CANCELADO', NULL, '2026-04-12T11:43:50');
INSERT INTO pagos (numero_orden, telefono_cliente, monto, metodo_pago, status, folio, fecha_pago) VALUES ('206986608', '5017', 150.0, 'OODI', 'FALLIDO', NULL, '2026-05-05T20:31:41');
INSERT INTO pagos (numero_orden, telefono_cliente, monto, metodo_pago, status, folio, fecha_pago) VALUES ('103827609', '5019', 20.0, 'EFECTIVO', 'APLICADO', 'X-31865', '2026-04-10T10:47:43');
INSERT INTO pagos (numero_orden, telefono_cliente, monto, metodo_pago, status, folio, fecha_pago) VALUES ('734447368', '5017', 30.0, 'OODI', 'CANCELADO', NULL, '2026-04-12T01:18:44');
INSERT INTO pagos (numero_orden, telefono_cliente, monto, metodo_pago, status, folio, fecha_pago) VALUES ('511781078', '5017', 100.0, 'TARJETA', 'APLICADO', 'X-68074', '2026-04-29T16:36:49');
INSERT INTO pagos (numero_orden, telefono_cliente, monto, metodo_pago, status, folio, fecha_pago) VALUES ('883702946', '5019', 300.0, 'EFECTIVO', 'APLICADO', 'P-69799', '2026-04-23T13:38:34');
INSERT INTO pagos (numero_orden, telefono_cliente, monto, metodo_pago, status, folio, fecha_pago) VALUES ('305717022', '5017', 100.0, 'TARJETA', 'APLICADO', 'X-52906', '2026-04-23T12:22:11');
INSERT INTO pagos (numero_orden, telefono_cliente, monto, metodo_pago, status, folio, fecha_pago) VALUES ('830500888', '5001', 200.0, 'OODI', 'FALLIDO', NULL, '2026-05-03T03:52:57');
INSERT INTO pagos (numero_orden, telefono_cliente, monto, metodo_pago, status, folio, fecha_pago) VALUES ('171061624', '5001', 10.0, 'TARJETA', 'APLICADO', 'P-38785', '2026-04-28T18:54:21');

COMMIT;
