import { Link } from '@tanstack/react-router';
import type { KnowledgeDocumentResponseDto, UserResponseDto } from '@semcache/shared-dtos';
import { KnowledgeDocumentStatus, QueryCategory } from '@semcache/shared-types';
import {
  AlertTriangle,
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  Eye,
  FileText,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  UploadCloud,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  CATEGORY_LABELS,
  FORMAT_LABELS,
  STATUS_LABELS,
  filterKnowledgeDocuments,
} from '@/features/knowledge-base/model/knowledge-base-helpers';
import {
  useDeleteKnowledgeDocumentMutation,
  useKnowledgeDocumentsQuery,
  useReprocessKnowledgeDocumentMutation,
} from '@/features/knowledge-base/model/use-knowledge-base';
import { KnowledgeBaseDetailDialog } from '@/features/knowledge-base/ui/knowledge-base-detail-dialog';
import { KnowledgeBaseRetrievalTester } from '@/features/knowledge-base/ui/knowledge-base-retrieval-tester';
import { KnowledgeBaseUploadDialog } from '@/features/knowledge-base/ui/knowledge-base-upload-dialog';
import { ThemeToggle } from '@/features/theme/ui/theme-toggle';
import { getAuthServerError } from '@/shared/api/api-client';
import { useFileDropZone } from '@/shared/lib/use-file-drop-zone';
import { Badge } from '@/shared/ui/badge';
import { BrandLogo } from '@/shared/ui/brand-logo';
import { Button } from '@/shared/ui/button';
import { Card } from '@/shared/ui/card';
import { CardContent } from '@/shared/ui/card-content';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/dialog';
import { Input } from '@/shared/ui/input';

export interface KnowledgeBaseWorkspaceProps {
  user: UserResponseDto;
}

