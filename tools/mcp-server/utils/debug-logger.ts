/**
 * デバッグ出力制御ユーティリティ
 */

const isDebugEnabled = (): boolean => {
  return Deno.env.get("MCP_DEBUG") === "true";
};

const isVerboseEnabled = (): boolean => {
  return Deno.env.get("MCP_VERBOSE") === "true";
};

export const debugLog = (...args: any[]): void => {
  if (isDebugEnabled()) {
    console.log("[DEBUG]", ...args);
  }
};

export const verboseLog = (...args: any[]): void => {
  if (isVerboseEnabled()) {
    console.log("[VERBOSE]", ...args);
  }
};

export const debugError = (...args: any[]): void => {
  if (isDebugEnabled()) {
    console.error("[DEBUG]", ...args);
  }
};

export const debugWarn = (...args: any[]): void => {
  if (isDebugEnabled()) {
    console.warn("[DEBUG]", ...args);
  }
};

export const productionLog = (...args: any[]): void => {
  console.log(...args);
};

export const productionError = (...args: any[]): void => {
  console.error(...args);
};