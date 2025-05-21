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
    const tree = this.makeTree(this.stack);
    console.log(tree);
    this.stack = [];
  }

  static init() {
    (globalThis as any).Tracer = Tracer;
  }

  private static onTrace(event: CustomEvent) {
    Tracer.stack.push(event.detail);
  }

  static makeTree(events: any[]) {
    // 트리 구조를 저장할 배열
    const tree: any[] = [];
    // 현재 활성 노드 스택
    const stack: any[] = [];

    for (let i = 0; i < this.stack.length; i++) {
      const event = events[i];

      if (event.type === "enter") {
        // 새 노드 생성
        const node = {
          name: event.name,
          args: event.args || [],
          children: [],
          startIndex: i,
        };

        // 현재 스택에 노드가 있으면 해당 노드의 자식으로 추가
        if (stack.length > 0) {
          stack[stack.length - 1].children.push(node);
        } else {
          // 루트 레벨 노드면 결과 트리에 직접 추가
          tree.push(node);
        }

        // 새 노드를 스택에 추가
        stack.push(node);
      } else if (event.type === "exit") {
        // 일치하는 enter 노드 찾기
        if (stack.length > 0 && stack[stack.length - 1].name === event.name) {
          const node = stack.pop();

          // exit 이벤트의 정보 추가
          node.returnValue = event.returnValue;
          node.endIndex = i;
          node.duration = node.endIndex - node.startIndex;
        }
        // 스택이 비어있거나 매칭되지 않는 경우 (비정상 케이스) 처리
        else {
          console.warn(`[TRACE] 매칭되지 않는 exit 이벤트: ${event.name}`);
        }
      }
    }

    // 처리가 끝났는데 스택에 노드가 남아있다면 경고
    if (stack.length > 0) {
      console.warn(
        `[TRACE] 닫히지 않은 함수 호출이 있습니다: ${stack
          .map((n) => n.name)
          .join(", ")}`
      );
    }

    return tree;
  }
}

export default Tracer;
