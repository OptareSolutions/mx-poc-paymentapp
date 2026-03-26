package com.att.paymentbox.client;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;

import java.util.Map;

/**
 * Cliente HTTP que valida el operador vía Prism Mock (Paso 4 del flujo).
 * URL configurable via MOCK_OPERADOR_URL (default: http://localhost:4010).
 */
@Component
public class OperadorApiClient {

    private final RestTemplate restTemplate;
    private final String operadorUrl;

    public OperadorApiClient(RestTemplate restTemplate,
                             @Value("${att.mocks.operador-url}") String operadorUrl) {
        this.restTemplate = restTemplate;
        this.operadorUrl = operadorUrl;
    }

    @SuppressWarnings("unchecked")
    public Map<String, Object> validarOperador(String telefono, String operador) {
        var payload = Map.of("telefono", telefono, "operador", operador);
        return restTemplate.postForObject(
                operadorUrl + "/api/operador/validar",
                payload,
                Map.class
        );
    }
}
