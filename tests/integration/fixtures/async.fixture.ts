// Async function fixtures – transformed by the scry babel plugin at test time.

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchData(id: number): Promise<{ id: number; value: string }> {
  await delay(5);
  return { id, value: `data-${id}` };
}

async function processItems(ids: number[]): Promise<string[]> {
  const results = await Promise.all(ids.map((id) => fetchData(id)));
  return results.map((r) => r.value);
}

async function chainedAsync(): Promise<number> {
  const a = await fetchData(1);
  const b = await fetchData(2);
  return a.id + b.id;
}

function promiseBased(): Promise<string> {
  return new Promise((resolve) => {
    setTimeout(() => resolve("done"), 5);
  });
}

// ── Runner exports ────────────────────────────────────────────────────────────
export async function runFetchData(id: number) {
  return fetchData(id);
}
export async function runProcessItems(ids: number[]) {
  return processItems(ids);
}
export async function runChainedAsync() {
  return chainedAsync();
}
export async function runPromiseBased() {
  return promiseBased();
}
