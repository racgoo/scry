// Error-throwing fixtures – transformed by the scry babel plugin at test time.

function syncThrow(): never {
  throw new Error("sync error");
}

function safeCatch(): string {
  try {
    syncThrow();
  } catch {
    return "caught";
  }
  return "ok";
}

async function asyncThrow(): Promise<never> {
  await Promise.resolve();
  throw new Error("async error");
}

async function asyncCatch(): Promise<string> {
  try {
    await asyncThrow();
  } catch {
    return "caught-async";
  }
  return "ok";
}

// ── Runner exports ────────────────────────────────────────────────────────────
export function runSyncThrow() {
  syncThrow();
}
export function runSafeCatch() {
  return safeCatch();
}
export async function runAsyncThrow() {
  await asyncThrow();
}
export async function runAsyncCatch() {
  return asyncCatch();
}
