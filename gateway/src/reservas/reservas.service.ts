import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EstadoReserva, Prisma, RolUsuario } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { Vehiculo, VehicleClient } from '../grpc/vehicle.client';
import { Cliente, CustomerClient } from '../grpc/customer.client';
import type { AuthPayload } from '../auth/auth.types';
import { CrearReservaDto } from './dto/crear-reserva.dto';
import { FiltroReservasInput } from './dto/filtro-reservas.input';
import { ReservaConsulta } from './models/reserva-consulta.model';
import { AlquilerHistorial } from './models/alquiler-historial.model';

const MS_POR_DIA = 24 * 60 * 60 * 1000;

@Injectable()
export class ReservasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly vehiculos: VehicleClient,
    private readonly clientes: CustomerClient,
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

  async cancelar(id: number, usuario: AuthPayload) {
    const clienteId = this.clienteAutenticado(usuario);
    const reserva = await this.prisma.reserva.findFirst({
      where: { id, clienteId },
    });

    if (!reserva) {
      throw new NotFoundException('No se encontró la reserva');
    }
    if (reserva.estado !== 'CONFIRMADA') {
      throw new ConflictException(
        'Solo se pueden cancelar reservas confirmadas',
      );
    }
    if (reserva.fechaInicio <= new Date()) {
      throw new BadRequestException('El período de alquiler ya comenzó');
    }

    // Se vuelven a validar las condiciones en la escritura para evitar que
    // dos cancelaciones simultáneas modifiquen la misma reserva.
    const resultado = await this.prisma.reserva.updateMany({
      where: {
        id,
        clienteId,
        estado: 'CONFIRMADA',
        fechaInicio: { gt: new Date() },
      },
      data: { estado: 'CANCELADA' },
    });
    if (resultado.count !== 1) {
      throw new ConflictException(
        'La reserva cambió o el alquiler ya comenzó. Actualizá la consulta.',
      );
    }

    return { id, estado: 'CANCELADA' as const };
  }

  private estadoEfectivo(
    estado: EstadoReserva,
    fechaFin: Date,
    ahora: Date,
  ): EstadoReserva {
    return estado === 'CONFIRMADA' && fechaFin <= ahora ? 'FINALIZADA' : estado;
  }

  async historial(usuario: AuthPayload): Promise<AlquilerHistorial[]> {
    const clienteId = this.clienteAutenticado(usuario);
    const ahora = new Date();
    const reservas = await this.prisma.reserva.findMany({
      where: {
        clienteId,
        OR: [
          { estado: 'CANCELADA' },
          { estado: 'FINALIZADA' },
          { estado: 'CONFIRMADA', fechaFin: { lte: ahora } },
        ],
      },
      orderBy: [{ fechaInicio: 'desc' }, { id: 'desc' }],
    });
    const vehiculos = await this.vehiculosDe(reservas);

    return reservas.map((reserva) => {
      // Los vehículos nunca se borran (baja lógica), así que siempre existe.
      const vehiculo = vehiculos.get(reserva.vehiculoId)!;
      return {
        id: reserva.id,
        vehiculo: `${vehiculo.marca} ${vehiculo.modelo}`,
        patente: vehiculo.patente,
        fechaInicio: reserva.fechaInicio,
        fechaFin: reserva.fechaFin,
        cantidadDias: Math.max(
          1,
          Math.ceil(
            (reserva.fechaFin.getTime() - reserva.fechaInicio.getTime()) /
              MS_POR_DIA,
          ),
        ),
        importeTotal: reserva.importeTotal.toNumber(),
        estado: this.estadoEfectivo(reserva.estado, reserva.fechaFin, ahora),
      };
    });
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

    // El Vehicle Service valida que exista (404) y esté activo (400), y da el precio actual
    const vehiculo = await this.vehiculos.validarParaReserva(dto.vehiculoId);
    const precioDiario = new Prisma.Decimal(vehiculo.precioDiario);

    return this.prisma.$transaction(async (tx) => {
      const reservaSolapada = await tx.reserva.findFirst({
        where: {
          vehiculoId: dto.vehiculoId,
          estado: 'CONFIRMADA',
          fechaInicio: { lt: fechaFin },
          fechaFin: { gt: fechaInicio },
        },
      });

      if (reservaSolapada) {
        throw new BadRequestException(
          `El vehículo con id ${dto.vehiculoId} no está disponible en el período solicitado`,
        );
      }

      const dias = Math.max(
        1,
        Math.ceil((fechaFin.getTime() - fechaInicio.getTime()) / MS_POR_DIA),
      );
      const importeTotal = precioDiario.mul(dias);

      return tx.reserva.create({
        data: {
          clienteId: dto.clienteId,
          vehiculoId: dto.vehiculoId,
          fechaInicio,
          fechaFin,
          precioDiario,
          importeTotal,
        },
      });
    });
  }

  async buscar(
    filtro: FiltroReservasInput,
    usuario: AuthPayload,
  ): Promise<ReservaConsulta[]> {
    const ahora = new Date();
    const { fechaDesde, fechaHasta } = filtro;

    if (fechaDesde && fechaHasta && fechaDesde > fechaHasta) {
      throw new BadRequestException(
        'La fecha hasta debe ser posterior a la fecha desde',
      );
    }

    const where: Prisma.ReservaWhereInput = {};

    if (usuario.rol === RolUsuario.CLIENTE) {
      if (usuario.clienteId == null) {
        throw new ForbiddenException('El usuario no tiene un cliente asociado');
      }
      where.clienteId = usuario.clienteId;
    } else {
      if (filtro.clienteId != null) where.clienteId = filtro.clienteId;

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
        where.clienteId = { in: permitidos };
      }
    }

    if (filtro.vehiculoId != null) where.vehiculoId = filtro.vehiculoId;

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
      where.vehiculoId = { in: coincidentes.map((v) => v.id) };
    }

    // El estado mostrado y los filtros usan el mismo criterio que el historial.
    // No se escribe en la base desde una consulta GraphQL.
    if (filtro.estado === 'FINALIZADA') {
      where.OR = [
        { estado: 'FINALIZADA' },
        { estado: 'CONFIRMADA', fechaFin: { lte: ahora } },
      ];
    } else if (filtro.estado === 'CONFIRMADA') {
      where.estado = 'CONFIRMADA';
      where.AND = [{ fechaFin: { gt: ahora } }];
    } else if (filtro.estado) {
      where.estado = filtro.estado;
    }

    if (fechaDesde) where.fechaFin = { gte: fechaDesde };
    if (fechaHasta) where.fechaInicio = { lte: fechaHasta };

    const reservas = await this.prisma.reserva.findMany({
      where,
      orderBy: { fechaInicio: 'desc' },
    });
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
        fechaInicio: reserva.fechaInicio,
        fechaFin: reserva.fechaFin,
        precioDiario: reserva.precioDiario.toNumber(),
        importeTotal: reserva.importeTotal.toNumber(),
        estado: this.estadoEfectivo(reserva.estado, reserva.fechaFin, ahora),
      };
    });
  }
}
