import { Controller, ParseUUIDPipe } from '@nestjs/common';
import { CurrentUser } from '@nestjs/authentication';
import { Can } from '@nestjs/authorization';
import { MessagePattern, Payload } from '@nestjs/microservices';
import type {
  DeleteAllDialogsResponseDto,
  DeleteDialogResponseDto,
  DialogMessageResponseDto,
  DialogMessageStreamEventDto,
  DialogResponseDto,
  DialogStatsResponseDto,
  SendMessageResponseDto,
} from '@semcache/shared-dtos';
import { type AuthenticatedUser, SERVICE_TCP_PATTERNS } from '@semcache/shared-types';
import type { Observable } from 'rxjs';
import { DialogsService } from './dialogs.service';
import { CreateDialogDto, EditMessageDto, SendMessageDto, UpdateDialogDto } from './dto/dialog.dto';
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

  @Can(DialogPolicy, 'update')
  @MessagePattern(SERVICE_TCP_PATTERNS.DIALOGS_UPDATE)
  async updateDialog(
    @CurrentUser() user: AuthenticatedUser,
    @Payload('dialogId', ParseUUIDPipe) id: string,
    @Payload('body') dto: UpdateDialogDto,
  ): Promise<DialogResponseDto> {
    return this.dialogsService.updateDialogTitle(user.id, id, dto);
  }

  @Can(DialogPolicy, 'delete')
  @MessagePattern(SERVICE_TCP_PATTERNS.DIALOGS_DELETE)
  async deleteDialog(
    @CurrentUser() user: AuthenticatedUser,
    @Payload('dialogId', ParseUUIDPipe) id: string,
  ): Promise<DeleteDialogResponseDto> {
    return this.dialogsService.deleteDialog(user.id, id);
  }

  @Can(DialogPolicy, 'deleteAll')
  @MessagePattern(SERVICE_TCP_PATTERNS.DIALOGS_DELETE_ALL)
  async deleteAllDialogs(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<DeleteAllDialogsResponseDto> {
    return this.dialogsService.deleteAllDialogs(user.id);
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

  @Can(DialogPolicy, 'editMessage')
  @MessagePattern(SERVICE_TCP_PATTERNS.DIALOGS_MESSAGES_EDIT)
  async editMessage(
    @CurrentUser() user: AuthenticatedUser,
    @Payload('dialogId', ParseUUIDPipe) id: string,
    @Payload('messageId', ParseUUIDPipe) messageId: string,
    @Payload('body') dto: EditMessageDto,
  ): Promise<SendMessageResponseDto> {
    return this.dialogsService.editMessage(user.id, id, messageId, dto);
  }

  @Can(DialogPolicy, 'streamEditMessage')
  @MessagePattern(SERVICE_TCP_PATTERNS.DIALOGS_MESSAGES_EDIT_STREAM)
  streamEditMessage(
    @CurrentUser() user: AuthenticatedUser,
    @Payload('dialogId', ParseUUIDPipe) id: string,
    @Payload('messageId', ParseUUIDPipe) messageId: string,
    @Payload('body') dto: EditMessageDto,
  ): Observable<DialogMessageStreamEventDto> {
    return this.dialogsService.streamEditMessage(user.id, id, messageId, dto);
  }

  @Can(DialogPolicy, 'viewStats')
  @MessagePattern(SERVICE_TCP_PATTERNS.DIALOGS_STATS_GET)
  async getStats(): Promise<DialogStatsResponseDto> {
    return this.dialogsService.getStats();
  }
}
