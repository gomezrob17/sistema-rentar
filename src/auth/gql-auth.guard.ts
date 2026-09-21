import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import type { AuthPayload } from './auth.types';

type RequestWithUser = Request & { user?: AuthPayload };

@Injectable()
export class GqlAuthGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  canActivate(context: ExecutionContext): boolean {
    const ctx = GqlExecutionContext.create(context);
    const request = ctx.getContext<{ req: RequestWithUser }>().req;

    const authorization = request.headers.authorization;
    const token = authorization?.startsWith('Bearer ')
      ? authorization.slice(7)
      : undefined;

    if (!token) {
      throw new UnauthorizedException('Falta el token de autenticación');
    }

    try {
      request.user = this.jwtService.verify<AuthPayload>(token);
      return true;
    } catch {
      throw new UnauthorizedException('El token de autenticación no es válido');
    }
  }
}