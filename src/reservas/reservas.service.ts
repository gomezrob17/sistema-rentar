import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CrearReservaDto } from './dto/crear-reserva.dto';

// 24 horas en milisegundos, para calcular la duración del alquiler
const MS_POR_DIA = 24 * 60 * 60 * 1000;

@Injectable()
export class ReservasService {
  // Acceso a la base con NestJS
  constructor(private readonly prisma: PrismaService) {}

  async crear(dto: CrearReservaDto) {
    const fechaInicio = new Date(dto.fechaInicio);
    const fechaFin = new Date(dto.fechaFin);

    // --- Validaciones de fechas ---
    if (fechaInicio >= fechaFin) {
      throw new BadRequestException(
        'La fecha de fin debe ser posterior a la de inicio',
      );
    }
    if (fechaInicio < new Date()) {
      throw new BadRequestException('La fecha de inicio debe ser futura');
    }

    // --- El cliente debe existir y estar activo ---
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

    // --- El vehículo debe existir y estar activo ---
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

    // --- Todo dentro de una transacción: el chequeo de disponibilidad y la
    // creación de la reserva van juntos para que dos reservas simultáneas
    // para el mismo vehículo no se pisen entre sí ---
    return this.prisma.$transaction(async (tx) => {
      // El vehículo está disponible si no tiene una reserva CONFIRMADA que
      // se pise con el período pedido. (Dos períodos se solapan si uno
      // empieza antes de que el otro termine, y viceversa)
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

      // --- Cálculo del importe ---
      // El precio diario se congela al momento de la reserva
      const dias = Math.max(
        1,
        Math.ceil((fechaFin.getTime() - fechaInicio.getTime()) / MS_POR_DIA),
      );
      const importeTotal = vehiculo.precioDiario.mul(dias);

      // El estado lo pone la base: CONFIRMADA por default
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
}
