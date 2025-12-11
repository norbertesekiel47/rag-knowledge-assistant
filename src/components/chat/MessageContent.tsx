"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface MessageContentProps {
  content: string;
  isUser?: boolean;
}

export function MessageContent({ content, isUser = false }: MessageContentProps) {
  if (isUser) {
    return <div className="text-sm whitespace-pre-wrap">{content}</div>;
  }

  return (
    <div className="message-content">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </div>
  );
}