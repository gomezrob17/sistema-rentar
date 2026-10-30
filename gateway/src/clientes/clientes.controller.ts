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
import { ClientesService } from './clientes.service';
import { CrearClienteDto } from './dto/crear-cliente.dto';
import { ActualizarClienteDto } from './dto/actualizar-cliente.dto';

// Ejemplo de la respuesta: telefono y fechaNacimiento solo aparecen si se cargaron.
const CLIENTE = {
  id: 4,
  documento: '40123456',
  nombre: 'Camila',
  apellido: 'Torres',
  email: 'camila.torres@example.test',
  activo: true,
  createdAt: '2026-10-11T15:59:58.114Z',
  updatedAt: '2026-10-11T15:59:58.114Z',
  telefono: '1155550004',
  fechaNacimiento: '1997-03-14T00:00:00.000Z',
};
const CON_CONTRASENA = { ...CLIENTE, contrasenaTemporal: 'Usuario4*' };
const ID_CLIENTE = {
  name: 'id',
  type: Number,
  description: 'Identificador del cliente',
};
const ID_INVALIDO = 'Identificador no numérico';
const NO_EXISTE = 'El cliente no existe';

// Toda la gestión de clientes (incluye las contraseñas temporales) es del administrador.
@ApiTags('Clientes')
@SoloRoles(RolUsuario.ADMIN)
@ApiErroresServicio('Customer Service')
@Controller('clientes')
export class ClientesController {
  constructor(private readonly clientesService: ClientesService) {}

  @Post()
  @ApiOperation({
    summary: 'Dar de alta un cliente',
    description:
      'Requiere el rol ADMIN. Crea el cliente activo y, en la misma operación, su usuario con rol CLIENTE, el email del cliente y la contraseña temporal Usuario{id}*.',
  })
  @ApiCreatedResponse({
    description: 'Cliente creado, con la contraseña temporal de su usuario',
    schema: { type: 'object', example: CON_CONTRASENA },
  })
  @ApiBadRequestResponse({
    description:
      'Datos inválidos: documento, nombre o apellido vacíos, email con formato inválido o fecha de nacimiento inválida',
  })
  @ApiConflictResponse({
    description: 'Ya existe un cliente con ese documento o email',
  })
  crear(@Body() dto: CrearClienteDto) {
    return this.clientesService.crear(dto);
  }

  @Get()
  @ApiOperation({
    summary: 'Listar todos los clientes',
    description:
      'Requiere el rol ADMIN. Devuelve todos los clientes ordenados por id, incluidos los dados de baja, con la contraseña temporal de cada uno.',
  })
  @ApiOkResponse({
    description: 'Lista de clientes',
    schema: { type: 'array', example: [CON_CONTRASENA] },
  })
  listar() {
    return this.clientesService.listar();
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Consultar un cliente por id',
    description:
      'Requiere el rol ADMIN. Devuelve el cliente esté activo o dado de baja.',
  })
  @ApiParam(ID_CLIENTE)
  @ApiOkResponse({
    description: 'Cliente encontrado',
    schema: { type: 'object', example: CLIENTE },
  })
  @ApiBadRequestResponse({ description: ID_INVALIDO })
  @ApiNotFoundResponse({ description: NO_EXISTE })
  buscarPorId(@Param('id', ParseIntPipe) id: number) {
    return this.clientesService.buscarPorId(id);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Modificar un cliente',
    description:
      'Requiere el rol ADMIN. Edición parcial: solo cambia los campos enviados, con las mismas validaciones que el alta. Si cambia el email, también se actualiza el del usuario con el que el cliente inicia sesión.',
  })
  @ApiParam(ID_CLIENTE)
  @ApiOkResponse({
    description: 'Cliente actualizado',
    schema: { type: 'object', example: { ...CLIENTE, telefono: '1155559999' } },
  })
  @ApiBadRequestResponse({ description: `${ID_INVALIDO} o datos inválidos` })
  @ApiNotFoundResponse({ description: NO_EXISTE })
  @ApiConflictResponse({
    description: 'El documento o el email ya pertenecen a otro cliente',
  })
  actualizar(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ActualizarClienteDto,
  ) {
    return this.clientesService.actualizar(id, dto);
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Baja lógica de un cliente',
    description:
      'Requiere el rol ADMIN. No borra el registro: el cliente pasa a activo = false y conserva su historial, pero ya no puede iniciar sesión ni hacer reservas.',
  })
  @ApiParam(ID_CLIENTE)
  @ApiOkResponse({
    description: 'Cliente dado de baja',
    schema: { type: 'object', example: { ...CLIENTE, activo: false } },
  })
  @ApiBadRequestResponse({ description: ID_INVALIDO })
  @ApiNotFoundResponse({ description: NO_EXISTE })
  eliminar(@Param('id', ParseIntPipe) id: number) {
    return this.clientesService.eliminar(id);
  }
}
