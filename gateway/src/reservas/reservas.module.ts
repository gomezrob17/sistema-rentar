import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ReservasController } from './reservas.controller';
import { ReservasResolver } from './reservas.resolver';
import { ReservasService } from './reservas.service';
import './models/enums';

@Module({
  imports: [AuthModule],
  controllers: [ReservasController],
  providers: [ReservasResolver, ReservasService],
})
export class ReservasModule {}