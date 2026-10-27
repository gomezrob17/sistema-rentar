import { Body, Controller, Get, Post, Req } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { RolUsuario, type AuthPayload } from '../auth/auth.types';
import { SoloRoles } from '../auth/roles.guard';
import { ApiErroresServicio } from '../grpc/api-errores-servicio';
import { CrearVehiculoExternoDto } from './dto/crear-vehiculo-externo.dto';
import { VehiculosExternosService } from './vehiculos-externos.service';

const VEHICULO_EXTERNO = {
  id: 1,
  clienteId: 4,
  patente: 'DEF456',
  marca: 'Toyota',
  modelo: 'Corolla',
  anio: 2023,
  color: 'Blanco',
  tipo: 'SEDAN',
  precioDiario: '32000',
  estado: 'PENDIENTE',
  validacionPatente: null,
  validacionTitularidad: null,
  vehiculoId: null,
  motivoRechazo: null,
  createdAt: '2026-10-27T12:00:00.000Z',
  updatedAt: '2026-10-27T12:00:00.000Z',
};

type AuthenticatedRequest = Request & { user: AuthPayload };

@ApiTags('Vehículos externos')
@ApiErroresServicio('Vehicle Service')
@Controller('vehiculos/externos')
export class VehiculosExternosController {
  constructor(
    private readonly vehiculosExternosService: VehiculosExternosService,
  ) {}

  @Post()
  @SoloRoles(RolUsuario.CLIENTE)
  @ApiOperation({
    summary: 'Registrar un vehículo propio para incorporarlo a Rentar',
    description:
      'Requiere una sesión de cliente. El vehículo queda en estado PENDIENTE y comienza un proceso asíncrono: se publica vehiculos.externos.registrados y dos validadores independientes verifican la patente y la titularidad. Si ambas validaciones dan VALIDADO, el vehículo se incorpora a la flota en estado DISPONIBLE; si alguna da RECHAZADO, no se incorpora. El clienteId sale del token, no del cuerpo.',
  })
  @ApiCreatedResponse({
    description: 'Solicitud registrada en estado PENDIENTE',
    schema: { type: 'object', example: VEHICULO_EXTERNO },
  })
  @ApiBadRequestResponse({
    description:
      'Datos inválidos: patente, marca o modelo vacíos, año anterior a 1900, tipo inexistente o precio diario no positivo',
  })
  @ApiConflictResponse({
    description:
      'Ya existe un vehículo o una solicitud de incorporación con esa patente',
  })
  @ApiUnauthorizedResponse({ description: 'Token ausente, inválido o vencido' })
  @ApiForbiddenResponse({ description: 'Requiere el rol CLIENTE' })
  registrar(
    @Body() dto: CrearVehiculoExternoDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.vehiculosExternosService.registrar(dto, request.user);
  }

  @Get('mios')
  @SoloRoles(RolUsuario.CLIENTE)
  @ApiOperation({
    summary: 'Listar las solicitudes de incorporación propias',
    description:
      'Requiere una sesión de cliente. Devuelve solo las solicitudes del cliente del token, con su estado y el resultado de cada validación.',
  })
  @ApiOkResponse({
    description: 'Solicitudes de incorporación del cliente',
    schema: { type: 'array', example: [VEHICULO_EXTERNO] },
  })
  @ApiUnauthorizedResponse({ description: 'Token ausente, inválido o vencido' })
  @ApiForbiddenResponse({ description: 'Requiere el rol CLIENTE' })
  listarMios(@Req() request: AuthenticatedRequest) {
    return this.vehiculosExternosService.listarMios(request.user);
  }
}
