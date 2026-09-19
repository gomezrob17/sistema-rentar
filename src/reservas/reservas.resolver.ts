import { UseGuards } from '@nestjs/common';
import { Args, Query, Resolver } from '@nestjs/graphql';
import type { AuthPayload } from '../auth/auth.types';
import { GqlAuthGuard } from '../auth/gql-auth.guard';
import { UsuarioActual } from '../auth/usuario-actual.decorator';
import { ReservasService } from './reservas.service';
import { FiltroReservasInput } from './dto/filtro-reservas.input';
import { ReservaConsulta } from './models/reserva-consulta.model';

@Resolver(() => ReservaConsulta)
export class ReservasResolver {
  constructor(private readonly reservasService: ReservasService) {}

  @Query(() => [ReservaConsulta], { name: 'reservas' })
  @UseGuards(GqlAuthGuard)
  buscar(
    @UsuarioActual() usuario: AuthPayload,
    @Args('filtro', { nullable: true }) filtro?: FiltroReservasInput,
  ) {
    return this.reservasService.buscar(filtro ?? {}, usuario);
  }
}