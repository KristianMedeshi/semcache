import type { UserResponseDto } from '@semcache/shared-dtos';
import { Headset } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { useSignOutMutation } from '@/features/auth/model/use-auth';
import { AdminOperatorDialog } from '@/features/auth/ui/admin-operator-dialog';
import { ProfileSettingsDialog } from '@/features/auth/ui/profile-settings-dialog';
import {
  type ActiveGraphNode,
  getAdjacentBranchId,
  resolveActiveMessagePath,
} from '@/features/chat/model/message-graph';
import {
  STREAMING_ASSISTANT_MESSAGE_ID,
  useCreateDialogMutation,
  useDeleteDialogMutation,
  useDialogMessagesQuery,
  useDialogsQuery,
  useStreamEditMessageMutation,
  useStreamMessageMutation,
  useUpdateDialogMutation,
} from '@/features/chat/model/use-chat';
import { ChatComposer } from '@/features/chat/ui/chat-composer';
import { ChatHeader } from '@/features/chat/ui/chat-header';
import { ChatMessageItem } from '@/features/chat/ui/chat-message-item';
import { ChatWelcomeState } from '@/features/chat/ui/chat-welcome-state';
import {
  ConversationSidebarContent,
  MobileConversationDrawer,
} from '@/features/chat/ui/conversation-sidebar';
import { SidebarAccountFooter } from '@/features/chat/ui/sidebar-account-footer';
import { getAuthServerError } from '@/shared/api/api-client';

export interface ChatWorkspaceProps {
  user: UserResponseDto;
}

