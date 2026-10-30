import os
import logging
import threading
from concurrent import futures

import grpc
from grpc_health.v1 import health, health_pb2, health_pb2_grpc
from grpc_reflection.v1alpha import reflection

from app.db import Base, Session, engine, migrar
from app.mantenimiento import ejecutar_publicador, registrar_resultado
from messaging import COLAS, consumir
from app.generated.rentar.alquileres.v1 import rental_pb2, rental_pb2_grpc
from app.servicer import RentalServicer


def main():
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
    # Crear tablas nuevas y aplicar el agregado compatible a las reservas existentes.
    Base.metadata.create_all(engine)
    migrar()

    # El broker y el mantenimiento nunca bloquean el servidor gRPC.
    threading.Thread(target=ejecutar_publicador, args=(Session,), daemon=True).start()
    cola = "rental_service.mantenimiento.resultado"
    threading.Thread(target=consumir, args=(
        cola, COLAS[cola], lambda evento, _: registrar_resultado(Session, evento)
    ), daemon=True).start()

    servidor = grpc.server(futures.ThreadPoolExecutor(max_workers=10))
    rental_pb2_grpc.add_RentalServiceServicer_to_server(RentalServicer(Session), servidor)

    # Health check (lo usa docker compose) y reflection (para probar con grpcurl).
    nombre = rental_pb2.DESCRIPTOR.services_by_name["RentalService"].full_name
    salud = health.HealthServicer()
    salud.set("", health_pb2.HealthCheckResponse.SERVING)
    salud.set(nombre, health_pb2.HealthCheckResponse.SERVING)
    health_pb2_grpc.add_HealthServicer_to_server(salud, servidor)
    reflection.enable_server_reflection(
        (nombre, health.SERVICE_NAME, reflection.SERVICE_NAME), servidor
    )

    puerto = os.environ.get("GRPC_PORT", "50053")
    servidor.add_insecure_port(f"[::]:{puerto}")
    servidor.start()
    print(f"Rental Service escuchando en el puerto {puerto}", flush=True)
    servidor.wait_for_termination()


if __name__ == "__main__":
    main()
