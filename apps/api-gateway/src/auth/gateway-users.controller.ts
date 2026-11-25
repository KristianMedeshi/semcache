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
import { ApiCookieAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { RevokeUserSessionsResponseDto, UserResponseDto } from '@semcache/shared-dtos';
import { SERVICE_TCP_PATTERNS } from '@semcache/shared-types';
import type { Request, Response } from 'express';
import { ApiStandardErrors, ApiUuidParam } from '../common/swagger/api-responses.decorator';
import { SWAGGER_COOKIE_AUTH_NAME } from '../swagger';
import { AuthProxyService } from './auth-proxy.service';
import {
  GatewayUpdateProfileDto,
  RevokeUserSessionsResponseSwaggerDto,
  UserResponseSwaggerDto,
} from './dto/gateway-auth.dto';
import { forwardAuthWithCookie, toAuthForwardContext } from './gateway-auth.controller';
import { GatewayAccessPolicy } from './policies/gateway-access.policy';

@ApiTags('Users')
@ApiCookieAuth(SWAGGER_COOKIE_AUTH_NAME)
@Public()
@Can(GatewayAccessPolicy, 'proxyAuthRequest')
@Controller('users')
export class GatewayUsersController {
  constructor(private readonly authProxyService: AuthProxyService) {}

  @Get(':id')
  @ApiOperation({ summary: 'Get a user profile by ID (self or admin)' })
  @ApiUuidParam('id', 'Target user UUID')
  @ApiOkResponse({ description: 'User profile', type: UserResponseSwaggerDto })
  @ApiStandardErrors({ badRequest: true, auth: true, forbidden: true, notFound: true })
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
  @ApiOperation({ summary: 'Update a user email or password (self or admin)' })
  @ApiUuidParam('id', 'Target user UUID')
  @ApiOkResponse({
    description: 'Updated user profile (rotates session cookie if own password changed)',
    type: UserResponseSwaggerDto,
  })
  @ApiStandardErrors({
    badRequest: true,
    auth: true,
    forbidden: true,
    notFound: true,
    conflict: true,
  })
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

@ApiTags('Admin Users')
@ApiCookieAuth(SWAGGER_COOKIE_AUTH_NAME)
@Public()
@Can(GatewayAccessPolicy, 'proxyAuthRequest')
@Controller('admin/users')
export class GatewayAdminUsersController {
  constructor(private readonly authProxyService: AuthProxyService) {}

  @Get()
  @ApiOperation({ summary: 'List all user accounts (admin only)' })
  @ApiOkResponse({ description: 'List of all users', type: [UserResponseSwaggerDto] })
  @ApiStandardErrors({ auth: true, forbidden: true })
  async listUsers(@Req() req: Request): Promise<UserResponseDto[]> {
    const result = await this.authProxyService.forwardRequest<UserResponseDto[]>(
      toAuthForwardContext(req),
      SERVICE_TCP_PATTERNS.ADMIN_USERS_LIST,
    );
    return result.data;
  }

  @Delete(':id/sessions')
  @ApiOperation({ summary: 'Revoke all active sessions for a user (admin only)' })
  @ApiUuidParam('id', 'Target user UUID')
  @ApiOkResponse({
    description: 'Revoked session count',
    type: RevokeUserSessionsResponseSwaggerDto,
  })
  @ApiStandardErrors({ badRequest: true, auth: true, forbidden: true, notFound: true })
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
