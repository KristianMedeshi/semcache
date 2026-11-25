import type { UserResponseDto } from '@semcache/shared-dtos';
import { AdminOperatorDialog } from '@/features/auth/ui/admin-operator-dialog';
import { ProfileSettingsDialog } from '@/features/auth/ui/profile-settings-dialog';
import { useChatWorkspace } from '@/features/chat/model/use-chat-workspace';
import {
  MAX_SIDEBAR_WIDTH,
  MIN_SIDEBAR_WIDTH,
  useResizableSidebar,
} from '@/features/chat/model/use-resizable-sidebar';
import { ChatComposer } from '@/features/chat/ui/chat-composer';
import { ChatHeader } from '@/features/chat/ui/chat-header';
import { ChatMessageItem } from '@/features/chat/ui/chat-message-item';
import { ChatTypingIndicator } from '@/features/chat/ui/chat-typing-indicator';
import { ChatWelcomeState } from '@/features/chat/ui/chat-welcome-state';
import {
  ConversationSidebarContent,
  MobileConversationDrawer,
} from '@/features/chat/ui/conversation-sidebar';
import { SidebarAccountFooter } from '@/features/chat/ui/sidebar-account-footer';
import { cn } from '@/shared/lib/utils';

export interface ChatWorkspaceProps {
  user: UserResponseDto;
}

export function ChatWorkspace({ user }: ChatWorkspaceProps) {
  const { sidebarWidth, isResizing, handleResizeStart, handleResizeKeyDown } =
    useResizableSidebar();
  const ws = useChatWorkspace();

  const sidebarFooter = (
    <SidebarAccountFooter
      user={user}
      onOpenProfileSettings={() => ws.setProfileOpen(true)}
      onOpenAdminDirectory={() => ws.setAdminOpen(true)}
      onSignOut={ws.handleSignOut}
      isSigningOut={ws.isSigningOut}
      onDeleteAllActivity={ws.handleDeleteAllDialogs}
      hasDialogs={ws.dialogs.length > 0}
      isDeletingAllActivity={ws.isSending}
    />
  );

  const sidebarProps = {
    dialogs: ws.dialogs,
    activeDialogId: ws.activeDialogId,
    lastMessagesByDialog: ws.lastMessagesByDialog,
    isLoading: ws.dialogsQuery.isPending,
    isBusy: ws.isSending,
    onSelectDialog: ws.handleSelectDialog,
    onNewConversation: ws.handleNewConversation,
    onRenameDialog: ws.handleRenameDialog,
    onDeleteDialog: ws.handleDeleteDialog,
    footer: sidebarFooter,
  };

  return (
    <div className="flex h-screen w-full flex-col overflow-hidden bg-background">
      <ChatHeader
        user={user}
        isSidebarOpen={ws.isSidebarOpen}
        onToggleSidebar={ws.toggleSidebar}
        onOpenMobileHistory={() => ws.setMobileHistoryOpen(true)}
      />

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <aside
          aria-hidden={!ws.isSidebarOpen}
          inert={!ws.isSidebarOpen}
          style={{ width: ws.isSidebarOpen ? `${sidebarWidth}px` : '0px' }}
          className={cn(
            'hidden shrink-0 overflow-hidden md:flex md:flex-col',
            isResizing ? 'transition-none' : 'transition-[width,opacity] duration-200 ease-in-out',
            ws.isSidebarOpen ? 'opacity-100' : 'pointer-events-none opacity-0',
          )}
        >
          <div style={{ width: `${sidebarWidth}px` }} className="flex h-full min-h-0 flex-col">
            <ConversationSidebarContent {...sidebarProps} />
          </div>
        </aside>

        {ws.isSidebarOpen ? (
          <div
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize conversation sidebar"
            aria-valuemin={MIN_SIDEBAR_WIDTH}
            aria-valuemax={MAX_SIDEBAR_WIDTH}
            aria-valuenow={sidebarWidth}
            tabIndex={0}
            onPointerDown={handleResizeStart}
            onKeyDown={handleResizeKeyDown}
            className={cn(
              "relative hidden w-px shrink-0 cursor-col-resize select-none bg-border transition-colors before:absolute before:inset-y-0 before:-right-1 before:-left-1 before:content-[''] hover:bg-primary/60 focus-visible:bg-primary focus-visible:outline-none md:block",
              isResizing ? 'bg-primary' : null,
            )}
          />
        ) : null}

        <main className="flex min-h-0 flex-1 flex-col bg-background">
          <div className="flex-1 overflow-y-auto px-4 py-6 sm:px-6">
            <div className="mx-auto flex w-full max-w-3xl flex-col space-y-5">
              {ws.activeDialogId && ws.messagesQuery.isPending ? (
                <div className="py-12 text-center text-sm text-muted-foreground">
                  Loading conversation...
                </div>
              ) : ws.showWelcomeState ? (
                <ChatWelcomeState
                  onSelectSuggestion={(prompt) => void ws.submitMessage(prompt)}
                  disabled={ws.isSending}
                />
              ) : (
                ws.activeGraphNodes.map((node) => (
                  <ChatMessageItem
                    key={node.message.id}
                    message={node.message}
                    siblingIndex={node.siblingIndex}
                    siblingCount={node.siblingCount}
                    onSelectBranch={(direction) => ws.handleSelectBranch(node, direction)}
                    onEditMessage={ws.handleEditMessage}
                    isBusy={ws.isSending}
                  />
                ))
              )}

              {ws.isStreaming && !ws.hasStreamingAssistantContent ? <ChatTypingIndicator /> : null}

              <div ref={ws.messagesEndRef} />
            </div>
          </div>

          <ChatComposer
            draft={ws.draft}
            onDraftChange={ws.setDraft}
            onSubmit={() => void ws.submitMessage(ws.draft)}
            isSending={ws.isSending}
          />
        </main>
      </div>

      <MobileConversationDrawer
        open={ws.mobileHistoryOpen}
        onOpenChange={ws.setMobileHistoryOpen}
        {...sidebarProps}
      />

      <ProfileSettingsDialog user={user} open={ws.profileOpen} onOpenChange={ws.setProfileOpen} />

      <AdminOperatorDialog open={ws.adminOpen} onOpenChange={ws.setAdminOpen} />
    </div>
  );
}
