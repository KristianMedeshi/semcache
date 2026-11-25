import { Body, Controller, Get, HttpCode, HttpStatus, Post, Req, Res } from '@nestjs/common';
import { Public } from '@nestjs/authentication';
import { Can } from '@nestjs/authorization';
import {
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { LogoutResponseDto, UserResponseDto } from '@semcache/shared-dtos';
import { SERVICE_TCP_PATTERNS } from '@semcache/shared-types';
import type { Request, Response } from 'express';
import { ApiStandardErrors } from '../common/swagger/api-responses.decorator';
import { SWAGGER_COOKIE_AUTH_NAME } from '../swagger';
import { type AuthForwardContext, AuthProxyService } from './auth-proxy.service';
import {
  GatewayLoginDto,
  GatewayRegisterDto,
  LogoutResponseSwaggerDto,
  UserResponseSwaggerDto,
} from './dto/gateway-auth.dto';
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

@ApiTags('Auth')
@Public()
@Controller('auth')
export class GatewayAuthController {
  constructor(private readonly authProxyService: AuthProxyService) {}

  @Post('register')
  @ApiOperation({ summary: 'Register a new customer account and issue a session cookie' })
  @ApiCreatedResponse({
    description: 'Customer registered and session cookie set',
    type: UserResponseSwaggerDto,
    headers: { 'Set-Cookie': { description: 'HttpOnly session cookie', schema: { type: 'string' } } },
  })
  @ApiStandardErrors({ badRequest: true, forbidden: true, conflict: true, tooManyRequests: true })
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
  @ApiOperation({ summary: 'Authenticate with email and password and issue a session cookie' })
  @ApiOkResponse({
    description: 'Authenticated user profile with Set-Cookie header',
    type: UserResponseSwaggerDto,
    headers: { 'Set-Cookie': { description: 'HttpOnly session cookie', schema: { type: 'string' } } },
  })
  @ApiStandardErrors({ badRequest: true, auth: true, forbidden: true, tooManyRequests: true })
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
  @ApiCookieAuth(SWAGGER_COOKIE_AUTH_NAME)
  @ApiOperation({ summary: 'Invalidate the current session and clear the session cookie' })
  @ApiOkResponse({
    description: 'Session terminated',
    type: LogoutResponseSwaggerDto,
    headers: { 'Set-Cookie': { description: 'Cleared session cookie', schema: { type: 'string' } } },
  })
  @ApiStandardErrors({ auth: true, forbidden: true })
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
  @ApiCookieAuth(SWAGGER_COOKIE_AUTH_NAME)
  @ApiOperation({ summary: 'Get the currently authenticated user profile' })
  @ApiOkResponse({ description: 'Current authenticated user', type: UserResponseSwaggerDto })
  @ApiStandardErrors({ auth: true })
  async me(@Req() req: Request): Promise<UserResponseDto> {
    const result = await this.authProxyService.forwardRequest<UserResponseDto>(
      toAuthForwardContext(req),
      SERVICE_TCP_PATTERNS.AUTH_ME,
    );
    return result.data;
  }
}
