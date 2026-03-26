import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PaymentboxService } from './paymentbox.service';
import {
  CustomerProfile, MontoRecarga, PagoResponse, ReciboResponse, ValidacionOperador
} from './models';

type Step = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent {

  currentStep: Step = 1;
  loading = false;
  error: string | null = null;

  // Paso 1
  operador = 'BLUE';

  // Paso 2
  telefonoInput = '';
  cliente: CustomerProfile | null = null;

  // Paso 3
  montos: MontoRecarga[] = [];
  montoSeleccionado: MontoRecarga | null = null;

  // Paso 4
  validacion: ValidacionOperador | null = null;

  // Paso 5
  metodosPago: string[] = [];
  metodoPago: string | null = null;

  // Paso 7
  pagoResponse: PagoResponse | null = null;

  // Paso 8
  reciboResponse: ReciboResponse | null = null;

  constructor(private svc: PaymentboxService) {}

  goTo(step: Step) {
    this.currentStep = step;
    this.error = null;
  }

  // ── Paso 1: Seleccionar operador ──────────────────────────────────────────
  confirmarOperador() {
    this.goTo(2);
  }

  // ── Paso 2: Focalizar cliente ─────────────────────────────────────────────
  buscarCliente() {
    if (!this.telefonoInput.trim()) return;
    this.loading = true;
    this.error = null;
    this.svc.buscarCliente(this.telefonoInput.trim()).subscribe({
      next: c => {
        this.cliente = c;
        this.loading = false;
        this.goTo(3);
        this.cargarMontos();
      },
      error: err => {
        this.loading = false;
        this.error = err.status === 404
          ? 'Cliente no encontrado o inactivo.'
          : 'Error al buscar cliente. Intente de nuevo.';
      }
    });
  }

  // ── Paso 3: Seleccionar monto ─────────────────────────────────────────────
  cargarMontos() {
    this.svc.obtenerMontos(this.operador).subscribe({
      next: m => { this.montos = m; },
      error: () => { this.error = 'No se pudieron cargar los montos.'; }
    });
  }

  seleccionarMonto(m: MontoRecarga) {
    this.montoSeleccionado = m;
    this.goTo(4);
    this.validarOperador();
  }

  // ── Paso 4: Validar operador ──────────────────────────────────────────────
  validarOperador() {
    if (!this.cliente) return;
    this.loading = true;
    this.svc.validarOperador(this.cliente.telefono, this.operador).subscribe({
      next: v => {
        this.validacion = v;
        this.loading = false;
        this.goTo(5);
        this.cargarMetodosPago();
      },
      error: () => {
        this.loading = false;
        this.error = 'Error al validar operador.';
      }
    });
  }

  // ── Paso 5: Métodos de pago ───────────────────────────────────────────────
  cargarMetodosPago() {
    this.svc.obtenerMetodosPago().subscribe({
      next: m => { this.metodosPago = m; },
      error: () => { this.error = 'No se pudieron cargar métodos de pago.'; }
    });
  }

  seleccionarMetodo(m: string) {
    this.metodoPago = m;
    this.goTo(6);
  }

  // ── Paso 6: Confirmar y registrar pago ───────────────────────────────────
  confirmarPago() {
    if (!this.cliente || !this.montoSeleccionado || !this.metodoPago) return;
    this.loading = true;
    this.error = null;
    const orden = 'ORD-' + Date.now();
    this.svc.registrarPago({
      telefonoCliente: this.cliente.telefono,
      monto: this.montoSeleccionado.monto,
      metodoPago: this.metodoPago,
      numeroOrden: orden
    }).subscribe({
      next: r => {
        this.pagoResponse = r;
        this.loading = false;
        this.goTo(7);
      },
      error: err => {
        this.loading = false;
        this.error = err.error?.message ?? 'Error al procesar el pago.';
      }
    });
  }

  // ── Paso 7 → 8: Emitir recibo ────────────────────────────────────────────
  emitirRecibo() {
    if (!this.pagoResponse) return;
    this.loading = true;
    this.svc.emitirRecibo(this.pagoResponse.folio, this.pagoResponse.numeroOrden).subscribe({
      next: r => {
        this.reciboResponse = r;
        this.loading = false;
        this.goTo(8);
      },
      error: () => {
        this.loading = false;
        this.error = 'Error al emitir el recibo.';
      }
    });
  }

  // ── Reset ─────────────────────────────────────────────────────────────────
  reiniciar() {
    this.currentStep = 1;
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

  steps = [
    { n: 1, label: 'Operador' },
    { n: 2, label: 'Cliente' },
    { n: 3, label: 'Monto' },
    { n: 4, label: 'Validar' },
    { n: 5, label: 'Pago' },
    { n: 6, label: 'Confirmar' },
    { n: 7, label: 'Aplicado' },
    { n: 8, label: 'Recibo' }
  ];
}
