-- Una base por servicio interno (Hito 2 y 3).
-- Postgres solo ejecuta este script cuando el volumen está vacío. Con un volumen ya
-- existente, el Verification Service crea su base al arrancar si no existe.
CREATE DATABASE rentar_vehiculos;
CREATE DATABASE rentar_clientes;
CREATE DATABASE rentar_alquileres;
CREATE DATABASE rentar_verificaciones;
