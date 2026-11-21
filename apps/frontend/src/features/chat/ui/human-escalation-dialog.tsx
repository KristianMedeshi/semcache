import { Clock, Headset, MessageSquareCheck, ShieldCheck } from 'lucide-react';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/dialog';

export interface HumanEscalationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conversationTitle?: string;
  onConfirmTransfer: () => void;
}

export function HumanEscalationDialog({
  open,
  onOpenChange,
  conversationTitle,
  onConfirmTransfer,
}: HumanEscalationDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <div className="mb-1 flex items-center gap-2">
            <Badge variant="success">
              <span className="size-1.5 rounded-full bg-emerald-500" />
              Specialists Available
            </Badge>
          </div>
          <DialogTitle className="flex items-center gap-2">
            <Headset className="size-5 text-primary" />
            Talk to a human agent
          </DialogTitle>
          <DialogDescription>
            Connect with a SemCache Telecom support specialist. Your current conversation summary
            will be shared so you don&apos;t have to repeat yourself.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 rounded-xl border bg-secondary/40 p-4 text-sm">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-muted-foreground">
              <Clock className="size-4 text-primary" />
              Estimated wait time
            </span>
            <span className="font-semibold text-foreground">Under 2 minutes</span>
          </div>

          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-muted-foreground">
              <MessageSquareCheck className="size-4 text-primary" />
              Context handoff
            </span>
            <span className="max-w-[200px] truncate font-medium text-foreground">
              {conversationTitle || 'New support inquiry'}
            </span>
          </div>

          <div className="flex items-center gap-2 pt-1 text-xs text-muted-foreground">
            <ShieldCheck className="size-4 shrink-0 text-cyan-600 dark:text-cyan-400" />
            <span>Verified subscriber session will be securely transferred.</span>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Stay with Telecom Assistant
          </Button>
          <Button
            type="button"
            onClick={() => {
              onConfirmTransfer();
              onOpenChange(false);
            }}
          >
            <Headset className="size-4" />
            Request live agent
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
