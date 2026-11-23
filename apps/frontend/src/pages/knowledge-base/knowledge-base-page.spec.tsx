import { QueryClientProvider } from '@tanstack/react-query';
import type {
  KnowledgeDocumentDetailResponseDto,
  KnowledgeDocumentResponseDto,
  RetrieveKnowledgeContextResponseDto,
  UserResponseDto,
} from '@semcache/shared-dtos';
import {
  KnowledgeDocumentFormat,
  KnowledgeDocumentStatus,
  QueryCategory,
  UserRole,
} from '@semcache/shared-types';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as authHooks from '@/features/auth/model/use-auth';
import * as kbClient from '@/features/knowledge-base/api/knowledge-base.client';
import { KnowledgeBasePage } from '@/pages/knowledge-base/ui/knowledge-base-page';
import { createAppQueryClient } from '@/shared/api/query-client';

vi.mock('@/features/auth/model/use-auth', () => ({
  useCurrentUserQuery: vi.fn(),
}));

vi.mock('@/features/knowledge-base/api/knowledge-base.client', () => ({
  listKnowledgeDocuments: vi.fn(),
  getKnowledgeDocument: vi.fn(),
  uploadKnowledgeDocument: vi.fn(),
  uploadMultipleKnowledgeDocuments: vi.fn(),
  reprocessKnowledgeDocument: vi.fn(),
  deleteKnowledgeDocument: vi.fn(),
  searchKnowledgeBase: vi.fn(),
}));

