"use client";

import { useState } from "react";
import {
  EmbeddingProvider,
  EMBEDDING_CONFIGS,
  DEFAULT_EMBEDDING_PROVIDER,
} from "@/lib/embeddings/config";

interface EmbeddingSettingsProps {
  currentProvider: EmbeddingProvider;
  onProviderChange: (provider: EmbeddingProvider) => void;
}

export function EmbeddingSettings({
  currentProvider,
  onProviderChange,
}: EmbeddingSettingsProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="bg-white border border-gray-200 rounded-lg">
      {/* Header - Always visible */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-4 text-left"
      >
        <div className="flex items-center space-x-3">
          <span className="text-lg">🧠</span>
          <div>
            <h3 className="text-sm font-medium text-gray-900">Embedding Model</h3>
            <p className="text-xs text-gray-500">
              {EMBEDDING_CONFIGS[currentProvider].model}
            </p>
          </div>
        </div>
        <svg
          className={`w-5 h-5 text-gray-400 transition-transform ${
            isExpanded ? "rotate-180" : ""
          }`}
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

      {/* Expanded Content */}
      {isExpanded && (
        <div className="px-4 pb-4 space-y-4">
          {/* Info Banner */}
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <p className="text-xs text-blue-800">
              <strong>Note:</strong> Documents are indexed per embedding model. 
              Switching models will show only documents processed with that model.
              You can have documents in both but just upload separately for each.
            </p>
          </div>

          {/* Provider Options */}
          <div className="space-y-3">
            {(Object.keys(EMBEDDING_CONFIGS) as EmbeddingProvider[]).map((provider) => {
              const config = EMBEDDING_CONFIGS[provider];
              const isSelected = currentProvider === provider;

              return (
                <div
                  key={provider}
                  onClick={() => onProviderChange(provider)}
                  className={`
                    p-4 rounded-lg border-2 cursor-pointer transition-all
                    ${
                      isSelected
                        ? "border-blue-500 bg-blue-50"
                        : "border-gray-200 hover:border-gray-300"
                    }
                  `}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2">
                        <h4 className="font-medium text-gray-900">
                          {provider === "voyage" ? "Voyage AI" : "Hugging Face"}
                        </h4>
                        {provider === DEFAULT_EMBEDDING_PROVIDER && (
                          <span className="px-2 py-0.5 text-xs bg-green-100 text-green-700 rounded-full">
                            Recommended
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-600 mt-1">
                        {config.model}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        {config.dimensions} dimensions
                      </p>
                    </div>
                    <div
                      className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                        isSelected
                          ? "border-blue-500 bg-blue-500"
                          : "border-gray-300"
                      }`}
                    >
                      {isSelected && (
                        <svg
                          className="w-3 h-3 text-white"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path
                            fillRule="evenodd"
                            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                            clipRule="evenodd"
                          />
                        </svg>
                      )}
                    </div>
                  </div>

                  {/* Description */}
                  <p className="text-xs text-gray-600 mt-2">{config.description}</p>

                  {/* Limitations */}
                  <div className="mt-3">
                    <p className="text-xs font-medium text-gray-700 mb-1">
                      Limitations:
                    </p>
                    <ul className="text-xs text-gray-500 space-y-1">
                      {config.limitations.map((limitation, index) => (
                        <li key={index} className="flex items-start">
                          <span className="text-gray-400 mr-1">•</span>
                          {limitation}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}