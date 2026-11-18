import { Body, Controller, Get, Post, Req, Res } from '@nestjs/common';
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
    await this.authProxyService.forwardRequest(req, res, '/auth/register', body);
  }

  @Post('login')
  async login(
    @Body() body: GatewayLoginDto,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    await this.authProxyService.forwardRequest(req, res, '/auth/login', body);
  }

  @Post('logout')
  async logout(@Req() req: Request, @Res() res: Response): Promise<void> {
    await this.authProxyService.forwardRequest(req, res, '/auth/logout');
  }

  @Get('me')
  async me(@Req() req: Request, @Res() res: Response): Promise<void> {
    await this.authProxyService.forwardRequest(req, res, '/auth/me');
  }
}
