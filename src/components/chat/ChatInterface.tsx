"use client";

import { useState, useRef, useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import { LLMProvider, MODEL_NAMES } from "@/lib/llm/types";
import { EmbeddingProvider, DEFAULT_EMBEDDING_PROVIDER } from "@/lib/embeddings/config";
import { MessageContent } from "./MessageContent";
import { SearchFilters, countActiveFilters } from "@/components/search/SearchFilters";
import type { Document } from "@/lib/supabase/types";
import type { SearchFilters as SearchFiltersType } from "@/lib/processing/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Send,
  Filter,
  BookOpen,
  ThumbsUp,
  ThumbsDown,
  ChevronDown,
  ChevronUp,
  Loader2,
  Sparkles,
  Bot,
  MessageSquare,
  Zap,
} from "lucide-react";

interface Source {
  documentId: string;
  filename: string;
  chunkIndex: number;
  score: number;
  preview: string;
}

interface ReasoningInfo {
  category: "simple" | "complex" | "conversational";
  subQueries?: string[];
  toolsUsed?: string[];
  reasoningTimeMs?: number;
}

interface ChatMessage {
  id?: string;
  role: "user" | "assistant";
  content: string;
  sources?: Source[];
  model?: LLMProvider;
  reasoning?: ReasoningInfo;
}

interface LLMMessageForAPI {
  role: "user" | "assistant";
  content: string;
}

interface APIMessage {
  id: string;
  session_id: string;
  role: "user" | "assistant";
  content: string;
  sources: Source[] | null;
  model: LLMProvider | null;
  created_at: string;
}

interface ChatInterfaceProps {
  sessionId: string | null;
  onSessionCreated?: (sessionId: string) => void;
  onTitleUpdate?: (title: string) => void;
  embeddingProvider?: EmbeddingProvider;
  documents?: Document[];
}

