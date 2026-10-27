import logging
import os
import time

import grpc

from app.generated import customer_pb2, customer_pb2_grpc

log = logging.getLogger(__name__)


class CustomerClient:
    """Cliente gRPC mínimo para obtener el documento del cliente que pide la incorporación.

    La validación de titularidad es asíncrona, pero el documento vive en el
    Customer Service; se consulta por gRPC en el momento de validar.
    """

    def __init__(self, url: str | None = None, timeout: float = 5, intentos: int = 3):
        self.url = url or os.environ.get("CUSTOMER_SERVICE_URL", "localhost:50052")
        self.timeout = timeout
        self.intentos = intentos
        self.canal = grpc.insecure_channel(self.url)
        self.stub = customer_pb2_grpc.CustomerServiceStub(self.canal)

    def documento(self, cliente_id: int) -> str:
        for intento in range(1, self.intentos + 1):
            try:
                cliente = self.stub.BuscarClientePorId(
                    customer_pb2.ClienteId(id=cliente_id), timeout=self.timeout
                )
                return cliente.documento
            except grpc.RpcError as error:
                if error.code() == grpc.StatusCode.NOT_FOUND:
                    raise
                if intento == self.intentos:
                    raise
                log.warning(
                    "Customer Service no respondió (intento %s/%s): %s",
                    intento,
                    self.intentos,
                    error.code(),
                )
                time.sleep(1)

    def cerrar(self):
        self.canal.close()
