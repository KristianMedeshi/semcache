import { Controller, ParseUUIDPipe, UseGuards } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import type {
  DialogMessageResponseDto,
  DialogResponseDto,
  SendMessageResponseDto,
} from '@semcache/shared-dtos';
import { type AuthenticatedUser, SERVICE_TCP_PATTERNS } from '@semcache/shared-types';
import { CurrentInternalUser, InternalAuthGuard } from '../auth/internal-auth.guard';
import { DialogsService } from './dialogs.service';
import { CreateDialogDto, SendMessageDto } from './dto/dialog.dto';

@Controller()
@UseGuards(InternalAuthGuard)
export class DialogsController {
  constructor(private readonly dialogsService: DialogsService) {}

  @MessagePattern(SERVICE_TCP_PATTERNS.DIALOGS_CREATE)
  async createDialog(
    @CurrentInternalUser() user: AuthenticatedUser,
    @Payload('body') dto: CreateDialogDto,
  ): Promise<DialogResponseDto> {
    return this.dialogsService.createDialog(user.id, dto);
  }

  @MessagePattern(SERVICE_TCP_PATTERNS.DIALOGS_LIST)
  async listDialogs(@CurrentInternalUser() user: AuthenticatedUser): Promise<DialogResponseDto[]> {
    return this.dialogsService.listUserDialogs(user.id);
  }

  @MessagePattern(SERVICE_TCP_PATTERNS.DIALOGS_MESSAGES_LIST)
  async getMessages(
    @CurrentInternalUser() user: AuthenticatedUser,
    @Payload('dialogId', ParseUUIDPipe) id: string,
  ): Promise<DialogMessageResponseDto[]> {
    return this.dialogsService.getDialogMessages(user.id, id);
  }

  @MessagePattern(SERVICE_TCP_PATTERNS.DIALOGS_MESSAGES_SEND)
  async sendMessage(
    @CurrentInternalUser() user: AuthenticatedUser,
    @Payload('dialogId', ParseUUIDPipe) id: string,
    @Payload('body') dto: SendMessageDto,
  ): Promise<SendMessageResponseDto> {
    return this.dialogsService.sendMessage(user.id, id, dto);
  }
}
