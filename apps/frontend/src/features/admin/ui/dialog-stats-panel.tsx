import type { DialogStatsResponseDto } from '@semcache/shared-dtos';
import { Clock, Loader2, MessageSquare, Sparkles, Users } from 'lucide-react';
import { formatLatencyMs, formatPercent } from '@/features/admin/model/admin-helpers';
import { Badge } from '@/shared/ui/badge';
import { Card } from '@/shared/ui/card';
import { CardContent } from '@/shared/ui/card-content';
import { CardDescription } from '@/shared/ui/card-description';
import { CardHeader } from '@/shared/ui/card-header';
import { CardTitle } from '@/shared/ui/card-title';

export interface DialogStatsPanelProps {
  stats?: DialogStatsResponseDto;
  isPending: boolean;
  isError: boolean;
}

export function DialogStatsPanel({ stats, isPending, isError }: DialogStatsPanelProps) {
  if (isPending) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Loading dialog statistics...
        </CardContent>
      </Card>
    );
  }

  if (isError || !stats) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-sm text-destructive">
          Unable to load dialog statistics right now.
        </CardContent>
      </Card>
    );
  }

  return (
    <section aria-label="Dialog & Inference Statistics" className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-muted-foreground">Total Dialogs</p>
            <MessageSquare className="size-4 text-primary" />
          </div>
          <p className="mt-1 text-2xl font-bold">{stats.totalDialogs.toLocaleString()}</p>
          <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
            <Users className="size-3.5" />
            {stats.activeUsersCount} active user(s)
          </p>
        </Card>

        <Card className="p-4">
          <p className="text-xs font-medium text-muted-foreground">Total Messages</p>
          <p className="mt-1 text-2xl font-bold">{stats.totalMessages.toLocaleString()}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {stats.userMessages.toLocaleString()} user • {stats.assistantMessages.toLocaleString()}{' '}
            assistant
          </p>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-muted-foreground">Observed Cache Hit Rate</p>
            <Sparkles className="size-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <p className="mt-1 text-2xl font-bold text-emerald-600 dark:text-emerald-400">
            {formatPercent(stats.cacheHitRate)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {stats.cachedAssistantMessages.toLocaleString()} cached •{' '}
            {stats.llmAssistantMessages.toLocaleString()} LLM turns
          </p>
        </Card>

        <Card className="p-4">
          <p className="text-xs font-medium text-muted-foreground">Total LLM Tokens</p>
          <p className="mt-1 text-2xl font-bold">{stats.totalTokens.toLocaleString()}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {stats.promptTokens.toLocaleString()} prompt • {stats.completionTokens.toLocaleString()}{' '}
            completion
          </p>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-12">
        <Card className="lg:col-span-5">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Clock className="size-4 text-primary" />
              Assistant Turn Latency
            </CardTitle>
            <CardDescription>
              Average end-to-end latency comparing semantic cache hits against LLM calls.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-3 gap-2.5">
            <div className="rounded-xl border bg-muted/20 p-3">
              <p className="text-[11px] font-medium text-muted-foreground">Overall Avg</p>
              <p className="mt-1 text-base font-semibold">
                {formatLatencyMs(stats.averageLatencyMs)}
              </p>
            </div>
            <div className="rounded-xl border bg-emerald-500/5 p-3">
              <p className="text-[11px] font-medium text-muted-foreground">Cache Hit Avg</p>
              <p className="mt-1 text-base font-semibold text-emerald-600 dark:text-emerald-400">
                {formatLatencyMs(stats.averageCachedLatencyMs)}
              </p>
            </div>
            <div className="rounded-xl border bg-muted/20 p-3">
              <p className="text-[11px] font-medium text-muted-foreground">LLM Call Avg</p>
              <p className="mt-1 text-base font-semibold">
                {formatLatencyMs(stats.averageLlmLatencyMs)}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-7">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Recent Dialog Activity</CardTitle>
            <CardDescription>Most recently updated customer support conversations.</CardDescription>
          </CardHeader>
          <CardContent>
            {stats.recentDialogs.length === 0 ? (
              <p className="py-4 text-center text-xs text-muted-foreground">
                No dialog activity recorded yet.
              </p>
            ) : (
              <div className="space-y-2">
                {stats.recentDialogs.map((dialog) => (
                  <div
                    key={dialog.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-xl border bg-background px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">{dialog.title}</p>
                      <p className="text-xs text-muted-foreground">
                        Updated {new Date(dialog.updatedAt).toLocaleString()}
                      </p>
                    </div>
                    <Badge variant="secondary">{dialog.messageCount} msg(s)</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
