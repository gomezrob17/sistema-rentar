import { Query, Resolver } from '@nestjs/graphql';

// Resolver mínimo para que GraphQL tenga al menos una consulta.
// Sirve como "ping" para verificar que la API está viva.
@Resolver()
export class HealthResolver {
  @Query(() => String)
  ping(): string {
    return 'pong';
  }
}