import { Args, Query, Resolver } from '@nestjs/graphql';
import { DisponibilidadService } from './disponibilidad.service';
import { VehiculoDisponible } from './models/vehiculo-disponible.model';
import { FiltroDisponibilidadInput } from './dto/filtro-disponibilidad.input';

@Resolver(() => VehiculoDisponible)
export class DisponibilidadResolver {
  constructor(private readonly disponibilidadService: DisponibilidadService) {}

  // Definimos la consulta "vehiculosDisponibles" que devuelve una lista de vehículos
  @Query(() => [VehiculoDisponible], {
    name: 'vehiculosDisponibles',
    description:
      'Lista los vehículos sin reservas confirmadas que se superpongan con el período indicado, aplicando los filtros opcionales de tipo, marca, modelo y rango de precio diario.',
  })
  buscar(@Args('filtro') filtro: FiltroDisponibilidadInput) {
    return this.disponibilidadService.buscar(filtro);
  }
}