import os
from concurrent import futures

import grpc
from grpc_health.v1 import health, health_pb2, health_pb2_grpc
from grpc_reflection.v1alpha import reflection

from app.db import Base, Session, engine
from app.generated.rentar.clientes.v1 import customer_pb2, customer_pb2_grpc
from app.servicer import CustomerServicer, asegurar_admin


def main():
    # ponytail: crea la tabla si no existe, sin migraciones. Pasar a Alembic si el esquema empieza a cambiar.
    Base.metadata.create_all(engine)

    # El administrador vive en la base como cualquier usuario. Sus credenciales
    # iniciales llegan por variables de entorno (ver docker-compose.yml).
    admin_email, admin_password = os.environ.get("ADMIN_EMAIL"), os.environ.get("ADMIN_PASSWORD")
    if admin_email and admin_password and asegurar_admin(Session, admin_email, admin_password):
        print(f"Usuario administrador creado: {admin_email}", flush=True)

    servidor = grpc.server(futures.ThreadPoolExecutor(max_workers=10))
    customer_pb2_grpc.add_CustomerServiceServicer_to_server(CustomerServicer(Session), servidor)

    # Health check (lo usa docker compose) y reflection (para probar con grpcurl).
    nombre = customer_pb2.DESCRIPTOR.services_by_name["CustomerService"].full_name
    salud = health.HealthServicer()
    salud.set("", health_pb2.HealthCheckResponse.SERVING)
    salud.set(nombre, health_pb2.HealthCheckResponse.SERVING)
    health_pb2_grpc.add_HealthServicer_to_server(salud, servidor)
    reflection.enable_server_reflection(
        (nombre, health.SERVICE_NAME, reflection.SERVICE_NAME), servidor
    )

    puerto = os.environ.get("GRPC_PORT", "50052")
    servidor.add_insecure_port(f"[::]:{puerto}")
    servidor.start()
    print(f"Customer Service escuchando en el puerto {puerto}", flush=True)
    servidor.wait_for_termination()


if __name__ == "__main__":
    main()
