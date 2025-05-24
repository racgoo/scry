class Tracer {
  private static isTracing = false;
  private static traceDepth = 0;

  static tracker<T>(fn: () => T, name: string): T {
    if (!Tracer.isTracing) return fn();

    const indent = "  ".repeat(Tracer.traceDepth);
    console.log(`${indent}[TRACE] ${name} 호출`);

    Tracer.traceDepth++;
    try {
      const result = fn();
      return result;
    } finally {
      Tracer.traceDepth--;
      console.log(`${indent}[TRACE] ${name} 종료`);
    }
  }

  static start(): void {
    Tracer.isTracing = true;
    console.log("[TRACE] 추적 시작");
  }

  static end(): void {
    Tracer.isTracing = false;
    Tracer.traceDepth = 0;
    console.log("[TRACE] 추적 종료");
  }
}

// 전역으로 노출
(globalThis as any).___tracer_tracker = Tracer.tracker.bind(Tracer);

export default Tracer;
