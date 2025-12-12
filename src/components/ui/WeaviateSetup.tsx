"use client";

import { useState, useEffect } from "react";

interface WeaviateStatus {
  initialized: boolean;
  collections: {
    voyage: boolean;
    huggingface: boolean;
  };
}

export function WeaviateSetup() {
  const [status, setStatus] = useState<WeaviateStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isInitializing, setIsInitializing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    checkStatus();
  }, []);

  const checkStatus = async () => {
    try {
      setIsLoading(true);
      const response = await fetch("/api/setup/weaviate");
      
      if (response.ok) {
        const data = await response.json();
        setStatus(data);
      } else {
        setError("Failed to check status");
      }
    } catch {
      setError("Failed to connect to server");
    } finally {
      setIsLoading(false);
    }
  };

  const handleInitialize = async () => {
    try {
      setIsInitializing(true);
      setError(null);

      const response = await fetch("/api/setup/weaviate", {
        method: "POST",
      });

      if (response.ok) {
        // Recheck status after initialization
        await checkStatus();
      } else {
        const data = await response.json();
        setError(data.error || "Initialization failed");
      }
    } catch {
      setError("Failed to initialize");
    } finally {
      setIsInitializing(false);
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm text-gray-600">Checking vector database status...</span>
        </div>
      </div>
    );
  }

  // Already initialized
  if (status?.initialized) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
              <svg
                className="w-5 h-5 text-green-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
            <div>
              <h3 className="text-sm font-medium text-green-800">
                Vector Database Ready
              </h3>
              <p className="text-xs text-green-600">
                Both embedding collections are initialized
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <span className="px-2 py-1 text-xs bg-green-100 text-green-700 rounded-full">
              Voyage ✓
            </span>
            <span className="px-2 py-1 text-xs bg-green-100 text-green-700 rounded-full">
              HuggingFace ✓
            </span>
          </div>
        </div>
      </div>
    );
  }

  // Not initialized - show setup button
  return (
    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-amber-100 rounded-full flex items-center justify-center">
            <svg
              className="w-5 h-5 text-amber-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
          <div>
            <h3 className="text-sm font-medium text-amber-800">
              First-time Setup Required
            </h3>
            <p className="text-xs text-amber-600">
              Initialize the vector database to enable document search
            </p>
          </div>
        </div>

        <button
          onClick={handleInitialize}
          disabled={isInitializing}
          className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
        >
          {isInitializing ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Initializing...
            </>
          ) : (
            <>
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 10V3L4 14h7v7l9-11h-7z"
                />
              </svg>
              Initialize Weaviate
            </>
          )}
        </button>
      </div>

      {/* Show partial status if one collection exists */}
      {status && (status.collections.voyage || status.collections.huggingface) && (
        <div className="mt-3 flex gap-2">
          <span
            className={`px-2 py-1 text-xs rounded-full ${
              status.collections.voyage
                ? "bg-green-100 text-green-700"
                : "bg-gray-100 text-gray-500"
            }`}
          >
            Voyage {status.collections.voyage ? "✓" : "✗"}
          </span>
          <span
            className={`px-2 py-1 text-xs rounded-full ${
              status.collections.huggingface
                ? "bg-green-100 text-green-700"
                : "bg-gray-100 text-gray-500"
            }`}
          >
            HuggingFace {status.collections.huggingface ? "✓" : "✗"}
          </span>
        </div>
      )}

      {error && (
        <div className="mt-3 p-2 bg-red-100 border border-red-200 rounded text-xs text-red-600">
          {error}
        </div>
      )}
    </div>
  );
}