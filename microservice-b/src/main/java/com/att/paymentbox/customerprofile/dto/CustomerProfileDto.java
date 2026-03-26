package com.att.paymentbox.customerprofile.dto;

// ══════════════════════════════════════════════════════════════════════════════
// CONTRATO PÚBLICO de microservice-b → consumido por microservice-a
//
// ⚠️  DEMO BREAK 1: renombrar 'telefono' → 'phone' y 'nombre' → 'fullName'
//     para romper el contrato y que el pipeline falle en Job 2.
// ══════════════════════════════════════════════════════════════════════════════
public class CustomerProfileDto {

    private Long id;
    private String telefono;   // CAMPO DE CONTRATO — no renombrar sin actualizar consumidores
    private String nombre;     // CAMPO DE CONTRATO — no renombrar sin actualizar consumidores
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
