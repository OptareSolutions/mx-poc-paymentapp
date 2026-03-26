package com.att.paymentbox.service;

import com.att.paymentbox.client.OperadorApiClient;
import com.att.paymentbox.client.ReciboApiClient;
import com.att.paymentbox.dto.PagoRequest;
import com.att.paymentbox.dto.PagoResponse;
import com.att.paymentbox.model.Cliente;
import com.att.paymentbox.model.MontosRecarga;
import com.att.paymentbox.model.Pago;
import com.att.paymentbox.repository.ClienteRepository;
import com.att.paymentbox.repository.MontosRecargaRepository;
import com.att.paymentbox.repository.PagoRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@DisplayName("RecargaService - Flujo de 8 Pasos AT&T PaymentBox")
class RecargaServiceTest {

    @Mock private ClienteRepository clienteRepository;
    @Mock private MontosRecargaRepository montosRepository;
    @Mock private PagoRepository pagoRepository;
    @Mock private OperadorApiClient operadorApiClient;
    @Mock private ReciboApiClient reciboApiClient;

    @InjectMocks
    private RecargaService recargaService;

    private Cliente billyUno;

    @BeforeEach
    void setUp() {
        billyUno = new Cliente();
        billyUno.setNombre("Billy 1 - Cortes");
        billyUno.setTelefono("4544");
        billyUno.setStatus("ACTIVO");
    }

    // ── Paso 2 ────────────────────────────────────────────────────────────────
    @Test
    @DisplayName("Paso 2: Debe encontrar el perfil Billy 1 activo por teléfono")
    void paso2_buscarClienteActivo_billyUnoExiste() {
        when(clienteRepository.findByTelefonoAndStatus("4544", "ACTIVO"))
                .thenReturn(Optional.of(billyUno));

        Cliente result = recargaService.buscarClienteActivo("4544");

        assertThat(result.getNombre()).isEqualTo("Billy 1 - Cortes");
        assertThat(result.getStatus()).isEqualTo("ACTIVO");
    }

    @Test
    @DisplayName("Paso 2: Debe lanzar 404 si el cliente no existe (Fail Fast)")
    void paso2_buscarClienteActivo_clienteNoExiste_lanza404() {
        when(clienteRepository.findByTelefonoAndStatus("9999", "ACTIVO"))
                .thenReturn(Optional.empty());

        assertThatThrownBy(() -> recargaService.buscarClienteActivo("9999"))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("9999");
    }

    // ── Paso 3 ────────────────────────────────────────────────────────────────
    @Test
    @DisplayName("Paso 3: Debe retornar montos de la DB para operador BLUE")
    void paso3_obtenerMontos_retornaListaDB() {
        MontosRecarga monto20 = new MontosRecarga();
        monto20.setMonto(new BigDecimal("20.00"));
        monto20.setOperador("BLUE");

        when(montosRepository.findByOperadorOrderByMontoAsc("BLUE"))
                .thenReturn(List.of(monto20));

        List<MontosRecarga> result = recargaService.obtenerMontos("BLUE");

        assertThat(result).hasSize(1);
        assertThat(result.get(0).getMonto()).isEqualByComparingTo("20.00");
    }

    @Test
    @DisplayName("Paso 3: Debe lanzar 404 si no hay montos para el operador")
    void paso3_obtenerMontos_sinMontos_lanza404() {
        when(montosRepository.findByOperadorOrderByMontoAsc("INEXISTENTE"))
                .thenReturn(List.of());

        assertThatThrownBy(() -> recargaService.obtenerMontos("INEXISTENTE"))
                .isInstanceOf(ResponseStatusException.class);
    }

    // ── Paso 4 ────────────────────────────────────────────────────────────────
    @Test
    @DisplayName("Paso 4: Debe llamar a OperadorApiClient y retornar respuesta del mock")
    void paso4_validarOperador_delegaAlCliente() {
        Map<String, Object> mockResponse = Map.of("valido", true, "operador", "BLUE");
        when(operadorApiClient.validarOperador("4544", "BLUE")).thenReturn(mockResponse);

        Map<String, Object> result = recargaService.validarOperador("4544", "BLUE");

        assertThat(result).containsEntry("valido", true);
        verify(operadorApiClient, times(1)).validarOperador("4544", "BLUE");
    }

    // ── Paso 5 ────────────────────────────────────────────────────────────────
    @Test
    @DisplayName("Paso 5: Debe retornar los 3 métodos de pago de PaymentBox")
    void paso5_obtenerMetodosPago_retornaTresPagos() {
        List<String> metodos = recargaService.obtenerMetodosPago();

        assertThat(metodos).containsExactlyInAnyOrder("TARJETA", "EFECTIVO", "OODI");
    }

    // ── Pasos 6 & 7 ──────────────────────────────────────────────────────────
    @Test
    @DisplayName("Pasos 6&7: Debe registrar pago con folio y status APLICADO")
    void paso7_registrarPago_persisteEnDB() {
        when(clienteRepository.findByTelefonoAndStatus("4544", "ACTIVO"))
                .thenReturn(Optional.of(billyUno));
        when(pagoRepository.save(any(Pago.class))).thenAnswer(inv -> inv.getArgument(0));

        PagoRequest request = new PagoRequest();
        request.setTelefonoCliente("4544");
        request.setMonto(new BigDecimal("20.00"));
        request.setMetodoPago("EFECTIVO");
        request.setNumeroOrden("111816681");

        PagoResponse response = recargaService.registrarPago(request);

        assertThat(response.getStatus()).isEqualTo("APLICADO");
        assertThat(response.getFolio()).startsWith("B-");
        assertThat(response.getNumeroOrden()).isEqualTo("111816681");
        verify(pagoRepository, times(1)).save(any(Pago.class));
    }

    // ── Paso 8 ────────────────────────────────────────────────────────────────
    @Test
    @DisplayName("Paso 8: Debe llamar a ReciboApiClient y retornar estado EMITIDO")
    void paso8_emitirRecibo_llamaAlMockYRetornaEstado() {
        Map<String, Object> mockResponse = Map.of("status", "EMITIDO", "url_pdf", "/recibos/R-001.pdf");
        when(reciboApiClient.emitirRecibo("B-89301", "111816681")).thenReturn(mockResponse);

        Map<String, Object> result = recargaService.emitirRecibo("B-89301", "111816681");

        assertThat(result).containsEntry("status", "EMITIDO");
        verify(reciboApiClient, times(1)).emitirRecibo("B-89301", "111816681");
    }
}
