import logging
import os
import threading
from concurrent import futures

import grpc
from grpc_health.v1 import health, health_pb2, health_pb2_grpc
from grpc_reflection.v1alpha import reflection
from messaging import COLAS, VERIFICACION_RESULTADO, consumir, declarar_topologia, publicar

from app.db import Base, Session, engine, migrar
from app.generated import vehicle_pb2, vehicle_pb2_grpc
from app.handler import procesar_resultado
from app.servicer import VehicleServicer

COLA_RESULTADOS = f"vehicle_service.{VERIFICACION_RESULTADO}"


def main():
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")

    # ponytail: crea la tabla si no existe, sin migraciones. Pasar a Alembic si el esquema empieza a cambiar.
    Base.metadata.create_all(engine)
    # Columna de Hito 3 sobre una tabla ya existente.
    migrar()

    # Topología declarada antes de atender pedidos: el primer alta ya tiene cola de destino.
    declarar_topologia()
    # Consumidor de resultados de verificación en su propio hilo (y su propia conexión).
    threading.Thread(
        target=consumir,
        args=(COLA_RESULTADOS, COLAS[COLA_RESULTADOS], lambda evento, _: procesar_resultado(Session, evento)),
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
