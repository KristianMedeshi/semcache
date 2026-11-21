import { Body, Controller, Get, HttpStatus, Post, Req, Res } from '@nestjs/common';
import { SERVICE_TCP_PATTERNS } from '@semcache/shared-types';
import type { Request, Response } from 'express';
import { AuthProxyService } from './auth-proxy.service';
import { GatewayLoginDto, GatewayRegisterDto } from './dto/gateway-auth.dto';

@Controller('auth')
export class GatewayAuthController {
  constructor(private readonly authProxyService: AuthProxyService) {}

  @Post('register')
  async register(
    @Body() body: GatewayRegisterDto,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    await this.authProxyService.forwardRequest(req, res, SERVICE_TCP_PATTERNS.AUTH_REGISTER, {
      body,
      statusCode: HttpStatus.CREATED,
    });
  }

  @Post('login')
  async login(
    @Body() body: GatewayLoginDto,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    await this.authProxyService.forwardRequest(req, res, SERVICE_TCP_PATTERNS.AUTH_LOGIN, {
      body,
      statusCode: HttpStatus.OK,
    });
  }

  @Post('logout')
  async logout(@Req() req: Request, @Res() res: Response): Promise<void> {
    await this.authProxyService.forwardRequest(req, res, SERVICE_TCP_PATTERNS.AUTH_LOGOUT, {
      statusCode: HttpStatus.OK,
    });
  }

  @Get('me')
  async me(@Req() req: Request, @Res() res: Response): Promise<void> {
    await this.authProxyService.forwardRequest(req, res, SERVICE_TCP_PATTERNS.AUTH_ME, {
      statusCode: HttpStatus.OK,
    });
  }
}
