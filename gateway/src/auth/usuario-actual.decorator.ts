import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import type { AuthPayload } from './auth.types';


export const UsuarioActual = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthPayload => {
    const ctx = GqlExecutionContext.create(context);
    return ctx.getContext<{ req: { user: AuthPayload } }>().req.user;
  },
);