# Se construye desde la raíz del repo (ver docker-compose.yml).
FROM node:24

WORKDIR /app

COPY gateway/package.json gateway/package-lock.json ./
RUN npm ci

COPY gateway/ ./
RUN npx prisma generate && npm run build

# Contratos de los servicios gRPC (PROTO_DIR por defecto: ../proto)
COPY proto/ /proto/

EXPOSE 3000

# Aplica las migraciones de Prisma (transitorio hasta que el gateway deje de usar la base).
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main"]
