import logging

from messaging import COLAS, VERIFICACION_SOLICITADA, consumir, declarar_topologia, publicar

from app.db import Base, Session, cargar_denuncias, crear_base_si_no_existe, engine
from app.handler import procesar_solicitud

COLA = f"verification_service.{VERIFICACION_SOLICITADA}"


def main():
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")

    crear_base_si_no_existe()
    # ponytail: crea la tabla si no existe, sin migraciones, igual que los otros servicios.
    Base.metadata.create_all(engine)
    cargar_denuncias(Session)

    declarar_topologia()
    print("Verification Service esperando pedidos de verificación", flush=True)

    # El resultado lleva como correlation_id el message_id del pedido que lo originó.
    consumir(
        COLA,
        COLAS[COLA],
        lambda evento, propiedades: procesar_solicitud(
            Session, publicar, evento, propiedades.correlation_id or propiedades.message_id
        ),
    )


if __name__ == "__main__":
    main()
