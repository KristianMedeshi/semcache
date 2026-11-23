import { KnowledgeDocumentFormat } from '@semcache/shared-types';
import { DocumentProcessorService } from './document-processor.service';

describe('DocumentProcessorService', () => {
  let processor: DocumentProcessorService;

  beforeEach(() => {
    processor = new DocumentProcessorService();
  });

  it('infers document format from fileName when format is omitted', () => {
    expect(processor.resolveFormat(undefined, 'roaming-guide.md')).toBe(
      KnowledgeDocumentFormat.MARKDOWN,
    );
    expect(processor.resolveFormat(undefined, 'faq.HTML')).toBe(KnowledgeDocumentFormat.HTML);
    expect(processor.resolveFormat(undefined, 'plans.json')).toBe(KnowledgeDocumentFormat.JSON);
    expect(processor.resolveFormat(undefined, 'notes.txt')).toBe(KnowledgeDocumentFormat.TEXT);
  });

  it('extracts clean text from HTML documents and strips scripts and styles', () => {
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

    const extracted = processor.extractContent(html, KnowledgeDocumentFormat.HTML);
    expect(extracted.format).toBe(KnowledgeDocumentFormat.HTML);
    expect(extracted.text).toContain('5G Unlimited Plan');
    expect(extracted.text).toContain('Includes unlimited 5G data & 25 GB EU roaming.');
    expect(extracted.text).not.toContain('alert("xss")');
    expect(extracted.text).not.toContain('.hidden');
  });

  it('flattens JSON documents and throws on invalid JSON', () => {
    const json = JSON.stringify({
      plan: 'Pro 5G',
      priceMonthlyEur: 29,
      features: ['Unlimited calls', 'eSIM'],
    });

    const extracted = processor.extractContent(json, KnowledgeDocumentFormat.JSON);
    expect(extracted.text).toContain('plan: Pro 5G');
    expect(extracted.text).toContain('priceMonthlyEur: 29');
    expect(extracted.text).toContain('features[0]: Unlimited calls');

    expect(() => processor.extractContent('{ invalid json', KnowledgeDocumentFormat.JSON)).toThrow(
      /Invalid JSON/,
    );
  });

  it('rejects documents that produce empty text after extraction', () => {
    expect(() =>
      processor.extractContent('<script>var x = 1;</script>   ', KnowledgeDocumentFormat.HTML),
    ).toThrow(/no extractable text/);
  });

  it('splits long documents into overlapping chunks while tracking section metadata', () => {
    const markdown = [
      '# International Roaming',
      '',
      'Our EU Roaming Pass covers all 27 EU member states at domestic rates up to 25 GB per billing cycle.',
      '',
      'Outside the EU, Travel Zone A costs 4.99 EUR per day for 1 GB of high-speed data and 30 minutes of voice calls.',
      '',
      '## Activation',
      '',
      'Send ROAM to 1234 or enable International Roaming inside the SemCache Telecom mobile application before departure.',
    ].join('\n');

    const chunks = processor.splitIntoChunks(markdown, {
      chunkSize: 160,
      chunkOverlap: 30,
    });

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks[0]?.chunkIndex).toBe(0);
    expect(chunks[0]?.metadata).toEqual({ section: 'International Roaming' });
    expect(chunks.every((c) => c.content.length <= 160)).toBe(true);
    expect(chunks.every((c) => c.tokenCount > 0 && c.characterCount === c.content.length)).toBe(
      true,
    );
  });
});
