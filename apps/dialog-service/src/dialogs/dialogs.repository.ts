import { Inject, Injectable } from '@nestjs/common';
import type {
  DialogMessageResponseDto,
  DialogResponseDto,
  DialogStatsResponseDto,
  LlmTokenUsageDto,
} from '@semcache/shared-dtos';
import { ChatMessageRole } from '@semcache/shared-types';
import { and, asc, desc, eq, sql } from 'drizzle-orm';
import { DIALOG_DRIZZLE, type DialogDatabase } from '../db/database.module';
import { type DialogMessageRecord, type DialogRecord, dialogMessages, dialogs } from '../db/schema';

export const DEFAULT_DIALOG_TITLE = 'New Conversation';

export interface InsertDialogMessageInput {
  dialogId: string;
  parentMessageId?: string | null;
  role: ChatMessageRole;
  content: string;
  model?: string;
  latencyMs?: number;
  usage?: LlmTokenUsageDto;
}

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
    parentMessageId: record.parentMessageId ?? null,
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

  async findMessageByIdForDialog(
    dialogId: string,
    messageId: string,
  ): Promise<DialogMessageResponseDto | null> {
    const rows = await this.db
      .select()
      .from(dialogMessages)
      .where(and(eq(dialogMessages.dialogId, dialogId), eq(dialogMessages.id, messageId)))
      .limit(1);

    const record = rows[0];
    return record ? toDialogMessageResponseDto(record) : null;
  }

  async insertMessage(input: InsertDialogMessageInput): Promise<DialogMessageResponseDto> {
    const rows = await this.db
      .insert(dialogMessages)
      .values({
        dialogId: input.dialogId,
        parentMessageId: input.parentMessageId ?? null,
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

  async updateDialogTitle(
    dialogId: string,
    userId: string,
    title: string,
  ): Promise<DialogResponseDto | null> {
    const rows = await this.db
      .update(dialogs)
      .set({
        title: title.trim(),
        updatedAt: new Date(),
      })
      .where(and(eq(dialogs.id, dialogId), eq(dialogs.userId, userId)))
      .returning();

    const updated = rows[0];
    return updated ? toDialogResponseDto(updated) : null;
  }

  async deleteDialog(dialogId: string, userId: string): Promise<boolean> {
    const rows = await this.db
      .delete(dialogs)
      .where(and(eq(dialogs.id, dialogId), eq(dialogs.userId, userId)))
      .returning({ id: dialogs.id });
    return rows.length > 0;
  }

  async deleteAllDialogsByUser(userId: string): Promise<number> {
    const rows = await this.db
      .delete(dialogs)
      .where(eq(dialogs.userId, userId))
      .returning({ id: dialogs.id });
    return rows.length;
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

  async getStats(): Promise<DialogStatsResponseDto> {
    const [dialogTotalsRows, messageTotalsRows, recentRows] = await Promise.all([
      this.db
        .select({
          totalDialogs: sql<number>`count(*)::int`,
          activeUsersCount: sql<number>`count(distinct ${dialogs.userId})::int`,
        })
        .from(dialogs),
      this.db
        .select({
          totalMessages: sql<number>`count(*)::int`,
          userMessages: sql<number>`count(*) filter (where ${dialogMessages.role} = 'user')::int`,
          assistantMessages: sql<number>`count(*) filter (where ${dialogMessages.role} = 'assistant')::int`,
          cachedAssistantMessages: sql<number>`count(*) filter (where ${dialogMessages.role} = 'assistant' and ${dialogMessages.model} = 'semantic-cache')::int`,
          llmAssistantMessages: sql<number>`count(*) filter (where ${dialogMessages.role} = 'assistant' and (${dialogMessages.model} is null or ${dialogMessages.model} <> 'semantic-cache'))::int`,
          averageLatencyMs: sql<
            number | null
          >`round(avg(${dialogMessages.latencyMs}) filter (where ${dialogMessages.role} = 'assistant' and ${dialogMessages.latencyMs} is not null))::int`,
          averageCachedLatencyMs: sql<
            number | null
          >`round(avg(${dialogMessages.latencyMs}) filter (where ${dialogMessages.role} = 'assistant' and ${dialogMessages.model} = 'semantic-cache' and ${dialogMessages.latencyMs} is not null))::int`,
          averageLlmLatencyMs: sql<
            number | null
          >`round(avg(${dialogMessages.latencyMs}) filter (where ${dialogMessages.role} = 'assistant' and (${dialogMessages.model} is null or ${dialogMessages.model} <> 'semantic-cache') and ${dialogMessages.latencyMs} is not null))::int`,
          totalTokens: sql<number>`coalesce(sum(${dialogMessages.totalTokens}), 0)::int`,
          promptTokens: sql<number>`coalesce(sum(${dialogMessages.promptTokens}), 0)::int`,
          completionTokens: sql<number>`coalesce(sum(${dialogMessages.completionTokens}), 0)::int`,
        })
        .from(dialogMessages),
      this.db
        .select({
          id: dialogs.id,
          userId: dialogs.userId,
          title: dialogs.title,
          messageCount: sql<number>`count(${dialogMessages.id})::int`,
          updatedAt: dialogs.updatedAt,
        })
        .from(dialogs)
        .leftJoin(dialogMessages, eq(dialogMessages.dialogId, dialogs.id))
        .groupBy(dialogs.id)
        .orderBy(desc(dialogs.updatedAt))
        .limit(5),
    ]);

    const dialogTotals = dialogTotalsRows[0];
    const messageTotals = messageTotalsRows[0];
    const assistantMessages = Number(messageTotals?.assistantMessages ?? 0);
    const cachedAssistantMessages = Number(messageTotals?.cachedAssistantMessages ?? 0);
    const toNullableInt = (val: number | null | undefined): number | null =>
      val === null || val === undefined ? null : Number(val);

    return {
      totalDialogs: Number(dialogTotals?.totalDialogs ?? 0),
      activeUsersCount: Number(dialogTotals?.activeUsersCount ?? 0),
      totalMessages: Number(messageTotals?.totalMessages ?? 0),
      userMessages: Number(messageTotals?.userMessages ?? 0),
      assistantMessages,
      cachedAssistantMessages,
      llmAssistantMessages: Number(messageTotals?.llmAssistantMessages ?? 0),
      cacheHitRate:
        assistantMessages > 0
          ? Number((cachedAssistantMessages / assistantMessages).toFixed(4))
          : 0,
      averageLatencyMs: toNullableInt(messageTotals?.averageLatencyMs),
      averageCachedLatencyMs: toNullableInt(messageTotals?.averageCachedLatencyMs),
      averageLlmLatencyMs: toNullableInt(messageTotals?.averageLlmLatencyMs),
      totalTokens: Number(messageTotals?.totalTokens ?? 0),
      promptTokens: Number(messageTotals?.promptTokens ?? 0),
      completionTokens: Number(messageTotals?.completionTokens ?? 0),
      recentDialogs: recentRows.map((row) => ({
        id: row.id,
        userId: row.userId,
        title: row.title,
        messageCount: Number(row.messageCount),
        updatedAt: row.updatedAt.toISOString(),
      })),
    };
  }
}
