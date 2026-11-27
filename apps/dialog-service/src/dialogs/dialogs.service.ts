import { BadRequestException, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { AuthenticationContext } from '@nestjs/authentication';
import { AuthorizationService } from '@nestjs/authorization';
import type {
  CreateDialogRequestDto,
  DeleteAllDialogsResponseDto,
  DeleteDialogResponseDto,
  DialogMessageResponseDto,
  DialogMessageStreamEventDto,
  DialogResponseDto,
  DialogStatsResponseDto,
  EditMessageRequestDto,
  SendMessageRequestDto,
  SendMessageResponseDto,
  UpdateDialogRequestDto,
} from '@semcache/shared-dtos';
import { ChatMessageRole } from '@semcache/shared-types';
import { type Observable, from, mergeMap } from 'rxjs';
import { DialogGraphService } from './dialog-graph.service';
import { DialogsRepository } from './dialogs.repository';
import { DialogPolicy } from './policies/dialog.policy';

@Injectable()
export class DialogsService {
  constructor(
    private readonly dialogsRepository: DialogsRepository,
    private readonly dialogGraphService: DialogGraphService,
    @Optional() private readonly authorizationService?: AuthorizationService,
    @Optional() private readonly authContext?: AuthenticationContext,
  ) {}

  async createDialog(userId: string, dto: CreateDialogRequestDto): Promise<DialogResponseDto> {
    return this.dialogsRepository.createDialog(userId, dto.title);
  }

  async listUserDialogs(userId: string): Promise<DialogResponseDto[]> {
    return this.dialogsRepository.findDialogsByUser(userId);
  }

  async updateDialogTitle(
    userId: string,
    dialogId: string,
    dto: UpdateDialogRequestDto,
  ): Promise<DialogResponseDto> {
    await this.requireOwnedDialog(userId, dialogId);
    const updated = await this.dialogsRepository.updateDialogTitle(dialogId, userId, dto.title);
    if (!updated) {
      throw new NotFoundException('Dialog not found');
    }
    return updated;
  }

  async deleteDialog(userId: string, dialogId: string): Promise<DeleteDialogResponseDto> {
    await this.requireOwnedDialog(userId, dialogId);
    const deleted = await this.dialogsRepository.deleteDialog(dialogId, userId);
    if (!deleted) {
      throw new NotFoundException('Dialog not found');
    }
    return { id: dialogId, deleted: true };
  }

  async deleteAllDialogs(userId: string): Promise<DeleteAllDialogsResponseDto> {
    const deletedCount = await this.dialogsRepository.deleteAllDialogsByUser(userId);
    return { deletedCount, deleted: true };
  }

  async getStats(): Promise<DialogStatsResponseDto> {
    return this.dialogsRepository.getStats();
  }

  async getDialogMessages(userId: string, dialogId: string): Promise<DialogMessageResponseDto[]> {
    await this.requireOwnedDialog(userId, dialogId);
    return this.dialogsRepository.findMessagesByDialog(dialogId);
  }

  async sendMessage(
    userId: string,
    dialogId: string,
    dto: SendMessageRequestDto,
  ): Promise<SendMessageResponseDto> {
    const dialog = await this.prepareSendMessageContext(userId, dialogId, dto.parentMessageId);
    return this.dialogGraphService.executeTurn({
      dialog,
      content: dto.content,
      model: dto.model,
      parentMessageId: dto.parentMessageId,
      category: dto.category,
      cacheMode: dto.cacheMode,
      fixedThresholdOverride: dto.fixedThresholdOverride,
    });
  }

  streamMessage(
    userId: string,
    dialogId: string,
    dto: SendMessageRequestDto,
  ): Observable<DialogMessageStreamEventDto> {
    return from(this.prepareSendMessageContext(userId, dialogId, dto.parentMessageId)).pipe(
      mergeMap((dialog) =>
        this.dialogGraphService.streamTurn({
          dialog,
          content: dto.content,
          model: dto.model,
          parentMessageId: dto.parentMessageId,
          category: dto.category,
          cacheMode: dto.cacheMode,
          fixedThresholdOverride: dto.fixedThresholdOverride,
        }),
      ),
    );
  }

  async editMessage(
    userId: string,
    dialogId: string,
    messageId: string,
    dto: EditMessageRequestDto,
  ): Promise<SendMessageResponseDto> {
    const { dialog, targetMessage } = await this.requireEditableUserMessage(
      userId,
      dialogId,
      messageId,
    );
    return this.dialogGraphService.executeTurn({
      dialog,
      content: dto.content,
      model: dto.model,
      parentMessageId: targetMessage.parentMessageId ?? null,
    });
  }

  streamEditMessage(
    userId: string,
    dialogId: string,
    messageId: string,
    dto: EditMessageRequestDto,
  ): Observable<DialogMessageStreamEventDto> {
    return from(this.requireEditableUserMessage(userId, dialogId, messageId)).pipe(
      mergeMap(({ dialog, targetMessage }) =>
        this.dialogGraphService.streamTurn({
          dialog,
          content: dto.content,
          model: dto.model,
          parentMessageId: targetMessage.parentMessageId ?? null,
        }),
      ),
    );
  }

  private async prepareSendMessageContext(
    userId: string,
    dialogId: string,
    parentMessageId?: string | null,
  ): Promise<DialogResponseDto> {
    const dialog = await this.requireOwnedDialog(userId, dialogId);
    if (parentMessageId) {
      const parent = await this.dialogsRepository.findMessageByIdForDialog(
        dialogId,
        parentMessageId,
      );
      if (!parent) {
        throw new NotFoundException('Parent message not found');
      }
    }
    return dialog;
  }

  private async requireEditableUserMessage(
    userId: string,
    dialogId: string,
    messageId: string,
  ): Promise<{ dialog: DialogResponseDto; targetMessage: DialogMessageResponseDto }> {
    const dialog = await this.requireOwnedDialog(userId, dialogId);
    const targetMessage = await this.dialogsRepository.findMessageByIdForDialog(
      dialogId,
      messageId,
    );
    if (!targetMessage) {
      throw new NotFoundException('Message not found');
    }
    if (targetMessage.role !== ChatMessageRole.USER) {
      throw new BadRequestException('Only user messages can be edited');
    }
    return { dialog, targetMessage };
  }

  private async requireOwnedDialog(userId: string, dialogId: string): Promise<DialogResponseDto> {
    const dialog = await this.dialogsRepository.findDialogByIdForUser(dialogId, userId);
    if (!dialog) {
      throw new NotFoundException('Dialog not found');
    }

    const actor = this.authContext?.user;
    if (this.authorizationService && actor) {
      await this.authorizationService.authorize(DialogPolicy, 'accessDialog', actor, dialog);
    }

    return dialog;
  }
}
