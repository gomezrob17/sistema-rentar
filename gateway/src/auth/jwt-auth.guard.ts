import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { AuthPayload } from './auth.types';

type RequestWithUser = Request & { user?: AuthPayload };

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<RequestWithUser>();
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