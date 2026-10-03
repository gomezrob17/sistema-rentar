import { Field, Float, Int, ObjectType } from '@nestjs/graphql';
import { EstadoReserva } from '@prisma/client';

@ObjectType({
  description:
    'Alquiler finalizado o reserva cancelada del cliente autenticado.',
})
export class AlquilerHistorial {
  @Field(() => Int, {
    description: 'Identificador de la reserva conservada en la base de datos.',
  })
  id: number;

  @Field({ description: 'Marca y modelo del vehículo.' })
  vehiculo: string;

  @Field({ description: 'Patente del vehículo.' })
  patente: string;

  @Field({
    description:
      'Fecha y hora de inicio del período reservado, en formato ISO 8601.',
  })
  fechaInicio: Date;

  @Field({
    description:
      'Fecha y hora de finalización del período reservado, en formato ISO 8601.',
  })
  fechaFin: Date;

  @Field(() => Int, {
    description:
      'Duración reservada: cada fracción de 24 horas se redondea hacia arriba, con mínimo de un día. Usa la misma regla que el alta.',
  })
  cantidadDias: number;

  @Field(() => Float, {
    description:
      'Importe original guardado al reservar. En una cancelación representa el importe de la reserva, no un cobro ni un reembolso.',
  })
  importeTotal: number;

  @Field(() => EstadoReserva, {
    description:
      'CANCELADA o FINALIZADA. Una reserva confirmada cuya fecha de fin ya pasó se muestra FINALIZADA sin modificar el registro.',
  })
  estado: EstadoReserva;
}
