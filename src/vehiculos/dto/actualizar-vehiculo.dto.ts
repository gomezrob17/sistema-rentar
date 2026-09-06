import { OmitType, PartialType } from '@nestjs/swagger';
import { CrearVehiculoDto } from './crear-vehiculo.dto';

// Reusamos las reglas del alta, pero:
// 1- PartialType: todos los campos pasan a ser opcionales (al editar se manda solo lo que cambia)
// 2- OmitType(['patente']): sacamos la patente: el TP dice que NO se puede modificar
export class ActualizarVehiculoDto extends PartialType(
  OmitType(CrearVehiculoDto, ['patente'] as const),
) {}