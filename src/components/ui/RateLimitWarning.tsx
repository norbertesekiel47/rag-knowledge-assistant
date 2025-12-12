"use client";

interface RateLimitWarningProps {
  retryAfter: number;
  onRetry?: () => void;
}

export function RateLimitWarning({ retryAfter, onRetry }: RateLimitWarningProps) {
  return (
    <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
      <div className="flex items-start gap-3">
        <span className="text-yellow-500 text-xl">⚠️</span>
        <div className="flex-1">
          <h4 className="font-medium text-yellow-800">Rate Limit Exceeded</h4>
          <p className="text-sm text-yellow-700 mt-1">
            You&apos;ve made too many requests. Please wait {retryAfter} seconds before trying again.
          </p>
          {onRetry && (
            <button
              onClick={onRetry}
              className="mt-2 text-sm text-yellow-800 underline hover:no-underline"
            >
              Try Again
            </button>
          )}
        </div>
      </div>
    </div>
  );
}