import fs from "node:fs";
import { config } from "../config.js";

type LogLevel = "info" | "warn" | "error";

function writeLine(line: string): void {
  if (config.logFilePath) {
    try {
      fs.appendFileSync(config.logFilePath, `${line}\n`, "utf8");
    } catch {
      // Best-effort sink fallback to stdout.
      console.log(line);
    }
    return;
  }
  console.log(line);
}

export function logEvent(level: LogLevel, message: string, fields: Record<string, unknown> = {}): void {
  const payload = {
    at: new Date().toISOString(),
    level,
    message,
    ...fields
  };
  writeLine(JSON.stringify(payload));
}
