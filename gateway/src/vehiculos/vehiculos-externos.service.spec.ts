import { ForbiddenException } from '@nestjs/common';
import { RolUsuario, type AuthPayload } from '../auth/auth.types';
import { CustomerClient } from '../grpc/customer.client';
import { VehicleClient } from '../grpc/vehicle.client';
import { VehiculosExternosService } from './vehiculos-externos.service';
import { TipoVehiculo } from './vehiculo.enums';

const cliente: AuthPayload = {
  sub: 7,
  rol: RolUsuario.CLIENTE,
  clienteId: 89,
  nombre: 'Camila Torres',
  email: 'camila@example.test',
};

const datos = {
  patente: 'DEF456',
  marca: 'Toyota',
  modelo: 'Corolla',
  anio: 2023,
  tipo: TipoVehiculo.SEDAN,
  precioDiario: 32000,
};

describe('VehiculosExternosService', () => {
  let vehiculos: { registrarExterno: jest.Mock; listarExternos: jest.Mock };
  let clientes: { validarParaReserva: jest.Mock };
  let servicio: VehiculosExternosService;

  beforeEach(() => {
    vehiculos = {
      registrarExterno: jest.fn().mockResolvedValue({ id: 1, estado: 'PENDIENTE' }),
      listarExternos: jest.fn().mockResolvedValue([]),
    };
    clientes = {
      validarParaReserva: jest.fn().mockResolvedValue({ id: 89 }),
    };
    servicio = new VehiculosExternosService(
      vehiculos as unknown as VehicleClient,
      clientes as unknown as CustomerClient,
    );
  });

  it('registra con el cliente del token y el precio como texto', async () => {
    await servicio.registrar(datos, cliente);

    expect(clientes.validarParaReserva).toHaveBeenCalledWith(89);
    expect(vehiculos.registrarExterno).toHaveBeenCalledWith({
      ...datos,
      clienteId: 89,
      precioDiario: '32000',
    });
  });

  it('no acepta un clienteId enviado en el cuerpo', async () => {
    await servicio.registrar(
      { ...datos, clienteId: 999 } as unknown as typeof datos,
      cliente,
    );

    expect(vehiculos.registrarExterno).toHaveBeenCalledWith(
      expect.objectContaining({ clienteId: 89 }),
    );
  });

  it('rechaza a un administrador', async () => {
    const admin: AuthPayload = {
      sub: 1,
      rol: RolUsuario.ADMIN,
      nombre: 'Administrador',
      email: 'admin@example.test',
    };

    await expect(servicio.registrar(datos, admin)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(vehiculos.registrarExterno).not.toHaveBeenCalled();
  });

  it('lista solo las solicitudes del cliente del token', async () => {
    await servicio.listarMios(cliente);
    expect(vehiculos.listarExternos).toHaveBeenCalledWith({ clienteId: 89 });
  });
});