export function ChatInterface({
  sessionId,
  onSessionCreated,
  onTitleUpdate,
  embeddingProvider = DEFAULT_EMBEDDING_PROVIDER,
  documents = [],
}: ChatInterfaceProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [provider, setProvider] = useState<LLMProvider>("llama-70b");
  const [streamingContent, setStreamingContent] = useState("");
  const [currentSources, setCurrentSources] = useState<Source[]>([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<SearchFiltersType>({});
  const [currentReasoning, setCurrentReasoning] = useState<ReasoningInfo | null>(null);
  const [feedbackMap, setFeedbackMap] = useState<Record<string, "positive" | "negative" | null>>({});

  const activeFilterCount = countActiveFilters(filters);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const currentSessionRef = useRef<string | null>(sessionId);

  // Load messages when session changes
  useEffect(() => {
    currentSessionRef.current = sessionId;

    if (sessionId) {
      loadMessages(sessionId);
    } else {
      setMessages([]);
    }
  }, [sessionId]);

  const handleFeedback = async (messageId: string, feedback: "positive" | "negative") => {
    if (!currentSessionRef.current) return;
    const currentFeedback = feedbackMap[messageId];
    setFeedbackMap((prev) => ({
      ...prev,
      [messageId]: currentFeedback === feedback ? null : feedback,
    }));
    try {
      const response = await fetch("/api/chat/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messageId,
          sessionId: currentSessionRef.current,
          feedback,
        }),
      });
      if (response.ok) {
        const data = await response.json();
        setFeedbackMap((prev) => ({ ...prev, [messageId]: data.feedback }));
      }
    } catch (error) {
      console.error("Failed to submit feedback:", error);
      setFeedbackMap((prev) => ({ ...prev, [messageId]: currentFeedback || null }));
    }
  };

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingContent]);

  const loadMessages = async (sid: string) => {
    setIsLoadingMessages(true);
    try {
      const [messagesRes, feedbackRes] = await Promise.all([
        fetch(`/api/chat/sessions/${sid}`),
        fetch(`/api/chat/feedback?sessionId=${sid}`),
      ]);

      if (messagesRes.ok && currentSessionRef.current === sid) {
        const data = await messagesRes.json();
        setMessages(
          data.messages.map((msg: APIMessage) => ({
            id: msg.id,
            role: msg.role,
            content: msg.content,
            sources: msg.sources || [],
            model: msg.model || undefined,
          }))
        );
      }

      if (feedbackRes.ok && currentSessionRef.current === sid) {
        const feedbackData = await feedbackRes.json();
        setFeedbackMap(feedbackData.feedbackMap || {});
      }
    } catch (error) {
      console.error("Failed to load messages:", error);
    } finally {
      setIsLoadingMessages(false);
    }
  };

  const saveMessage = async (
    sid: string,
    role: "user" | "assistant",
    content: string,
    sources: Source[] = [],
    model: LLMProvider | null = null
  ): Promise<string | null> => {
    try {
      const res = await fetch(`/api/chat/sessions/${sid}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role, content, sources, model }),
      });
      if (res.ok) {
        const data = await res.json();
        return data.message?.id || null;
      }
      return null;
    } catch (error) {
      console.error("Failed to save message:", error);
      return null;
    }
  };

  const createSession = async (firstMessage: string): Promise<string | null> => {
    try {
      let title = firstMessage.slice(0, 50) + (firstMessage.length > 50 ? "..." : "");

      try {
        const titleResponse = await fetch("/api/chat/generate-title", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: firstMessage }),
        });

        if (titleResponse.ok) {
          const titleData = await titleResponse.json();
          title = titleData.title;
        }
      } catch (titleError) {
        console.error("Failed to generate title:", titleError);
      }

      const response = await fetch("/api/chat/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      });

      if (response.ok) {
        const data = await response.json();
        onSessionCreated?.(data.session.id);
        onTitleUpdate?.(title);
        return data.session.id;
      }
    } catch (error) {
      console.error("Failed to create session:", error);
    }
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput("");
    setIsLoading(true);
    setStreamingContent("");
    setCurrentSources([]);
    setCurrentReasoning(null);

    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);

    let activeSessionId = sessionId;
    if (!activeSessionId) {
      activeSessionId = await createSession(userMessage);
      if (!activeSessionId) {
        setIsLoading(false);
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: "Error: Failed to create chat session" },
        ]);
        return;
      }
      currentSessionRef.current = activeSessionId;
    }

    const userMsgId = await saveMessage(activeSessionId, "user", userMessage);
    if (userMsgId) {
      setMessages((prev) =>
        prev.map((msg, i) =>
          i === prev.length - 1 && msg.role === "user" ? { ...msg, id: userMsgId } : msg
        )
      );
    }

    try {
      const conversationHistory: LLMMessageForAPI[] = messages.slice(-10).map((msg) => ({
        role: msg.role,
        content: msg.content,
      }));

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userMessage,
          provider,
          conversationHistory,
          embeddingProvider,
          filters: activeFilterCount > 0 ? filters : undefined,
        }),
      });

      if (response.status === 429) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Rate limit exceeded. Please wait and try again.");
      }

      if (!response.ok) {
        throw new Error("Chat request failed");
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No response stream");

      const decoder = new TextDecoder();
      let fullContent = "";
      let sources: Source[] = [];
      let reasoning: ReasoningInfo | null = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split("\n\n");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));

              switch (data.type) {
                case "reasoning":
                  reasoning = {
                    category: data.category,
                    subQueries: data.subQueries,
                    toolsUsed: data.toolsUsed,
                    reasoningTimeMs: data.reasoningTimeMs,
                  };
                  setCurrentReasoning(reasoning);
                  break;

                case "sources":
                  sources = data.sources;
                  setCurrentSources(sources);
                  break;

                case "token":
                  fullContent += data.content;
                  setStreamingContent(fullContent);
                  break;

                case "complete":
                  setMessages((prev) => [
                    ...prev,
                    {
                      role: "assistant",
                      content: data.content,
                      sources,
                      model: provider,
                      reasoning: reasoning || undefined,
                    },
                  ]);
                  setStreamingContent("");
                  setCurrentSources([]);
                  setCurrentReasoning(null);

                  const assistantMsgId = await saveMessage(
                    activeSessionId!,
                    "assistant",
                    data.content,
                    sources,
                    provider
                  );
                  if (assistantMsgId) {
                    setMessages((prev) =>
                      prev.map((msg, i) =>
                        i === prev.length - 1 && msg.role === "assistant"
                          ? { ...msg, id: assistantMsgId }
                          : msg
                      )
                    );
                  }
                  break;

                case "error":
                  throw new Error(data.error);
              }
            } catch {
              // Ignore parse errors for incomplete chunks
            }
          }
        }
      }
    } catch (error) {
      console.error("Chat error:", error);
      const errorMessage = `Error: ${error instanceof Error ? error.message : "Something went wrong"}`;
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: errorMessage },
      ]);
    } finally {
      setIsLoading(false);
      setStreamingContent("");
    }
  };

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-border/50 bg-background/80 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[var(--gradient-start)] to-[var(--gradient-end)] flex items-center justify-center shadow-sm shadow-primary/20">
            <Bot className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground text-sm">RAG Assistant</h3>
            <span className="text-xs text-green-400 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
              Online
            </span>
          </div>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="text-sm gap-2 rounded-xl">
              <Sparkles className="h-3.5 w-3.5 text-[var(--gradient-mid)]" />
              {MODEL_NAMES[provider]}
              <ChevronDown className="h-3 w-3 text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setProvider("llama-70b")}>
              {MODEL_NAMES["llama-70b"]}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setProvider("llama-8b")}>
              {MODEL_NAMES["llama-8b"]}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setProvider("qwen-32b")}>
              {MODEL_NAMES["qwen-32b"]}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {isLoadingMessages ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-6 h-6 text-primary animate-spin" />
          </div>
        ) : messages.length === 0 && !streamingContent ? (
          <WelcomeScreen />
        ) : (
          <>
            {messages.map((message, index) => (
              <MessageBubble
                key={message.id || index}
                message={message}
                feedback={message.id ? feedbackMap[message.id] : undefined}
                onFeedback={message.id ? (fb) => handleFeedback(message.id!, fb) : undefined}
              />
            ))}
          </>
        )}

        {/* Streaming message */}
        {streamingContent && (
          <div className="flex items-end gap-3 justify-start">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[var(--gradient-start)] to-[var(--gradient-end)] flex items-center justify-center shrink-0 mb-1 shadow-sm shadow-primary/20">
              <Bot className="w-4 h-4 text-white" />
            </div>
            <div className="max-w-[75%] space-y-1.5">
              {currentReasoning && <ReasoningBadge reasoning={currentReasoning} />}
              {currentSources.length > 0 && <SourcesList sources={currentSources} />}
              <div className="bubble-assistant px-4 py-2.5">
                <div className="text-sm">
                  <MessageContent content={streamingContent} isUser={false} sources={currentSources} />
                  <span className="inline-block w-1.5 h-4 bg-primary animate-pulse ml-0.5 rounded-sm" />
                </div>
              </div>
            </div>
          </div>
        )}

        {isLoading && !streamingContent && (
          <div className="flex items-end gap-3 justify-start">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[var(--gradient-start)] to-[var(--gradient-end)] flex items-center justify-center shrink-0 mb-1 shadow-sm shadow-primary/20">
              <Bot className="w-4 h-4 text-white" />
            </div>
            <div className="bubble-assistant px-4 py-3">
              <div className="flex space-x-1.5">
                <div className="w-2 h-2 bg-muted-foreground/60 rounded-full animate-bounce" />
                <div className="w-2 h-2 bg-muted-foreground/60 rounded-full animate-bounce [animation-delay:100ms]" />
                <div className="w-2 h-2 bg-muted-foreground/60 rounded-full animate-bounce [animation-delay:200ms]" />
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Filter Panel */}
      {showFilters && (
        <div className="px-4 pt-2 border-t border-border">
          <SearchFilters
            documents={documents}
            filters={filters}
            onFiltersChange={setFilters}
            compact
          />
        </div>
      )}

      {/* Input */}
      <form onSubmit={handleSubmit} className="px-4 py-3 border-t border-border/30 bg-background/50 backdrop-blur-sm">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-end gap-2">
            {/* Filter button */}
            <button
              type="button"
              onClick={() => setShowFilters(!showFilters)}
              className={`relative w-10 h-10 rounded-full flex items-center justify-center shrink-0 transition-colors ${
                showFilters || activeFilterCount > 0
                  ? "bg-primary/10 text-primary border border-primary/30"
                  : "bg-card border border-border/50 text-muted-foreground hover:text-foreground hover:border-border"
              }`}
              title="Search filters"
            >
              <Filter className="h-4 w-4" />
              {activeFilterCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-primary text-white text-[9px] rounded-full flex items-center justify-center font-bold">
                  {activeFilterCount}
                </span>
              )}
            </button>

            {/* Input container */}
            <div className="flex-1 bg-card border border-border/50 rounded-2xl px-4 py-2.5 focus-within:ring-2 focus-within:ring-[var(--gradient-mid)]/20 focus-within:border-[var(--gradient-mid)]/30 transition-all">
              <input
                type="text"
                value={input}
                onChange={(e) => {
                  if (e.target.value.length <= 10000) setInput(e.target.value);
                }}
                maxLength={10000}
                placeholder="Type a message..."
                disabled={isLoading}
                className="w-full bg-transparent text-foreground placeholder:text-muted-foreground/60 text-sm focus:outline-none disabled:opacity-50"
              />
              {input.length > 500 && (
                <span
                  className={`text-[10px] mt-0.5 block ${
                    input.length > 9000 ? "text-amber-500" : "text-muted-foreground/50"
                  }`}
                >
                  {input.length.toLocaleString()}/10,000
                </span>
              )}
            </div>

            {/* Send button */}
            <button
              type="submit"
              disabled={isLoading || !input.trim()}
              className="w-10 h-10 rounded-full bg-gradient-to-r from-[var(--gradient-start)] via-[var(--gradient-mid)] to-[var(--gradient-end)] text-white flex items-center justify-center shrink-0 hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm shadow-primary/20"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

function WelcomeScreen() {
  return (
    <div className="flex flex-col items-center justify-center h-full px-4">
      <div className="text-center max-w-lg space-y-8">
        <div className="w-20 h-20 mx-auto rounded-2xl bg-gradient-to-br from-[var(--gradient-start)] to-[var(--gradient-end)] flex items-center justify-center shadow-xl shadow-primary/20">
          <MessageSquare className="w-10 h-10 text-white" />
        </div>
        <div className="space-y-3">
          <h2 className="text-2xl font-bold text-foreground">How can I help you?</h2>
          <p className="text-muted-foreground text-sm leading-relaxed">
            Ask questions about your uploaded documents. I&apos;ll search through your knowledge base to find relevant answers.
          </p>
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          <Badge variant="secondary" className="px-4 py-2 cursor-default text-sm rounded-full">
            Summarize my documents
          </Badge>
          <Badge variant="secondary" className="px-4 py-2 cursor-default text-sm rounded-full">
            Find key insights
          </Badge>
          <Badge variant="secondary" className="px-4 py-2 cursor-default text-sm rounded-full">
            Compare topics
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground/50">
          Powered by open-source LLMs via Groq
        </p>
      </div>
    </div>
  );
}

function UserChatAvatar() {
  const { user } = useUser();
  return (
    <div className="w-8 h-8 rounded-full shrink-0 mb-1 overflow-hidden">
      {user?.imageUrl ? (
        <img src={user.imageUrl} alt="" className="w-full h-full object-cover" />
      ) : (
        <div className="w-full h-full bg-sidebar-accent flex items-center justify-center text-xs font-medium text-sidebar-foreground">
          {user?.firstName?.[0] || "U"}
        </div>
      )}
    </div>
  );
}

function MessageBubble({
  message,
  feedback,
  onFeedback,
}: {
  message: ChatMessage;
  feedback?: "positive" | "negative" | null;
  onFeedback?: (feedback: "positive" | "negative") => void;
}) {
  const isUser = message.role === "user";

  return (
    <div className={`flex items-end gap-3 ${isUser ? "justify-end" : "justify-start"}`}>
      {/* Assistant avatar */}
      {!isUser && (
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[var(--gradient-start)] to-[var(--gradient-end)] flex items-center justify-center shrink-0 mb-1 shadow-sm shadow-primary/20">
          <Bot className="w-4 h-4 text-white" />
        </div>
      )}

      <div className="max-w-[75%] space-y-1.5">
        {!isUser && message.reasoning && (
          <ReasoningBadge reasoning={message.reasoning} />
        )}
        {!isUser && message.sources && message.sources.length > 0 && (
          <SourcesList sources={message.sources} />
        )}

        <div className={isUser ? "bubble-user px-4 py-2.5" : "bubble-assistant px-4 py-2.5"}>
          <MessageContent content={message.content} isUser={isUser} sources={message.sources} />
        </div>

        {!isUser && (
          <div className="flex items-center gap-2 px-1">
            {message.model && (
              <span className="text-[11px] text-muted-foreground/70">
                via {MODEL_NAMES[message.model]}
              </span>
            )}
            {onFeedback && (
              <div className="flex items-center gap-0.5 ml-auto">
                <button
                  onClick={() => onFeedback("positive")}
                  className={`p-1 rounded-full transition-colors ${
                    feedback === "positive"
                      ? "text-green-500 bg-green-500/10"
                      : "text-muted-foreground/50 hover:text-green-500 hover:bg-green-500/10"
                  }`}
                  title="Helpful"
                >
                  <ThumbsUp className="w-3 h-3" />
                </button>
                <button
                  onClick={() => onFeedback("negative")}
                  className={`p-1 rounded-full transition-colors ${
                    feedback === "negative"
                      ? "text-red-500 bg-red-500/10"
                      : "text-muted-foreground/50 hover:text-red-500 hover:bg-red-500/10"
                  }`}
                  title="Not helpful"
                >
                  <ThumbsDown className="w-3 h-3" />
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* User avatar */}
      {isUser && <UserChatAvatar />}
    </div>
  );
}

function SourcesList({ sources }: { sources: Source[] }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="text-xs">
      <button
        onClick={() => setExpanded(!expanded)}
        className="text-[var(--gradient-mid)] hover:text-[var(--gradient-end)] flex items-center space-x-1 transition-colors"
      >
        <BookOpen className="w-3.5 h-3.5" />
        <span>
          {sources.length} source{sources.length !== 1 ? "s" : ""}
        </span>
        {expanded ? (
          <ChevronUp className="w-3 h-3" />
        ) : (
          <ChevronDown className="w-3 h-3" />
        )}
      </button>

      {expanded && (
        <div className="mt-2 space-y-1 bg-card/60 backdrop-blur-sm border border-border/50 rounded-lg p-2">
          {sources.map((source, index) => (
            <div key={index} className="text-muted-foreground">
              <span className="font-medium text-foreground/80">{source.filename}</span>
              <span className="text-muted-foreground/60">
                {" "}&bull; chunk {source.chunkIndex + 1} &bull; {(source.score * 100).toFixed(0)}% match
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ReasoningBadge({ reasoning }: { reasoning: ReasoningInfo }) {
  const labels: Record<string, { text: string; icon: typeof Zap; className: string }> = {
    simple: { text: "Direct retrieval", icon: Zap, className: "bg-green-500/10 text-green-400 border-green-500/20" },
    complex: { text: "Multi-step reasoning", icon: Sparkles, className: "bg-purple-500/10 text-purple-400 border-purple-500/20" },
    conversational: { text: "Conversational", icon: MessageSquare, className: "bg-muted text-muted-foreground border-border" },
  };

  const { text, icon: Icon, className } = labels[reasoning.category] || labels.simple;

  return (
    <div className="flex items-center gap-2 text-xs">
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border ${className}`}>
        <Icon className="w-3 h-3" />
        {text}
      </span>
      {reasoning.subQueries && reasoning.subQueries.length > 1 && (
        <span className="text-muted-foreground">
          {reasoning.subQueries.length} sub-queries
        </span>
      )}
      {reasoning.reasoningTimeMs !== undefined && (
        <span className="text-muted-foreground">
          {(reasoning.reasoningTimeMs / 1000).toFixed(1)}s
        </span>
      )}
    </div>
  );
}
