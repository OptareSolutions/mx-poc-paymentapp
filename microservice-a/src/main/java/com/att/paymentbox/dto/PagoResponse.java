package com.att.paymentbox.dto;

public class PagoResponse {
    private String folio;
    private String status;
    private String numeroOrden;
    private String mensaje;

    public PagoResponse() {}

    public PagoResponse(String folio, String status, String numeroOrden, String mensaje) {
        this.folio = folio;
        this.status = status;
        this.numeroOrden = numeroOrden;
        this.mensaje = mensaje;
    }

    public String getFolio() { return folio; }
    public void setFolio(String folio) { this.folio = folio; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public String getNumeroOrden() { return numeroOrden; }
    public void setNumeroOrden(String numeroOrden) { this.numeroOrden = numeroOrden; }
    public String getMensaje() { return mensaje; }
    public void setMensaje(String mensaje) { this.mensaje = mensaje; }
}
