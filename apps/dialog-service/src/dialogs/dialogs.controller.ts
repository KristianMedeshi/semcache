import { Controller, ParseUUIDPipe } from '@nestjs/common';
import { CurrentUser } from '@nestjs/authentication';
import { Can } from '@nestjs/authorization';
import { MessagePattern, Payload } from '@nestjs/microservices';
import type {
  DialogMessageResponseDto,
  DialogMessageStreamEventDto,
  DialogResponseDto,
  SendMessageResponseDto,
} from '@semcache/shared-dtos';
import { type AuthenticatedUser, SERVICE_TCP_PATTERNS } from '@semcache/shared-types';
import type { Observable } from 'rxjs';
import { DialogsService } from './dialogs.service';
import { CreateDialogDto, SendMessageDto } from './dto/dialog.dto';
import { DialogPolicy } from './policies/dialog.policy';

@Controller()
export class DialogsController {
  constructor(private readonly dialogsService: DialogsService) {}

  @Can(DialogPolicy, 'create')
  @MessagePattern(SERVICE_TCP_PATTERNS.DIALOGS_CREATE)
  async createDialog(
    @CurrentUser() user: AuthenticatedUser,
    @Payload('body') dto: CreateDialogDto,
  ): Promise<DialogResponseDto> {
    return this.dialogsService.createDialog(user.id, dto);
  }

  @Can(DialogPolicy, 'list')
  @MessagePattern(SERVICE_TCP_PATTERNS.DIALOGS_LIST)
  async listDialogs(@CurrentUser() user: AuthenticatedUser): Promise<DialogResponseDto[]> {
    return this.dialogsService.listUserDialogs(user.id);
  }

  @Can(DialogPolicy, 'viewMessages')
  @MessagePattern(SERVICE_TCP_PATTERNS.DIALOGS_MESSAGES_LIST)
  async getMessages(
    @CurrentUser() user: AuthenticatedUser,
    @Payload('dialogId', ParseUUIDPipe) id: string,
  ): Promise<DialogMessageResponseDto[]> {
    return this.dialogsService.getDialogMessages(user.id, id);
  }

  @Can(DialogPolicy, 'sendMessage')
  @MessagePattern(SERVICE_TCP_PATTERNS.DIALOGS_MESSAGES_SEND)
  async sendMessage(
    @CurrentUser() user: AuthenticatedUser,
    @Payload('dialogId', ParseUUIDPipe) id: string,
    @Payload('body') dto: SendMessageDto,
  ): Promise<SendMessageResponseDto> {
    return this.dialogsService.sendMessage(user.id, id, dto);
  }

  @Can(DialogPolicy, 'streamMessage')
  @MessagePattern(SERVICE_TCP_PATTERNS.DIALOGS_MESSAGES_STREAM)
  streamMessage(
    @CurrentUser() user: AuthenticatedUser,
    @Payload('dialogId', ParseUUIDPipe) id: string,
    @Payload('body') dto: SendMessageDto,
  ): Observable<DialogMessageStreamEventDto> {
    return this.dialogsService.streamMessage(user.id, id, dto);
  }
}
