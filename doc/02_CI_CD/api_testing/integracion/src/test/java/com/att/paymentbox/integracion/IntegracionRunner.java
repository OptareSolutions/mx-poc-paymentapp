package com.att.paymentbox.integracion;

import com.intuit.karate.junit5.Karate;
import org.junit.jupiter.api.DisplayName;

/**
 * Entry point for all E2E / integration API tests.
 *
 * Run profiles:
 *   mvn test -Dkarate.env=local    (default — services on localhost)
 *   mvn test -Dkarate.env=ci       (GitHub Actions — services in Docker network)
 *   mvn test -Dkarate.env=staging  (against staging environment)
 *
 * Tag-filtered runs:
 *   mvn test -Dtest=IntegracionRunner#testSmoke
 *   mvn test -Dtest=IntegracionRunner#testAuthFlow
 *   mvn test -Dtest=IntegracionRunner#testClienteIntegracion
 *   mvn test -Dtest=IntegracionRunner#testRecargaE2E
 *   mvn test -Dtest=IntegracionRunner#testNegative
 *   mvn test -Dtest=IntegracionRunner#testCriticalPath
 */
@DisplayName("AT&T PaymentBox - Karate Integration Tests (E2E)")
public class IntegracionRunner {

    /** Smoke suite: tests rápidos para confirmar disponibilidad del entorno. */
    @Karate.Test
    Karate testSmoke() {
        return Karate.run("classpath:features")
                .tags("@smoke")
                .relativeTo(getClass());
    }

    /** Flujo completo de autenticación (login → uso → refresh → logout). */
    @Karate.Test
    Karate testAuthFlow() {
        return Karate.run("classpath:features/auth/auth_flow.feature")
                .relativeTo(getClass());
    }

    /** Integración entre microservice-a y microservice-b + servicios externos. */
    @Karate.Test
    Karate testClienteIntegracion() {
        return Karate.run("classpath:features/cliente/cliente_integracion.feature")
                .relativeTo(getClass());
    }

    /** Flujo E2E completo de recarga (8 pasos encadenados con transporte de IDs). */
    @Karate.Test
    Karate testRecargaE2E() {
        return Karate.run("classpath:features/recarga/recarga_integracion_e2e.feature")
                .relativeTo(getClass());
    }

    /** Ruta crítica completa (login + 8 pasos de recarga). */
    @Karate.Test
    Karate testCriticalPath() {
        return Karate.run("classpath:features")
                .tags("@critical-path")
                .relativeTo(getClass());
    }

    /** Escenarios negativos (errores esperados, validaciones de error). */
    @Karate.Test
    Karate testNegative() {
        return Karate.run("classpath:features")
                .tags("@negative")
                .relativeTo(getClass());
    }

    /** Todos los tests de integración (suite completa). */
    @Karate.Test
    Karate testAll() {
        return Karate.run("classpath:features")
                .tags("@integracion")
                .relativeTo(getClass());
    }
}
