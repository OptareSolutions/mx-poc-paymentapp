package com.att.paymentbox.customerprofile.dto;

// =============================================================================
// CONTRATO PUBLICO de microservice-b -> consumido por microservice-a
//
// DEMO BREAK 1: renombrar 'telefono' -> 'phone' y 'nombre' -> 'fullName'
//     con demo/break-contract.ps1 para romper contrato en CI.
// =============================================================================
public class CustomerProfileDto {

    private Long id;
    private String telefono;
    private String nombre;
    private String status;

    public CustomerProfileDto() {}

    public CustomerProfileDto(Long id, String telefono, String nombre, String status) {
        this.id = id;
        this.telefono = telefono;
        this.nombre = nombre;
        this.status = status;
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getTelefono() { return telefono; }
    public void setTelefono(String telefono) { this.telefono = telefono; }

    public String getNombre() { return nombre; }
    public void setNombre(String nombre) { this.nombre = nombre; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
}
