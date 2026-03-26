package com.att.paymentbox;

import com.intuit.karate.junit5.Karate;
import org.junit.jupiter.api.DisplayName;

@DisplayName("AT&T PaymentBox - Karate Functional Tests (8 Passos)")
public class RecargaFlowRunner {

    @Karate.Test
    Karate testRecargaFlow() {
        return Karate.run("classpath:features/recarga_flow.feature")
                .relativeTo(getClass());
    }
}
