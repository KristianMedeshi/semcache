import { KNOWLEDGE_BASE_VALIDATION_LIMITS } from '@semcache/shared-dtos';
import { QueryCategory } from '@semcache/shared-types';
import { FileText, Loader2, Search, Sparkles } from 'lucide-react';
import { type FormEvent, useState } from 'react';
import { toast } from 'sonner';
import { useSearchKnowledgeBaseMutation } from '@/features/knowledge-base/model/use-knowledge-base';
import { QueryCategorySelect } from '@/features/knowledge-base/ui/query-category-select';
import { getAuthServerError } from '@/shared/api/api-client';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import { Card } from '@/shared/ui/card';
import { CardContent } from '@/shared/ui/card-content';
import { CardDescription } from '@/shared/ui/card-description';
import { CardHeader } from '@/shared/ui/card-header';
import { CardTitle } from '@/shared/ui/card-title';
import { Input } from '@/shared/ui/input';
import { Label } from '@/shared/ui/label';

export function KnowledgeBaseRetrievalTester() {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<QueryCategory | 'all'>('all');
  const [topK, setTopK] = useState<number>(KNOWLEDGE_BASE_VALIDATION_LIMITS.DEFAULT_TOP_K);
  const [minSimilarity, setMinSimilarity] = useState<number>(
    KNOWLEDGE_BASE_VALIDATION_LIMITS.DEFAULT_MIN_SIMILARITY,
  );

  const searchMutation = useSearchKnowledgeBaseMutation();

  const handleSearch = async (event: FormEvent) => {
    event.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) {
      toast.error('Enter a customer question to test retrieval.');
      return;
    }

    try {
      await searchMutation.mutateAsync({
        query: trimmed,
        topK,
        minSimilarity,
        ...(category !== 'all' ? { category } : {}),
      });
    } catch (error) {
      toast.error(getAuthServerError(error as Error, 'Knowledge retrieval search failed.'));
    }
  };

  const result = searchMutation.data;

  return (
    <Card className="h-fit">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="size-4.5 text-primary" />
          Test Knowledge Retrieval (RAG)
        </CardTitle>
        <CardDescription>
          Enter a customer question to preview the exact document chunks and source references
          returned to the AI Support Service.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <form onSubmit={(e) => void handleSearch(e)} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="kb-rag-query">Customer Question</Label>
            <Input
              id="kb-rag-query"
              placeholder="e.g. How much EU roaming data is included in 5G Unlimited?"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>

          <div className="grid gap-2.5 sm:grid-cols-3">
            <div className="space-y-1">
              <Label htmlFor="kb-rag-category" className="text-xs">
                Category
              </Label>
              <QueryCategorySelect
                id="kb-rag-category"
                value={category}
                onChange={setCategory}
                includeAllOption
                className="px-2.5 text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="kb-rag-topk" className="text-xs">
                Top Results
              </Label>
              <Input
                id="kb-rag-topk"
                type="number"
                min={KNOWLEDGE_BASE_VALIDATION_LIMITS.MIN_TOP_K}
                max={KNOWLEDGE_BASE_VALIDATION_LIMITS.MAX_TOP_K}
                value={topK}
                onChange={(e) => setTopK(Number(e.target.value))}
                className="h-9 text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="kb-rag-min-sim" className="text-xs">
                Min Similarity
              </Label>
              <Input
                id="kb-rag-min-sim"
                type="number"
                step="0.05"
                min={0}
                max={1}
                value={minSimilarity}
                onChange={(e) => setMinSimilarity(Number(e.target.value))}
                className="h-9 text-xs"
              />
            </div>
          </div>

          <Button type="submit" className="w-full" disabled={searchMutation.isPending}>
            {searchMutation.isPending ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Searching Knowledge Base...
              </>
            ) : (
              <>
                <Search className="size-4" />
                Test Retrieval
              </>
            )}
          </Button>
        </form>

        {result ? (
          <div className="space-y-3 border-t pt-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Badge variant={result.hasRelevantContext ? 'success' : 'secondary'}>
                {result.hasRelevantContext
                  ? `${result.results.length} relevant chunk(s) found`
                  : 'No matching context found'}
              </Badge>
              {result.sources.length > 0 ? (
                <span className="text-xs text-muted-foreground">
                  {result.sources.length} source reference(s)
                </span>
              ) : null}
            </div>

            {!result.hasRelevantContext ? (
              <p className="rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground">
                No indexed chunks met the similarity threshold ({minSimilarity}). The AI Support
                Service will acknowledge insufficient knowledge base information for this query.
              </p>
            ) : (
              <div className="max-h-96 space-y-2.5 overflow-y-auto pr-1">
                {result.results.map((chunk) => (
                  <div key={chunk.chunkId} className="rounded-xl border bg-background p-3">
                    <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 text-xs font-medium text-foreground">
                        <FileText className="size-3.5 text-primary" />
                        <span>{chunk.documentTitle}</span>
                        {chunk.fileName ? (
                          <span className="text-muted-foreground">({chunk.fileName})</span>
                        ) : null}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Badge variant="teal" className="text-[11px]">
                          {(chunk.similarity * 100).toFixed(1)}% match
                        </Badge>
                        <Badge variant="outline" className="text-[11px]">
                          Chunk #{chunk.chunkIndex + 1}
                        </Badge>
                      </div>
                    </div>
                    <p className="whitespace-pre-wrap text-xs leading-relaxed text-muted-foreground">
                      {chunk.content}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
