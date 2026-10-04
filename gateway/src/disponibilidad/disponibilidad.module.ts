import { Module } from '@nestjs/common';
import { DisponibilidadResolver } from './disponibilidad.resolver';
import { DisponibilidadService } from './disponibilidad.service';

@Module({
  providers: [DisponibilidadResolver, DisponibilidadService],
})
export class DisponibilidadModule {}