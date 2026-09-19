import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, RolUsuario } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthPayload } from '../auth/auth.types';
import { CrearReservaDto } from './dto/crear-reserva.dto';
import { FiltroReservasInput } from './dto/filtro-reservas.input';
import { ReservaConsulta } from './models/reserva-consulta.model';

const MS_POR_DIA = 24 * 60 * 60 * 1000;

@Injectable()
export class ReservasService {
  constructor(private readonly prisma: PrismaService) {}

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

    const cliente = await this.prisma.cliente.findUnique({
      where: { id: dto.clienteId },
    });
    if (!cliente) {
      throw new NotFoundException(
        `No se encontró el cliente con id ${dto.clienteId}`,
      );
    }
    if (!cliente.activo) {
      throw new BadRequestException(
        `El cliente con id ${dto.clienteId} no está activo`,
      );
    }

    const vehiculo = await this.prisma.vehiculo.findUnique({
      where: { id: dto.vehiculoId },
    });
    if (!vehiculo) {
      throw new NotFoundException(
        `No se encontró el vehículo con id ${dto.vehiculoId}`,
      );
    }
    if (!vehiculo.activo) {
      throw new BadRequestException(
        `El vehículo con id ${dto.vehiculoId} no está activo`,
      );
    }

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
      const importeTotal = vehiculo.precioDiario.mul(dias);

      return tx.reserva.create({
        data: {
          clienteId: dto.clienteId,
          vehiculoId: dto.vehiculoId,
          fechaInicio,
          fechaFin,
          precioDiario: vehiculo.precioDiario,
          importeTotal,
        },
      });
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

    const where: Prisma.ReservaWhereInput = {};

    if (usuario.rol === RolUsuario.CLIENTE) {
      if (usuario.clienteId == null) {
        throw new ForbiddenException(
          'El usuario no tiene un cliente asociado',
        );
      }
      where.clienteId = usuario.clienteId;
    } else {
      if (filtro.clienteId != null) where.clienteId = filtro.clienteId;

      if (filtro.cliente?.trim()) {
        const texto = filtro.cliente.trim();
        where.cliente = {
          OR: [
            { nombre: { contains: texto, mode: 'insensitive' } },
            { apellido: { contains: texto, mode: 'insensitive' } },
            { documento: { contains: texto, mode: 'insensitive' } },
            { email: { contains: texto, mode: 'insensitive' } },
          ],
        };
      }
    }

    if (filtro.vehiculoId != null) where.vehiculoId = filtro.vehiculoId;

    const vehiculo: Prisma.VehiculoWhereInput = {};

    if (filtro.tipo) vehiculo.tipo = filtro.tipo;

    if (filtro.vehiculo?.trim()) {
      const texto = filtro.vehiculo.trim();
      vehiculo.OR = [
        { marca: { contains: texto, mode: 'insensitive' } },
        { modelo: { contains: texto, mode: 'insensitive' } },
        { patente: { contains: texto, mode: 'insensitive' } },
      ];
    }

    if (Object.keys(vehiculo).length > 0) where.vehiculo = vehiculo;

    if (filtro.estado) where.estado = filtro.estado;

    if (fechaDesde) where.fechaFin = { gte: fechaDesde };
    if (fechaHasta) where.fechaInicio = { lte: fechaHasta };

    const reservas = await this.prisma.reserva.findMany({
      where,
      include: { cliente: true, vehiculo: true },
      orderBy: { fechaInicio: 'desc' },
    });

    return reservas.map((reserva) => ({
      id: reserva.id,
      clienteId: reserva.clienteId,
      cliente: `${reserva.cliente.apellido}, ${reserva.cliente.nombre}`,
      vehiculoId: reserva.vehiculoId,
      vehiculo: `${reserva.vehiculo.marca} ${reserva.vehiculo.modelo}`,
      patente: reserva.vehiculo.patente,
      tipo: reserva.vehiculo.tipo,
      fechaInicio: reserva.fechaInicio,
      fechaFin: reserva.fechaFin,
      precioDiario: reserva.precioDiario.toNumber(),
      importeTotal: reserva.importeTotal.toNumber(),
      estado: reserva.estado,
    }));
  }
}