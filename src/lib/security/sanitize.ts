/**
 * Input sanitization utilities for security hardening.
 * Provides length validation, prompt injection mitigation, and conversation history cleaning.
 */

/**
 * Maximum allowed lengths for various inputs.
 */
export const INPUT_LIMITS = {
  MESSAGE_MAX_LENGTH: 10_000,
  QUERY_MAX_LENGTH: 5_000,
  CONVERSATION_HISTORY_MAX: 50,
  HISTORY_MESSAGE_MAX_LENGTH: 8_000,
} as const;

/**
 * Sanitize user input before interpolation into LLM prompts.
 *
 * Strategy:
 * 1. Strip null bytes and unicode control characters (except newlines/tabs)
 * 2. Escape sequences that look like prompt delimiters or role markers
 * 3. Truncate to maxLength
 *
 * This does NOT attempt to "detect" prompt injection (which is unreliable).
 * Instead it reduces the attack surface by normalizing input and relies on
 * prompt-level delimiters (see promptDefense.ts) for structural defense.
 */
export function sanitizeForPrompt(
  input: string,
  maxLength?: number
): string {
  let sanitized = input;

  // Remove null bytes
  sanitized = sanitized.replace(/\0/g, "");

  // Remove unicode control chars except \n (\x0A), \r (\x0D), \t (\x09)
  sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");

  // Escape sequences that mimic prompt structure markers.
  // This prevents inputs from containing fake "SYSTEM:", "INSTRUCTIONS:", etc.
  sanitized = sanitized.replace(
    /^(SYSTEM|INSTRUCTIONS|CONTEXT|SYNTHESIS INSTRUCTION|SECURITY NOTE)(\s*:)/gim,
    "[$1]$2"
  );

  // Truncate
  const limit = maxLength || INPUT_LIMITS.MESSAGE_MAX_LENGTH;
  if (sanitized.length > limit) {
    sanitized = sanitized.slice(0, limit);
  }

  return sanitized;
}

/**
 * Validate and sanitize conversation history from the client.
 * Returns a cleaned array with only valid user/assistant messages.
 * Rejects "system" role messages injected by malicious clients.
 */
export function sanitizeConversationHistory(
  history: unknown
): { role: "user" | "assistant"; content: string }[] {
  if (!Array.isArray(history)) return [];

  const validRoles = new Set(["user", "assistant"]);

  return history
    .filter(
      (msg): msg is { role: string; content: string } =>
        typeof msg === "object" &&
        msg !== null &&
        typeof msg.role === "string" &&
        validRoles.has(msg.role) &&
        typeof msg.content === "string"
    )
    .slice(-INPUT_LIMITS.CONVERSATION_HISTORY_MAX)
    .map((msg) => ({
      role: msg.role as "user" | "assistant",
      content: sanitizeForPrompt(
        msg.content,
        INPUT_LIMITS.HISTORY_MESSAGE_MAX_LENGTH
      ),
    }));
}

/**
 * Validate message length and return error message if invalid.
 * Returns null if valid.
 */
export function validateMessageLength(
  message: unknown,
  maxLength = INPUT_LIMITS.MESSAGE_MAX_LENGTH
): string | null {
  if (!message || typeof message !== "string") {
    return "Message is required";
  }
  if (message.trim().length === 0) {
    return "Message cannot be empty";
  }
  if (message.length > maxLength) {
    return `Message exceeds maximum length of ${maxLength} characters`;
  }
  return null;
}
