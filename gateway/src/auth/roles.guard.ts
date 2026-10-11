import {
  applyDecorators,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
  UseGuards,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { GqlContextType, GqlExecutionContext } from '@nestjs/graphql';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { AuthPayload, RolUsuario } from './auth.types';
import { JwtAuthGuard } from './jwt-auth.guard';

const ROLES = 'roles';

// Roles que pueden ejecutar una ruta REST o una operación GraphQL.
export const Roles = (...roles: RolUsuario[]) => SetMetadata(ROLES, roles);

// Verifica el rol del usuario del token. Va después del guard de autenticación
// (JwtAuthGuard en REST, GqlAuthGuard en GraphQL), que deja el usuario en el request.
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<RolUsuario[] | undefined>(
      ROLES,
      [context.getHandler(), context.getClass()],
    );
    if (!roles?.length) return true;

    type ConUsuario = Request & { user?: AuthPayload };
    const request =
      context.getType<GqlContextType>() === 'graphql'
        ? GqlExecutionContext.create(context).getContext<{ req: ConUsuario }>()
            .req
        : context.switchToHttp().getRequest<ConUsuario>();

    const rol = request.user?.rol;
    if (!rol || !roles.includes(rol)) {
      throw new ForbiddenException(
        'No tenés permiso para realizar esta operación',
      );
    }
    return true;
  }
}

// Atajo para rutas REST: exige token válido (401) y uno de los roles (403), y lo documenta en Swagger.
export const SoloRoles = (...roles: RolUsuario[]) =>
  applyDecorators(
    Roles(...roles),
    UseGuards(JwtAuthGuard, RolesGuard),
    ApiBearerAuth(),
    ApiUnauthorizedResponse({
      description: 'Token ausente, inválido o vencido',
    }),
    ApiForbiddenResponse({
      description: `Requiere el rol ${roles.join(' o ')}`,
    }),
  );
