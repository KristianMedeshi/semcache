import { DocxLoader } from '@langchain/community/document_loaders/fs/docx';
import { Document } from '@langchain/core/documents';
import { KnowledgeDocumentFormat } from '@semcache/shared-types';
import { DocumentProcessorService } from './document-processor.service';

/**
 * Generates a minimal valid 1-page PDF buffer containing the given ASCII text.
 */
function createMinimalPdfBuffer(text: string): Buffer {
  const escaped = text.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
  const stream = `BT /F1 12 Tf 72 720 Td (${escaped}) Tj ET`;
  const objects = [
    '1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n',
    '2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj\n',
    '3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >> endobj\n',
    `4 0 obj << /Length ${Buffer.byteLength(stream, 'utf-8')} >> stream\n${stream}\nendstream endobj\n`,
    '5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj\n',
  ];

  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [0];
  for (const obj of objects) {
    offsets.push(Buffer.byteLength(pdf, 'utf-8'));
    pdf += obj;
  }

  const xrefOffset = Buffer.byteLength(pdf, 'utf-8');
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += '0000000000 65535 f \n';
  for (let i = 1; i <= objects.length; i += 1) {
    pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;

  return Buffer.from(pdf, 'utf-8');
}

describe('DocumentProcessorService (LangChain loaders & splitters)', () => {
  let processor: DocumentProcessorService;

  beforeEach(() => {
    processor = new DocumentProcessorService();
  });

  it('infers document format from fileName for all 6 supported formats', () => {
    expect(processor.resolveFormat(undefined, 'roaming-guide.md')).toBe(
      KnowledgeDocumentFormat.MARKDOWN,
    );
    expect(processor.resolveFormat(undefined, 'faq.HTML')).toBe(KnowledgeDocumentFormat.HTML);
    expect(processor.resolveFormat(undefined, 'plans.json')).toBe(KnowledgeDocumentFormat.JSON);
    expect(processor.resolveFormat(undefined, 'notes.txt')).toBe(KnowledgeDocumentFormat.TEXT);
    expect(processor.resolveFormat(undefined, 'terms.pdf')).toBe(KnowledgeDocumentFormat.PDF);
    expect(processor.resolveFormat(undefined, 'manual.docx')).toBe(KnowledgeDocumentFormat.DOCX);
  });

  it('extracts clean text from HTML documents using LangChain HtmlToTextTransformer', async () => {
    const html = `
      <html>
        <head><style>.hidden { display: none; }</style><script>alert("xss")</script></head>
        <body>
          <h1>5G Unlimited Plan</h1>
          <p>Includes unlimited 5G data &amp; 25 GB EU roaming.</p>
          <ul><li>No annual contract</li><li>eSIM ready</li></ul>
        </body>
      </html>
    `;

    const result = await processor.processDocument({
      rawContent: html,
      format: KnowledgeDocumentFormat.HTML,
      fileName: 'plans.html',
      documentId: 'doc-html-1',
    });

    expect(result.format).toBe(KnowledgeDocumentFormat.HTML);
    expect(result.text.toLowerCase()).toContain('5g unlimited plan');
    expect(result.text).toContain('Includes unlimited 5G data & 25 GB EU roaming.');
    expect(result.text).not.toContain('alert("xss")');
    expect(result.chunks[0]?.metadata).toMatchObject({
      documentId: 'doc-html-1',
      fileName: 'plans.html',
      format: KnowledgeDocumentFormat.HTML,
    });
  });

  it('loads JSON documents via LangChain BaseDocumentLoader and throws on invalid JSON', async () => {
    const json = JSON.stringify({
      plan: 'Pro 5G',
      priceMonthlyEur: 29,
      features: ['Unlimited calls', 'eSIM'],
    });

    const result = await processor.processDocument({
      rawContent: json,
      format: KnowledgeDocumentFormat.JSON,
      documentId: 'doc-json-1',
    });

    expect(result.text).toContain('plan: Pro 5G');
    expect(result.text).toContain('priceMonthlyEur: 29');
    expect(result.text).toContain('features[0]: Unlimited calls');

    await expect(
      processor.processDocument({
        rawContent: '{ invalid json',
        format: KnowledgeDocumentFormat.JSON,
      }),
    ).rejects.toThrow(/Invalid JSON/);
  });

  it('splits Markdown documents with LangChain MarkdownTextSplitter preserving document and section metadata', async () => {
    const markdown = [
      '# International Roaming',
      '',
      'Our EU Roaming Pass covers all 27 EU member states at domestic rates up to 25 GB per billing cycle.',
      '',
      '## Activation Steps',
      '',
      'Send ROAM to 1234 or enable International Roaming inside the SemCache Telecom mobile application before departure.',
    ].join('\n');

    const result = await processor.processDocument({
      rawContent: markdown,
      format: KnowledgeDocumentFormat.MARKDOWN,
      fileName: 'roaming.md',
      documentId: 'doc-md-1',
      chunkSize: 160,
      chunkOverlap: 30,
    });

    expect(result.chunks.length).toBeGreaterThanOrEqual(2);
    expect(result.chunks[0]?.metadata).toMatchObject({
      documentId: 'doc-md-1',
      fileName: 'roaming.md',
      format: KnowledgeDocumentFormat.MARKDOWN,
      section: 'International Roaming',
    });
    const activationChunk = result.chunks.find((c) => c.content.includes('Send ROAM to 1234'));
    expect(activationChunk?.metadata).toMatchObject({
      documentId: 'doc-md-1',
      fileName: 'roaming.md',
      section: 'Activation Steps',
    });
  });

  it('loads DOCX documents via LangChain DocxLoader and splits with RecursiveCharacterTextSplitter', async () => {
    const loadSpy = jest.spyOn(DocxLoader.prototype, 'load').mockResolvedValueOnce([
      new Document({
        pageContent: 'SemCache Telecom eSIM Activation Terms and Conditions.',
        metadata: { source: 'blob' },
      }),
    ]);

    const result = await processor.processDocument({
      rawContent: Buffer.from('PK-mock-docx').toString('base64'),
      format: KnowledgeDocumentFormat.DOCX,
      fileName: 'esim-terms.docx',
      documentId: 'doc-docx-1',
    });

    expect(loadSpy).toHaveBeenCalledTimes(1);
    expect(result.format).toBe(KnowledgeDocumentFormat.DOCX);
    expect(result.text).toBe('SemCache Telecom eSIM Activation Terms and Conditions.');
    expect(result.chunks[0]?.metadata).toMatchObject({
      documentId: 'doc-docx-1',
      fileName: 'esim-terms.docx',
      format: KnowledgeDocumentFormat.DOCX,
    });
    loadSpy.mockRestore();
  });

  it('loads PDF documents via LangChain PDFLoader and preserves pageNumber metadata', async () => {
    const pdfBase64 = createMinimalPdfBuffer('SemCache Telecom 5G Roaming Guide').toString(
      'base64',
    );

    const result = await processor.processDocument({
      rawContent: pdfBase64,
      format: KnowledgeDocumentFormat.PDF,
      fileName: 'roaming.pdf',
      documentId: 'doc-pdf-1',
    });

    expect(result.format).toBe(KnowledgeDocumentFormat.PDF);
    expect(result.text).toContain('SemCache Telecom 5G Roaming Guide');
    expect(result.chunks[0]?.metadata).toMatchObject({
      documentId: 'doc-pdf-1',
      fileName: 'roaming.pdf',
      format: KnowledgeDocumentFormat.PDF,
      pageNumber: 1,
    });
  });

  it('rejects empty documents and invalid chunkOverlap >= chunkSize', async () => {
    await expect(
      processor.processDocument({
        rawContent: '   ',
        format: KnowledgeDocumentFormat.TEXT,
      }),
    ).rejects.toThrow(/no extractable text/);

    await expect(
      processor.processDocument({
        rawContent: 'Valid text content',
        format: KnowledgeDocumentFormat.TEXT,
        chunkSize: 200,
        chunkOverlap: 200,
      }),
    ).rejects.toThrow(/chunkOverlap/);
  });
});
