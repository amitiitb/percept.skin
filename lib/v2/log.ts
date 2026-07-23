// Structured logging for v2 API routes — Eng review Section 8 (Observability).
// Enables reconstructing "user paid but not premium" style incidents from logs alone.
type LogFields = Record<string, string | number | boolean | null | undefined>;

function emit(level: "info" | "warn" | "error", event: string, fields?: LogFields) {
  console[level](JSON.stringify({ ts: new Date().toISOString(), event, ...fields }));
}

export const logV2 = {
  info: (event: string, fields?: LogFields) => emit("info", event, fields),
  warn: (event: string, fields?: LogFields) => emit("warn", event, fields),
  error: (event: string, fields?: LogFields) => emit("error", event, fields),
};
