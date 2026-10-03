import { Module } from '@nestjs/common';
import { DisponibilidadResolver } from './disponibilidad.resolver';
import { DisponibilidadService } from './disponibilidad.service';
import './models/enums'; // registra el enum TipoVehiculo en GraphQL

@Module({
  providers: [DisponibilidadResolver, DisponibilidadService],
})
export class DisponibilidadModule {}