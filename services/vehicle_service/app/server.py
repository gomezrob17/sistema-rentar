import os
from concurrent import futures

import grpc
from grpc_health.v1 import health, health_pb2, health_pb2_grpc
from grpc_reflection.v1alpha import reflection

from app.db import Base, Session, engine
from app.generated import vehicle_pb2, vehicle_pb2_grpc
from app.servicer import VehicleServicer


def main():
    # ponytail: crea la tabla si no existe, sin migraciones. Pasar a Alembic si el esquema empieza a cambiar.
    Base.metadata.create_all(engine)

    servidor = grpc.server(futures.ThreadPoolExecutor(max_workers=10))
    vehicle_pb2_grpc.add_VehicleServiceServicer_to_server(VehicleServicer(Session), servidor)

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
