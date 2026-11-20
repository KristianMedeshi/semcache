import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { DialogProxyService } from './dialog-proxy.service';
import { GatewayCreateDialogDto, GatewaySendMessageDto } from './dto/gateway-dialogs.dto';

@Controller('dialogs')
export class GatewayDialogsController {
  constructor(private readonly dialogProxyService: DialogProxyService) {}

  @Post()
  async createDialog(
    @Body() body: GatewayCreateDialogDto,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    await this.dialogProxyService.forwardDialogRequest(req, res, '/dialogs', body);
  }

  @Get()
  async listDialogs(@Req() req: Request, @Res() res: Response): Promise<void> {
    await this.dialogProxyService.forwardDialogRequest(req, res, '/dialogs');
  }

  @Get(':id/messages')
  async getMessages(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    await this.dialogProxyService.forwardDialogRequest(req, res, `/dialogs/${id}/messages`);
  }

  @Post(':id/messages')
  async sendMessage(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: GatewaySendMessageDto,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    await this.dialogProxyService.forwardDialogRequest(req, res, `/dialogs/${id}/messages`, body);
  }
}
