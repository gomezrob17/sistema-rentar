"""Mensajería por eventos de Rentar (Hito 3) sobre RabbitMQ.

Una sola copia en el repo: cada Dockerfile la copia a /repo/messaging, igual que proto/.

- El cuerpo del mensaje es exactamente el payload JSON del enunciado.
- La identificación del evento viaja en las propiedades AMQP: message_id (UUID),
  type (la routing key), timestamp, content_type y correlation_id si corresponde.
"""

import json
import logging
import os
import time
import uuid

import pika
from pika.exceptions import AMQPConnectionError, AMQPError

log = logging.getLogger("messaging")
# pika loguea cada intento fallido con traceback; los reintentos ya se informan acá.
logging.getLogger("pika").setLevel(logging.CRITICAL)

EXCHANGE = "rentar.eventos"
# Los mensajes que un consumidor rechaza terminan acá, en vez de reintentarse para siempre.
DLX = "rentar.eventos.dlx"
COLA_MUERTOS = "rentar.eventos.dead"

VERIFICACION_SOLICITADA = "vehiculos.verificacion.solicitada"
VERIFICACION_RESULTADO = "vehiculos.verificacion.resultado"
RESERVA_CONFIRMADA = "reserva.confirmada"
MANTENIMIENTO_RESULTADO = "mantenimiento.resultado"

# Hito 3, incorporación de vehículos de propietarios externos.
EXTERNOS_REGISTRADOS = "vehiculos.externos.registrados"
EXTERNOS_VALIDACION_PATENTE = "vehiculos.externos.validacion.patente"
EXTERNOS_VALIDACION_TITULARIDAD = "vehiculos.externos.validacion.titularidad"
EXTERNOS_VALIDACION_COMPLETADA = "vehiculos.externos.validacion.completada"

# Colas durables de los consumidores implementados (<servicio>.<responsabilidad>) con sus
# bindings. Todos los servicios las declaran al arrancar: así un evento publicado antes de
# que arranque su consumidor queda guardado en la cola en vez de descartarse por no tener destino.
COLAS = {
    "maintenance_service.reserva.confirmada": [RESERVA_CONFIRMADA],
    "rental_service.mantenimiento.resultado": [MANTENIMIENTO_RESULTADO],
    f"verification_service.{VERIFICACION_SOLICITADA}": [VERIFICACION_SOLICITADA],
    f"vehicle_service.{VERIFICACION_RESULTADO}": [VERIFICACION_RESULTADO],
    # Las dos validaciones del vehículo externo son consumidores independientes.
    "verification_service.vehiculos.externos.patente": [EXTERNOS_REGISTRADOS],
    "verification_service.vehiculos.externos.titularidad": [EXTERNOS_REGISTRADOS],
    # El correlador recibe los dos resultados por la misma cola.
    "vehicle_service.vehiculos.externos.validaciones": [
        EXTERNOS_VALIDACION_PATENTE,
        EXTERNOS_VALIDACION_TITULARIDAD,
    ],
    "vehicle_service.vehiculos.externos.completadas": [EXTERNOS_VALIDACION_COMPLETADA],
}

URL = os.environ.get("RABBITMQ_URL", "amqp://rentar:rentar@localhost:55672/%2F")


def conectar(intentos: int = 30, espera: float = 2) -> pika.BlockingConnection:
    """Abre una conexión. Reintenta porque el broker puede tardar en arrancar."""
    for intento in range(1, intentos + 1):
        try:
            return pika.BlockingConnection(pika.URLParameters(URL))
        except AMQPConnectionError:
            if intento == intentos:
                raise
            log.warning("RabbitMQ no disponible (intento %s/%s), reintentando", intento, intentos)
            time.sleep(espera)


def _declarar_cola(canal, cola: str, routing_keys: list[str]) -> None:
    canal.queue_declare(cola, durable=True, arguments={"x-dead-letter-exchange": DLX})
    for routing_key in routing_keys:
        canal.queue_bind(cola, EXCHANGE, routing_key)


def declarar_topologia(canal=None) -> None:
    """Declara exchanges, colas y bindings. Es idempotente: se puede llamar en cada arranque."""
    if canal is None:
        with conectar() as conexion:
            return declarar_topologia(conexion.channel())
    canal.exchange_declare(EXCHANGE, "topic", durable=True)
    canal.exchange_declare(DLX, "fanout", durable=True)
    canal.queue_declare(COLA_MUERTOS, durable=True)
    canal.queue_bind(COLA_MUERTOS, DLX)
    for cola, routing_keys in COLAS.items():
        _declarar_cola(canal, cola, routing_keys)


def publicar(routing_key: str, payload: dict, correlation_id: str | None = None) -> str:
    """Publica un evento persistente y espera la confirmación del broker. Devuelve su message_id.

    Falla si el broker no responde o si ninguna cola recibe el evento (mandatory).
    """
    message_id = str(uuid.uuid4())
    propiedades = pika.BasicProperties(
        content_type="application/json",
        delivery_mode=pika.DeliveryMode.Persistent,
        message_id=message_id,
        type=routing_key,
        timestamp=int(time.time()),
        correlation_id=correlation_id,
    )
    # ponytail: una conexión por evento (pocos por minuto). Una conexión ociosa compartida
    # entre hilos de gRPC necesitaría lock y manejo de heartbeats.
    with conectar(intentos=1) as conexion:
        canal = conexion.channel()
        canal.confirm_delivery()
        canal.basic_publish(
            EXCHANGE, routing_key, json.dumps(payload).encode(), propiedades, mandatory=True
        )
    log.info("Publicado %s message_id=%s correlation_id=%s %s", routing_key, message_id, correlation_id, payload)
    return message_id


def consumir(cola: str, routing_keys: list[str], handler) -> None:
    """Consume la cola para siempre, reconectando si se cae el broker.

    handler(payload, propiedades) procesa un evento. Si termina bien el mensaje se confirma
    (ack); si lanza una excepción se rechaza sin reencolar y va a la cola de muertos.
    RabbitMQ entrega at-least-once: el handler tiene que tolerar el mismo evento dos veces.
    """

    def al_recibir(canal, entrega, propiedades, cuerpo):
        try:
            handler(json.loads(cuerpo), propiedades)
        except Exception:
            log.exception("Error procesando %s %s; va a %s", cola, propiedades.message_id, COLA_MUERTOS)
            canal.basic_nack(entrega.delivery_tag, requeue=False)
        else:
            canal.basic_ack(entrega.delivery_tag)

    while True:
        try:
            with conectar() as conexion:
                canal = conexion.channel()
                declarar_topologia(canal)
                _declarar_cola(canal, cola, routing_keys)
                # De a un mensaje por vez: el siguiente llega recién después del ack.
                canal.basic_qos(prefetch_count=1)
                canal.basic_consume(cola, al_recibir)
                log.info("Consumiendo %s", cola)
                canal.start_consuming()
        except AMQPError as error:
            log.warning("Se cortó la conexión con RabbitMQ consumiendo %s (%r), reconectando", cola, error)
            time.sleep(2)
