"use client";

import React, { useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { CitationBadge } from "./CitationBadge";

interface Source {
  documentId: string;
  filename: string;
  chunkIndex: number;
  score: number;
  preview: string;
}

interface MessageContentProps {
  content: string;
  isUser?: boolean;
  sources?: Source[];
}

const CITE_PLACEHOLDER = /%%CITE:(\d+)%%/g;

/**
 * Split a string on %%CITE:N%% placeholders and interleave CitationBadge components.
 */
function renderWithCitations(text: string, sources: Source[]): React.ReactNode {
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  const regex = new RegExp(CITE_PLACEHOLDER.source, "g");
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    const num = parseInt(match[1], 10);
    const source = sources[num - 1] || null;
    parts.push(<CitationBadge key={`cite-${match.index}`} index={num} source={source} />);
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts.length > 0 ? <>{parts}</> : text;
}

/**
 * Recursively process React children, replacing string nodes that contain
 * %%CITE:N%% placeholders with CitationBadge components.
 */
function processChildren(children: React.ReactNode, sources: Source[]): React.ReactNode {
  return React.Children.map(children, (child) => {
    if (typeof child === "string") {
      if (child.includes("%%CITE:")) {
        return renderWithCitations(child, sources);
      }
      return child;
    }
    if (React.isValidElement<{ children?: React.ReactNode }>(child) && child.props.children) {
      return React.cloneElement(
        child,
        undefined,
        processChildren(child.props.children, sources)
      );
    }
    return child;
  });
}

export function MessageContent({ content, isUser = false, sources = [] }: MessageContentProps) {
  if (isUser) {
    return <div className="text-sm whitespace-pre-wrap">{content}</div>;
  }

  // Pre-process: replace [N] (1-20) with %%CITE:N%% to avoid markdown link parsing
  const processedContent = useMemo(() => {
    if (sources.length === 0) return content;
    return content.replace(/\[(\d{1,2})\]/g, (match, num) => {
      const n = parseInt(num, 10);
      if (n >= 1 && n <= 20) {
        return `%%CITE:${n}%%`;
      }
      return match;
    });
  }, [content, sources.length]);

  const hasCitations = sources.length > 0 && processedContent.includes("%%CITE:");

  return (
    <div className="message-content">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={
          hasCitations
            ? {
                p: ({ children }) => (
                  <p>{processChildren(children, sources)}</p>
                ),
                li: ({ children }) => (
                  <li>{processChildren(children, sources)}</li>
                ),
                td: ({ children }) => (
                  <td>{processChildren(children, sources)}</td>
                ),
              }
            : undefined
        }
      >
        {processedContent}
      </ReactMarkdown>
    </div>
  );
}
