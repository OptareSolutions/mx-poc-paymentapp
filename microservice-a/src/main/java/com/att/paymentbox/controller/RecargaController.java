package com.att.paymentbox.controller;

import com.att.paymentbox.dto.PagoRequest;
import com.att.paymentbox.dto.PagoResponse;
import com.att.paymentbox.model.Cliente;
import com.att.paymentbox.model.MontosRecarga;
import com.att.paymentbox.service.RecargaService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api")
@Tag(name = "Recarga PaymentBox", description = "Flujo de 8 pasos - Recarga por PaymentBox AT&T")
public class RecargaController {

    private final RecargaService recargaService;

    public RecargaController(RecargaService recargaService) {
        this.recargaService = recargaService;
    }

    // ── Paso 2: Focalizar Cliente ─────────────────────────────────────────────
    @GetMapping("/clientes/buscar")
    @Operation(summary = "Paso 2 - Focalizar cliente por teléfono (Billy 1)")
    public ResponseEntity<Cliente> buscarCliente(@RequestParam String telefono) {
        return ResponseEntity.ok(recargaService.buscarClienteActivo(telefono));
    }

    // ── Paso 3: Selecionar Monto (validado vs DB) ─────────────────────────────
    @GetMapping("/recargas/montos")
    @Operation(summary = "Paso 3 - Obtener montos disponibles desde DB")
    public ResponseEntity<List<MontosRecarga>> obtenerMontos(
            @RequestParam(defaultValue = "BLUE") String operador) {
        return ResponseEntity.ok(recargaService.obtenerMontos(operador));
    }

    // ── Paso 4: Validar con API Operador (contrato via Prism) ─────────────────
    @PostMapping("/recargas/validar-operador")
    @Operation(summary = "Paso 4 - Validar con API Operador (Mock Prism)")
    public ResponseEntity<Map<String, Object>> validarOperador(
            @RequestParam String telefono,
            @RequestParam(defaultValue = "BLUE") String operador) {
        return ResponseEntity.ok(recargaService.validarOperador(telefono, operador));
    }

    // ── Paso 5: Métodos de Pago ───────────────────────────────────────────────
    @GetMapping("/pagos/metodos")
    @Operation(summary = "Paso 5 - Obtener métodos de pago disponibles en PaymentBox")
    public ResponseEntity<List<String>> obtenerMetodosPago() {
        return ResponseEntity.ok(recargaService.obtenerMetodosPago());
    }

    // ── Pasos 6 & 7: Registrar Pago ──────────────────────────────────────────
    @PostMapping("/pagos/registrar")
    @Operation(summary = "Pasos 6 y 7 - Procesar y registrar pago en Ambiente A")
    public ResponseEntity<PagoResponse> registrarPago(@RequestBody PagoRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(recargaService.registrarPago(request));
    }

    // ── Paso 8: Emitir Recibo (via Prism) ────────────────────────────────────
    @PostMapping("/recibos/emitir")
    @Operation(summary = "Paso 8 - Emitir recibo PDF vía API Mock (Prism)")
    public ResponseEntity<Map<String, Object>> emitirRecibo(
            @RequestParam String folio,
            @RequestParam String numeroOrden) {
        return ResponseEntity.ok(recargaService.emitirRecibo(folio, numeroOrden));
    }
}
