import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  GatewayTimeoutException,
  HttpException,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { status } from '@grpc/grpc-js';
import { firstValueFrom, Observable, timeout, TimeoutError } from 'rxjs';

const DEADLINE_MS = Number(process.env.GRPC_DEADLINE_MS ?? 5000);

// Código gRPC que devuelve un servicio interno -> error HTTP que recibe la interfaz web.
// GraphQL también lo hereda, porque Nest convierte las HttpException en errores GraphQL.
const ERRORES_HTTP: Partial<
  Record<status, (mensaje: string) => HttpException>
> = {
  [status.INVALID_ARGUMENT]: (m) => new BadRequestException(m),
  [status.FAILED_PRECONDITION]: (m) => new BadRequestException(m),
  [status.NOT_FOUND]: (m) => new NotFoundException(m),
  [status.ALREADY_EXISTS]: (m) => new ConflictException(m),
  [status.ABORTED]: (m) => new ConflictException(m),
  [status.UNAUTHENTICATED]: (m) => new UnauthorizedException(m),
  [status.PERMISSION_DENIED]: (m) => new ForbiddenException(m),
};

/**
 * Ejecuta una llamada gRPC (el Observable que devuelve un ClientGrpc) con deadline
 * y traduce los errores del servicio a la HttpException equivalente, con el mismo mensaje.
 * Al vencer el deadline se cancela la llamada (Nest la cancela al desuscribirse).
 */
export async function rpc<T>(
  llamada$: Observable<T>,
  servicio: string,
  deadlineMs = DEADLINE_MS,
): Promise<T> {
  try {
    return await firstValueFrom(llamada$.pipe(timeout(deadlineMs)));
  } catch (error) {
    throw aHttp(error, servicio);
  }
}

function aHttp(error: unknown, servicio: string): unknown {
  if (error instanceof TimeoutError) {
    return new GatewayTimeoutException(`${servicio} no respondió a tiempo`);
  }
  const { code, details } = (error ?? {}) as {
    code?: status;
    details?: string;
  };
  if (code === status.UNAVAILABLE) {
    return new ServiceUnavailableException(`${servicio} no está disponible`);
  }
  if (code === status.DEADLINE_EXCEEDED) {
    return new GatewayTimeoutException(`${servicio} no respondió a tiempo`);
  }
  const crear = code === undefined ? undefined : ERRORES_HTTP[code];
  // Lo que no es un error de negocio del servicio se deja pasar y Nest responde 500.
  return crear ? crear(details ?? '') : error;
}
