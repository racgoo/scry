// Class method fixtures – transformed by the scry babel plugin at test time.

class Calculator {
  private history: number[] = [];

  add(a: number, b: number): number {
    const result = a + b;
    this.history.push(result);
    return result;
  }

  multiply(a: number, b: number): number {
    const result = a * b;
    this.history.push(result);
    return result;
  }

  getHistory(): number[] {
    return [...this.history];
  }
}

class AsyncService {
  async fetchAndProcess(id: number): Promise<string> {
    await new Promise<void>((r) => setTimeout(r, 5));
    return `processed-${id}`;
  }

  async batchProcess(ids: number[]): Promise<string[]> {
    return Promise.all(ids.map((id) => this.fetchAndProcess(id)));
  }
}

// ── Runner exports ────────────────────────────────────────────────────────────
export function runCalculatorAdd(a: number, b: number) {
  const calc = new Calculator();
  return calc.add(a, b);
}

export function runCalculatorMultiple() {
  const calc = new Calculator();
  calc.add(2, 3);
  calc.multiply(4, 5);
  calc.getHistory();
}

export async function runAsyncService(id: number) {
  const svc = new AsyncService();
  return svc.fetchAndProcess(id);
}

export async function runBatchProcess(ids: number[]) {
  const svc = new AsyncService();
  return svc.batchProcess(ids);
}
