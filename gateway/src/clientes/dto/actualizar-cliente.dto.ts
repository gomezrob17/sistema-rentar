import { PartialType } from '@nestjs/swagger';
import { CrearClienteDto } from './crear-cliente.dto';

export class ActualizarClienteDto extends PartialType(CrearClienteDto) {}