const adminUser: UserResponseDto = {
  id: 'admin-1',
  email: 'operator@semcache.telecom',
  role: UserRole.ADMIN,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const customerUser: UserResponseDto = {
  ...adminUser,
  id: 'customer-1',
  email: 'customer@example.com',
  role: UserRole.CUSTOMER,
};

const sampleDocs: KnowledgeDocumentResponseDto[] = [
  {
    id: 'doc-ready-1',
    title: 'EU Roaming Guide',
    fileName: 'roaming.md',
    format: KnowledgeDocumentFormat.MARKDOWN,
    category: QueryCategory.PRODUCT_INQUIRY,
    status: KnowledgeDocumentStatus.READY,
    chunkCount: 3,
    characterCount: 1450,
    errorMessage: null,
    metadata: {},
    uploadedBy: adminUser.id,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:01:00.000Z',
  },
  {
    id: 'doc-failed-2',
    title: 'Billing Schedule',
    fileName: 'billing.json',
    format: KnowledgeDocumentFormat.JSON,
    category: QueryCategory.BILLING,
    status: KnowledgeDocumentStatus.FAILED,
    chunkCount: 0,
    characterCount: 0,
    errorMessage: 'Embedding service timeout',
    metadata: {},
    uploadedBy: adminUser.id,
    createdAt: '2026-01-01T00:02:00.000Z',
    updatedAt: '2026-01-01T00:02:00.000Z',
  },
];

function renderKnowledgeBasePage() {
  const client = createAppQueryClient();
  return render(
    <QueryClientProvider client={client}>
      <KnowledgeBasePage />
    </QueryClientProvider>,
  );
}

describe('KnowledgeBasePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('denies access to non-admin customers', () => {
    vi.mocked(authHooks.useCurrentUserQuery).mockReturnValue({
      data: customerUser,
      isPending: false,
    } as ReturnType<typeof authHooks.useCurrentUserQuery>);

    renderKnowledgeBasePage();

    expect(screen.getByText('Operator Access Required')).toBeVisible();
    expect(kbClient.listKnowledgeDocuments).not.toHaveBeenCalled();
  });

  it('renders documents, supports search/filtering, retrying failed docs, deleting, and testing RAG retrieval', async () => {
    const user = userEvent.setup();

    vi.mocked(authHooks.useCurrentUserQuery).mockReturnValue({
      data: adminUser,
      isPending: false,
    } as ReturnType<typeof authHooks.useCurrentUserQuery>);
    vi.mocked(kbClient.listKnowledgeDocuments).mockResolvedValue(sampleDocs);

    const reprocessedDoc: KnowledgeDocumentDetailResponseDto = {
      ...sampleDocs[1],
      status: KnowledgeDocumentStatus.READY,
      chunkCount: 2,
      characterCount: 400,
      errorMessage: null,
      content: 'Invoices are issued on the 1st.',
      chunks: [],
    };
    vi.mocked(kbClient.reprocessKnowledgeDocument).mockResolvedValueOnce(reprocessedDoc);
    vi.mocked(kbClient.deleteKnowledgeDocument).mockResolvedValueOnce({
      id: 'doc-ready-1',
      deleted: true,
      deletedChunksCount: 3,
    });

    const ragResult: RetrieveKnowledgeContextResponseDto = {
      query: 'How much EU roaming data?',
      hasRelevantContext: true,
      formattedContext: '[Source 1: EU Roaming Guide]\n25 GB included.',
      results: [
        {
          chunkId: 'chunk-1',
          documentId: 'doc-ready-1',
          documentTitle: 'EU Roaming Guide',
          fileName: 'roaming.md',
          category: QueryCategory.PRODUCT_INQUIRY,
          chunkIndex: 0,
          content: '5G Unlimited includes 25 GB EU roaming data.',
          similarity: 0.92,
          source: {
            documentId: 'doc-ready-1',
            documentTitle: 'EU Roaming Guide',
            fileName: 'roaming.md',
            category: QueryCategory.PRODUCT_INQUIRY,
            chunkId: 'chunk-1',
            chunkIndex: 0,
          },
        },
      ],
      sources: [
        {
          documentId: 'doc-ready-1',
          documentTitle: 'EU Roaming Guide',
          fileName: 'roaming.md',
          category: QueryCategory.PRODUCT_INQUIRY,
          chunkId: 'chunk-1',
          chunkIndex: 0,
        },
      ],
    };
    vi.mocked(kbClient.searchKnowledgeBase).mockResolvedValueOnce(ragResult);

    renderKnowledgeBasePage();

    expect(await screen.findByText('EU Roaming Guide')).toBeVisible();
    expect(screen.getByText('Billing Schedule')).toBeVisible();
    expect(screen.getByText('Embedding service timeout')).toBeVisible();

    // Filter by search query
    const searchInput = screen.getByLabelText('Search documents');
    await user.type(searchInput, 'Billing');
    expect(screen.queryByText('EU Roaming Guide')).not.toBeInTheDocument();
    expect(screen.getByText('Billing Schedule')).toBeVisible();

    // Retry failed document
    await user.click(screen.getByRole('button', { name: 'Retry' }));
    await waitFor(() => {
      expect(kbClient.reprocessKnowledgeDocument).toHaveBeenCalledWith('doc-failed-2');
    });

    // Clear search and delete a document
    await user.clear(searchInput);
    expect(await screen.findByText('EU Roaming Guide')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Delete EU Roaming Guide' }));
    const deleteDialog = await screen.findByRole('dialog');
    await user.click(within(deleteDialog).getByRole('button', { name: 'Delete Document' }));
    await waitFor(() => {
      expect(kbClient.deleteKnowledgeDocument).toHaveBeenCalledWith('doc-ready-1');
    });

    // Test RAG retrieval
    await user.type(screen.getByLabelText('Customer Question'), 'How much EU roaming data?');
    await user.click(screen.getByRole('button', { name: 'Test Retrieval' }));
    expect(await screen.findByText('1 relevant chunk(s) found')).toBeVisible();
    expect(screen.getByText('5G Unlimited includes 25 GB EU roaming data.')).toBeVisible();
    expect(screen.getByText('92.0% match')).toBeVisible();
  });

  it('uploads multiple documents via the Upload Documents dialog', async () => {
    const user = userEvent.setup();
    vi.mocked(authHooks.useCurrentUserQuery).mockReturnValue({
      data: adminUser,
      isPending: false,
    } as ReturnType<typeof authHooks.useCurrentUserQuery>);
    vi.mocked(kbClient.listKnowledgeDocuments).mockResolvedValue([]);
    vi.mocked(kbClient.uploadMultipleKnowledgeDocuments).mockResolvedValueOnce([
      {
        ...sampleDocs[0],
        content: 'File 1 content',
        chunks: [],
      },
      {
        ...sampleDocs[0],
        id: 'doc-ready-2',
        title: 'esim',
        fileName: 'esim.txt',
        content: 'File 2 content',
        chunks: [],
      },
    ]);

    renderKnowledgeBasePage();

    await user.click(await screen.findByRole('button', { name: /upload documents/i }));

    const fileInput = document.querySelector('#kb-file-upload') as HTMLInputElement;
    const file1 = new File(['File 1 content'], 'roaming.md', { type: 'text/markdown' });
    const file2 = new File(['File 2 content'], 'esim.txt', { type: 'text/plain' });
    // Ensure File.prototype.text works in jsdom
    file1.text = async () => 'File 1 content';
    file2.text = async () => 'File 2 content';

    await user.upload(fileInput, [file1, file2]);

    expect(await screen.findByDisplayValue('roaming')).toBeVisible();
    expect(screen.getByDisplayValue('esim')).toBeVisible();

    await user.click(screen.getByRole('button', { name: /upload 2 documents/i }));

    await waitFor(() => {
      expect(kbClient.uploadMultipleKnowledgeDocuments).toHaveBeenCalledWith(
        [
          expect.objectContaining({
            title: 'roaming',
            fileName: 'roaming.md',
            format: KnowledgeDocumentFormat.MARKDOWN,
            content: 'File 1 content',
          }),
          expect.objectContaining({
            title: 'esim',
            fileName: 'esim.txt',
            format: KnowledgeDocumentFormat.TEXT,
            content: 'File 2 content',
          }),
        ],
        expect.any(Function),
      );
    });
  });

  it('opens Upload Documents dialog with queued files when dropping files onto the page', async () => {
    const user = userEvent.setup();
    vi.mocked(authHooks.useCurrentUserQuery).mockReturnValue({
      data: adminUser,
      isPending: false,
    } as ReturnType<typeof authHooks.useCurrentUserQuery>);
    vi.mocked(kbClient.listKnowledgeDocuments).mockResolvedValue([]);
    vi.mocked(kbClient.uploadMultipleKnowledgeDocuments).mockResolvedValueOnce([
      {
        ...sampleDocs[0],
        title: 'dropped guide',
        fileName: 'dropped-guide.md',
        content: 'Dropped content',
        chunks: [],
      },
    ]);

    const { container } = renderKnowledgeBasePage();
    await screen.findByText('No knowledge documents uploaded yet');

    const droppedFile = new File(['Dropped content'], 'dropped-guide.md', {
      type: 'text/markdown',
    });
    droppedFile.text = async () => 'Dropped content';

    const workspaceRoot = container.firstElementChild as HTMLElement;
    const dataTransfer = {
      types: ['Files'],
      files: [droppedFile],
      dropEffect: 'none',
    };

    fireEvent.dragEnter(workspaceRoot, { dataTransfer });
    expect(screen.getByTestId('kb-page-drop-overlay')).toBeVisible();

    fireEvent.drop(workspaceRoot, { dataTransfer });
    expect(screen.queryByTestId('kb-page-drop-overlay')).not.toBeInTheDocument();

    expect(await screen.findByDisplayValue('dropped guide')).toBeVisible();

    await user.click(screen.getByRole('button', { name: /upload 1 document/i }));

    await waitFor(() => {
      expect(kbClient.uploadMultipleKnowledgeDocuments).toHaveBeenCalledWith(
        [
          expect.objectContaining({
            title: 'dropped guide',
            fileName: 'dropped-guide.md',
            format: KnowledgeDocumentFormat.MARKDOWN,
            content: 'Dropped content',
          }),
        ],
        expect.any(Function),
      );
    });
  });

  it('queues files dropped onto the Upload Documents dialog dropzone', async () => {
    const user = userEvent.setup();
    vi.mocked(authHooks.useCurrentUserQuery).mockReturnValue({
      data: adminUser,
      isPending: false,
    } as ReturnType<typeof authHooks.useCurrentUserQuery>);
    vi.mocked(kbClient.listKnowledgeDocuments).mockResolvedValue([]);

    renderKnowledgeBasePage();

    await user.click(await screen.findByRole('button', { name: /upload documents/i }));
    const dropzone = screen.getByTestId('kb-dialog-dropzone');

    const droppedFile = new File(['FAQ body'], 'support-faq.txt', { type: 'text/plain' });
    droppedFile.text = async () => 'FAQ body';

    const dataTransfer = {
      types: ['Files'],
      files: [droppedFile],
      dropEffect: 'none',
    };

    fireEvent.dragEnter(dropzone, { dataTransfer });
    expect(screen.getByText('Drop documents here to add them')).toBeVisible();

    fireEvent.drop(dropzone, { dataTransfer });
    expect(await screen.findByDisplayValue('support faq')).toBeVisible();
  });
});
