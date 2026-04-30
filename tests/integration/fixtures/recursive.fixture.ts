// Recursive fixtures – used to verify the maxDepth guard
// transformed by the scry babel plugin at test time.

function factorial(n: number): number {
  if (n <= 1) return 1;
  return n * factorial(n - 1);
}

function fibonacci(n: number): number {
  if (n <= 1) return n;
  return fibonacci(n - 1) + fibonacci(n - 2);
}

function deepRecurse(depth: number): number {
  if (depth <= 0) return 0;
  return 1 + deepRecurse(depth - 1);
}

// ── Runner exports ────────────────────────────────────────────────────────────
export function runFactorial(n: number) {
  return factorial(n);
}
export function runFibonacci(n: number) {
  return fibonacci(n);
}
export function runDeepRecurse(depth: number) {
  return deepRecurse(depth);
}
