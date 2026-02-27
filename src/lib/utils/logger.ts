type LogLevel = "info" | "warn" | "error";

interface LogEntry {
  level: LogLevel;
  message: string;
  context?: string;
  timestamp: string;
  data?: Record<string, unknown>;
}

// Patterns to redact from log output
const SENSITIVE_PATTERNS = [
  /(?:api[_-]?key|token|secret|password|authorization)\s*[:=]\s*["']?[^\s"',}{]+/gi,
  /(?:sk|pk|key|token)-[a-zA-Z0-9_-]{20,}/g,
  /Bearer\s+[a-zA-Z0-9._-]+/gi,
];

function redact(value: string): string {
  let redacted = value;
  for (const pattern of SENSITIVE_PATTERNS) {
    redacted = redacted.replace(pattern, "[REDACTED]");
  }
  return redacted;
}

function formatEntry(entry: LogEntry): string {
  const parts = [
    `[${entry.timestamp}]`,
    `[${entry.level.toUpperCase()}]`,
    entry.context ? `[${entry.context}]` : "",
    entry.message,
  ].filter(Boolean);

  let output = parts.join(" ");

  if (entry.data) {
    const serialized = JSON.stringify(entry.data, (_key, value) => {
      if (value instanceof Error) {
        return { message: value.message, stack: value.stack?.split("\n").slice(0, 3).join("\n") };
      }
      return value;
    });
    output += ` | ${redact(serialized)}`;
  }

  return redact(output);
}

function createEntry(
  level: LogLevel,
  message: string,
  context?: string,
  data?: Record<string, unknown>
): LogEntry {
  return {
    level,
    message,
    context,
    timestamp: new Date().toISOString(),
    data,
  };
}

export const logger = {
  info(message: string, context?: string, data?: Record<string, unknown>) {
    const entry = createEntry("info", message, context, data);
    console.log(formatEntry(entry));
  },

  warn(message: string, context?: string, data?: Record<string, unknown>) {
    const entry = createEntry("warn", message, context, data);
    console.warn(formatEntry(entry));
  },

  error(message: string, context?: string, data?: Record<string, unknown>) {
    const entry = createEntry("error", message, context, data);
    console.error(formatEntry(entry));
  },
};
