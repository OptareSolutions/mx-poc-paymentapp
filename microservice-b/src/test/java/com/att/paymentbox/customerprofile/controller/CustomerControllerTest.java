package com.att.paymentbox.customerprofile.controller;

import com.att.paymentbox.customerprofile.dto.CustomerProfileDto;
import com.att.paymentbox.customerprofile.model.Cliente;
import com.att.paymentbox.customerprofile.repository.ClienteRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@DisplayName("CustomerController - Microservice B")
class CustomerControllerTest {

    @Mock
    private ClienteRepository clienteRepository;

    @InjectMocks
    private CustomerController customerController;

    private Cliente cliente(String tel, String nombre, String status) {
        Cliente c = new Cliente();
        c.setTelefono(tel);
        c.setNombre(nombre);
        c.setStatus(status);
        return c;
    }

    @Test
    @DisplayName("GET /{telefono} debe retornar perfil con campos del contrato")
    void getByTelefono_retornaPerfilConCamposDeContrato() {
        when(clienteRepository.findByTelefono("4544"))
                .thenReturn(Optional.of(cliente("4544", "Billy 1 - Cortes", "ACTIVO")));

        var response = customerController.getByTelefono("4544");

        assertThat(response.getStatusCode()).isEqualTo(org.springframework.http.HttpStatus.OK);
        CustomerProfileDto dto = response.getBody();
        assertThat(dto).isNotNull();
        // âš ï¸ CONTRATO: estos campos deben existir â€” si se renombran rompe microservice-a
        assertThat(dto.getPhone()).isEqualTo("4544");
        assertThat(dto.getFullName()).isEqualTo("Billy 1 - Cortes");
        assertThat(dto.getStatus()).isEqualTo("ACTIVO");
    }

    @Test
    @DisplayName("GET /{telefono} debe retornar 404 si no existe")
    void getByTelefono_noExiste_lanza404() {
        when(clienteRepository.findByTelefono("9999")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> customerController.getByTelefono("9999"))
                .isInstanceOf(ResponseStatusException.class)
                .extracting(e -> ((ResponseStatusException) e).getStatusCode())
                .isEqualTo(HttpStatus.NOT_FOUND);
    }

    @Test
    @DisplayName("GET / debe listar todos los perfiles")
    void getAll_retornaListaCompleta() {
        when(clienteRepository.findAll()).thenReturn(List.of(
                cliente("4544", "Billy 1", "ACTIVO"),
                cliente("4547", "Billy 4", "INACTIVO")
        ));

        var result = customerController.getAll();

        assertThat(result).hasSize(2);
        assertThat(result.get(0).getPhone()).isEqualTo("4544");
    }
}
