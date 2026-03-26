import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  CustomerProfile, MontoRecarga, PagoRequest, PagoResponse, ReciboResponse, ValidacionOperador
} from './models';

@Injectable({ providedIn: 'root' })
export class PaymentboxService {

  private readonly api = '/api';

  constructor(private http: HttpClient) {}

  buscarCliente(telefono: string): Observable<CustomerProfile> {
    return this.http.get<CustomerProfile>(`${this.api}/clientes/buscar`, {
      params: new HttpParams().set('telefono', telefono)
    });
  }

  obtenerMontos(operador: string): Observable<MontoRecarga[]> {
    return this.http.get<MontoRecarga[]>(`${this.api}/recargas/montos`, {
      params: new HttpParams().set('operador', operador)
    });
  }

  validarOperador(telefono: string, operador: string): Observable<ValidacionOperador> {
    return this.http.post<ValidacionOperador>(`${this.api}/recargas/validar-operador`, null, {
      params: new HttpParams().set('telefono', telefono).set('operador', operador)
    });
  }

  obtenerMetodosPago(): Observable<string[]> {
    return this.http.get<string[]>(`${this.api}/pagos/metodos`);
  }

  registrarPago(request: PagoRequest): Observable<PagoResponse> {
    return this.http.post<PagoResponse>(`${this.api}/pagos/registrar`, request);
  }

  emitirRecibo(folio: string, numeroOrden: string): Observable<ReciboResponse> {
    return this.http.post<ReciboResponse>(`${this.api}/recibos/emitir`, null, {
      params: new HttpParams().set('folio', folio).set('numeroOrden', numeroOrden)
    });
  }
}
