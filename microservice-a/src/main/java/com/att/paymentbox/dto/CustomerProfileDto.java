package com.att.paymentbox.dto;

public class CustomerProfileDto {

    private Long id;
    private String telefono;
    private String nombre;
    private String status;

    public CustomerProfileDto() {}

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getTelefono() { return telefono; }
    public void setTelefono(String telefono) { this.telefono = telefono; }

    public String getNombre() { return nombre; }
    public void setNombre(String nombre) { this.nombre = nombre; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
}
