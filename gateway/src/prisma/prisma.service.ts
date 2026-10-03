import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

// Este servicio es el que usan el resto de modulos para hablar con la base
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  async onModuleInit() {
    // Abro la conexión cuando arranca la app
    await this.$connect();
  }
}