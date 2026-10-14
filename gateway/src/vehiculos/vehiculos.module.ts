import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { VehiculosController } from './vehiculos.controller';
import { VehiculosService } from './vehiculos.service';

// AuthModule aporta el JwtService que usan los guards de autenticación y rol.
@Module({
  imports: [AuthModule],
  controllers: [VehiculosController],
  providers: [VehiculosService],
})
export class VehiculosModule {}
