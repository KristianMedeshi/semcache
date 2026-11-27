import { Link } from '@tanstack/react-router';
import type { KnowledgeDocumentResponseDto, UserResponseDto } from '@semcache/shared-dtos';
import { KnowledgeDocumentStatus, QueryCategory } from '@semcache/shared-types';
import {
  ArrowLeft,
  BookOpen,
  FileText,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  SlidersHorizontal,
  UploadCloud,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  STATUS_LABELS,
  filterKnowledgeDocuments,
} from '@/features/knowledge-base/model/knowledge-base-helpers';
import {
  useDeleteKnowledgeDocumentMutation,
  useKnowledgeDocumentsQuery,
  useReprocessKnowledgeDocumentMutation,
} from '@/features/knowledge-base/model/use-knowledge-base';
import { KnowledgeBaseDetailDialog } from '@/features/knowledge-base/ui/knowledge-base-detail-dialog';
import { KnowledgeBaseDocumentRow } from '@/features/knowledge-base/ui/knowledge-base-document-row';
import { KnowledgeBaseRetrievalTester } from '@/features/knowledge-base/ui/knowledge-base-retrieval-tester';
import { KnowledgeBaseStats } from '@/features/knowledge-base/ui/knowledge-base-stats';
import { KnowledgeBaseUploadDialog } from '@/features/knowledge-base/ui/knowledge-base-upload-dialog';
import { QueryCategorySelect } from '@/features/knowledge-base/ui/query-category-select';
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
import { AppHeader } from '@/widgets/app-header/ui/app-header';

export interface KnowledgeBaseWorkspaceProps {
  user: UserResponseDto;
}

export function KnowledgeBaseWorkspace({ user }: KnowledgeBaseWorkspaceProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<QueryCategory | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<KnowledgeDocumentStatus | 'all'>('all');
  const [uploadOpen, setUploadOpen] = useState(false);
  const [pendingDroppedFiles, setPendingDroppedFiles] = useState<File[]>([]);
  const [selectedDoc, setSelectedDoc] = useState<{ id: string; edit: boolean } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<KnowledgeDocumentResponseDto | null>(null);

  const { isDragging, dropZoneProps } = useFileDropZone({
    disabled: uploadOpen || Boolean(selectedDoc) || Boolean(deleteTarget),
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
      if (selectedDoc?.id === deleteTarget.id) {
        setSelectedDoc(null);
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

      <AppHeader containerClassName="mx-auto max-w-7xl px-4 sm:px-6">
        <AppHeader.Left>
          <AppHeader.Brand to="/">
            <BrandLogo compact className="sm:hidden" />
            <BrandLogo subtitle="Operator Dashboard" className="hidden sm:flex" />
          </AppHeader.Brand>
          <AppHeader.Divider />
          <AppHeader.Title
            title="Knowledge Base Management"
            badge={
              <Badge variant="teal" className="hidden sm:inline-flex">
                <BookOpen className="size-3" />
                RAG Corpus
              </Badge>
            }
            subtitle={`Signed in as ${user.email}`}
          />
        </AppHeader.Left>
      </AppHeader>

      <main className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild variant="outline" size="sm">
              <Link to="/">
                <ArrowLeft className="size-4" />
                <span>Support Chat</span>
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link to="/admin">
                <SlidersHorizontal className="size-4 text-primary" />
                <span>Admin Panel</span>
              </Link>
            </Button>
          </div>
          <Button type="button" size="sm" onClick={() => setUploadOpen(true)}>
            <Plus className="size-4" />
            Upload Documents
          </Button>
        </div>

        <KnowledgeBaseStats documents={documents} />

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

                  <QueryCategorySelect
                    ariaLabel="Filter by category"
                    value={categoryFilter}
                    onChange={setCategoryFilter}
                    includeAllOption
                    className="w-auto text-xs"
                  />

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
                      <KnowledgeBaseDocumentRow
                        key={doc.id}
                        doc={doc}
                        isReprocessing={reprocessMutation.isPending}
                        onSelect={() => setSelectedDoc({ id: doc.id, edit: false })}
                        onEdit={() => setSelectedDoc({ id: doc.id, edit: true })}
                        onRetry={() => void handleRetry(doc.id)}
                        onDelete={() => setDeleteTarget(doc)}
                      />
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
        documentId={selectedDoc?.id ?? null}
        initialEditMode={selectedDoc?.edit ?? false}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedDoc(null);
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
