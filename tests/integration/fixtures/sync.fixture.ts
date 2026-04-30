// Sync function fixtures – transformed by the scry babel plugin at test time.
// Tests call the exported "run" functions; the internal calls (add, multiply, etc.)
// are instrumented because they appear as CallExpressions in this transformed file.

function add(a: number, b: number): number {
  return a + b;
}

function multiply(a: number, b: number): number {
  return a * b;
}

function computeSum(values: number[]): number {
  let total = 0;
  for (const v of values) {
    total = add(total, v);
  }
  return total;
}

function nested(): number {
  function inner(): number {
    return multiply(3, 4);
  }
  return add(inner(), 2);
}

// ── Runner exports ───────────────────────────────────────────────────────────
export function runAdd(a: number, b: number) {
  return add(a, b);
}
export function runMultiply(a: number, b: number) {
  return multiply(a, b);
}
export function runComputeSum(values: number[]) {
  return computeSum(values);
}
export function runNested() {
  return nested();
}
export function runMultipleCalls() {
  add(1, 2);
  multiply(3, 4);
}
