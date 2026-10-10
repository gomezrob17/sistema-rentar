import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { RolUsuario } from '@prisma/client';
import { Vehiculo, VehicleClient } from '../grpc/vehicle.client';
import { Cliente, CustomerClient } from '../grpc/customer.client';
import { FiltroReservas, RentalClient } from '../grpc/rental.client';
import type { AuthPayload } from '../auth/auth.types';
import { CrearReservaDto } from './dto/crear-reserva.dto';
import { FiltroReservasInput } from './dto/filtro-reservas.input';
import { ReservaConsulta } from './models/reserva-consulta.model';
import { AlquilerHistorial } from './models/alquiler-historial.model';

const MS_POR_DIA = 24 * 60 * 60 * 1000;

@Injectable()
export class ReservasService {
  constructor(
    private readonly vehiculos: VehicleClient,
    private readonly clientes: CustomerClient,
    private readonly reservas: RentalClient,
  ) {}

  // Datos de los vehículos de las reservas, en una sola llamada al Vehicle Service.
  private async vehiculosDe(
    reservas: { vehiculoId: number }[],
  ): Promise<Map<number, Vehiculo>> {
    if (reservas.length === 0) return new Map();
    const ids = [...new Set(reservas.map((reserva) => reserva.vehiculoId))];
    const vehiculos = await this.vehiculos.listar({ ids });
    return new Map(vehiculos.map((v) => [v.id, v]));
  }

  // Datos de los clientes de las reservas, en una sola llamada al Customer Service.
  private async clientesDe(
    reservas: { clienteId: number }[],
  ): Promise<Map<number, Cliente>> {
    if (reservas.length === 0) return new Map();
    const ids = [...new Set(reservas.map((reserva) => reserva.clienteId))];
    const clientes = await this.clientes.listar({ ids });
    return new Map(clientes.map((c) => [c.id, c]));
  }

  // El cliente sale del token firmado, nunca de un id enviado por el navegador.
  private clienteAutenticado(usuario: AuthPayload): number {
    if (usuario.rol !== RolUsuario.CLIENTE || !usuario.clienteId) {
      throw new ForbiddenException(
        'Esta operación requiere una sesión de cliente',
      );
    }
    return usuario.clienteId;
  }

  async crear(dto: CrearReservaDto) {
    const fechaInicio = new Date(dto.fechaInicio);
    const fechaFin = new Date(dto.fechaFin);

    if (fechaInicio >= fechaFin) {
      throw new BadRequestException(
        'La fecha de fin debe ser posterior a la de inicio',
      );
    }
    if (fechaInicio < new Date()) {
      throw new BadRequestException('La fecha de inicio debe ser futura');
    }

    // El Customer Service valida que exista (404) y esté activo (400).
    await this.clientes.validarParaReserva(dto.clienteId);

    // El Vehicle Service valida existencia/estado y da el precio actual del momento.
    const vehiculo = await this.vehiculos.validarParaReserva(dto.vehiculoId);

    // El Rental Service valida el período y el solapamiento, y calcula el importe.
    return this.reservas.crear({
      clienteId: dto.clienteId,
      vehiculoId: dto.vehiculoId,
      fechaInicio: fechaInicio.toISOString(),
      fechaFin: fechaFin.toISOString(),
      precioDiario: vehiculo.precioDiario,
    });
  }

  async cancelar(id: number, usuario: AuthPayload) {
    const clienteId = this.clienteAutenticado(usuario);
    await this.reservas.cancelar(id, clienteId);
    return { id, estado: 'CANCELADA' as const };
  }

  async historial(usuario: AuthPayload): Promise<AlquilerHistorial[]> {
    const clienteId = this.clienteAutenticado(usuario);
    const reservas = await this.reservas.historial(clienteId);
    const vehiculos = await this.vehiculosDe(reservas);

    return reservas.map((reserva) => {
      const vehiculo = vehiculos.get(reserva.vehiculoId)!;
      const inicio = new Date(reserva.fechaInicio);
      const fin = new Date(reserva.fechaFin);
      return {
        id: reserva.id,
        vehiculo: `${vehiculo.marca} ${vehiculo.modelo}`,
        patente: vehiculo.patente,
        fechaInicio: inicio,
        fechaFin: fin,
        cantidadDias: Math.max(
          1,
          Math.ceil((fin.getTime() - inicio.getTime()) / MS_POR_DIA),
        ),
        importeTotal: parseFloat(reserva.importeTotal),
        estado: reserva.estado,
      };
    });
  }

