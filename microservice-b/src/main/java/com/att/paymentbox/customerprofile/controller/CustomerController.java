package com.att.paymentbox.customerprofile.controller;

import com.att.paymentbox.customerprofile.dto.CustomerProfileDto;
import com.att.paymentbox.customerprofile.model.Cliente;
import com.att.paymentbox.customerprofile.repository.ClienteRepository;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;

import java.util.List;

@RestController
@RequestMapping("/api/customers")
@Tag(name = "Customer Profile", description = "Microservice B — Perfiles de clientes Telco Operator (PoC)")
public class CustomerController {

    private final ClienteRepository clienteRepository;

    public CustomerController(ClienteRepository clienteRepository) {
        this.clienteRepository = clienteRepository;
    }

    @GetMapping("/{telefono}")
    @Operation(summary = "Obtener perfil de cliente por teléfono")
    public ResponseEntity<CustomerProfileDto> getByTelefono(@PathVariable String telefono) {
        return clienteRepository.findByTelefono(telefono)
                .map(this::toDto)
                .map(ResponseEntity::ok)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "Cliente no encontrado: " + telefono));
    }

    @GetMapping
    @Operation(summary = "Listar todos los perfiles de clientes")
    public List<CustomerProfileDto> getAll() {
        return clienteRepository.findAll().stream().map(this::toDto).toList();
    }

    private CustomerProfileDto toDto(Cliente c) {
        return new CustomerProfileDto(c.getId(), c.getTelefono(), c.getNombre(), c.getStatus());
    }
}
