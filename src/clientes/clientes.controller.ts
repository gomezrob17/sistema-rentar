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
import { ClientesService } from './clientes.service';
import { CrearClienteDto } from './dto/crear-cliente.dto';
import { ActualizarClienteDto } from './dto/actualizar-cliente.dto';

@ApiTags('Clientes')
@Controller('clientes')
export class ClientesController {
  constructor(private readonly clientesService: ClientesService) {}

  @Post()
  @ApiOperation({ summary: 'Dar de alta un cliente' })
  crear(@Body() dto: CrearClienteDto) {
    return this.clientesService.crear(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Listar todos los clientes' })
  listar() {
    return this.clientesService.listar();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Consultar un cliente por id' })
  buscarPorId(@Param('id', ParseIntPipe) id: number) {
    return this.clientesService.buscarPorId(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Modificar un cliente' })
  actualizar(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ActualizarClienteDto,
  ) {
    return this.clientesService.actualizar(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Baja lógica de un cliente' })
  eliminar(@Param('id', ParseIntPipe) id: number) {
    return this.clientesService.eliminar(id);
  }
}