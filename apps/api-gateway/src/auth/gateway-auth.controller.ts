import { Body, Controller, Get, HttpCode, HttpStatus, Post, Req, Res } from '@nestjs/common';
import { Public } from '@nestjs/authentication';
import { Can } from '@nestjs/authorization';
import type { LogoutResponseDto, UserResponseDto } from '@semcache/shared-dtos';
import { SERVICE_TCP_PATTERNS } from '@semcache/shared-types';
import type { Request, Response } from 'express';
import { type AuthForwardContext, AuthProxyService } from './auth-proxy.service';
import { GatewayLoginDto, GatewayRegisterDto } from './dto/gateway-auth.dto';
import { GatewayAccessPolicy } from './policies/gateway-access.policy';

export function toAuthForwardContext(req: Request): AuthForwardContext {
  return {
    headers: req.headers,
    method: req.method,
    ip: req.ip,
  };
}

export async function forwardAuthWithCookie<T>(
  authProxyService: AuthProxyService,
  req: Request,
  res: Response,
  pattern: string,
  options?: { id?: string; body?: unknown },
): Promise<T> {
  const result = await authProxyService.forwardRequest<T>(
    toAuthForwardContext(req),
    pattern,
    options,
  );
  if (result.setCookie) {
    res.setHeader('set-cookie', [result.setCookie]);
  }
  return result.data;
}

@Public()
@Controller('auth')
export class GatewayAuthController {
  constructor(private readonly authProxyService: AuthProxyService) {}

  @Post('register')
  async register(
    @Body() body: GatewayRegisterDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<UserResponseDto> {
    return forwardAuthWithCookie<UserResponseDto>(
      this.authProxyService,
      req,
      res,
      SERVICE_TCP_PATTERNS.AUTH_REGISTER,
      { body },
    );
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() body: GatewayLoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<UserResponseDto> {
    return forwardAuthWithCookie<UserResponseDto>(
      this.authProxyService,
      req,
      res,
      SERVICE_TCP_PATTERNS.AUTH_LOGIN,
      { body },
    );
  }

  @Can(GatewayAccessPolicy, 'proxyAuthRequest')
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<LogoutResponseDto> {
    return forwardAuthWithCookie<LogoutResponseDto>(
      this.authProxyService,
      req,
      res,
      SERVICE_TCP_PATTERNS.AUTH_LOGOUT,
    );
  }

  @Can(GatewayAccessPolicy, 'proxyAuthRequest')
  @Get('me')
  async me(@Req() req: Request): Promise<UserResponseDto> {
    const result = await this.authProxyService.forwardRequest<UserResponseDto>(
      toAuthForwardContext(req),
      SERVICE_TCP_PATTERNS.AUTH_ME,
    );
    return result.data;
  }
}
