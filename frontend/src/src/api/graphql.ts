import { http } from './http'

// POST a /graphql con la consulta en el cuerpo
// Esta función manda la consulta y devuelve solo los datos (o tira error si falla algo)
export async function graphqlRequest<T>(
  query: string,
  variables?: Record<string, unknown>,
): Promise<T> {
  const respuesta = await http.post('/graphql', { query, variables })

  if (respuesta.data.errors) {
    // Si el backend devolvió errores de GraphQL, mostramos el primero
    throw new Error(respuesta.data.errors[0].message)
  }

  return respuesta.data.data as T
}