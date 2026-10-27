import logging
import threading

from messaging import COLAS, VERIFICACION_SOLICITADA, consumir, declarar_topologia, publicar

from app.customer_client import CustomerClient
from app.db import (
    Base,
    Session,
    cargar_denuncias,
    cargar_titularidades,
    crear_base_si_no_existe,
    engine,
)
from app.handler import (
    procesar_externo_patente,
    procesar_externo_titularidad,
    procesar_solicitud,
)

COLA = f"verification_service.{VERIFICACION_SOLICITADA}"
COLA_EXTERNO_PATENTE = "verification_service.vehiculos.externos.patente"
COLA_EXTERNO_TITULARIDAD = "verification_service.vehiculos.externos.titularidad"


def main():
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")

    crear_base_si_no_existe()
    # ponytail: crea la tabla si no existe, sin migraciones, igual que los otros servicios.
    Base.metadata.create_all(engine)
    cargar_denuncias(Session)
    cargar_titularidades(Session)

    declarar_topologia()
    print("Verification Service esperando pedidos de verificación", flush=True)

    customer = CustomerClient()
    # Las dos validaciones del vehículo externo son consumidores independientes:
    # cada una tiene su cola, su conexión y su propio hilo.
    threading.Thread(
        target=consumir,
        args=(
            COLA_EXTERNO_PATENTE,
            COLAS[COLA_EXTERNO_PATENTE],
            lambda evento, propiedades: procesar_externo_patente(
                Session, publicar, evento, propiedades.correlation_id or propiedades.message_id
            ),
        ),
        daemon=True,
    ).start()
    threading.Thread(
        target=consumir,
        args=(
            COLA_EXTERNO_TITULARIDAD,
            COLAS[COLA_EXTERNO_TITULARIDAD],
            lambda evento, propiedades: procesar_externo_titularidad(
                Session,
                publicar,
                customer.documento,
                evento,
                propiedades.correlation_id or propiedades.message_id,
            ),
        ),
        daemon=True,
    ).start()

    # El resultado de la verificación policial común lleva como correlation_id
    # el message_id del pedido que lo originó.
    consumir(
        COLA,
        COLAS[COLA],
        lambda evento, propiedades: procesar_solicitud(
            Session, publicar, evento, propiedades.correlation_id or propiedades.message_id
        ),
    )


if __name__ == "__main__":
    main()
