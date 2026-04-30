// Fixtures that mirror common real-world user patterns the babel plugin
// must handle correctly.  Transformed by the scry babel plugin at test time.

// ── Pattern 1: global builtin calls (Math.*, JSON.*) inside a traced scope ──
// Reproduces user reports where Tracer.start/end wraps a small function that
// only calls global builtins — the trace tree must NOT come back empty.
export function runMathBuiltins(): number {
  const r = Math.random();
  const f = Math.floor(r * 10);
  const m = Math.max(1, 2, 3);
  return f + m;
}

export function runJsonBuiltins(value: unknown): unknown {
  const s = JSON.stringify(value);
  return JSON.parse(s);
}

// ── Pattern 2: array/object methods on literals ──
export function runArrayMethods(): number {
  const arr = [1, 2, 3, 4, 5];
  const filtered = arr.filter((x) => x > 2);
  const mapped = filtered.map((x) => x * 2);
  return mapped.reduce((a, b) => a + b, 0);
}

// ── Pattern 3: nested-call argument like the user's Funnel.tsx (`f(g(h()))`) ──
// Each inner call returns a value that becomes the next call's argument.
export function runNestedArgs(): number {
  return Math.floor(Math.abs(Math.random() * 100));
}

// ── Pattern 4: function with NO call inside the start/end window ──
export function runEmptyScope(): number {
  const x = 42;
  return x + 1;
}

// ── Pattern 5: a function the user invokes repeatedly inside setInterval-like
//             loop.  We just call it N times to verify each invocation produces
//             an entry in the trace tree (no detail loss across invocations).
export function runRepeatedInvocations(n: number): number {
  let sum = 0;
  for (let i = 0; i < n; i++) {
    sum += Math.floor(Math.random() * 10);
  }
  return sum;
}

// ── Pattern 6: arrow function and function-expression call sites ──
export const runArrowAndFnExpr = () => {
  const fn = function double(x: number) {
    return x * 2;
  };
  return fn(Math.floor(Math.random() * 5));
};

// ── Pattern 7: `f(await x())` — call with an awaited argument ──
// Reproduces user report from Hoguma-console: `zipFiles(await someAsync())`
// produced "Uncaught SyntaxError: Unexpected reserved word" because the
// plugin wrapped the outer call in a sync arrow whose body contained the
// untouched `await`.
async function asyncSource(): Promise<number> {
  return 42;
}
function consume(n: number): number {
  return n + 1;
}
export async function runAwaitInArg(): Promise<number> {
  return consume(await asyncSource());
}
