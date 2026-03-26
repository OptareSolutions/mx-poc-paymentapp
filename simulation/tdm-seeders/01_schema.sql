-- ============================================================
-- TDM Schema: att_paymentbox - Ambiente A Simulado
-- Ejecutado automáticamente en el arranque del contenedor postgres
-- ============================================================

CREATE TABLE IF NOT EXISTS clientes (
    id        BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nombre    VARCHAR(100) NOT NULL,
    telefono  VARCHAR(20)  NOT NULL UNIQUE,
    status    VARCHAR(20)  NOT NULL DEFAULT 'ACTIVO',
    CONSTRAINT chk_status CHECK (status IN ('ACTIVO', 'INACTIVO', 'BLOQUEADO'))
);

CREATE TABLE IF NOT EXISTS montos_recarga (
    id       BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    monto    NUMERIC(10, 2) NOT NULL,
    operador VARCHAR(50)    NOT NULL,
    CONSTRAINT chk_monto CHECK (monto > 0)
);

CREATE TABLE IF NOT EXISTS metodos_pago (
    id     BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nombre VARCHAR(50) NOT NULL UNIQUE,
    activo BOOLEAN     NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS pagos (
    id               BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    numero_orden     VARCHAR(50),
    telefono_cliente VARCHAR(20)    NOT NULL,
    monto            NUMERIC(10, 2) NOT NULL,
    metodo_pago      VARCHAR(50)    NOT NULL,
    status           VARCHAR(30)    NOT NULL DEFAULT 'PENDIENTE',
    folio            VARCHAR(50),
    fecha_pago       TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_pago_status CHECK (status IN ('PENDIENTE', 'APLICADO', 'CANCELADO', 'FALLIDO'))
);

-- Índices para búsquedas frecuentes (Paso 2)
CREATE INDEX IF NOT EXISTS idx_clientes_telefono ON clientes (telefono);
CREATE INDEX IF NOT EXISTS idx_clientes_telefono_status ON clientes (telefono, status);
CREATE INDEX IF NOT EXISTS idx_montos_operador ON montos_recarga (operador);
