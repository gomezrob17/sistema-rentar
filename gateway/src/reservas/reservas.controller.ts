import {
  Body,
  Controller,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { RolUsuario, type AuthPayload } from '../auth/auth.types';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SoloRoles } from '../auth/roles.guard';
import { ApiErroresServicio } from '../grpc/api-errores-servicio';
import { ReservasService } from './reservas.service';
import { CrearReservaDto } from './dto/crear-reserva.dto';

@ApiTags('Reservas')
@ApiErroresServicio('Rental Service')
@Controller('reservas') // Las rutas de aca arrancan con /reservas
export class ReservasController {
  constructor(private readonly reservasService: ReservasService) {}

  @Post()
  @SoloRoles(RolUsuario.CLIENTE)
  @ApiOperation({
    summary: 'Crear una reserva de un vehículo',
    description:
      'Requiere un cliente autenticado. La reserva queda a nombre del cliente del token, nunca de un id enviado en el cuerpo. El API Gateway valida las fechas, el Customer Service que el cliente esté activo y el Vehicle Service que el vehículo exista y esté activo; el Rental Service verifica que el vehículo no tenga otra reserva CONFIRMADA en el período y calcula el importe con el precio diario vigente (cada fracción de 24 horas cuenta como un día).',
  })
  @ApiCreatedResponse({
    description: 'Reserva CONFIRMADA, con mantenimiento PENDIENTE. La respuesta no espera al taller ni al broker. El resultado se consulta en reservas o historialAlquileres (GraphQL).',
    schema: {
      type: 'object',
      example: {
        id: 4,
        clienteId: 4,
        vehiculoId: 4,
        fechaInicio: '2026-10-20T10:00:00.000Z',
        fechaFin: '2026-10-23T10:00:00.000Z',
        precioDiario: '21000',
        importeTotal: '63000',
        estado: 'CONFIRMADA',
        mantenimiento: 'PENDIENTE',
        createdAt: '2026-10-11T16:00:31.000Z',
        updatedAt: '2026-10-11T16:00:31.000Z',
      },
    },
  })
  @ApiBadRequestResponse({
    description:
      'Datos inválidos, fecha de fin no posterior a la de inicio, inicio en el pasado, cliente o vehículo dado de baja, vehículo inhabilitado por denuncia de robo o ya reservado en el período',
  })
  @ApiNotFoundResponse({ description: 'El vehículo no existe' })
  crear(
    @Body() dto: CrearReservaDto,
    @Req() request: Request & { user: AuthPayload },
  ) {
    return this.reservasService.crear(dto, request.user);
  }

  @Patch(':id/cancelar')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Cancelar una reserva propia antes del inicio del alquiler',
    description:
      'Requiere un cliente autenticado. Conserva la reserva en la base, cambia su estado a CANCELADA y libera ese período para nuevas reservas. No recibe cuerpo.',
  })
  @ApiParam({
    name: 'id',
    type: Number,
    description: 'Identificador de la reserva propia',
  })
  @ApiOkResponse({
    description: 'Reserva cancelada',
    schema: {
      type: 'object',
      required: ['id', 'estado'],
      properties: {
        id: { type: 'integer', example: 1 },
        estado: { type: 'string', enum: ['CANCELADA'] },
      },
    },
  })
  @ApiBadRequestResponse({
    description: 'Identificador inválido o alquiler ya iniciado',
  })
  @ApiUnauthorizedResponse({ description: 'Token ausente, inválido o vencido' })
  @ApiForbiddenResponse({
    description: 'La sesión no corresponde a un cliente',
  })
  @ApiNotFoundResponse({
    description: 'La reserva no existe o pertenece a otro cliente',
  })
  @ApiConflictResponse({
    description:
      'La reserva no está confirmada o cambió durante la cancelación',
  })
  cancelar(
    @Param('id', ParseIntPipe) id: number,
    @Req() request: Request & { user: AuthPayload },
  ) {
    return this.reservasService.cancelar(id, request.user);
  }
}
