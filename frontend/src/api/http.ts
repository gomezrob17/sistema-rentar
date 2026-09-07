import axios from 'axios'

// URL de base del backend (NestJS). Realizamos la lectura del archivo .env
const baseURL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000'

// Instancia de axios que reusamos en toda la app
export const http = axios.create({
  baseURL,
  headers: { 'Content-Type': 'application/json' },
})