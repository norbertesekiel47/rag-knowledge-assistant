import { logger } from "./logger";

export interface RetryConfig {
  /** Maximum number of retry attempts (excluding the initial attempt) */
  maxRetries: number;
  /** Initial delay in ms before first retry */
  initialDelayMs: number;
  /** Multiplier for exponential backoff */
  backoffMultiplier: number;
  /** Maximum delay cap in ms */
  maxDelayMs: number;
  /** Determines if an error is retryable */
  isRetryable?: (error: unknown) => boolean;
}

export interface TimeoutConfig {
  /** Timeout in milliseconds */
  timeoutMs: number;
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 2,
  initialDelayMs: 2000,
  backoffMultiplier: 2,
  maxDelayMs: 10000,
};

/**
 * Checks if an error is likely transient and worth retrying.
 */
export function isTransientError(error: unknown): boolean {
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    // HTTP status-based
    if (msg.includes("429") || msg.includes("rate_limit") || msg.includes("rate limit")) return true;
    if (msg.includes("503") || msg.includes("service unavailable")) return true;
    if (msg.includes("502") || msg.includes("bad gateway")) return true;
    if (msg.includes("500") && msg.includes("internal server error")) return true;
    // Network errors
    if (msg.includes("econnrefused") || msg.includes("econnreset")) return true;
    if (msg.includes("etimedout") || msg.includes("timeout")) return true;
    if (msg.includes("fetch failed") || msg.includes("network")) return true;
    if (msg.includes("socket hang up")) return true;
  }
  return false;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Wrap an async operation with timeout.
 * Rejects with a TimeoutError if the operation takes longer than timeoutMs.
 */
export async function withTimeout<T>(
  fn: () => Promise<T>,
  config: TimeoutConfig,
  label?: string
): Promise<T> {
  const { timeoutMs } = config;

  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Operation timed out after ${timeoutMs}ms${label ? ` (${label})` : ""}`));
    }, timeoutMs);

    fn()
      .then((result) => {
        clearTimeout(timer);
        resolve(result);
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });
}

/**
 * Wrap an async operation with retry logic and exponential backoff.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  config: Partial<RetryConfig> = {},
  label?: string
): Promise<T> {
  const {
    maxRetries,
    initialDelayMs,
    backoffMultiplier,
    maxDelayMs,
    isRetryable = isTransientError,
  } = { ...DEFAULT_RETRY_CONFIG, ...config };

  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (attempt === maxRetries || !isRetryable(error)) {
        break;
      }

      const delayMs = Math.min(initialDelayMs * Math.pow(backoffMultiplier, attempt), maxDelayMs);
      logger.warn(
        `Attempt ${attempt + 1}/${maxRetries + 1} failed, retrying in ${delayMs}ms`,
        label,
        { error: error instanceof Error ? { message: error.message } : { error: String(error) } }
      );
      await delay(delayMs);
    }
  }

  throw lastError;
}

/**
 * Combine retry + timeout in a single wrapper.
 * Each attempt is individually subject to the timeout.
 */
export async function withRetryAndTimeout<T>(
  fn: () => Promise<T>,
  retryConfig: Partial<RetryConfig> = {},
  timeoutConfig: TimeoutConfig = { timeoutMs: 30000 },
  label?: string
): Promise<T> {
  return withRetry(
    () => withTimeout(fn, timeoutConfig, label),
    retryConfig,
    label
  );
}
