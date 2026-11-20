import { Inject, Injectable } from '@nestjs/common';
import type {
  DialogMessageResponseDto,
  DialogResponseDto,
  LlmTokenUsageDto,
} from '@semcache/shared-dtos';
import { ChatMessageRole } from '@semcache/shared-types';
import { and, asc, desc, eq } from 'drizzle-orm';
import { DIALOG_DRIZZLE, type DialogDatabase } from '../db/database.module';
import { type DialogMessageRecord, type DialogRecord, dialogMessages, dialogs } from '../db/schema';

export const DEFAULT_DIALOG_TITLE = 'New Conversation';

export function toDialogResponseDto(record: DialogRecord): DialogResponseDto {
  return {
    id: record.id,
    userId: record.userId,
    title: record.title,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

export function toDialogMessageResponseDto(record: DialogMessageRecord): DialogMessageResponseDto {
  const hasUsage =
    record.promptTokens !== null && record.completionTokens !== null && record.totalTokens !== null;

  return {
    id: record.id,
    dialogId: record.dialogId,
    role: record.role as ChatMessageRole,
    content: record.content,
    model: record.model,
    latencyMs: record.latencyMs,
    usage: hasUsage
      ? {
          promptTokens: record.promptTokens ?? 0,
          completionTokens: record.completionTokens ?? 0,
          totalTokens: record.totalTokens ?? 0,
        }
      : null,
    createdAt: record.createdAt.toISOString(),
  };
}

@Injectable()
export class DialogsRepository {
  constructor(@Inject(DIALOG_DRIZZLE) private readonly db: DialogDatabase) {}

  async createDialog(userId: string, title?: string): Promise<DialogResponseDto> {
    const resolvedTitle = title && title.trim().length > 0 ? title.trim() : DEFAULT_DIALOG_TITLE;
    const rows = await this.db.insert(dialogs).values({ userId, title: resolvedTitle }).returning();

    const created = rows[0];
    if (!created) {
      throw new Error('Failed to create dialog record');
    }
    return toDialogResponseDto(created);
  }

  async findDialogsByUser(userId: string): Promise<DialogResponseDto[]> {
    const rows = await this.db
      .select()
      .from(dialogs)
      .where(eq(dialogs.userId, userId))
      .orderBy(desc(dialogs.updatedAt), desc(dialogs.createdAt));

    return rows.map(toDialogResponseDto);
  }

  async findDialogByIdForUser(dialogId: string, userId: string): Promise<DialogResponseDto | null> {
    const rows = await this.db
      .select()
      .from(dialogs)
      .where(and(eq(dialogs.id, dialogId), eq(dialogs.userId, userId)))
      .limit(1);

    const record = rows[0];
    return record ? toDialogResponseDto(record) : null;
  }

  async findMessagesByDialog(dialogId: string): Promise<DialogMessageResponseDto[]> {
    const rows = await this.db
      .select()
      .from(dialogMessages)
      .where(eq(dialogMessages.dialogId, dialogId))
      .orderBy(asc(dialogMessages.createdAt), asc(dialogMessages.id));

    return rows.map(toDialogMessageResponseDto);
  }

  async insertMessage(input: {
    dialogId: string;
    role: ChatMessageRole;
    content: string;
    model?: string;
    latencyMs?: number;
    usage?: LlmTokenUsageDto;
  }): Promise<DialogMessageResponseDto> {
    const rows = await this.db
      .insert(dialogMessages)
      .values({
        dialogId: input.dialogId,
        role: input.role,
        content: input.content,
        model: input.model ?? null,
        latencyMs: input.latencyMs ?? null,
        promptTokens: input.usage?.promptTokens ?? null,
        completionTokens: input.usage?.completionTokens ?? null,
        totalTokens: input.usage?.totalTokens ?? null,
      })
      .returning();

    const created = rows[0];
    if (!created) {
      throw new Error('Failed to insert dialog message');
    }
    return toDialogMessageResponseDto(created);
  }

  async touchDialog(dialogId: string, title?: string): Promise<DialogResponseDto> {
    const updates: Partial<{ updatedAt: Date; title: string }> = {
      updatedAt: new Date(),
    };
    if (title !== undefined) {
      updates.title = title;
    }

    const rows = await this.db
      .update(dialogs)
      .set(updates)
      .where(eq(dialogs.id, dialogId))
      .returning();

    const updated = rows[0];
    if (!updated) {
      throw new Error('Failed to update dialog timestamp');
    }
    return toDialogResponseDto(updated);
  }
}
