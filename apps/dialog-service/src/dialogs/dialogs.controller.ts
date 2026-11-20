import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import type {
  DialogMessageResponseDto,
  DialogResponseDto,
  SendMessageResponseDto,
} from '@semcache/shared-dtos';
import type { AuthenticatedUser } from '@semcache/shared-types';
import { CurrentInternalUser, InternalAuthGuard } from '../auth/internal-auth.guard';
import { DialogsService } from './dialogs.service';
import { CreateDialogDto, SendMessageDto } from './dto/dialog.dto';

@Controller('dialogs')
@UseGuards(InternalAuthGuard)
export class DialogsController {
  constructor(private readonly dialogsService: DialogsService) {}

  @Post()
  async createDialog(
    @CurrentInternalUser() user: AuthenticatedUser,
    @Body() dto: CreateDialogDto,
  ): Promise<DialogResponseDto> {
    return this.dialogsService.createDialog(user.id, dto);
  }

  @Get()
  async listDialogs(@CurrentInternalUser() user: AuthenticatedUser): Promise<DialogResponseDto[]> {
    return this.dialogsService.listUserDialogs(user.id);
  }

  @Get(':id/messages')
  async getMessages(
    @CurrentInternalUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<DialogMessageResponseDto[]> {
    return this.dialogsService.getDialogMessages(user.id, id);
  }

  @Post(':id/messages')
  @HttpCode(HttpStatus.OK)
  async sendMessage(
    @CurrentInternalUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SendMessageDto,
  ): Promise<SendMessageResponseDto> {
    return this.dialogsService.sendMessage(user.id, id, dto);
  }
}
