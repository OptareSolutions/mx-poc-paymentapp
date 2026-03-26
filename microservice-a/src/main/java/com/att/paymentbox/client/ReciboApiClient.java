package com.att.paymentbox.client;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;

import java.util.Map;

/**
 * Cliente HTTP que solicita a emissão do recibo vía Prism Mock (Paso 8 do fluxo).
 * URL configurable via MOCK_RECIBO_URL (default: http://localhost:4011).
 */
@Component
public class ReciboApiClient {

    private final RestTemplate restTemplate;
    private final String reciboUrl;

    public ReciboApiClient(RestTemplate restTemplate,
                           @Value("${att.mocks.recibo-url}") String reciboUrl) {
        this.restTemplate = restTemplate;
        this.reciboUrl = reciboUrl;
    }

    @SuppressWarnings("unchecked")
    public Map<String, Object> emitirRecibo(String folio, String numeroOrden) {
        var payload = Map.of("folio", folio, "numeroOrden", numeroOrden);
        return restTemplate.postForObject(
                reciboUrl + "/api/recibo/emitir",
                payload,
                Map.class
        );
    }
}
