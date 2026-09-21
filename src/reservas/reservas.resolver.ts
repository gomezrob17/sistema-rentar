import { UseGuards } from '@nestjs/common';
import { Args, Query, Resolver } from '@nestjs/graphql';
import type { AuthPayload } from '../auth/auth.types';
import { GqlAuthGuard } from '../auth/gql-auth.guard';
import { UsuarioActual } from '../auth/usuario-actual.decorator';
import { ReservasService } from './reservas.service';
import { FiltroReservasInput } from './dto/filtro-reservas.input';
import { ReservaConsulta } from './models/reserva-consulta.model';
import { AlquilerHistorial } from './models/alquiler-historial.model';

@Resolver(() => ReservaConsulta)
export class ReservasResolver {
  constructor(private readonly reservasService: ReservasService) {}

  @Query(() => [ReservaConsulta], {
    name: 'reservas',
    description:
      'Lista las reservas del cliente autenticado, con filtros opcionales por cliente, vehículo, tipo, estado y rango de fechas.',
  })
  @UseGuards(GqlAuthGuard)
  buscar(
    @UsuarioActual() usuario: AuthPayload,
    @Args('filtro', { nullable: true }) filtro?: FiltroReservasInput,
  ) {
    return this.reservasService.buscar(filtro ?? {}, usuario);
  }

  @Query(() => [AlquilerHistorial], {
    name: 'historialAlquileres',
    description:
      'Historial privado del cliente autenticado: reservas canceladas y alquileres finalizados, incluidos los confirmados cuya fecha de fin ya pasó. Ordenado por inicio descendente. No recibe un clienteId ni modifica la base.',
  })
  @UseGuards(GqlAuthGuard)
  historial(@UsuarioActual() usuario: AuthPayload) {
    return this.reservasService.historial(usuario);
  }
}
