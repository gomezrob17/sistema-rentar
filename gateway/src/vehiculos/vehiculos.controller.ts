import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { VehiculosService } from './vehiculos.service';
import { CrearVehiculoDto } from './dto/crear-vehiculo.dto';
import { ActualizarVehiculoDto } from './dto/actualizar-vehiculo.dto';

@ApiTags('Vehículos')
@Controller('vehiculos') // Las rutas de aca arrancan con /vehiculos
export class VehiculosController {
  constructor(private readonly vehiculosService: VehiculosService) {}

  @Post()
  @ApiOperation({ summary: 'Dar de alta un vehículo' })
  crear(@Body() dto: CrearVehiculoDto) {
    return this.vehiculosService.crear(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Listar todos los vehículos' })
  listar() {
    return this.vehiculosService.listar();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Consultar un vehículo por id' })
  buscarPorId(@Param('id', ParseIntPipe) id: number) {
    return this.vehiculosService.buscarPorId(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Modificar un vehículo' })
  actualizar(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ActualizarVehiculoDto,
  ) {
    return this.vehiculosService.actualizar(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Baja lógica de un vehículo' })
  eliminar(@Param('id', ParseIntPipe) id: number) {
    return this.vehiculosService.eliminar(id);
  }
}