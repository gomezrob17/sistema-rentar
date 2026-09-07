import type { TipoVehiculo } from '../types/vehiculo'

export interface ModeloCatalogo { nombre: string; tipo: TipoVehiculo }
export interface MarcaCatalogo { marca: string; modelos: ModeloCatalogo[] }

export const CATALOGO: MarcaCatalogo[] = [
  { marca: 'Toyota', modelos: [
    { nombre: 'Corolla', tipo: 'SEDAN' }, { nombre: 'Etios', tipo: 'HATCHBACK' }, { nombre: 'Yaris', tipo: 'HATCHBACK' },
    { nombre: 'Hilux', tipo: 'PICKUP' }, { nombre: 'SW4', tipo: 'SUV' }, { nombre: 'Corolla Cross', tipo: 'SUV' } ] },
  { marca: 'Volkswagen', modelos: [
    { nombre: 'Gol', tipo: 'HATCHBACK' }, { nombre: 'Polo', tipo: 'HATCHBACK' }, { nombre: 'Virtus', tipo: 'SEDAN' },
    { nombre: 'Vento', tipo: 'SEDAN' }, { nombre: 'Amarok', tipo: 'PICKUP' }, { nombre: 'Taos', tipo: 'SUV' } ] },
  { marca: 'Ford', modelos: [
    { nombre: 'Ka', tipo: 'HATCHBACK' }, { nombre: 'Fiesta', tipo: 'HATCHBACK' }, { nombre: 'Focus', tipo: 'SEDAN' },
    { nombre: 'Ranger', tipo: 'PICKUP' }, { nombre: 'EcoSport', tipo: 'SUV' }, { nombre: 'Territory', tipo: 'SUV' } ] },
  { marca: 'Chevrolet', modelos: [
    { nombre: 'Onix', tipo: 'HATCHBACK' }, { nombre: 'Onix Plus', tipo: 'SEDAN' }, { nombre: 'Cruze', tipo: 'SEDAN' },
    { nombre: 'S10', tipo: 'PICKUP' }, { nombre: 'Tracker', tipo: 'SUV' }, { nombre: 'Spin', tipo: 'SUV' } ] },
  { marca: 'Renault', modelos: [
    { nombre: 'Kwid', tipo: 'HATCHBACK' }, { nombre: 'Sandero', tipo: 'HATCHBACK' }, { nombre: 'Logan', tipo: 'SEDAN' },
    { nombre: 'Duster', tipo: 'SUV' }, { nombre: 'Oroch', tipo: 'PICKUP' }, { nombre: 'Koleos', tipo: 'SUV' } ] },
  { marca: 'Fiat', modelos: [
    { nombre: 'Mobi', tipo: 'HATCHBACK' }, { nombre: 'Argo', tipo: 'HATCHBACK' }, { nombre: 'Cronos', tipo: 'SEDAN' },
    { nombre: 'Toro', tipo: 'PICKUP' }, { nombre: 'Pulse', tipo: 'SUV' }, { nombre: 'Fastback', tipo: 'COUPE' } ] },
  { marca: 'Peugeot', modelos: [
    { nombre: '208', tipo: 'HATCHBACK' }, { nombre: '301', tipo: 'SEDAN' }, { nombre: '408', tipo: 'SEDAN' },
    { nombre: '2008', tipo: 'SUV' }, { nombre: '3008', tipo: 'SUV' }, { nombre: 'Landtrek', tipo: 'PICKUP' } ] },
  { marca: 'Citroën', modelos: [
    { nombre: 'C3', tipo: 'HATCHBACK' }, { nombre: 'C4 Cactus', tipo: 'SUV' }, { nombre: 'C3 Aircross', tipo: 'SUV' },
    { nombre: 'C-Elysée', tipo: 'SEDAN' }, { nombre: 'Berlingo', tipo: 'SUV' }, { nombre: 'C4', tipo: 'SEDAN' } ] },
  { marca: 'Nissan', modelos: [
    { nombre: 'March', tipo: 'HATCHBACK' }, { nombre: 'Versa', tipo: 'SEDAN' }, { nombre: 'Sentra', tipo: 'SEDAN' },
    { nombre: 'Kicks', tipo: 'SUV' }, { nombre: 'X-Trail', tipo: 'SUV' }, { nombre: 'Frontier', tipo: 'PICKUP' } ] },
  { marca: 'Honda', modelos: [
    { nombre: 'Fit', tipo: 'HATCHBACK' }, { nombre: 'City', tipo: 'SEDAN' }, { nombre: 'Civic', tipo: 'SEDAN' },
    { nombre: 'HR-V', tipo: 'SUV' }, { nombre: 'CR-V', tipo: 'SUV' }, { nombre: 'WR-V', tipo: 'SUV' } ] },
  { marca: 'Jeep', modelos: [
    { nombre: 'Renegade', tipo: 'SUV' }, { nombre: 'Compass', tipo: 'SUV' }, { nombre: 'Commander', tipo: 'SUV' },
    { nombre: 'Wrangler', tipo: 'SUV' }, { nombre: 'Cherokee', tipo: 'SUV' }, { nombre: 'Gladiator', tipo: 'PICKUP' } ] },
  { marca: 'Hyundai', modelos: [
    { nombre: 'HB20', tipo: 'HATCHBACK' }, { nombre: 'Accent', tipo: 'SEDAN' }, { nombre: 'Elantra', tipo: 'SEDAN' },
    { nombre: 'Creta', tipo: 'SUV' }, { nombre: 'Tucson', tipo: 'SUV' }, { nombre: 'Santa Fe', tipo: 'SUV' } ] },
  { marca: 'Kia', modelos: [
    { nombre: 'Picanto', tipo: 'HATCHBACK' }, { nombre: 'Rio', tipo: 'SEDAN' }, { nombre: 'Cerato', tipo: 'SEDAN' },
    { nombre: 'Seltos', tipo: 'SUV' }, { nombre: 'Sportage', tipo: 'SUV' }, { nombre: 'Sorento', tipo: 'SUV' } ] },
  { marca: 'Suzuki', modelos: [
    { nombre: 'Swift', tipo: 'HATCHBACK' }, { nombre: 'Baleno', tipo: 'HATCHBACK' }, { nombre: 'Ciaz', tipo: 'SEDAN' },
    { nombre: 'Vitara', tipo: 'SUV' }, { nombre: 'S-Cross', tipo: 'SUV' }, { nombre: 'Jimny', tipo: 'SUV' } ] },
  { marca: 'Mercedes-Benz', modelos: [
    { nombre: 'Clase A', tipo: 'HATCHBACK' }, { nombre: 'Clase C', tipo: 'SEDAN' }, { nombre: 'Clase E', tipo: 'SEDAN' },
    { nombre: 'CLA', tipo: 'COUPE' }, { nombre: 'GLA', tipo: 'SUV' }, { nombre: 'GLC', tipo: 'SUV' } ] },
]

// Modelos de una marca
export function modelosDe(marca: string): ModeloCatalogo[] {
  return CATALOGO.find((m) => m.marca === marca)?.modelos ?? []
}
// Sugerido para un modelo (ejemplo: Corolla -> SEDAN)
export function tipoDe(marca: string, modelo: string): TipoVehiculo | undefined {
  return modelosDe(marca).find((m) => m.nombre === modelo)?.tipo
}