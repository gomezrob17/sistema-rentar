import { Field, Float, Int, ObjectType } from '@nestjs/graphql';
import { TipoVehiculo } from '../../vehiculos/vehiculo.enums';
import { EstadoReserva } from './enums';

@ObjectType({ description: 'Reserva de un vehículo, con sus datos asociados.' })
export class ReservaConsulta {
  @Field(() => Int, { description: 'Identificador de la reserva.' })
  id: number;

  @Field(() => Int, { description: 'Identificador del cliente.' })
  clienteId: number;

  @Field({ description: 'Apellido y nombre del cliente' })
  cliente: string;

  @Field(() => Int, { description: 'Identificador del vehículo.' })
  vehiculoId: number;

  @Field({ description: 'Marca y modelo del vehículo' })
  vehiculo: string;

  @Field({ description: 'Patente del vehículo.' })
  patente: string;

  @Field(() => TipoVehiculo, { description: 'Tipo de vehículo.' })
  tipo: TipoVehiculo;

  @Field({ description: 'Fecha y hora de inicio del período reservado.' })
  fechaInicio: Date;

  @Field({ description: 'Fecha y hora de finalización del período reservado.' })
  fechaFin: Date;

  @Field(() => Float, { description: 'Precio de alquiler por día.' })
  precioDiario: number;

  @Field(() => Float, { description: 'Importe total de la reserva.' })
  importeTotal: number;

  @Field(() => EstadoReserva, { description: 'Estado actual de la reserva.' })
  estado: EstadoReserva;

  @Field(() => String, {
    nullable: true,
    description: 'Mantenimiento preventivo: PENDIENTE, REALIZADO o NO_REALIZADO. Null para reservas previas a esta funcionalidad. No modifica el estado de la reserva.',
  })
  mantenimiento?: string | null;

  @Field(() => String, {
    nullable: true,
    description:
      'Reasignación automática por avería: REASIGNADA o FALLIDA. Null si la reserva no fue impactada.',
  })
  reasignacion?: string | null;

  @Field(() => String, {
    nullable: true,
    description:
      'Detalle de la reasignación: sustituto asignado o motivo por el que no se encontró uno.',
  })
  reasignacionDetalle?: string | null;

  @Field(() => Int, {
    nullable: true,
    description: 'Vehículo que estaba asignado antes de la reasignación.',
  })
  vehiculoOriginalId?: number | null;

  @Field(() => Int, {
    nullable: true,
    description: 'Avería que disparó la reasignación.',
  })
  averiaId?: number | null;
}