export function ChatWorkspace({ user }: ChatWorkspaceProps) {
  const [selectedDialogId, setSelectedDialogId] = useState<string | null>(null);
  const [isNewChatPending, setIsNewChatPending] = useState(false);
  const [draft, setDraft] = useState('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [mobileHistoryOpen, setMobileHistoryOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);
  const [lastMessagesByDialog, setLastMessagesByDialog] = useState<Record<string, string>>({});
  const [selectedBranchesByDialog, setSelectedBranchesByDialog] = useState<
    Record<string, Record<string, string>>
  >({});

  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const dialogsQuery = useDialogsQuery();
  const dialogs = dialogsQuery.data ?? [];
  const activeDialogId = isNewChatPending ? null : (selectedDialogId ?? dialogs[0]?.id ?? null);

  const messagesQuery = useDialogMessagesQuery(activeDialogId);
  const createDialogMutation = useCreateDialogMutation();
  const updateDialogMutation = useUpdateDialogMutation();
  const deleteDialogMutation = useDeleteDialogMutation();
  const streamMessageMutation = useStreamMessageMutation();
  const streamEditMessageMutation = useStreamEditMessageMutation();
  const signOutMutation = useSignOutMutation();

  const isStreaming = streamMessageMutation.isPending || streamEditMessageMutation.isPending;
  const isSending =
    createDialogMutation.isPending ||
    updateDialogMutation.isPending ||
    deleteDialogMutation.isPending ||
    isStreaming;

  const activeMessages = messagesQuery.data ?? [];
  const activeBranchSelections = useMemo(
    () => (activeDialogId ? (selectedBranchesByDialog[activeDialogId] ?? {}) : {}),
    [activeDialogId, selectedBranchesByDialog],
  );

  const { nodes: activeGraphNodes, activeLeafMessageId } = useMemo(
    () => resolveActiveMessagePath(activeMessages, activeBranchSelections),
    [activeMessages, activeBranchSelections],
  );

  const hasStreamingAssistantContent = activeGraphNodes.some(
    (node) => node.message.id === STREAMING_ASSISTANT_MESSAGE_ID && node.message.content.length > 0,
  );
  const lastMessageContent = activeGraphNodes[activeGraphNodes.length - 1]?.message.content ?? '';

  useEffect(() => {
    if (activeDialogId && activeGraphNodes.length > 0) {
      const last = activeGraphNodes[activeGraphNodes.length - 1].message;
      setLastMessagesByDialog((prev) =>
        prev[activeDialogId] === last.content ? prev : { ...prev, [activeDialogId]: last.content },
      );
    }
  }, [activeDialogId, activeGraphNodes]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeGraphNodes.length, lastMessageContent, isStreaming]);

  const handleSelectDialog = (dialogId: string) => {
    setIsNewChatPending(false);
    setSelectedDialogId(dialogId);
  };

  const handleNewConversation = async () => {
    try {
      const created = await createDialogMutation.mutateAsync({});
      setIsNewChatPending(false);
      setSelectedDialogId(created.id);
    } catch (error) {
      toast.error(getAuthServerError(error as Error, 'Failed to start a new conversation'));
    }
  };

  const handleRenameDialog = async (dialogId: string, title: string) => {
    try {
      await updateDialogMutation.mutateAsync({ dialogId, dto: { title } });
      toast.success('Conversation renamed');
    } catch (error) {
      toast.error(getAuthServerError(error as Error, 'Failed to rename conversation'));
    }
  };

  const handleDeleteDialog = async (dialogId: string) => {
    try {
      await deleteDialogMutation.mutateAsync(dialogId);
      if (selectedDialogId === dialogId || activeDialogId === dialogId) {
        setSelectedDialogId(null);
      }
      setSelectedBranchesByDialog((prev) => {
        if (!(dialogId in prev)) {
          return prev;
        }
        const next = { ...prev };
        delete next[dialogId];
        return next;
      });
      toast.success('Conversation deleted');
    } catch (error) {
      toast.error(getAuthServerError(error as Error, 'Failed to delete conversation'));
    }
  };

  const handleSelectBranch = (node: ActiveGraphNode, direction: 'prev' | 'next') => {
    if (!activeDialogId) {
      return;
    }
    const targetId = getAdjacentBranchId(node, direction);
    if (!targetId) {
      return;
    }
    setSelectedBranchesByDialog((prev) => ({
      ...prev,
      [activeDialogId]: {
        ...(prev[activeDialogId] ?? {}),
        [node.parentKey]: targetId,
      },
    }));
  };

  const handleEditMessage = async (messageId: string, newContent: string) => {
    if (!activeDialogId || isSending) {
      return;
    }
    const targetMessage = activeMessages.find((msg) => msg.id === messageId);
    if (!targetMessage) {
      return;
    }

    const parentMessageId = targetMessage.parentMessageId ?? null;

    try {
      await streamEditMessageMutation.mutateAsync({
        dialogId: activeDialogId,
        messageId,
        parentMessageId,
        dto: { content: newContent },
        onBranchCreated: (parentKey, createdMessageId) => {
          setSelectedBranchesByDialog((prev) => ({
            ...prev,
            [activeDialogId]: {
              ...(prev[activeDialogId] ?? {}),
              [parentKey]: createdMessageId,
            },
          }));
        },
      });
    } catch (error) {
      toast.error(getAuthServerError(error as Error, 'Unable to edit message. Please try again.'));
    }
  };

  const submitMessage = async (rawContent: string) => {
    const content = rawContent.trim();
    if (!content || isSending) {
      return;
    }

    try {
      let targetDialogId = activeDialogId;
      let parentMessageId = activeLeafMessageId;
      if (!targetDialogId) {
        const created = await createDialogMutation.mutateAsync({});
        targetDialogId = created.id;
        parentMessageId = null;
        setIsNewChatPending(false);
        setSelectedDialogId(created.id);
      }

      setDraft('');
      await streamMessageMutation.mutateAsync({
        dialogId: targetDialogId,
        dto: {
          content,
          ...(parentMessageId ? { parentMessageId } : {}),
        },
      });
    } catch (error) {
      setDraft(content);
      toast.error(getAuthServerError(error as Error, 'Unable to send message. Please try again.'));
    }
  };

  const handleSignOut = async () => {
    try {
      await signOutMutation.mutateAsync();
      toast.success('Signed out');
    } catch {
      toast.error('Failed to sign out');
    }
  };

  const showWelcomeState =
    !activeDialogId || (!messagesQuery.isPending && activeGraphNodes.length === 0);

  const sidebarFooter = (
    <SidebarAccountFooter
      user={user}
      onOpenProfileSettings={() => setProfileOpen(true)}
      onOpenAdminDirectory={() => setAdminOpen(true)}
      onSignOut={handleSignOut}
      isSigningOut={signOutMutation.isPending}
    />
  );

  return (
    <div className="flex h-screen w-full flex-col overflow-hidden bg-background">
      <ChatHeader
        user={user}
        isSidebarOpen={isSidebarOpen}
        onToggleSidebar={() => setIsSidebarOpen((prev) => !prev)}
        onOpenMobileHistory={() => setMobileHistoryOpen(true)}
      />

      <div className="flex min-h-0 flex-1 overflow-hidden">
        {isSidebarOpen ? (
          <aside className="hidden w-72 shrink-0 border-r md:flex md:flex-col lg:w-80">
            <ConversationSidebarContent
              dialogs={dialogs}
              activeDialogId={activeDialogId}
              lastMessagesByDialog={lastMessagesByDialog}
              isLoading={dialogsQuery.isPending}
              isBusy={isSending}
              onSelectDialog={handleSelectDialog}
              onNewConversation={handleNewConversation}
              onRenameDialog={handleRenameDialog}
              onDeleteDialog={handleDeleteDialog}
              footer={sidebarFooter}
            />
          </aside>
        ) : null}

        <main className="flex min-h-0 flex-1 flex-col bg-background">
          <div className="flex-1 overflow-y-auto px-4 py-6 sm:px-6">
            <div className="mx-auto flex w-full max-w-3xl flex-col space-y-5">
              {activeDialogId && messagesQuery.isPending ? (
                <div className="py-12 text-center text-sm text-muted-foreground">
                  Loading conversation...
                </div>
              ) : showWelcomeState ? (
                <ChatWelcomeState
                  onSelectSuggestion={(prompt) => void submitMessage(prompt)}
                  disabled={isSending}
                />
              ) : (
                activeGraphNodes.map((node) => (
                  <ChatMessageItem
                    key={node.message.id}
                    message={node.message}
                    siblingIndex={node.siblingIndex}
                    siblingCount={node.siblingCount}
                    onSelectBranch={(direction) => handleSelectBranch(node, direction)}
                    onEditMessage={handleEditMessage}
                    isBusy={isSending}
                  />
                ))
              )}

              {isStreaming && !hasStreamingAssistantContent ? (
                <div role="status" aria-live="polite" className="flex items-center gap-3">
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-full border border-primary/20 bg-primary/10 text-primary">
                    <Headset className="size-4" />
                  </div>
                  <div className="flex items-center gap-2 rounded-2xl rounded-tl-sm border bg-card px-4 py-3 text-xs text-muted-foreground shadow-xs">
                    <span className="flex gap-1">
                      <span className="size-1.5 animate-bounce rounded-full bg-primary [animation-delay:-0.3s]" />
                      <span className="size-1.5 animate-bounce rounded-full bg-primary [animation-delay:-0.15s]" />
                      <span className="size-1.5 animate-bounce rounded-full bg-primary" />
                    </span>
                    <span>Telecom Assistant is typing...</span>
                  </div>
                </div>
              ) : null}

              <div ref={messagesEndRef} />
            </div>
          </div>

          <ChatComposer
            draft={draft}
            onDraftChange={setDraft}
            onSubmit={() => void submitMessage(draft)}
            isSending={isSending}
          />
        </main>
      </div>

      <MobileConversationDrawer
        open={mobileHistoryOpen}
        onOpenChange={setMobileHistoryOpen}
        dialogs={dialogs}
        activeDialogId={activeDialogId}
        lastMessagesByDialog={lastMessagesByDialog}
        isLoading={dialogsQuery.isPending}
        isBusy={isSending}
        onSelectDialog={handleSelectDialog}
        onNewConversation={handleNewConversation}
        onRenameDialog={handleRenameDialog}
        onDeleteDialog={handleDeleteDialog}
        footer={sidebarFooter}
      />

      <ProfileSettingsDialog user={user} open={profileOpen} onOpenChange={setProfileOpen} />

      <AdminOperatorDialog open={adminOpen} onOpenChange={setAdminOpen} />
    </div>
  );
}
