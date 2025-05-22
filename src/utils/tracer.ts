import Output from "@utils/output";

class Tracer {
  private static isTracing = false;
  private static details: Detail[] = [];
  // 바인딩된 함수를 정적 속성으로 저장
  private static boundOnTrace = Tracer.onTrace.bind(Tracer) as EventListener;

  static start() {
    if (this.isTracing) {
      Output.print(
        "이미 추적이 진행 중입니다. Tracer.end()를 먼저 호출해주세요."
      );
      return;
    }
    this.isTracing = true;
    globalThis.addEventListener("scry:trace", this.boundOnTrace);
    Output.print("추적 시작");
  }

  static end() {
    if (!this.isTracing) {
      Output.print(
        "추적이 진행 중이지 않습니다. Tracer.start()를 먼저 호출해주세요."
      );
      return;
    }
    this.isTracing = false;
    globalThis.removeEventListener("scry:trace", this.boundOnTrace);
    const tree = this.makeTree(this.details);
    Output.print("추적 종료");
    Output.print("실행 트리", tree);
    this.details = [];
    return tree;
  }

  private static onTrace(event: CustomEvent) {
    Tracer.details.push(event.detail);
  }

  static makeTree(details: any[]): TraceNode[] {
    // 트리 구조를 저장할 배열
    const tree: TraceNode[] = [];
    // 노드 맵 (traceId로 인덱싱)
    const nodeMap = new Map<string, TraceNode>();
    // 부모-자식 관계를 추적하기 위한 스택
    const callStack: string[] = [];

    // 1단계: 모든 enter 이벤트 노드 생성 및 맵에 저장
    for (let i = 0; i < details.length; i++) {
      const detail = details[i];

      if (detail.type === "enter") {
        // 새 노드 생성
        const node: TraceNode = {
          traceId: detail.traceId,
          name: detail.name,
          source: detail.source,
          args: detail.args || [],
          children: [],
          timestamp: detail.timestamp,
          completed: false,
          chained: detail.chained,
          parentTraceId: detail.parentTraceId,
        };

        // 맵에 저장
        nodeMap.set(detail.traceId, node);

        // 실행 스택 추적 (비동기 함수도 대응)
        callStack.push(detail.traceId);

        // 부모-자식 관계 설정
        if (callStack.length > 1) {
          const parentId = callStack[callStack.length - 2];
          const parent = nodeMap.get(parentId);

          if (parent && !parent.completed) {
            parent.children.push(node);
          } else {
            // 부모가 이미 완료된 경우 루트로 처리
            tree.push(node);
          }
        } else {
          // 루트 레벨 노드
          tree.push(node);
        }
      } else if (detail.type === "exit") {
        // traceId로 노드 찾기
        const node = nodeMap.get(detail.traceId);

        if (node) {
          // exit 이벤트 정보 추가
          node.returnValue = detail.returnValue;
          node.completed = true;

          if (detail.timestamp && node.timestamp) {
            node.duration = detail.timestamp - node.timestamp;
          }

          // 콜스택에서 제거 (가장 최근에 추가된 같은 traceId 항목)
          const stackIndex = callStack.lastIndexOf(detail.traceId);
          if (stackIndex !== -1) {
            callStack.splice(stackIndex, 1);
          }
        }
      }
    }
    tree.pop(); //end 이벤트 제거
    return tree;
  }
}

export default Tracer;
