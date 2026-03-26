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
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
public class RecargaService {

    static final List<String> METODOS_PAGO = List.of("TARJETA", "EFECTIVO", "OODI");

    private final ClienteRepository clienteRepository;
    private final MontosRecargaRepository montosRepository;
    private final PagoRepository pagoRepository;
    private final OperadorApiClient operadorApiClient;
    private final ReciboApiClient reciboApiClient;

    public RecargaService(ClienteRepository clienteRepository,
                          MontosRecargaRepository montosRepository,
                          PagoRepository pagoRepository,
                          OperadorApiClient operadorApiClient,
                          ReciboApiClient reciboApiClient) {
        this.clienteRepository = clienteRepository;
        this.montosRepository = montosRepository;
        this.pagoRepository = pagoRepository;
        this.operadorApiClient = operadorApiClient;
        this.reciboApiClient = reciboApiClient;
    }

    // ── Paso 2: Focalizar Cliente ─────────────────────────────────────────────
    public Cliente buscarClienteActivo(String telefono) {
        return clienteRepository.findByTelefonoAndStatus(telefono, "ACTIVO")
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "Cliente no encontrado o inactivo: " + telefono));
    }

    // ── Paso 3: Montos desde DB ───────────────────────────────────────────────
    public List<MontosRecarga> obtenerMontos(String operador) {
        List<MontosRecarga> montos = montosRepository.findByOperadorOrderByMontoAsc(operador);
        if (montos.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND,
                    "Sin montos disponibles para operador: " + operador);
        }
        return montos;
    }

    // ── Paso 4: Validar con API Operador (Prism Mock) ─────────────────────────
    public Map<String, Object> validarOperador(String telefono, String operador) {
        return operadorApiClient.validarOperador(telefono, operador);
    }

    // ── Paso 5: Métodos de Pago disponibles ───────────────────────────────────
    public List<String> obtenerMetodosPago() {
        return METODOS_PAGO;
    }

    // ── Pasos 6 & 7: Procesar y registrar pago en DB ─────────────────────────
    public PagoResponse registrarPago(PagoRequest request) {
        // Verify client still active before persisting
        buscarClienteActivo(request.getTelefonoCliente());

        String folio = "B-" + UUID.randomUUID().toString().substring(0, 5).toUpperCase();

        Pago pago = new Pago();
        pago.setNumeroOrden(request.getNumeroOrden());
        pago.setTelefonoCliente(request.getTelefonoCliente());
        pago.setMonto(request.getMonto());
        pago.setMetodoPago(request.getMetodoPago());
        pago.setStatus("APLICADO");
        pago.setFolio(folio);
        pago.setFechaPago(LocalDateTime.now());

        pagoRepository.save(pago);

        return new PagoResponse(folio, "APLICADO", request.getNumeroOrden(),
                "Pago aplicado exitosamente con folio: " + folio);
    }

    // ── Paso 8: Emitir Recibo (Prism Mock) ───────────────────────────────────
    public Map<String, Object> emitirRecibo(String folio, String numeroOrden) {
        return reciboApiClient.emitirRecibo(folio, numeroOrden);
    }
}
