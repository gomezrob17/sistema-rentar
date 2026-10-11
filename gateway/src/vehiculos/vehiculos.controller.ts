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
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { RolUsuario } from '../auth/auth.types';
import { SoloRoles } from '../auth/roles.guard';
import { ApiErroresServicio } from '../grpc/api-errores-servicio';
import { VehiculosService } from './vehiculos.service';
import { CrearVehiculoDto } from './dto/crear-vehiculo.dto';
import { ActualizarVehiculoDto } from './dto/actualizar-vehiculo.dto';
import { ActualizarEstadoVehiculoDto } from './dto/actualizar-estado-vehiculo.dto';

// Ejemplo de la respuesta: el precio viaja como texto decimal y color solo aparece si se cargó.
const VEHICULO = {
  id: 4,
  patente: 'AE321KL',
  marca: 'Renault',
  modelo: 'Kwid',
  anio: 2024,
  tipo: 'HATCHBACK',
  precioDiario: '20000',
  estado: 'DISPONIBLE',
  activo: true,
  createdAt: '2026-10-11T15:59:28.829Z',
  updatedAt: '2026-10-11T15:59:28.829Z',
  color: 'Blanco',
};
const ID_VEHICULO = {
  name: 'id',
  type: Number,
  description: 'Identificador del vehículo',
};
const ID_INVALIDO = 'Identificador no numérico';
const NO_EXISTE = 'El vehículo no existe';

// Consultar la flota es público (la página de inicio la muestra sin sesión);
// dar de alta, modificar, cambiar el estado y dar de baja es del administrador.
@ApiTags('Vehículos')
@ApiErroresServicio('Vehicle Service')
@Controller('vehiculos') // Las rutas de aca arrancan con /vehiculos
export class VehiculosController {
  constructor(private readonly vehiculosService: VehiculosService) {}

  @Post()
  @SoloRoles(RolUsuario.ADMIN)
  @ApiOperation({
    summary: 'Dar de alta un vehículo',
    description:
      'Requiere el rol ADMIN. El vehículo queda en estado DISPONIBLE y activo. La patente es única y no se puede modificar después.',
  })
  @ApiCreatedResponse({
    description: 'Vehículo creado',
    schema: { type: 'object', example: VEHICULO },
  })
  @ApiBadRequestResponse({
    description:
      'Datos inválidos: patente, marca o modelo vacíos, año anterior a 1900, tipo inexistente o precio diario no positivo',
  })
  @ApiConflictResponse({ description: 'Ya existe un vehículo con esa patente' })
  crear(@Body() dto: CrearVehiculoDto) {
    return this.vehiculosService.crear(dto);
  }

  @Get()
  @ApiOperation({
    summary: 'Listar todos los vehículos',
    description:
      'Público. Devuelve todos los vehículos ordenados por id, incluidos los dados de baja (activo = false).',
  })
  @ApiOkResponse({
    description: 'Lista de vehículos',
    schema: { type: 'array', example: [VEHICULO] },
  })
  listar() {
    return this.vehiculosService.listar();
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Consultar un vehículo por id',
    description: 'Público. Devuelve el vehículo esté activo o dado de baja.',
  })
  @ApiParam(ID_VEHICULO)
  @ApiOkResponse({
    description: 'Vehículo encontrado',
    schema: { type: 'object', example: VEHICULO },
  })
  @ApiBadRequestResponse({ description: ID_INVALIDO })
  @ApiNotFoundResponse({ description: NO_EXISTE })
  buscarPorId(@Param('id', ParseIntPipe) id: number) {
    return this.vehiculosService.buscarPorId(id);
  }

  @Patch(':id')
  @SoloRoles(RolUsuario.ADMIN)
  @ApiOperation({
    summary: 'Modificar un vehículo',
    description:
      'Requiere el rol ADMIN. Edición parcial: solo cambia los campos enviados, con las mismas validaciones que el alta. La patente no se puede modificar y, si se envía, se ignora.',
  })
  @ApiParam(ID_VEHICULO)
  @ApiOkResponse({
    description: 'Vehículo actualizado',
    schema: {
      type: 'object',
      example: { ...VEHICULO, precioDiario: '21000', color: 'Negro' },
    },
  })
  @ApiBadRequestResponse({ description: `${ID_INVALIDO} o datos inválidos` })
  @ApiNotFoundResponse({ description: NO_EXISTE })
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
      'Requiere el rol ADMIN. Pasa el vehículo a DISPONIBLE, RESERVADO o EN_ALQUILER. Solo los vehículos activos y DISPONIBLE se ofrecen en la consulta de disponibilidad.',
  })
  @ApiParam(ID_VEHICULO)
  @ApiOkResponse({
    description: 'Vehículo con el nuevo estado',
    schema: { type: 'object', example: { ...VEHICULO, estado: 'RESERVADO' } },
  })
  @ApiBadRequestResponse({
    description: `${ID_INVALIDO}, estado inválido o vehículo dado de baja`,
  })
  @ApiNotFoundResponse({ description: NO_EXISTE })
  actualizarEstado(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ActualizarEstadoVehiculoDto,
  ) {
    return this.vehiculosService.actualizarEstado(id, dto.estado);
  }

  @Delete(':id')
  @SoloRoles(RolUsuario.ADMIN)
  @ApiOperation({
    summary: 'Baja lógica de un vehículo',
    description:
      'Requiere el rol ADMIN. No borra el registro: el vehículo pasa a activo = false, se conserva con sus reservas y deja de ofrecerse en la disponibilidad.',
  })
  @ApiParam(ID_VEHICULO)
  @ApiOkResponse({
    description: 'Vehículo dado de baja',
    schema: { type: 'object', example: { ...VEHICULO, activo: false } },
  })
  @ApiBadRequestResponse({ description: ID_INVALIDO })
  @ApiNotFoundResponse({ description: NO_EXISTE })
  eliminar(@Param('id', ParseIntPipe) id: number) {
    return this.vehiculosService.eliminar(id);
  }
}
