# Se construye desde la raíz del repo (ver docker-compose.yml).
# Worker sin gRPC: no necesita proto/, solo el módulo compartido de mensajería.
FROM python:3.12-slim

WORKDIR /repo/services/verification_service

COPY services/verification_service/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Módulo compartido de mensajería (RabbitMQ), importable como `messaging`.
COPY messaging/ /repo/messaging/
ENV PYTHONPATH=/repo
COPY services/verification_service/ .

CMD ["python", "-m", "app.worker"]
