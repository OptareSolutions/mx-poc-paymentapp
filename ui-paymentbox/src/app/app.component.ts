import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PaymentboxService } from './paymentbox.service';
import {
  CustomerProfile, MontoRecarga, PagoResponse, ReciboResponse, ValidacionOperador
} from './models';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent {

  loadingBuscar     = false;
  loadingValidacion = false;
  loadingPago       = false;
  loadingRecibo     = false;
  error: string | null = null;

  operador           = 'BLUE';
  telefonoInput      = '';
  cliente: CustomerProfile | null = null;
  montos: MontoRecarga[] = [];
  montoSeleccionado: MontoRecarga | null = null;
  validacion: ValidacionOperador | null = null;
  metodosPago: string[] = [];
  metodoPago: string | null = null;
  pagoResponse: PagoResponse | null = null;
  reciboResponse: ReciboResponse | null = null;

  constructor(private svc: PaymentboxService) {}

  get canConfirm(): boolean {
    return !!(this.cliente && this.montoSeleccionado && this.metodoPago &&
              this.validacion && !this.loadingPago && !this.pagoResponse);
  }

  onOperadorChange(): void {
    if (this.cliente) {
      this.montos = [];
      this.montoSeleccionado = null;
      this.validacion = null;
      this.cargarMontos();
      this.validarOperador();
    }
  }

  buscarCliente(): void {
    if (!this.telefonoInput.trim()) return;
    this.loadingBuscar = true;
    this.error = null;
    this.cliente = null;
    this.montos = [];
    this.montoSeleccionado = null;
    this.validacion = null;
    this.metodosPago = [];
    this.pagoResponse = null;
    this.reciboResponse = null;
    this.svc.buscarCliente(this.telefonoInput.trim()).subscribe({
      next: c => {
        this.cliente = c;
        this.loadingBuscar = false;
        this.cargarMontos();
        this.validarOperador();
        this.cargarMetodosPago();
      },
      error: err => {
        this.loadingBuscar = false;
        this.error = err.status === 404
          ? 'Cliente no encontrado o inactivo.'
          : 'Error al buscar cliente. Intente de nuevo.';
      }
    });
  }

  private cargarMontos(): void {
    this.svc.obtenerMontos(this.operador).subscribe({
      next: m => { this.montos = m; },
      error: () => { this.error = 'No se pudieron cargar los montos.'; }
    });
  }

  private cargarMetodosPago(): void {
    this.svc.obtenerMetodosPago().subscribe({
      next: m => { this.metodosPago = m; },
      error: () => { this.error = 'No se pudieron cargar metodos de pago.'; }
    });
  }

  private validarOperador(): void {
    if (!this.cliente) return;
    this.loadingValidacion = true;
    this.svc.validarOperador(this.cliente.telefono, this.operador).subscribe({
      next: v => { this.validacion = v; this.loadingValidacion = false; },
      error: () => {
        this.loadingValidacion = false;
        this.error = 'Error al validar operador.';
      }
    });
  }

  confirmarPago(): void {
    if (!this.canConfirm) return;
    this.loadingPago = true;
    this.error = null;
    const orden = 'ORD-' + Date.now();
    this.svc.registrarPago({
      telefonoCliente: this.cliente!.telefono,
      monto: this.montoSeleccionado!.monto,
      metodoPago: this.metodoPago!,
      numeroOrden: orden
    }).subscribe({
      next: r => {
        this.pagoResponse = r;
        this.loadingPago = false;
        this.emitirRecibo();
      },
      error: err => {
        this.loadingPago = false;
        this.error = err.error?.message ?? 'Error al procesar el pago.';
      }
    });
  }

  private emitirRecibo(): void {
    if (!this.pagoResponse) return;
    this.loadingRecibo = true;
    this.svc.emitirRecibo(this.pagoResponse.folio, this.pagoResponse.numeroOrden).subscribe({
      next: r => { this.reciboResponse = r; this.loadingRecibo = false; },
      error: () => {
        this.loadingRecibo = false;
        this.error = 'Error al emitir el recibo.';
      }
    });
  }

  reiniciar(): void {
    this.telefonoInput = '';
    this.cliente = null;
    this.montos = [];
    this.montoSeleccionado = null;
    this.validacion = null;
    this.metodosPago = [];
    this.metodoPago = null;
    this.pagoResponse = null;
    this.reciboResponse = null;
    this.error = null;
  }
}