import { Check, ChevronLeft, ChevronRight, Copy, ThumbsDown, ThumbsUp } from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import { Button } from '@/shared/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/ui/tooltip';

export interface BranchControlsProps {
  siblingIndex: number;
  siblingCount: number;
  isBusy: boolean;
  onSelectBranch?: (direction: 'prev' | 'next') => void;
}

export function BranchControls({
  siblingIndex,
  siblingCount,
  isBusy,
  onSelectBranch,
}: BranchControlsProps) {
  if (siblingCount <= 1 || !onSelectBranch) {
    return null;
  }

  return (
    <div className="flex items-center gap-0.5 text-[11px] text-muted-foreground">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label="Previous branch"
        disabled={isBusy || siblingIndex <= 0}
        onClick={() => onSelectBranch('prev')}
        className="size-6 rounded-md text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="size-3.5" />
      </Button>
      <span className="min-w-8 text-center font-medium tabular-nums">
        {siblingIndex + 1} / {siblingCount}
      </span>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label="Next branch"
        disabled={isBusy || siblingIndex >= siblingCount - 1}
        onClick={() => onSelectBranch('next')}
        className="size-6 rounded-md text-muted-foreground hover:text-foreground"
      >
        <ChevronRight className="size-3.5" />
      </Button>
    </div>
  );
}

export interface AssistantMessageActionsProps extends BranchControlsProps {
  feedback: 'up' | 'down' | null;
  copied: boolean;
  onFeedback: (type: 'up' | 'down') => void;
  onCopy: () => void;
}

export function AssistantMessageActions({
  feedback,
  copied,
  onFeedback,
  onCopy,
  ...branchProps
}: AssistantMessageActionsProps) {
  return (
    <TooltipProvider>
      <div className="flex items-center gap-1 px-1 pt-0.5">
        <BranchControls {...branchProps} />
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Helpful response"
              aria-pressed={feedback === 'up'}
              onClick={() => onFeedback('up')}
              className={cn(
                'size-7 rounded-lg text-muted-foreground hover:text-foreground',
                feedback === 'up' && 'bg-accent text-accent-foreground',
              )}
            >
              <ThumbsUp className="size-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Helpful</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Not helpful response"
              aria-pressed={feedback === 'down'}
              onClick={() => onFeedback('down')}
              className={cn(
                'size-7 rounded-lg text-muted-foreground hover:text-foreground',
                feedback === 'down' && 'bg-destructive/10 text-destructive',
              )}
            >
              <ThumbsDown className="size-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Not helpful</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Copy response"
              onClick={onCopy}
              className="size-7 rounded-lg text-muted-foreground hover:text-foreground"
            >
              {copied ? (
                <Check className="size-3.5 text-emerald-600" />
              ) : (
                <Copy className="size-3.5" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent>{copied ? 'Copied' : 'Copy response'}</TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
}
