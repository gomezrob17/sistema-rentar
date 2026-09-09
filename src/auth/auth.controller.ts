import {
  Body,
  Controller,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { AuthPayload } from './auth.types';
import { AuthService } from './auth.service';
import { CambiarPasswordDto } from './dto/cambiar-password.dto';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from './jwt-auth.guard';

type AuthenticatedRequest = Request & { user: AuthPayload };

@ApiTags('Autenticación')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Patch('password')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  cambiarPassword(
    @Req() request: AuthenticatedRequest,
    @Body() dto: CambiarPasswordDto,
  ) {
    return this.authService.cambiarPassword(request.user.sub, dto);
  }
}