package com.att.paymentbox.customerprofile.dto;

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// CONTRATO PÃšBLICO de microservice-b â†’ consumido por microservice-a
//
// âš ï¸  DEMO BREAK 1: renombrar 'telefono' â†’ 'phone' y 'nombre' â†’ 'fullName'
//     para romper el contrato y que el pipeline falle en Job 2.
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
public class CustomerProfileDto {

    private Long id;
    private String phone;       // BROKEN: era "telefono"   // CAMPO DE CONTRATO â€” no renombrar sin actualizar consumidores
    private String fullName;    // BROKEN: era "nombre"     // CAMPO DE CONTRATO â€” no renombrar sin actualizar consumidores
    private String status;

    public CustomerProfileDto() {}

    public CustomerProfileDto(Long id, String telefono, String nombre, String status) {
        this.id = id;
        this.phone = phone;
        this.fullName = fullName;
        this.status = status;
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getPhone() { return phone; }
    public void setPhone(String phone) { this.phone = phone; }

    public String getFullName() { return fullName; }
    public void setFullName(String fullName) { this.fullName = fullName; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
}
