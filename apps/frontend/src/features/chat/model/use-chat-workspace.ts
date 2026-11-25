import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { useSignOutMutation } from '@/features/auth/model/use-auth';
import {
  type BranchSelectionsByDialog,
  applyAdjacentBranchSelection,
  removeDialogBranchSelections,
  runWithErrorToast,
  setBranchSelection,
} from '@/features/chat/model/chat-workspace.helpers';
import {
  type ActiveGraphNode,
  resolveActiveMessagePath,
} from '@/features/chat/model/message-graph';
import {
  STREAMING_ASSISTANT_MESSAGE_ID,
  useCreateDialogMutation,
  useDeleteAllDialogsMutation,
  useDeleteDialogMutation,
  useDialogMessagesQuery,
  useDialogsQuery,
  useStreamEditMessageMutation,
  useStreamMessageMutation,
  useUpdateDialogMutation,
} from '@/features/chat/model/use-chat';
import { getAuthServerError } from '@/shared/api/api-client';

export function useChatWorkspace() {
  const [selectedDialogId, setSelectedDialogId] = useState<string | null>(null);
  const [isNewChatPending, setIsNewChatPending] = useState(false);
  const [draft, setDraft] = useState('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [mobileHistoryOpen, setMobileHistoryOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);
  const [lastMessagesByDialog, setLastMessagesByDialog] = useState<Record<string, string>>({});
  const [selectedBranchesByDialog, setSelectedBranchesByDialog] =
    useState<BranchSelectionsByDialog>({});

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const dialogsQuery = useDialogsQuery();
  const dialogs = dialogsQuery.data ?? [];
  const activeDialogId = isNewChatPending ? null : (selectedDialogId ?? dialogs[0]?.id ?? null);

  const messagesQuery = useDialogMessagesQuery(activeDialogId);
  const createDialogMutation = useCreateDialogMutation();
  const updateDialogMutation = useUpdateDialogMutation();
  const deleteDialogMutation = useDeleteDialogMutation();
  const deleteAllDialogsMutation = useDeleteAllDialogsMutation();
  const streamMessageMutation = useStreamMessageMutation();
  const streamEditMessageMutation = useStreamEditMessageMutation();
  const signOutMutation = useSignOutMutation();

  const isStreaming = streamMessageMutation.isPending || streamEditMessageMutation.isPending;
  const isSending =
    createDialogMutation.isPending ||
    updateDialogMutation.isPending ||
    deleteDialogMutation.isPending ||
    deleteAllDialogsMutation.isPending ||
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

  const handleNewConversation = () =>
    runWithErrorToast(async () => {
      const created = await createDialogMutation.mutateAsync({});
      setIsNewChatPending(false);
      setSelectedDialogId(created.id);
    }, 'Failed to start a new conversation');

  const handleRenameDialog = (dialogId: string, title: string) =>
    runWithErrorToast(async () => {
      await updateDialogMutation.mutateAsync({ dialogId, dto: { title } });
      toast.success('Conversation renamed');
    }, 'Failed to rename conversation');

  const handleDeleteDialog = (dialogId: string) =>
    runWithErrorToast(async () => {
      await deleteDialogMutation.mutateAsync(dialogId);
      if (selectedDialogId === dialogId || activeDialogId === dialogId) {
        setSelectedDialogId(null);
      }
      removeDialogBranchSelections(setSelectedBranchesByDialog, dialogId);
      toast.success('Conversation deleted');
    }, 'Failed to delete conversation');

  const handleDeleteAllDialogs = () =>
    runWithErrorToast(async () => {
      await deleteAllDialogsMutation.mutateAsync();
      setIsNewChatPending(false);
      setSelectedDialogId(null);
      setSelectedBranchesByDialog({});
      setLastMessagesByDialog({});
      toast.success('All conversations deleted');
    }, 'Failed to delete all conversations');

  const handleSelectBranch = (node: ActiveGraphNode, direction: 'prev' | 'next') =>
    applyAdjacentBranchSelection(setSelectedBranchesByDialog, activeDialogId, node, direction);

  const handleEditMessage = async (messageId: string, newContent: string) => {
    const targetMessage =
      activeDialogId && !isSending ? activeMessages.find((msg) => msg.id === messageId) : undefined;
    if (!activeDialogId || !targetMessage) {
      return;
    }

    await runWithErrorToast(async () => {
      await streamEditMessageMutation.mutateAsync({
        dialogId: activeDialogId,
        messageId,
        parentMessageId: targetMessage.parentMessageId ?? null,
        dto: { content: newContent },
        onBranchCreated: (parentKey, createdMessageId) =>
          setBranchSelection(setSelectedBranchesByDialog, activeDialogId, parentKey, createdMessageId),
      });
    }, 'Unable to edit message. Please try again.');
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
        dto: { content, ...(parentMessageId ? { parentMessageId } : {}) },
      });
    } catch (error) {
      setDraft(content);
      toast.error(getAuthServerError(error as Error, 'Unable to send message. Please try again.'));
    }
  };

  const handleSignOut = async () => {
    try {
      await signOutMutation.mutateAsync();
    } catch {
      toast.error('Failed to sign out');
    }
  };

  return {
    draft,
    setDraft,
    isSidebarOpen,
    toggleSidebar: () => setIsSidebarOpen((prev) => !prev),
    mobileHistoryOpen,
    setMobileHistoryOpen,
    profileOpen,
    setProfileOpen,
    adminOpen,
    setAdminOpen,
    messagesEndRef,
    dialogsQuery,
    dialogs,
    activeDialogId,
    messagesQuery,
    isStreaming,
    isSending,
    activeGraphNodes,
    hasStreamingAssistantContent,
    lastMessagesByDialog,
    isSigningOut: signOutMutation.isPending,
    showWelcomeState:
      !activeDialogId || (!messagesQuery.isPending && activeGraphNodes.length === 0),
    handleSelectDialog,
    handleNewConversation,
    handleRenameDialog,
    handleDeleteDialog,
    handleDeleteAllDialogs,
    handleSelectBranch,
    handleEditMessage,
    submitMessage,
    handleSignOut,
  };
}
