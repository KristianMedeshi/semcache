import type { UserResponseDto } from '@semcache/shared-dtos';
import { FREE_OPENROUTER_MODELS, type FreeOpenRouterModelId } from '@semcache/shared-types';
import { Loader2, MessageSquarePlus, MessagesSquare, Send, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import {
  useCreateDialogMutation,
  useDialogMessagesQuery,
  useDialogsQuery,
  useSendMessageMutation,
} from '@/features/chat/model/use-chat';
import { ChatMessageItem } from '@/features/chat/ui/chat-message-item';
import { getAuthServerError } from '@/shared/api/api-client';
import { cn } from '@/shared/lib/utils';
import { Button } from '@/shared/ui/button';
import { Card } from '@/shared/ui/card';
import { Input } from '@/shared/ui/input';
import { Label } from '@/shared/ui/label';

export interface ChatWorkspaceProps {
  user: UserResponseDto;
}

export function ChatWorkspace({ user }: ChatWorkspaceProps) {
  const [selectedDialogId, setSelectedDialogId] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState<FreeOpenRouterModelId>(
    FREE_OPENROUTER_MODELS[0],
  );
  const [draft, setDraft] = useState('');

  const dialogsQuery = useDialogsQuery();
  const dialogs = dialogsQuery.data ?? [];
  const activeDialogId = selectedDialogId ?? dialogs[0]?.id ?? null;

  const messagesQuery = useDialogMessagesQuery(activeDialogId);
  const createDialogMutation = useCreateDialogMutation();
  const sendMessageMutation = useSendMessageMutation();

  const isSending = createDialogMutation.isPending || sendMessageMutation.isPending;
  const activeMessages = messagesQuery.data ?? [];

  const handleCreateDialog = async () => {
    try {
      const created = await createDialogMutation.mutateAsync({});
      setSelectedDialogId(created.id);
    } catch (error) {
      toast.error(getAuthServerError(error as Error, 'Failed to create conversation'));
    }
  };

  const handleSendMessage = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const content = draft.trim();
    if (!content || isSending) {
      return;
    }

    try {
      let targetDialogId = activeDialogId;
      if (!targetDialogId) {
        const created = await createDialogMutation.mutateAsync({});
        targetDialogId = created.id;
        setSelectedDialogId(created.id);
      }

      setDraft('');
      await sendMessageMutation.mutateAsync({
        dialogId: targetDialogId,
        dto: { content, model: selectedModel },
      });
    } catch (error) {
      setDraft(content);
      toast.error(getAuthServerError(error as Error, 'Failed to get AI response'));
    }
  };

  return (
    <Card className="grid h-[72vh] min-h-[520px] w-full grid-cols-1 overflow-hidden shadow-md md:grid-cols-[260px_1fr]">
      <aside className="flex flex-col border-b bg-muted/20 md:border-r md:border-b-0">
        <div className="flex items-center justify-between border-b p-3">
          <div className="min-w-0">
            <p className="truncate text-xs font-medium text-foreground">{user.email}</p>
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
              {user.role}
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleCreateDialog}
            disabled={isSending}
          >
            <MessageSquarePlus className="size-4" />
            New chat
          </Button>
        </div>

        <div className="flex-1 space-y-1 overflow-y-auto p-2">
          {dialogsQuery.isPending ? (
            <p className="px-2 py-4 text-xs text-muted-foreground">Loading conversations...</p>
          ) : dialogs.length === 0 ? (
            <p className="px-2 py-4 text-xs text-muted-foreground">
              No conversations yet. Send a message to start.
            </p>
          ) : (
            dialogs.map((dialog) => {
              const isSelected = dialog.id === activeDialogId;
              return (
                <button
                  key={dialog.id}
                  type="button"
                  onClick={() => setSelectedDialogId(dialog.id)}
                  className={cn(
                    'flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs transition-colors',
                    isSelected
                      ? 'bg-primary text-primary-foreground font-medium'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                  )}
                >
                  <MessagesSquare className="size-3.5 shrink-0" />
                  <span className="truncate">{dialog.title}</span>
                </button>
              );
            })
          )}
        </div>
      </aside>

      <section className="flex min-h-0 flex-col">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
          <div className="flex items-center gap-2">
            <Sparkles className="size-4 text-primary" />
            <h1 className="text-sm font-semibold">OpenRouter Support Chat</h1>
          </div>

          <div className="flex items-center gap-2">
            <Label htmlFor="free-model-select" className="text-xs text-muted-foreground">
              Free Model
            </Label>
            <select
              id="free-model-select"
              value={selectedModel}
              onChange={(event) => setSelectedModel(event.target.value as FreeOpenRouterModelId)}
              className="h-8 rounded-md border border-input bg-background px-2 text-xs shadow-xs outline-none focus-visible:border-ring"
            >
              {FREE_OPENROUTER_MODELS.map((modelId) => (
                <option key={modelId} value={modelId}>
                  {modelId}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-4">
          {!activeDialogId ? (
            <div className="flex h-full flex-col items-center justify-center text-center text-sm text-muted-foreground">
              <p className="font-medium text-foreground">Start a free OpenRouter conversation</p>
              <p className="mt-1 max-w-sm text-xs">
                Ask any customer support question. Only zero-cost OpenRouter models are enabled.
              </p>
            </div>
          ) : messagesQuery.isPending ? (
            <p className="text-sm text-muted-foreground">Loading messages...</p>
          ) : activeMessages.length === 0 ? (
            <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
              Send your first message below to start this conversation.
            </div>
          ) : (
            activeMessages.map((message) => <ChatMessageItem key={message.id} message={message} />)
          )}

          {sendMessageMutation.isPending && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="size-3.5 animate-spin" />
              <span>Generating response via {selectedModel}...</span>
            </div>
          )}
        </div>

        <form onSubmit={handleSendMessage} className="flex items-center gap-2 border-t p-3">
          <Input
            type="text"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Ask a question..."
            aria-label="Message input"
            disabled={isSending}
          />
          <Button type="submit" disabled={isSending || draft.trim().length === 0}>
            {isSending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
            Send
          </Button>
        </form>
      </section>
    </Card>
  );
}
