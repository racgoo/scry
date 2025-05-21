// 인터페이스 정의 부분 삭제
class Tracer {
  private static isTracing = false;
  private static stack: string[] = [];
  // 바인딩된 함수를 정적 속성으로 저장
  private static boundOnTrace = Tracer.onTrace.bind(Tracer) as EventListener;

  static start() {
    if (this.isTracing) {
      console.warn("[TRACE] 이미 추적 중입니다.");
      return;
    }

    this.isTracing = true;
    // 저장된 바인딩 함수 사용
    globalThis.addEventListener("scry:trace", this.boundOnTrace);
    console.log("[TRACE] 추적 시작");
  }

  static end() {
    this.isTracing = false;
    // 저장된 동일한 바인딩 함수 사용
    globalThis.removeEventListener("scry:trace", this.boundOnTrace);
    console.log("[TRACE] 추적 종료", this.stack);
    this.stack = [];
  }

  static init() {
    (globalThis as any).Tracer = Tracer;
  }

  private static onTrace(event: CustomEvent) {
    Tracer.stack.push(event.detail);
  }
}

export default Tracer;
