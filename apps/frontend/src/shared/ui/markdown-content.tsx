import type { ReactNode } from 'react';
import { Fragment } from 'react';
import { cn } from '@/shared/lib/utils';

export interface MarkdownContentProps {
  content: string;
  className?: string;
}

const INLINE_TOKEN_REGEX =
  /(\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*|\[[^\]]+\]\((https?:\/\/[^\s)]+|\/[^\s)]*)\))/g;

function renderInlineTokens(text: string): ReactNode[] {
  const parts: ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  INLINE_TOKEN_REGEX.lastIndex = 0;
  while ((match = INLINE_TOKEN_REGEX.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }

    const token = match[0];
    const key = `${match.index}-${token.length}`;

    if (token.startsWith('**') && token.endsWith('**')) {
      parts.push(
        <strong key={key} className="font-semibold text-foreground">
          {token.slice(2, -2)}
        </strong>,
      );
    } else if (token.startsWith('`') && token.endsWith('`')) {
      parts.push(
        <code
          key={key}
          className="rounded-md bg-secondary px-1.5 py-0.5 font-mono text-[0.85em] text-secondary-foreground"
        >
          {token.slice(1, -1)}
        </code>,
      );
    } else if (token.startsWith('*') && token.endsWith('*')) {
      parts.push(
        <em key={key} className="italic">
          {token.slice(1, -1)}
        </em>,
      );
    } else if (token.startsWith('[')) {
      const closeBracket = token.indexOf(']');
      const label = token.slice(1, closeBracket);
      const href = token.slice(closeBracket + 2, -1);
      const isExternal = href.startsWith('http://') || href.startsWith('https://');
      parts.push(
        <a
          key={key}
          href={href}
          target={isExternal ? '_blank' : undefined}
          rel={isExternal ? 'noopener noreferrer' : undefined}
          className="font-medium text-primary underline decoration-primary/40 underline-offset-4 hover:decoration-primary"
        >
          {label}
        </a>,
      );
    }

    lastIndex = INLINE_TOKEN_REGEX.lastIndex;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts.length > 0 ? parts : [text];
}

export function MarkdownContent({ content, className }: MarkdownContentProps) {
  const lines = content.replace(/\r\n/g, '\n').split('\n');
  const blocks: ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      i += 1;
      continue;
    }

    // Fenced code / instruction block
    if (trimmed.startsWith('```')) {
      const codeLines: string[] = [];
      i += 1;
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeLines.push(lines[i]);
        i += 1;
      }
      i += 1;
      blocks.push(
        <pre
          key={`code-${i}`}
          className="overflow-x-auto rounded-lg border bg-secondary/70 p-3 font-mono text-xs leading-relaxed text-foreground"
        >
          <code>{codeLines.join('\n')}</code>
        </pre>,
      );
      continue;
    }

    // Headings
    const headingMatch = /^(#{1,3})\s+(.+)$/.exec(trimmed);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const text = headingMatch[2];
      const headingClass =
        level === 1
          ? 'text-base font-semibold text-foreground mt-2'
          : level === 2
            ? 'text-sm font-semibold text-foreground mt-2'
            : 'text-sm font-medium text-foreground mt-1.5';
      blocks.push(
        <h4 key={`h-${i}`} className={headingClass}>
          {renderInlineTokens(text)}
        </h4>,
      );
      i += 1;
      continue;
    }

    // Blockquote / highlighted information
    if (trimmed.startsWith('>')) {
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith('>')) {
        quoteLines.push(lines[i].trim().replace(/^>\s?/, ''));
        i += 1;
      }
      blocks.push(
        <blockquote
          key={`quote-${i}`}
          className="rounded-lg border-l-3 border-cyan-500 bg-accent/60 px-3.5 py-2.5 text-sm text-accent-foreground"
        >
          {quoteLines.map((qLine, idx) => (
            <Fragment key={idx}>
              {idx > 0 ? <br /> : null}
              {renderInlineTokens(qLine)}
            </Fragment>
          ))}
        </blockquote>,
      );
      continue;
    }

    // Unordered list
    if (/^[-*]\s+/.test(trimmed)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*]\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^[-*]\s+/, ''));
        i += 1;
      }
      blocks.push(
        <ul key={`ul-${i}`} className="list-disc space-y-1.5 pl-5 text-sm leading-relaxed">
          {items.map((item, idx) => (
            <li key={idx}>{renderInlineTokens(item)}</li>
          ))}
        </ul>,
      );
      continue;
    }

    // Ordered list
    if (/^\d+\.\s+/.test(trimmed)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^\d+\.\s+/, ''));
        i += 1;
      }
      blocks.push(
        <ol key={`ol-${i}`} className="list-decimal space-y-1.5 pl-5 text-sm leading-relaxed">
          {items.map((item, idx) => (
            <li key={idx}>{renderInlineTokens(item)}</li>
          ))}
        </ol>,
      );
      continue;
    }

    // Standard paragraph (collect consecutive non-special lines)
    const paraLines: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() !== '' &&
      !lines[i].trim().startsWith('```') &&
      !/^(#{1,3})\s+/.test(lines[i].trim()) &&
      !lines[i].trim().startsWith('>') &&
      !/^[-*]\s+/.test(lines[i].trim()) &&
      !/^\d+\.\s+/.test(lines[i].trim())
    ) {
      paraLines.push(lines[i].trim());
      i += 1;
    }
    blocks.push(
      <p key={`p-${i}`} className="text-sm leading-relaxed break-words">
        {paraLines.map((pLine, idx) => (
          <Fragment key={idx}>
            {idx > 0 ? <br /> : null}
            {renderInlineTokens(pLine)}
          </Fragment>
        ))}
      </p>,
    );
  }

  return <div className={cn('space-y-2.5', className)}>{blocks}</div>;
}
