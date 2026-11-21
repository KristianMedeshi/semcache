import {
  Body,
  Controller,
  Get,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import { Can } from '@nestjs/authorization';
import { SERVICE_TCP_PATTERNS } from '@semcache/shared-types';
import type { Request, Response } from 'express';
import { GatewayAccessPolicy } from '../auth/policies/gateway-access.policy';
import { DialogProxyService } from './dialog-proxy.service';
import { GatewayCreateDialogDto, GatewaySendMessageDto } from './dto/gateway-dialogs.dto';

@Can(GatewayAccessPolicy, 'accessDialogs')
@Controller('dialogs')
export class GatewayDialogsController {
  constructor(private readonly dialogProxyService: DialogProxyService) {}

  @Post()
  async createDialog(
    @Body() body: GatewayCreateDialogDto,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    await this.dialogProxyService.forwardDialogRequest(
      req,
      res,
      SERVICE_TCP_PATTERNS.DIALOGS_CREATE,
      {
        body,
        statusCode: HttpStatus.CREATED,
      },
    );
  }

  @Get()
  async listDialogs(@Req() req: Request, @Res() res: Response): Promise<void> {
    await this.dialogProxyService.forwardDialogRequest(
      req,
      res,
      SERVICE_TCP_PATTERNS.DIALOGS_LIST,
      {
        statusCode: HttpStatus.OK,
      },
    );
  }

  @Get(':id/messages')
  async getMessages(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    await this.dialogProxyService.forwardDialogRequest(
      req,
      res,
      SERVICE_TCP_PATTERNS.DIALOGS_MESSAGES_LIST,
      {
        dialogId: id,
        statusCode: HttpStatus.OK,
      },
    );
  }

  @Post(':id/messages')
  async sendMessage(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: GatewaySendMessageDto,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    await this.dialogProxyService.forwardDialogRequest(
      req,
      res,
      SERVICE_TCP_PATTERNS.DIALOGS_MESSAGES_SEND,
      {
        dialogId: id,
        body,
        statusCode: HttpStatus.OK,
      },
    );
  }

  @Post(':id/messages/stream')
  async streamMessage(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: GatewaySendMessageDto,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    await this.dialogProxyService.streamDialogRequest(
      req,
      res,
      SERVICE_TCP_PATTERNS.DIALOGS_MESSAGES_STREAM,
      {
        dialogId: id,
        body,
      },
    );
  }
}
