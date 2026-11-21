import {
  Body,
  Controller,
  Delete,
  Get,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Req,
  Res,
} from '@nestjs/common';
import { SERVICE_TCP_PATTERNS } from '@semcache/shared-types';
import type { Request, Response } from 'express';
import { AuthProxyService } from './auth-proxy.service';
import { GatewayUpdateProfileDto } from './dto/gateway-auth.dto';

@Controller('users')
export class GatewayUsersController {
  constructor(private readonly authProxyService: AuthProxyService) {}

  @Get(':id')
  async getUser(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    await this.authProxyService.forwardRequest(req, res, SERVICE_TCP_PATTERNS.USERS_GET, {
      id,
      statusCode: HttpStatus.OK,
    });
  }

  @Patch(':id')
  async updateUser(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: GatewayUpdateProfileDto,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    await this.authProxyService.forwardRequest(req, res, SERVICE_TCP_PATTERNS.USERS_UPDATE, {
      id,
      body,
      statusCode: HttpStatus.OK,
    });
  }
}

@Controller('admin/users')
export class GatewayAdminUsersController {
  constructor(private readonly authProxyService: AuthProxyService) {}

  @Get()
  async listUsers(@Req() req: Request, @Res() res: Response): Promise<void> {
    await this.authProxyService.forwardRequest(req, res, SERVICE_TCP_PATTERNS.ADMIN_USERS_LIST, {
      statusCode: HttpStatus.OK,
    });
  }

  @Delete(':id/sessions')
  async revokeUserSessions(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    await this.authProxyService.forwardRequest(
      req,
      res,
      SERVICE_TCP_PATTERNS.ADMIN_USERS_REVOKE_SESSIONS,
      {
        id,
        statusCode: HttpStatus.OK,
      },
    );
  }
}
