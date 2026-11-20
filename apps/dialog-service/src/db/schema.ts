import {
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

export const dialogMessageRoleEnum = pgEnum('dialog_message_role', ['system', 'user', 'assistant']);

export const dialogs = pgTable(
  'dialogs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').notNull(),
    title: varchar('title', { length: 120 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (table) => [index('dialogs_user_id_idx').on(table.userId)],
);

export const dialogMessages = pgTable(
  'dialog_messages',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    dialogId: uuid('dialog_id')
      .notNull()
      .references(() => dialogs.id, { onDelete: 'cascade' }),
    role: dialogMessageRoleEnum('role').notNull(),
    content: text('content').notNull(),
    model: varchar('model', { length: 120 }),
    latencyMs: integer('latency_ms'),
    promptTokens: integer('prompt_tokens'),
    completionTokens: integer('completion_tokens'),
    totalTokens: integer('total_tokens'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (table) => [index('dialog_messages_dialog_id_idx').on(table.dialogId)],
);

export type DialogRecord = typeof dialogs.$inferSelect;
export type NewDialogRecord = typeof dialogs.$inferInsert;
export type DialogMessageRecord = typeof dialogMessages.$inferSelect;
export type NewDialogMessageRecord = typeof dialogMessages.$inferInsert;
