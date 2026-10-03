import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

// Lo hacemos global para no tener que importarlo en cada módulo
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}