  async buscar(
    filtro: FiltroReservasInput,
    usuario: AuthPayload,
  ): Promise<ReservaConsulta[]> {
    const { fechaDesde, fechaHasta } = filtro;

    if (fechaDesde && fechaHasta && fechaDesde > fechaHasta) {
      throw new BadRequestException(
        'La fecha hasta debe ser posterior a la fecha desde',
      );
    }

    const filtroServicio: FiltroReservas = {};

    if (usuario.rol === RolUsuario.CLIENTE) {
      if (usuario.clienteId == null) {
        throw new ForbiddenException('El usuario no tiene un cliente asociado');
      }
      filtroServicio.clienteId = usuario.clienteId;
    } else {
      if (filtro.clienteId != null) filtroServicio.clienteId = filtro.clienteId;

      // Los filtros por datos del cliente (nombre, apellido, documento o email)
      // los resuelve el Customer Service. Si ningún cliente coincide, no hay reservas.
      if (filtro.cliente?.trim()) {
        const coincidentes = await this.clientes.listar({
          texto: filtro.cliente.trim(),
        });
        const ids = coincidentes.map((cliente) => cliente.id);
        const permitidos =
          filtro.clienteId != null
            ? ids.filter((id) => id === filtro.clienteId)
            : ids;
        if (permitidos.length === 0) return [];
        filtroServicio.clienteId = undefined;
        filtroServicio.clienteIds = permitidos;
      }
    }

    if (filtro.vehiculoId != null) filtroServicio.vehiculoId = filtro.vehiculoId;

    // Los filtros por datos del vehículo (marca, modelo, patente o tipo) los resuelve
    // el Vehicle Service. Si ningún vehículo coincide, no hay reservas que buscar.
    const textoVehiculo = filtro.vehiculo?.trim();
    if (textoVehiculo || filtro.tipo) {
      const coincidentes = await this.vehiculos.listar({
        ids: filtro.vehiculoId != null ? [filtro.vehiculoId] : [],
        texto: textoVehiculo,
        tipo: filtro.tipo,
      });
      if (coincidentes.length === 0) return [];
      filtroServicio.vehiculoId = undefined;
      filtroServicio.vehiculoIds = coincidentes.map((v) => v.id);
    }

    if (filtro.estado) filtroServicio.estado = filtro.estado;
    if (fechaDesde) filtroServicio.fechaDesde = fechaDesde.toISOString();
    if (fechaHasta) filtroServicio.fechaHasta = fechaHasta.toISOString();

    const reservas = await this.reservas.listar(filtroServicio);
    const [vehiculos, clientes] = await Promise.all([
      this.vehiculosDe(reservas),
      this.clientesDe(reservas),
    ]);

    return reservas.map((reserva) => {
      const vehiculo = vehiculos.get(reserva.vehiculoId)!;
      const cliente = clientes.get(reserva.clienteId);
      return {
        id: reserva.id,
        clienteId: reserva.clienteId,
        cliente: cliente
          ? `${cliente.apellido}, ${cliente.nombre}`
          : `Cliente ${reserva.clienteId}`,
        vehiculoId: reserva.vehiculoId,
        vehiculo: `${vehiculo.marca} ${vehiculo.modelo}`,
        patente: vehiculo.patente,
        tipo: vehiculo.tipo,
        fechaInicio: new Date(reserva.fechaInicio),
        fechaFin: new Date(reserva.fechaFin),
        precioDiario: parseFloat(reserva.precioDiario),
        importeTotal: parseFloat(reserva.importeTotal),
        estado: reserva.estado,
      };
    });
  }
}
