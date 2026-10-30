import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { VehiculosController } from './vehiculos.controller';
import { VehiculosExternosController } from './vehiculos-externos.controller';
import { VehiculosExternosService } from './vehiculos-externos.service';
import { VehiculosService } from './vehiculos.service';

// AuthModule aporta el JwtService que usan los guards de autenticación y rol.
@Module({
  imports: [AuthModule],
  controllers: [VehiculosController, VehiculosExternosController],
  providers: [VehiculosService, VehiculosExternosService],
})
export class VehiculosModule {}
