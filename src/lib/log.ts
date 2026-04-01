const PREFIX = "[sob-zap]";

function debugEnabled(): boolean {
  try {
    const hasQueryFlag = new URLSearchParams(window.location.search).has("sob_debug");
    const hasHashFlag = window.location.hash.includes("sob_debug");
    const localOverride = window.localStorage.getItem("sob_debug") === "1";
    return hasQueryFlag || hasHashFlag || localOverride;
  } catch {
    return false;
  }
}

const isDebug = debugEnabled();

export const log = {
  info(...args: unknown[]): void {
    console.info(PREFIX, ...args);
  },
  warn(...args: unknown[]): void {
    console.warn(PREFIX, ...args);
  },
  error(...args: unknown[]): void {
    console.error(PREFIX, ...args);
  },
  debug(...args: unknown[]): void {
    if (isDebug) {
      console.debug(PREFIX, ...args);
    }
  }
};
