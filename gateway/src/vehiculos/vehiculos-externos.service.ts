import { ForbiddenException, Injectable } from '@nestjs/common';
import { AuthPayload, RolUsuario } from '../auth/auth.types';
import { CustomerClient } from '../grpc/customer.client';
import { VehicleClient } from '../grpc/vehicle.client';
import { CrearVehiculoExternoDto } from './dto/crear-vehiculo-externo.dto';

@Injectable()
export class VehiculosExternosService {
  constructor(
    private readonly vehiculos: VehicleClient,
    private readonly clientes: CustomerClient,
  ) {}

  // El cliente sale del token firmado, nunca de un id enviado por el navegador.
  private clienteAutenticado(usuario: AuthPayload): number {
    if (usuario.rol !== RolUsuario.CLIENTE || !usuario.clienteId) {
      throw new ForbiddenException(
        'Esta operación requiere una sesión de cliente',
      );
    }
    return usuario.clienteId;
  }

  async registrar(dto: CrearVehiculoExternoDto, usuario: AuthPayload) {
    const clienteId = this.clienteAutenticado(usuario);
    // Verifica que el cliente exista y esté activo antes de iniciar el proceso.
    await this.clientes.validarParaReserva(clienteId);
    return this.vehiculos.registrarExterno({
      ...dto,
      clienteId,
      precioDiario: String(dto.precioDiario),
    });
  }

  async listarMios(usuario: AuthPayload) {
    return this.vehiculos.listarExternos({
      clienteId: this.clienteAutenticado(usuario),
    });
  }
}
