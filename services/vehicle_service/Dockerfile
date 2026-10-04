# Se construye desde la raíz del repo (ver docker-compose.yml).
# Replica la estructura del repo para usar el mismo comando de protoc que en desarrollo.
FROM python:3.12-slim

WORKDIR /repo/services/vehicle_service

COPY services/vehicle_service/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY proto/ /repo/proto/
COPY services/vehicle_service/ .
RUN python -m grpc_tools.protoc -Iapp/generated=../../proto --python_out=. --grpc_python_out=. --pyi_out=. ../../proto/vehicle.proto

EXPOSE 50051
CMD ["python", "-m", "app.server"]
