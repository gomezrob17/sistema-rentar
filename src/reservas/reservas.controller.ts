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
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { Request } from 'express';
import type { AuthPayload } from '../auth/auth.types';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ReservasService } from './reservas.service';
import { CrearReservaDto } from './dto/crear-reserva.dto';

@ApiTags('Reservas')
@Controller('reservas') // Las rutas de aca arrancan con /reservas
export class ReservasController {
  constructor(private readonly reservasService: ReservasService) {}

  @Post()
  @ApiOperation({ summary: 'Crear una reserva de un vehículo' })
  crear(@Body() dto: CrearReservaDto) {
    return this.reservasService.crear(dto);
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
