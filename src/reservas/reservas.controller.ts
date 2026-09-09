import { Body, Controller, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
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
}
