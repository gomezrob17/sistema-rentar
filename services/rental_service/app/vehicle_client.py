"""Cliente gRPC mínimo del Rental Service hacia el Vehicle Service.

Solo se usa desde el consumidor de averías, en segundo plano. El contrato es
proto/rentar/vehiculos/v1/vehicle.proto (BuscarVehiculoSustituto).
"""

import os
from dataclasses import dataclass

import grpc

from app.generated.rentar.vehiculos.v1 import vehicle_pb2 as pb
from app.generated.rentar.vehiculos.v1 import vehicle_pb2_grpc as pb_grpc

VEHICLE_SERVICE_URL = os.environ.get("VEHICLE_SERVICE_URL", "localhost:50051")
DEADLINE_SEGUNDOS = float(os.environ.get("VEHICLE_GRPC_DEADLINE_SEGUNDOS", "5"))


@dataclass(frozen=True)
class Sustituto:
    id: int
    patente: str
    marca: str
    modelo: str
    tipo: str
    precio_diario: str


def buscar_sustituto(
    vehiculo_id: int,
    fecha_inicio: str,
    fecha_fin: str,
    excluidos: list[int],
) -> Sustituto | None:
    """Pide al Vehicle Service el mejor reemplazo compatible, o None.

    Se abre una conexión por mensaje: el consumidor procesa pocos eventos y así
    no hay que compartir un canal entre hilos ni manejar heartbeats.
    """
    with grpc.insecure_channel(VEHICLE_SERVICE_URL) as canal:
        stub = pb_grpc.VehicleServiceStub(canal)
        respuesta = stub.BuscarVehiculoSustituto(
            pb.BuscarVehiculoSustitutoRequest(
                vehiculo_id=vehiculo_id,
                fecha_inicio=fecha_inicio,
                fecha_fin=fecha_fin,
                excluidos=excluidos,
            ),
            timeout=DEADLINE_SEGUNDOS,
        )

    if not respuesta.HasField("vehiculo"):
        return None
    v = respuesta.vehiculo
    return Sustituto(
        id=v.id,
        patente=v.patente,
        marca=v.marca,
        modelo=v.modelo,
        tipo=v.tipo,
        precio_diario=v.precio_diario,
    )
