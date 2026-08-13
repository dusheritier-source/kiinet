type LogLevel = "info" | "warn" | "error";

const secretPattern = /(authorization|cookie|credential|password|secret|token|api[-_]?key)/i;

function sanitize(value: unknown, depth = 0): unknown {
  if (depth > 4) return "[truncated]";
  if (value instanceof Error) return { name: value.name, message: value.message, stack: value.stack };
  if (Array.isArray(value)) return value.slice(0, 20).map((item) => sanitize(item, depth + 1));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, secretPattern.test(key) ? "[redacted]" : sanitize(item, depth + 1)]));
  }
  return typeof value === "string" && value.length > 1000 ? `${value.slice(0, 1000)}…` : value;
}

export function logEvent(level: LogLevel, event: string, fields: Record<string, unknown> = {}) {
  const record = JSON.stringify({ timestamp: new Date().toISOString(), level, event, ...sanitize(fields) as object });
  if (level === "error") console.error(record);
  else if (level === "warn") console.warn(record);
  else console.info(record);
}

export function requestId(request: Request) {
  return request.headers.get("x-request-id") || crypto.randomUUID();
}
