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
    await this.authProxyService.forwardRequest(req, res, `/users/${id}`);
  }

  @Patch(':id')
  async updateUser(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: GatewayUpdateProfileDto,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    await this.authProxyService.forwardRequest(req, res, `/users/${id}`, body);
  }
}

@Controller('admin/users')
export class GatewayAdminUsersController {
  constructor(private readonly authProxyService: AuthProxyService) {}

  @Get()
  async listUsers(@Req() req: Request, @Res() res: Response): Promise<void> {
    await this.authProxyService.forwardRequest(req, res, '/admin/users');
  }

  @Delete(':id/sessions')
  async revokeUserSessions(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    await this.authProxyService.forwardRequest(req, res, `/admin/users/${id}/sessions`);
  }
}
