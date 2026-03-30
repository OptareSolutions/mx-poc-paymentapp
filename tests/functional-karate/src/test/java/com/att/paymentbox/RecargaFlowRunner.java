package com.att.paymentbox;

import com.intuit.karate.junit5.Karate;
import org.junit.jupiter.api.DisplayName;

@DisplayName("Telco Operator PaymentBox - Karate Functional Tests (8 Pasos + Contratos)")
public class RecargaFlowRunner {

    @Karate.Test
    Karate testRecargaFlow() {
        return Karate.run("classpath:features/recarga_flow.feature")
                .relativeTo(getClass());
    }

    @Karate.Test
    Karate testContratoMicroservicios() {
        return Karate.run("classpath:features/contract_microservices.feature")
                .relativeTo(getClass());
    }

    @Karate.Test
    Karate testSmoke() {
        return Karate.run("classpath:features")
                .tags("@smoke")
                .relativeTo(getClass());
    }

    @Karate.Test
    Karate testNegative() {
        return Karate.run("classpath:features")
                .tags("@negative")
                .relativeTo(getClass());
    }

    @Karate.Test
    Karate testDemoBreak() {
        return Karate.run("classpath:features")
                .tags("@demo-break")
                .relativeTo(getClass());
    }
}
