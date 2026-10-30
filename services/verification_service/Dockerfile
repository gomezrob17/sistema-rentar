# Se construye desde la raíz del repo (ver docker-compose.yml).
# Worker de eventos. Usa gRPC como cliente del Customer Service para validar
# la titularidad y el módulo compartido de mensajería para los eventos.
FROM python:3.12-slim

WORKDIR /repo/services/verification_service

COPY services/verification_service/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY proto/ /repo/proto/
# Módulo compartido de mensajería (RabbitMQ), importable como `messaging`.
COPY messaging/ /repo/messaging/
ENV PYTHONPATH=/repo
COPY services/verification_service/ .
RUN python -m grpc_tools.protoc -Iapp/generated=../../proto --python_out=. --grpc_python_out=. --pyi_out=. ../../proto/rentar/clientes/v1/customer.proto

CMD ["python", "-m", "app.worker"]