export function KnowledgeBaseWorkspace({ user }: KnowledgeBaseWorkspaceProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<QueryCategory | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<KnowledgeDocumentStatus | 'all'>('all');
  const [uploadOpen, setUploadOpen] = useState(false);
  const [pendingDroppedFiles, setPendingDroppedFiles] = useState<File[]>([]);
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<KnowledgeDocumentResponseDto | null>(null);

  const { isDragging, dropZoneProps } = useFileDropZone({
    disabled: uploadOpen || Boolean(selectedDocId) || Boolean(deleteTarget),
    onDropFiles: (files) => {
      setPendingDroppedFiles(files);
      setUploadOpen(true);
    },
  });

  const documentsQuery = useKnowledgeDocumentsQuery();
  const reprocessMutation = useReprocessKnowledgeDocumentMutation();
  const deleteMutation = useDeleteKnowledgeDocumentMutation();

  const documents = documentsQuery.data ?? [];

  const filteredDocuments = useMemo(
    () =>
      filterKnowledgeDocuments(documents, {
        searchQuery,
        category: categoryFilter,
        status: statusFilter,
      }),
    [documents, searchQuery, categoryFilter, statusFilter],
  );

  const stats = useMemo(() => {
    let readyCount = 0;
    let processingCount = 0;
    let failedCount = 0;
    let totalChunks = 0;

    for (const doc of documents) {
      if (doc.status === KnowledgeDocumentStatus.READY) {
        readyCount += 1;
        totalChunks += doc.chunkCount;
      } else if (
        doc.status === KnowledgeDocumentStatus.PROCESSING ||
        doc.status === KnowledgeDocumentStatus.PENDING
      ) {
        processingCount += 1;
      } else if (doc.status === KnowledgeDocumentStatus.FAILED) {
        failedCount += 1;
      }
    }
    return { total: documents.length, readyCount, processingCount, failedCount, totalChunks };
  }, [documents]);

  const handleRetry = async (documentId: string) => {
    try {
      const updated = await reprocessMutation.mutateAsync(documentId);
      if (updated.status === KnowledgeDocumentStatus.FAILED) {
        toast.error(updated.errorMessage || 'Document reprocessing failed.');
      } else {
        toast.success(`Reprocessed "${updated.title}" successfully.`);
      }
    } catch (error) {
      toast.error(getAuthServerError(error as Error, 'Failed to retry document processing.'));
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) {
      return;
    }
    try {
      const result = await deleteMutation.mutateAsync(deleteTarget.id);
      toast.success(
        `Deleted "${deleteTarget.title}" and ${result.deletedChunksCount} indexed chunk(s).`,
      );
      if (selectedDocId === deleteTarget.id) {
        setSelectedDocId(null);
      }
      setDeleteTarget(null);
    } catch (error) {
      toast.error(getAuthServerError(error as Error, 'Failed to delete document.'));
    }
  };

  return (
    <div {...dropZoneProps} className="relative min-h-screen bg-background text-foreground">
      {isDragging ? (
        <div
          data-testid="kb-page-drop-overlay"
          className="pointer-events-none fixed inset-0 z-40 flex items-center justify-center bg-background/80 p-6 backdrop-blur-xs"
        >
          <div className="flex max-w-md flex-col items-center rounded-2xl border-2 border-dashed border-primary bg-card/95 px-8 py-10 text-center shadow-xl">
            <div className="mb-3 flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary">
              <UploadCloud className="size-7" />
            </div>
            <p className="text-base font-semibold text-foreground">Drop documents to upload</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Supported formats: .txt, .md, .html, .json, .pdf, .docx
            </p>
          </div>
        </div>
      ) : null}
      <header className="border-b bg-card">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <BrandLogo compact className="sm:hidden" />
            <BrandLogo subtitle="Operator Dashboard" className="hidden sm:flex" />
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="truncate text-sm font-semibold sm:text-base">
                  Knowledge Base Management
                </h1>
                <Badge variant="teal" className="hidden sm:inline-flex">
                  <BookOpen className="size-3" />
                  RAG Corpus
                </Badge>
              </div>
              <p className="truncate text-xs text-muted-foreground">Signed in as {user.email}</p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <Button asChild variant="outline" size="sm">
              <Link to="/">
                <ArrowLeft className="size-4" />
                <span className="hidden sm:inline">Support Chat</span>
              </Link>
            </Button>
            <ThemeToggle />
            <Button type="button" size="sm" onClick={() => setUploadOpen(true)}>
              <Plus className="size-4" />
              Upload Documents
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6">
        <section
          aria-label="Knowledge Base Processing Summary"
          className="grid gap-3 sm:grid-cols-4"
        >
          <Card className="p-4">
            <p className="text-xs font-medium text-muted-foreground">Total Documents</p>
            <p className="mt-1 text-2xl font-bold">{stats.total}</p>
          </Card>
          <Card className="p-4">
            <p className="text-xs font-medium text-muted-foreground">Ready & Indexed</p>
            <div className="mt-1 flex items-baseline gap-2">
              <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                {stats.readyCount}
              </p>
              <span className="text-xs text-muted-foreground">({stats.totalChunks} chunks)</span>
            </div>
          </Card>
          <Card className="p-4">
            <p className="text-xs font-medium text-muted-foreground">Processing Queue</p>
            <div className="mt-1 flex items-center gap-2">
              <p className="text-2xl font-bold text-primary">{stats.processingCount}</p>
              {stats.processingCount > 0 ? (
                <Badge variant="teal" className="text-[11px]">
                  <Loader2 className="size-3 animate-spin" />
                  Live polling
                </Badge>
              ) : null}
            </div>
          </Card>
          <Card className="p-4">
            <p className="text-xs font-medium text-muted-foreground">Failed Processing</p>
            <p className="mt-1 text-2xl font-bold text-destructive">{stats.failedCount}</p>
          </Card>
        </section>

        <div className="grid gap-6 lg:grid-cols-12">
          <section className="space-y-4 lg:col-span-7">
            <Card>
              <CardContent className="space-y-4 p-4">
                <div className="flex flex-wrap items-center gap-2.5">
                  <div className="relative min-w-52 flex-1">
                    <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      aria-label="Search documents"
                      placeholder="Search by title, filename, or error..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9"
                    />
                  </div>

                  <select
                    aria-label="Filter by category"
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value as QueryCategory | 'all')}
                    className="h-9 rounded-md border border-input bg-background px-3 text-xs"
                  >
                    <option value="all">All categories</option>
                    {Object.values(QueryCategory).map((cat) => (
                      <option key={cat} value={cat}>
                        {CATEGORY_LABELS[cat]}
                      </option>
                    ))}
                  </select>

                  <select
                    aria-label="Filter by status"
                    value={statusFilter}
                    onChange={(e) =>
                      setStatusFilter(e.target.value as KnowledgeDocumentStatus | 'all')
                    }
                    className="h-9 rounded-md border border-input bg-background px-3 text-xs"
                  >
                    <option value="all">All statuses</option>
                    {Object.values(KnowledgeDocumentStatus).map((status) => (
                      <option key={status} value={status}>
                        {STATUS_LABELS[status]}
                      </option>
                    ))}
                  </select>

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => void documentsQuery.refetch()}
                    disabled={documentsQuery.isFetching}
                    aria-label="Refresh documents"
                  >
                    <RefreshCw
                      className={`size-4 ${documentsQuery.isFetching ? 'animate-spin' : ''}`}
                    />
                  </Button>
                </div>

                {documentsQuery.isPending ? (
                  <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
                    <Loader2 className="size-4 animate-spin" />
                    Loading knowledge base documents...
                  </div>
                ) : filteredDocuments.length === 0 ? (
                  <div className="rounded-xl border border-dashed py-12 text-center">
                    <FileText className="mx-auto size-8 text-muted-foreground/60" />
                    <p className="mt-2 text-sm font-medium text-foreground">
                      {documents.length === 0
                        ? 'No knowledge documents uploaded yet'
                        : 'No documents match your current filters'}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {documents.length === 0
                        ? 'Drag and drop files onto this page or click Upload Documents to ground the AI Support Service.'
                        : 'Try clearing the search query or changing the category/status filter.'}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {filteredDocuments.map((doc) => (
                      <div
                        key={doc.id}
                        className="flex flex-col justify-between gap-3 rounded-xl border bg-background p-3.5 sm:flex-row sm:items-center"
                      >
                        <div className="min-w-0 space-y-1.5">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="truncate text-sm font-semibold text-foreground">
                              {doc.title}
                            </p>
                            {doc.status === KnowledgeDocumentStatus.READY ? (
                              <Badge variant="success">
                                <CheckCircle2 className="size-3" />
                                Ready
                              </Badge>
                            ) : doc.status === KnowledgeDocumentStatus.FAILED ? (
                              <Badge
                                variant="outline"
                                className="border-destructive/50 text-destructive"
                              >
                                <AlertTriangle className="size-3" />
                                Failed
                              </Badge>
                            ) : (
                              <Badge variant="teal">
                                <Loader2 className="size-3 animate-spin" />
                                {STATUS_LABELS[doc.status]}
                              </Badge>
                            )}
                          </div>

                          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                            <Badge variant="secondary" className="text-[11px]">
                              {CATEGORY_LABELS[doc.category]}
                            </Badge>
                            <span>{FORMAT_LABELS[doc.format]}</span>
                            {doc.fileName ? <span>• {doc.fileName}</span> : null}
                            <span>• {doc.chunkCount} chunks</span>
                            <span>• {doc.characterCount.toLocaleString()} chars</span>
                          </div>

                          {doc.status === KnowledgeDocumentStatus.FAILED && doc.errorMessage ? (
                            <p className="text-xs text-destructive">{doc.errorMessage}</p>
                          ) : null}
                        </div>

                        <div className="flex shrink-0 items-center gap-1.5">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setSelectedDocId(doc.id)}
                          >
                            <Eye className="size-3.5" />
                            Details
                          </Button>

                          {doc.status === KnowledgeDocumentStatus.FAILED ? (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => void handleRetry(doc.id)}
                              disabled={reprocessMutation.isPending}
                            >
                              <RefreshCw
                                className={`size-3.5 ${
                                  reprocessMutation.isPending ? 'animate-spin' : ''
                                }`}
                              />
                              Retry
                            </Button>
                          ) : null}

                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            aria-label={`Delete ${doc.title}`}
                            onClick={() => setDeleteTarget(doc)}
                          >
                            <Trash2 className="size-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </section>

          <aside className="lg:col-span-5">
            <KnowledgeBaseRetrievalTester />
          </aside>
        </div>
      </main>

      <KnowledgeBaseUploadDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        pendingFiles={pendingDroppedFiles}
        onPendingFilesConsumed={() => setPendingDroppedFiles([])}
      />

      <KnowledgeBaseDetailDialog
        documentId={selectedDocId}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedDocId(null);
          }
        }}
      />

      <Dialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteTarget(null);
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Knowledge Document</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete <strong>{deleteTarget?.title}</strong>? This will
              permanently remove the document and all {deleteTarget?.chunkCount ?? 0} associated
              chunks and embeddings from the RAG index.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeleteTarget(null)}
              disabled={deleteMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => void handleConfirmDelete()}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? 'Deleting...' : 'Delete Document'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
