"use client";

import { useState, useRef, useEffect } from "react";
import { LLMProvider, MODEL_NAMES } from "@/lib/llm/types";

interface Source {
  documentId: string;
  filename: string;
  chunkIndex: number;
  score: number;
  preview: string;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  sources?: Source[];
  model?: LLMProvider;
}

interface LLMMessageForAPI {
  role: "user" | "assistant";
  content: string;
}

export function ChatInterface() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [provider, setProvider] = useState<LLMProvider>("llama-70b");
  const [streamingContent, setStreamingContent] = useState("");
  const [currentSources, setCurrentSources] = useState<Source[]>([]);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingContent]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput("");
    setIsLoading(true);
    setStreamingContent("");
    setCurrentSources([]);

    // Add user message
    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);

    try {
      // Prepare conversation history (last 10 messages for context)
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
        }),
      });

      if (!response.ok) {
        throw new Error("Chat request failed");
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No response stream");

      const decoder = new TextDecoder();
      let fullContent = "";
      let sources: Source[] = [];

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
                    },
                  ]);
                  setStreamingContent("");
                  setCurrentSources([]);
                  break;

                case "error":
                  throw new Error(data.error);
              }
            } catch (parseError) {
              // Ignore parse errors for incomplete chunks
            }
          }
        }
      }
    } catch (error) {
      console.error("Chat error:", error);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `Error: ${error instanceof Error ? error.message : "Something went wrong"}`,
        },
      ]);
    } finally {
      setIsLoading(false);
      setStreamingContent("");
    }
  };

  return (
    <div className="flex flex-col h-[600px] bg-white border border-gray-200 rounded-lg">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
        <h3 className="font-medium text-gray-900">Chat with your Documents</h3>
        <div className="flex items-center space-x-2">
          <label className="text-sm text-gray-600">Model:</label>
          <select
            value={provider}
            onChange={(e) => setProvider(e.target.value as LLMProvider)}
            className="text-sm border border-gray-300 rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
            <option value="llama-70b">{MODEL_NAMES["llama-70b"]}</option>
            <option value="llama-8b">{MODEL_NAMES["llama-8b"]}</option>
            <option value="qwen-32b">{MODEL_NAMES["qwen-32b"]}</option>
           </select>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && !streamingContent && (
          <div className="text-center text-gray-500 mt-8">
            <p className="text-lg mb-2">👋 Welcome!</p>
            <p className="text-sm">
              Ask questions about your uploaded documents.
            </p>
            <p className="text-xs text-gray-400 mt-2">
              Powered by open-source LLMs via Groq
            </p>
          </div>
        )}

        {messages.map((message, index) => (
          <MessageBubble key={index} message={message} />
        ))}

        {/* Streaming message */}
        {streamingContent && (
          <div className="flex justify-start">
            <div className="max-w-[80%] space-y-2">
              {currentSources.length > 0 && (
                <SourcesList sources={currentSources} />
              )}
              <div className="bg-gray-100 rounded-lg px-4 py-2">
                <p className="text-sm text-gray-800 whitespace-pre-wrap">
                  {streamingContent}
                  <span className="inline-block w-2 h-4 bg-blue-500 animate-pulse ml-1" />
                </p>
              </div>
            </div>
          </div>
        )}

        {isLoading && !streamingContent && (
          <div className="flex justify-start">
            <div className="bg-gray-100 rounded-lg px-4 py-2">
              <div className="flex space-x-1">
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-100" />
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-200" />
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="p-4 border-t border-gray-200">
        <div className="flex space-x-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about your documents..."
            disabled={isLoading}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="px-6 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:bg-blue-300 disabled:cursor-not-allowed transition-colors"
          >
            Send
          </button>
        </div>
      </form>
    </div>
  );
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div className={`max-w-[80%] space-y-2`}>
        {/* Sources (for assistant messages) */}
        {!isUser && message.sources && message.sources.length > 0 && (
          <SourcesList sources={message.sources} />
        )}

        {/* Message content */}
        <div
          className={`rounded-lg px-4 py-2 ${
            isUser ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-800"
          }`}
        >
          <p className="text-sm whitespace-pre-wrap">{message.content}</p>
        </div>

        {/* Model badge */}
        {!isUser && message.model && (
          <span className="text-xs text-gray-400">
            via {MODEL_NAMES[message.model]}
          </span>
        )}
      </div>
    </div>
  );
}

function SourcesList({ sources }: { sources: Source[] }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="text-xs">
      <button
        onClick={() => setExpanded(!expanded)}
        className="text-blue-600 hover:text-blue-800 flex items-center space-x-1"
      >
        <span>
          📚 {sources.length} source{sources.length !== 1 ? "s" : ""}
        </span>
        <svg
          className={`w-3 h-3 transition-transform ${expanded ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {expanded && (
        <div className="mt-2 space-y-1 bg-blue-50 rounded-lg p-2">
          {sources.map((source, index) => (
            <div key={index} className="text-gray-600">
              <span className="font-medium">{source.filename}</span>
              <span className="text-gray-400">
                {" "}
                • chunk {source.chunkIndex + 1} • {(source.score * 100).toFixed(0)}%
                match
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}