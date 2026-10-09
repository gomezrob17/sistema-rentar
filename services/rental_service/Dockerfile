# Se construye desde la raíz del repo (ver docker-compose.yml).
# Replica la estructura del repo para usar el mismo comando de protoc que en desarrollo.
FROM python:3.12-slim

WORKDIR /repo/services/rental_service

COPY services/rental_service/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY proto/ /repo/proto/
COPY services/rental_service/ .
RUN python -m grpc_tools.protoc -Iapp/generated=../../proto --python_out=. --grpc_python_out=. --pyi_out=. ../../proto/rental.proto

EXPOSE 50053
CMD ["python", "-m", "app.server"]
