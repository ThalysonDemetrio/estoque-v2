const DEBUG_MODE = process.env.NODE_ENV !== "production";

type LogMeta = Record<string, unknown> | undefined;

function formatMeta(meta?: LogMeta) {
  if (!meta) return "";
  try {
    return JSON.stringify(meta);
  } catch {
    return "[unserializable-meta]";
  }
}

export const logger = {
  info(message: string, meta?: LogMeta) {
    if (!DEBUG_MODE) return;
    if (meta) {
      console.info("[App]", message, formatMeta(meta));
      return;
    }
    console.info("[App]", message);
  },

  warn(message: string, meta?: LogMeta) {
    if (!DEBUG_MODE) return;
    if (meta) {
      console.warn("[App]", message, formatMeta(meta));
      return;
    }
    console.warn("[App]", message);
  },

  error(message: string, meta?: LogMeta) {
    if (!DEBUG_MODE) return;
    if (meta) {
      console.error("[App]", message, formatMeta(meta));
      return;
    }
    console.error("[App]", message);
  },
};
