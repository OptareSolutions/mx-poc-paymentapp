package com.att.paymentbox.model;

import jakarta.persistence.*;
import java.math.BigDecimal;

@Entity
@Table(name = "montos_recarga")
public class MontosRecarga {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, precision = 10, scale = 2)
    private BigDecimal monto;

    @Column(nullable = false)
    private String operador;

    public MontosRecarga() {}

    public Long getId() { return id; }
    public BigDecimal getMonto() { return monto; }
    public void setMonto(BigDecimal monto) { this.monto = monto; }
    public String getOperador() { return operador; }
    public void setOperador(String operador) { this.operador = operador; }
}
