import { HttpException } from '@nestjs/common';
import { status } from '@grpc/grpc-js';
import { NEVER, of, throwError } from 'rxjs';
import { rpc } from './rpc';

const errorGrpc = (code: status, details: string) =>
  throwError(() =>
    Object.assign(new Error(`${code} ${details}`), { code, details }),
  );

async function httpDe(promesa: Promise<unknown>) {
  const error = await promesa.catch((e: unknown) => e);
  expect(error).toBeInstanceOf(HttpException);
  const http = error as HttpException;
  return { codigo: http.getStatus(), mensaje: http.message };
}

describe('rpc', () => {
  it('devuelve la respuesta del servicio', async () => {
    await expect(rpc(of({ id: 1 }), 'Vehicle Service')).resolves.toEqual({
      id: 1,
    });
  });

  it.each([
    [status.INVALID_ARGUMENT, 400],
    [status.FAILED_PRECONDITION, 400],
    [status.NOT_FOUND, 404],
    [status.ALREADY_EXISTS, 409],
    [status.ABORTED, 409],
    [status.UNAUTHENTICATED, 401],
    [status.PERMISSION_DENIED, 403],
  ])(
    'traduce el código gRPC %i a HTTP %i con el mismo mensaje',
    async (code, http) => {
      const resultado = await httpDe(
        rpc(errorGrpc(code, 'Mensaje del servicio'), 'Rental Service'),
      );
      expect(resultado).toEqual({
        codigo: http,
        mensaje: 'Mensaje del servicio',
      });
    },
  );

  it('informa 503 si el servicio está caído', async () => {
    const resultado = await httpDe(
      rpc(errorGrpc(status.UNAVAILABLE, 'No connection'), 'Rental Service'),
    );
    expect(resultado).toEqual({
      codigo: 503,
      mensaje: 'Rental Service no está disponible',
    });
  });

  it('informa 504 si se vence el deadline', async () => {
    const resultado = await httpDe(rpc(NEVER, 'Customer Service', 10));
    expect(resultado).toEqual({
      codigo: 504,
      mensaje: 'Customer Service no respondió a tiempo',
    });
  });

  it('deja pasar los errores que no son de gRPC', async () => {
    const bug = new TypeError('bug');
    await expect(
      rpc(
        throwError(() => bug),
        'Vehicle Service',
      ),
    ).rejects.toBe(bug);
  });
});
