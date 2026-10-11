# Se construye desde la raíz del repo (ver docker-compose.yml).
FROM node:24

WORKDIR /app

COPY gateway/package.json gateway/package-lock.json ./
RUN npm ci

COPY gateway/ ./
RUN npm run build

# Contratos de los servicios gRPC (PROTO_DIR por defecto: ../proto)
COPY proto/ /proto/

EXPOSE 3000

# El gateway no tiene base de datos: todo lo resuelve por gRPC con los servicios.
CMD ["node", "dist/main"]
