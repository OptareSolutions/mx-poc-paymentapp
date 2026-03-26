package com.att.paymentbox.client;

import com.att.paymentbox.dto.CustomerProfileDto;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.server.ResponseStatusException;

@Component
public class CustomerProfileClient {

    private final RestTemplate restTemplate;
    private final String customerProfileUrl;

    public CustomerProfileClient(RestTemplate restTemplate,
                                 @Value("${att.services.customer-profile-url}") String customerProfileUrl) {
        this.restTemplate = restTemplate;
        this.customerProfileUrl = customerProfileUrl;
    }

    public CustomerProfileDto getCustomerProfile(String telefono) {
        try {
            return restTemplate.getForObject(
                    customerProfileUrl + "/api/customers/" + telefono,
                    CustomerProfileDto.class);
        } catch (HttpClientErrorException.NotFound e) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND,
                    "Cliente no encontrado en Customer Profile Service: " + telefono);
        }
    }
}
