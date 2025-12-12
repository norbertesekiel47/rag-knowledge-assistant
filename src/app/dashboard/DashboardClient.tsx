"use client";

import { useState, useEffect, useCallback } from "react";
import { FileUpload } from "@/components/upload/FileUpload";
import { DocumentList } from "@/components/documents/DocumentList";
import { SearchBox } from "@/components/search/SearchBox";
import { ChatInterface } from "@/components/chat/ChatInterface";
import { ChatSidebar } from "@/components/chat/ChatSidebar";
import type { Document } from "@/lib/supabase/types";
import { EmbeddingSettings } from "@/components/settings/EmbeddingSettings";
import { EmbeddingProvider, DEFAULT_EMBEDDING_PROVIDER } from "@/lib/embeddings/config";
import { AnalyticsDashboard } from "@/components/analytics/AnalyticsDashboard";
import { WeaviateSetup } from "@/components/ui/WeaviateSetup";

interface ChatSession {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

interface DashboardClientProps {
  initialDocuments: Document[];
}

export function DashboardClient({ initialDocuments }: DashboardClientProps) {
  const [documents, setDocuments] = useState<Document[]>(initialDocuments);
  const [error, setError] = useState<string | null>(null);
  // const [setupStatus, setSetupStatus] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"chat" | "search" | "documents" | "analytics">("chat");
  const [embeddingProvider, setEmbeddingProvider] = useState<EmbeddingProvider>(DEFAULT_EMBEDDING_PROVIDER);

  // Chat session state
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [isLoadingSessions, setIsLoadingSessions] = useState(true);

  const hasPendingDocuments = documents.some(
    (doc) => doc.status === "pending" || doc.status === "processing"
  );

  const hasProcessedDocuments = documents.some(
  (doc) => doc.status === "processed" && doc.embedding_provider === embeddingProvider
  );

  // Filter documents by selected embedding provider
  const filteredDocuments = documents.filter(
  (doc) => doc.embedding_provider === embeddingProvider
  );

  const handleDocumentDeleted = (documentId: string) => {
  setDocuments((prev) => prev.filter((doc) => doc.id !== documentId));
  };

  // Load chat sessions on mount
  useEffect(() => {
    loadSessions();
  }, []);

  const loadSessions = async () => {
    setIsLoadingSessions(true);
    try {
      const response = await fetch("/api/chat/sessions");
      if (response.ok) {
        const data = await response.json();
        setSessions(data.sessions);
      }
    } catch (error) {
      console.error("Failed to load sessions:", error);
    } finally {
      setIsLoadingSessions(false);
    }
  };

  const refreshDocuments = useCallback(async () => {
    try {
      const response = await fetch("/api/documents");
      if (response.ok) {
        const data = await response.json();
        setDocuments(data.documents);
      }
    } catch (err) {
      console.error("Failed to refresh documents:", err);
    }
  }, []);

  useEffect(() => {
    if (!hasPendingDocuments) return;

    const interval = setInterval(() => {
      refreshDocuments();
    }, 2000);

    return () => clearInterval(interval);
  }, [hasPendingDocuments, refreshDocuments]);

  const handleUploadComplete = (newDocument: Document) => {
    setDocuments((prev) => [newDocument, ...prev]);
    setError(null);
  };

  const handleUploadError = (errorMessage: string) => {
    setError(errorMessage);
    setTimeout(() => setError(null), 5000);
  };

  /*const handleSetupWeaviate = async () => {
    setSetupStatus("Initializing...");
    try {
      const response = await fetch("/api/setup/weaviate", { method: "POST" });
      const data = await response.json();

      if (response.ok) {
        setSetupStatus("✓ Weaviate schema initialized successfully!");
      } else {
        setSetupStatus(`✗ Error: ${data.error}`);
      }
    } catch {
      setSetupStatus("✗ Failed to connect to setup endpoint");
    }
    setTimeout(() => setSetupStatus(null), 5000);
  }; */

  const handleNewChat = () => {
    setCurrentSessionId(null);
    setActiveTab("chat");
  };

  const handleSelectSession = (sessionId: string) => {
    setCurrentSessionId(sessionId);
    setActiveTab("chat");
  };

  const handleDeleteSession = async (sessionId: string) => {
    try {
      const response = await fetch(`/api/chat/sessions/${sessionId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        setSessions((prev) => prev.filter((s) => s.id !== sessionId));
        if (currentSessionId === sessionId) {
          setCurrentSessionId(null);
        }
      }
    } catch (error) {
      console.error("Failed to delete session:", error);
    }
  };

  const handleSessionCreated = (sessionId: string) => {
    setCurrentSessionId(sessionId);
    loadSessions(); // Refresh the sessions list
  };

  return (
    <div className="flex h-[calc(100vh-73px)]">
      {/* Sidebar */}
      <div className="w-64 shrink-0">
        <ChatSidebar
          sessions={sessions}
          currentSessionId={currentSessionId}
          onSelectSession={handleSelectSession}
          onNewChat={handleNewChat}
          onDeleteSession={handleDeleteSession}
          isLoading={isLoadingSessions}
        />
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Setup Section */}
          <WeaviateSetup />

          {/* Tabs */}
          <div className="flex space-x-1 border-b border-gray-200">
            <button
              onClick={() => setActiveTab("chat")}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === "chat"
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              💬 Chat
            </button>
            <button
              onClick={() => setActiveTab("search")}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === "search"
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              🔍 Search
            </button>
            <button
              onClick={() => setActiveTab("documents")}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === "documents"
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              📄 Documents
            </button>
            <button
              onClick={() => setActiveTab("analytics")}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === "analytics"
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              📊 Analytics
            </button>
          </div>

          {/* Tab Content */}
          {activeTab === "chat" && (
            hasProcessedDocuments ? (
              <ChatInterface
                sessionId={currentSessionId}
                onSessionCreated={handleSessionCreated}
                embeddingProvider={embeddingProvider}
              />
            ) : (
              <div className="p-8 bg-gray-50 border border-gray-200 rounded-lg text-center">
                <p className="text-gray-600">
                  Upload and process documents to enable chat.
                </p>
              </div>
            )
          )}

          {activeTab === "search" && (
            hasProcessedDocuments ? (
              <SearchBox />
            ) : (
              <div className="p-8 bg-gray-50 border border-gray-200 rounded-lg text-center">
                <p className="text-gray-600">
                  Upload and process documents to enable search.
                </p>
              </div>
            )
          )}

          {activeTab === "documents" && (
            <div className="space-y-6">
               {/* Embedding Settings */}
              <EmbeddingSettings
                currentProvider={embeddingProvider}
                onProviderChange={setEmbeddingProvider}
              />
              {/* Upload Section */}
              <section>
                <h2 className="text-lg font-medium text-gray-900 mb-4">
                  Upload Documents
                </h2>
                <FileUpload
                  onUploadComplete={handleUploadComplete}
                  onUploadError={handleUploadError}
                  embeddingProvider={embeddingProvider}
                />
                {error && (
                  <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-sm text-red-600">{error}</p>
                  </div>
                )}
              </section>

              {/* Documents List */}
              <section>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-medium text-gray-900">Your Documents</h2>
                  <div className="flex items-center space-x-3">
                    {hasPendingDocuments && (
                      <span className="text-sm text-blue-600 flex items-center">
                        <svg
                          className="w-4 h-4 mr-1 animate-spin"
                          fill="none"
                          viewBox="0 0 24 24"
                        >
                          <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                          />
                          <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                          />
                        </svg>
                        Processing...
                      </span>
                    )}
                    <span className="text-sm text-gray-500">
                      {filteredDocuments.length} document{filteredDocuments.length !== 1 ? "s" : ""} 
                      {filteredDocuments.length !== documents.length && (
                        <span className="text-gray-400"> ({documents.length} total)</span>
                      )}
                    </span>
                  </div>
                </div>
                <DocumentList 
                  documents={filteredDocuments} 
                  onDocumentDeleted={handleDocumentDeleted}
                />
              </section>
            </div>
          )}
          {activeTab === "analytics" && <AnalyticsDashboard />}
        </div>
      </div>
    </div>
  );
}