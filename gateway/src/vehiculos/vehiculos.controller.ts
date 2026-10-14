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
import { RolUsuario } from '../auth/auth.types';
import { SoloRoles } from '../auth/roles.guard';
import { VehiculosService } from './vehiculos.service';
import { CrearVehiculoDto } from './dto/crear-vehiculo.dto';
import { ActualizarVehiculoDto } from './dto/actualizar-vehiculo.dto';
import { ActualizarEstadoVehiculoDto } from './dto/actualizar-estado-vehiculo.dto';

// Consultar la flota es público (la página de inicio la muestra sin sesión);
// dar de alta, modificar, cambiar el estado y dar de baja es del administrador.
@ApiTags('Vehículos')
@Controller('vehiculos') // Las rutas de aca arrancan con /vehiculos
export class VehiculosController {
  constructor(private readonly vehiculosService: VehiculosService) {}

  @Post()
  @SoloRoles(RolUsuario.ADMIN)
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
  @SoloRoles(RolUsuario.ADMIN)
  @ApiOperation({ summary: 'Modificar un vehículo' })
  actualizar(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ActualizarVehiculoDto,
  ) {
    return this.vehiculosService.actualizar(id, dto);
  }

  @Patch(':id/estado')
  @SoloRoles(RolUsuario.ADMIN)
  @ApiOperation({
    summary: 'Cambiar el estado de un vehículo',
    description:
      'Pasa el vehículo a DISPONIBLE, RESERVADO o EN_ALQUILER. No se permite si el vehículo está dado de baja (400).',
  })
  actualizarEstado(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ActualizarEstadoVehiculoDto,
  ) {
    return this.vehiculosService.actualizarEstado(id, dto.estado);
  }

  @Delete(':id')
  @SoloRoles(RolUsuario.ADMIN)
  @ApiOperation({ summary: 'Baja lógica de un vehículo' })
  eliminar(@Param('id', ParseIntPipe) id: number) {
    return this.vehiculosService.eliminar(id);
  }
}
