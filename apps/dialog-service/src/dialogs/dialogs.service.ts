import { Injectable, NotFoundException } from '@nestjs/common';
import type {
  CreateDialogRequestDto,
  DialogMessageResponseDto,
  DialogResponseDto,
  SendMessageRequestDto,
  SendMessageResponseDto,
} from '@semcache/shared-dtos';
import { DialogGraphService } from './dialog-graph.service';
import { DialogsRepository } from './dialogs.repository';

@Injectable()
export class DialogsService {
  constructor(
    private readonly dialogsRepository: DialogsRepository,
    private readonly dialogGraphService: DialogGraphService,
  ) {}

  async createDialog(userId: string, dto: CreateDialogRequestDto): Promise<DialogResponseDto> {
    return this.dialogsRepository.createDialog(userId, dto.title);
  }

  async listUserDialogs(userId: string): Promise<DialogResponseDto[]> {
    return this.dialogsRepository.findDialogsByUser(userId);
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
    const dialog = await this.requireOwnedDialog(userId, dialogId);
    return this.dialogGraphService.executeTurn({
      dialog,
      content: dto.content,
      model: dto.model,
    });
  }

  private async requireOwnedDialog(userId: string, dialogId: string): Promise<DialogResponseDto> {
    const dialog = await this.dialogsRepository.findDialogByIdForUser(dialogId, userId);
    if (!dialog) {
      throw new NotFoundException('Dialog not found');
    }
    return dialog;
  }
}
