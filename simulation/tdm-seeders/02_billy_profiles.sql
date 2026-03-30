-- ============================================================
-- TDM Seeder: Perfiles Billy (Datos Sintéticos Telco Operator)
-- Evelyn Pineda & Billy Cortes - Perfiles validados para la PoC
-- ============================================================

-- Perfiles de clientes sintéticos "Billy"
INSERT INTO clientes (nombre, telefono, status) VALUES
    ('Billy 1 - Cortes',  '4544', 'ACTIVO'),
    ('Billy 2 - Cortes',  '4545', 'ACTIVO'),
    ('Billy 3 - Cortes',  '4546', 'ACTIVO'),
    ('Billy 4 - Pineda',  '4547', 'INACTIVO'),   -- perfil negativo para tests
    ('Billy 5 - Bloqueado', '4548', 'BLOQUEADO')  -- perfil bloqueado para tests
ON CONFLICT (telefono) DO UPDATE SET
    nombre = EXCLUDED.nombre,
    status = EXCLUDED.status;

-- Métodos de pago disponibles en PaymentBox (Paso 5)
INSERT INTO metodos_pago (nombre, activo) VALUES
    ('TARJETA',  TRUE),
    ('EFECTIVO', TRUE),
    ('OODI',     TRUE)
ON CONFLICT (nombre) DO UPDATE SET activo = EXCLUDED.activo;

-- Montos de recarga disponibles para operador BLUE (Paso 3)
-- Refleja los montos del menú UI de la imagen adjunta
INSERT INTO montos_recarga (monto, operador) VALUES
    ( 10.00, 'BLUE'),
    ( 20.00, 'BLUE'),
    ( 30.00, 'BLUE'),
    ( 50.00, 'BLUE'),
    ( 70.00, 'BLUE'),
    (100.00, 'BLUE'),
    (120.00, 'BLUE'),
    (150.00, 'BLUE'),
    (200.00, 'BLUE'),
    (300.00, 'BLUE'),
    (500.00, 'BLUE'),
    (600.00, 'BLUE'),
    (800.00, 'BLUE');

-- Pago de referencia (para validaciones de recibo en Paso 8)
INSERT INTO pagos (numero_orden, telefono_cliente, monto, metodo_pago, status, folio)
VALUES ('111816681', '4544', 50.00, 'EFECTIVO', 'APLICADO', 'B-89301')
ON CONFLICT DO NOTHING;
