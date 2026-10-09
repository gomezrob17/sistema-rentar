# Se construye desde la raíz del repo (ver docker-compose.yml).
# Replica la estructura del repo para usar el mismo comando de protoc que en desarrollo.
FROM python:3.12-slim

WORKDIR /repo/services/customer_service

COPY services/customer_service/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY proto/ /repo/proto/
COPY services/customer_service/ .
RUN python -m grpc_tools.protoc -Iapp/generated=../../proto --python_out=. --grpc_python_out=. --pyi_out=. ../../proto/customer.proto

EXPOSE 50052
CMD ["python", "-m", "app.server"]
