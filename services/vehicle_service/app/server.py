import logging
import os
import threading
from concurrent import futures

import grpc
from grpc_health.v1 import health, health_pb2, health_pb2_grpc
from grpc_reflection.v1alpha import reflection
from messaging import (
    COLAS,
    EXTERNOS_VALIDACION_PATENTE,
    EXTERNOS_VALIDACION_TITULARIDAD,
    VERIFICACION_RESULTADO,
    consumir,
    declarar_topologia,
    publicar,
)

from app.db import Base, Session, engine, migrar
from app.generated.rentar.vehiculos.v1 import vehicle_pb2, vehicle_pb2_grpc
from app.handler import (
    procesar_incorporacion,
    procesar_resultado,
    procesar_validacion_patente,
    procesar_validacion_titularidad,
)
from app.servicer import VehicleServicer

COLA_RESULTADOS = f"vehicle_service.{VERIFICACION_RESULTADO}"
COLA_VALIDACIONES = "vehicle_service.vehiculos.externos.validaciones"
COLA_COMPLETADAS = "vehicle_service.vehiculos.externos.completadas"


def al_recibir_validacion(evento, propiedades):
    correlation_id = propiedades.correlation_id or propiedades.message_id
    if propiedades.type == EXTERNOS_VALIDACION_PATENTE:
        procesar_validacion_patente(Session, publicar, evento, correlation_id)
    elif propiedades.type == EXTERNOS_VALIDACION_TITULARIDAD:
        procesar_validacion_titularidad(Session, publicar, evento, correlation_id)
    else:
        raise ValueError(f"Evento de validación externa desconocido: {propiedades.type!r}")


def main():
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")

    # ponytail: crea la tabla si no existe, sin migraciones. Pasar a Alembic si el esquema empieza a cambiar.
    Base.metadata.create_all(engine)
    # Columna de Hito 3 sobre una tabla ya existente.
    migrar()

    # Topología declarada antes de atender pedidos: el primer alta ya tiene cola de destino.
    declarar_topologia()
    # Cada consumidor corre en su propio hilo y con su propia conexión.
    threading.Thread(
        target=consumir,
        args=(COLA_RESULTADOS, COLAS[COLA_RESULTADOS], lambda evento, _: procesar_resultado(Session, evento)),
        daemon=True,
    ).start()
    # Resultados de las dos validaciones del vehículo externo (correlador).
    threading.Thread(
        target=consumir,
        args=(COLA_VALIDACIONES, COLAS[COLA_VALIDACIONES], al_recibir_validacion),
        daemon=True,
    ).start()
    # Solicitud de incorporación cuando las dos validaciones dieron VALIDADO.
    threading.Thread(
        target=consumir,
        args=(
            COLA_COMPLETADAS,
            COLAS[COLA_COMPLETADAS],
            lambda evento, _: procesar_incorporacion(Session, evento),
        ),
        daemon=True,
    ).start()

    servidor = grpc.server(futures.ThreadPoolExecutor(max_workers=10))
    vehicle_pb2_grpc.add_VehicleServiceServicer_to_server(VehicleServicer(Session, publicar), servidor)

    # Health check (lo usa docker compose) y reflection (para probar con grpcurl).
    nombre = vehicle_pb2.DESCRIPTOR.services_by_name["VehicleService"].full_name
    salud = health.HealthServicer()
    salud.set("", health_pb2.HealthCheckResponse.SERVING)
    salud.set(nombre, health_pb2.HealthCheckResponse.SERVING)
    health_pb2_grpc.add_HealthServicer_to_server(salud, servidor)
    reflection.enable_server_reflection(
        (nombre, health.SERVICE_NAME, reflection.SERVICE_NAME), servidor
    )

    puerto = os.environ.get("GRPC_PORT", "50051")
    servidor.add_insecure_port(f"[::]:{puerto}")
    servidor.start()
    print(f"Vehicle Service escuchando en el puerto {puerto}", flush=True)
    servidor.wait_for_termination()


if __name__ == "__main__":
    main()
