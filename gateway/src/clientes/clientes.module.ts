import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ClientesController } from './clientes.controller';
import { ClientesService } from './clientes.service';

// AuthModule aporta el JwtService que usan los guards de autenticación y rol.
@Module({
  imports: [AuthModule],
  controllers: [ClientesController],
  providers: [ClientesService],
})
export class ClientesModule {}
