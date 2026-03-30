package com.att.paymentbox.controller;

import com.att.paymentbox.dto.CustomerProfileDto;
import com.att.paymentbox.dto.PagoRequest;
import com.att.paymentbox.dto.PagoResponse;
import com.att.paymentbox.model.MontosRecarga;
import com.att.paymentbox.service.RecargaService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@DisplayName("RecargaController - Endpoints PaymentBox Telco Operator")
class RecargaControllerTest {

    @Mock
    private RecargaService recargaService;

    @InjectMocks
    private RecargaController recargaController;

    private CustomerProfileDto billyUno;

    @BeforeEach
    void setUp() {
        billyUno = new CustomerProfileDto();
        billyUno.setNombre("Billy 1 - Cortes");
        billyUno.setTelefono("4544");
        billyUno.setStatus("ACTIVO");
    }

    @Test
    @DisplayName("GET /api/clientes/buscar - retorna 200 con cliente activo")
    void buscarCliente_retorna200() {
        when(recargaService.buscarClienteActivo("4544")).thenReturn(billyUno);

        ResponseEntity<CustomerProfileDto> response = recargaController.buscarCliente("4544");

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().getTelefono()).isEqualTo("4544");
        verify(recargaService, times(1)).buscarClienteActivo("4544");
    }

    @Test
    @DisplayName("GET /api/recargas/montos - retorna lista de montos desde DB")
    void obtenerMontos_retornaLista() {
        MontosRecarga monto = new MontosRecarga();
        monto.setMonto(new BigDecimal("20.00"));
        monto.setOperador("BLUE");
        when(recargaService.obtenerMontos("BLUE")).thenReturn(List.of(monto));

        ResponseEntity<List<MontosRecarga>> response = recargaController.obtenerMontos("BLUE");

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).hasSize(1);
    }

    @Test
    @DisplayName("POST /api/recargas/validar-operador - delega al servicio y retorna 200")
    void validarOperador_retorna200() {
        Map<String, Object> mockResp = Map.of("valido", true, "operador", "BLUE");
        when(recargaService.validarOperador("4544", "BLUE")).thenReturn(mockResp);

        ResponseEntity<Map<String, Object>> response =
                recargaController.validarOperador("4544", "BLUE");

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).containsEntry("valido", true);
    }

    @Test
    @DisplayName("GET /api/pagos/metodos - retorna los 3 métodos de PaymentBox")
    void obtenerMetodosPago_retornaLista() {
        when(recargaService.obtenerMetodosPago())
                .thenReturn(List.of("TARJETA", "EFECTIVO", "OODI"));

        ResponseEntity<List<String>> response = recargaController.obtenerMetodosPago();

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).containsExactlyInAnyOrder("TARJETA", "EFECTIVO", "OODI");
    }

    @Test
    @DisplayName("POST /api/pagos/registrar - retorna 201 con folio generado")
    void registrarPago_retorna201() {
        PagoRequest request = new PagoRequest();
        request.setTelefonoCliente("4544");
        request.setMonto(new BigDecimal("20.00"));
        request.setMetodoPago("EFECTIVO");
        request.setNumeroOrden("111816681");

        PagoResponse pagoResponse = new PagoResponse("B-12345", "APLICADO", "111816681",
                "Pago aplicado exitosamente con folio: B-12345");
        when(recargaService.registrarPago(any(PagoRequest.class))).thenReturn(pagoResponse);

        ResponseEntity<PagoResponse> response = recargaController.registrarPago(request);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().getStatus()).isEqualTo("APLICADO");
        assertThat(response.getBody().getFolio()).isEqualTo("B-12345");
    }

    @Test
    @DisplayName("POST /api/recibos/emitir - retorna 200 con estado EMITIDO")
    void emitirRecibo_retorna200() {
        Map<String, Object> mockResp = Map.of("status", "EMITIDO", "url_pdf", "/recibos/R-001.pdf");
        when(recargaService.emitirRecibo("B-89301", "111816681")).thenReturn(mockResp);

        ResponseEntity<Map<String, Object>> response =
                recargaController.emitirRecibo("B-89301", "111816681");

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).containsEntry("status", "EMITIDO");
    }
}
