import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Req,
  Res,
} from '@nestjs/common';
import { Public } from '@nestjs/authentication';
import { Can } from '@nestjs/authorization';
import type { RevokeUserSessionsResponseDto, UserResponseDto } from '@semcache/shared-dtos';
import { SERVICE_TCP_PATTERNS } from '@semcache/shared-types';
import type { Request, Response } from 'express';
import { AuthProxyService } from './auth-proxy.service';
import { GatewayUpdateProfileDto } from './dto/gateway-auth.dto';
import { forwardAuthWithCookie, toAuthForwardContext } from './gateway-auth.controller';
import { GatewayAccessPolicy } from './policies/gateway-access.policy';

@Public()
@Can(GatewayAccessPolicy, 'proxyAuthRequest')
@Controller('users')
export class GatewayUsersController {
  constructor(private readonly authProxyService: AuthProxyService) {}

  @Get(':id')
  async getUser(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: Request,
  ): Promise<UserResponseDto> {
    const result = await this.authProxyService.forwardRequest<UserResponseDto>(
      toAuthForwardContext(req),
      SERVICE_TCP_PATTERNS.USERS_GET,
      { id },
    );
    return result.data;
  }

  @Patch(':id')
  async updateUser(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: GatewayUpdateProfileDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<UserResponseDto> {
    return forwardAuthWithCookie<UserResponseDto>(
      this.authProxyService,
      req,
      res,
      SERVICE_TCP_PATTERNS.USERS_UPDATE,
      { id, body },
    );
  }
}

@Public()
@Can(GatewayAccessPolicy, 'proxyAuthRequest')
@Controller('admin/users')
export class GatewayAdminUsersController {
  constructor(private readonly authProxyService: AuthProxyService) {}

  @Get()
  async listUsers(@Req() req: Request): Promise<UserResponseDto[]> {
    const result = await this.authProxyService.forwardRequest<UserResponseDto[]>(
      toAuthForwardContext(req),
      SERVICE_TCP_PATTERNS.ADMIN_USERS_LIST,
    );
    return result.data;
  }

  @Delete(':id/sessions')
  async revokeUserSessions(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: Request,
  ): Promise<RevokeUserSessionsResponseDto> {
    const result = await this.authProxyService.forwardRequest<RevokeUserSessionsResponseDto>(
      toAuthForwardContext(req),
      SERVICE_TCP_PATTERNS.ADMIN_USERS_REVOKE_SESSIONS,
      { id },
    );
    return result.data;
  }
}
