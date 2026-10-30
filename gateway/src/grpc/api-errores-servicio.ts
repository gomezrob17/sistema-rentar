import { applyDecorators } from '@nestjs/common';
import {
  ApiGatewayTimeoutResponse,
  ApiServiceUnavailableResponse,
} from '@nestjs/swagger';

// Documenta en Swagger los errores que rpc() devuelve cuando falla la llamada al servicio interno.
export const ApiErroresServicio = (servicio: string) =>
  applyDecorators(
    ApiServiceUnavailableResponse({
      description: `El ${servicio} no está disponible`,
    }),
    ApiGatewayTimeoutResponse({
      description: `El ${servicio} no respondió dentro del plazo (5 segundos)`,
    }),
  );
