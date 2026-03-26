export interface CustomerProfile {
  id: number;
  telefono: string;
  nombre: string;
  status: string;
}

export interface MontoRecarga {
  id: number;
  monto: number;
  operador: string;
}

export interface PagoRequest {
  telefonoCliente: string;
  monto: number;
  metodoPago: string;
  numeroOrden: string;
}

export interface PagoResponse {
  folio: string;
  status: string;
  numeroOrden: string;
  mensaje: string;
}

export interface ReciboResponse {
  status: string;
  url_pdf: string;
  numero_folio: string;
}

export interface ValidacionOperador {
  valido: boolean;
  operador: string;
}
