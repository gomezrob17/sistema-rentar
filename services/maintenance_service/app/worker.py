import logging
import os
import threading
import time

from messaging import COLAS, consumir, declarar_topologia, publicar
from app.db import Base, Session, crear_base_si_no_existe, engine
from app.handler import procesar_pendientes, publicar_resultados, registrar_solicitud

log = logging.getLogger(__name__)


def ejecutar_taller(no_realizados):
    while True:
        try:
            procesar_pendientes(Session, no_realizados)
            declarar_topologia()
            publicar_resultados(Session, publicar)
        except Exception:
            log.exception("Taller: operación pendiente; se reintentará")
        time.sleep(2)


def main():
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
    demora = float(os.environ.get("MANTENIMIENTO_DEMORA_SEGUNDOS", "2"))
    if not 0 <= demora <= 3600:
        raise ValueError("MANTENIMIENTO_DEMORA_SEGUNDOS debe estar entre 0 y 3600")
    no_realizados = {int(i.strip()) for i in os.environ.get("MANTENIMIENTO_VEHICULOS_NO_REALIZADOS", "").split(",") if i.strip()}
    crear_base_si_no_existe()
    Base.metadata.create_all(engine)
    threading.Thread(target=ejecutar_taller, args=(no_realizados,), daemon=True).start()
    cola = "maintenance_service.reserva.confirmada"
    consumir(cola, COLAS[cola], lambda evento, _: registrar_solicitud(Session, evento, demora))


if __name__ == "__main__":
    main()
