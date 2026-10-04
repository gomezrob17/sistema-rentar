import { Injectable } from '@nestjs/common';
import { VehicleClient } from '../grpc/vehicle.client';
import { CrearVehiculoDto } from './dto/crear-vehiculo.dto';
import { ActualizarVehiculoDto } from './dto/actualizar-vehiculo.dto';
import { EstadoVehiculo } from './vehiculo.enums';

// Las reglas de los vehículos (patente única, baja lógica, estado) viven en el
// Vehicle Service. Acá solo se adaptan los datos y se delega por gRPC.
@Injectable()
export class VehiculosService {
  constructor(private readonly vehiculos: VehicleClient) {}

  crear(dto: CrearVehiculoDto) {
    // El precio viaja como texto para no perder precisión
    return this.vehiculos.crear({
      ...dto,
      precioDiario: String(dto.precioDiario),
    });
  }

  listar() {
    return this.vehiculos.listar();
  }

  buscarPorId(id: number) {
    return this.vehiculos.buscarPorId(id);
  }

  actualizar(id: number, dto: ActualizarVehiculoDto) {
    // La patente no viene en el DTO de actualización, así que no se puede modificar
    return this.vehiculos.actualizar(id, {
      ...dto,
      precioDiario: dto.precioDiario?.toString(),
    });
  }

  eliminar(id: number) {
    // Baja: no se borra el registro, el servicio lo marca como inactivo
    return this.vehiculos.darDeBaja(id);
  }

  actualizarEstado(id: number, estado: EstadoVehiculo) {
    return this.vehiculos.actualizarEstado(id, estado);
  }
}
