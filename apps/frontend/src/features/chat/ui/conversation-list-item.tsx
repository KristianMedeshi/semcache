import type { DialogResponseDto } from '@semcache/shared-dtos';
import { formatDistanceToNow } from 'date-fns';
import { MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import { Button } from '@/shared/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/shared/ui/dropdown-menu';

export interface ConversationListItemProps {
  dialog: DialogResponseDto;
  isSelected: boolean;
  preview: string;
  isBusy: boolean;
  onSelect: () => void;
  onStartRename?: () => void;
  onStartDelete?: () => void;
}

function formatRelativeTime(isoDate: string): string {
  try {
    return formatDistanceToNow(new Date(isoDate), { addSuffix: true });
  } catch {
    return '';
  }
}

export function ConversationListItem({
  dialog,
  isSelected,
  preview,
  isBusy,
  onSelect,
  onStartRename,
  onStartDelete,
}: ConversationListItemProps) {
  return (
    <div
      className={cn(
        'group relative flex w-full items-start gap-1 rounded-xl border px-3 py-2.5 transition-all',
        isSelected
          ? 'border-primary/25 bg-card text-foreground shadow-xs'
          : 'border-transparent text-muted-foreground hover:border-border/60 hover:bg-card/70 hover:text-foreground',
      )}
    >
      {isSelected ? (
        <span
          aria-hidden="true"
          className="absolute top-2.5 bottom-2.5 left-0 w-1 rounded-r-full bg-primary"
        />
      ) : null}

      <button
        type="button"
        onClick={onSelect}
        aria-current={isSelected ? 'true' : undefined}
        className="flex min-w-0 flex-1 flex-col gap-1 text-left"
      >
        <div className="flex items-center justify-between gap-2">
          <span
            className={cn(
              'truncate text-xs',
              isSelected ? 'font-semibold text-foreground' : 'font-medium text-foreground',
            )}
          >
            {dialog.title}
          </span>
          <span className="shrink-0 text-[10px] text-muted-foreground">
            {formatRelativeTime(dialog.updatedAt)}
          </span>
        </div>

        <p className="truncate text-[11px] text-muted-foreground">{preview}</p>
      </button>

      {onStartRename || onStartDelete ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={`Actions for ${dialog.title}`}
              disabled={isBusy}
              className="size-7 shrink-0 rounded-md text-muted-foreground opacity-80 transition-opacity hover:text-foreground group-hover:opacity-100 data-[state=open]:opacity-100"
            >
              <MoreHorizontal className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="right" align="start" className="w-44">
            {onStartRename ? (
              <DropdownMenuItem onSelect={onStartRename}>
                <Pencil className="size-4 text-muted-foreground" />
                Rename
              </DropdownMenuItem>
            ) : null}
            {onStartDelete ? (
              <DropdownMenuItem
                onSelect={onStartDelete}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="size-4" />
                Delete
              </DropdownMenuItem>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
    </div>
  );
}
