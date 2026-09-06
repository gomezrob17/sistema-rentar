import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Linea para que el frontend (que corre en otra URL) pueda consumir la API
  app.enableCors();

  // Valida los datos de entrada y descarta los campos que no correspondan
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  // El Swagger queda disponible en http://localhost:3000/api
  const config = new DocumentBuilder()
    .setTitle('Rentar API')
    .setDescription('API de alquiler de vehículos')
    .setVersion('1.0')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  console.log(`Rentar backend andando en http://localhost:${port}`);
}
bootstrap();