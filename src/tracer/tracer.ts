import Output from "@utils/output";

interface TraceNode {
  traceId: string;
  name: string;
  source: string;
  args: any[];
  children: TraceNode[];
  returnValue?: any;
  timestamp?: number;
  duration?: number;
  completed: boolean;
  chained?: boolean;
  parentTraceId?: string;
  // 컨텍스트 정보 추가
  context?: {
    params: string; // 파라미터 문자열
    result: string; // 반환값 문자열
    link: string; // 컨텍스트 링크 (예: "context-{traceId}")
  };
}

class Tracer {
  private isTracing = false;
  private details: Detail[] = [];
  private duration: number = 0;
  // 바인딩된 함수를 정적 속성으로 저장
  private boundOnTrace = this.onTrace.bind(this) as EventListener;

  public start() {
    if (this.isTracing) {
      Output.print(
        "이미 추적이 진행 중입니다. Tracer.end()를 먼저 호출해주세요."
      );
      return;
    }
    this.isTracing = true;
    this.duration = Date.now();
    globalThis.addEventListener("scry:trace", this.boundOnTrace);
    Output.print("추적 시작");
  }

  end() {
    if (!this.isTracing) {
      Output.print(
        "추적이 진행 중이지 않습니다. Tracer.start()를 먼저 호출해주세요."
      );
      return;
    }
    this.isTracing = false;
    globalThis.removeEventListener("scry:trace", this.boundOnTrace);
    this.duration = Date.now() - this.duration;
    const tree = this.makeTree(this.details);
    Output.print("추적 종료");
    const displayResult = this.makeConsoleResult(tree).join("\n");
    Output.print("실행 트리", "\n" + displayResult);
    this.details = [];
    return tree;
  }

  private onTrace(event: CustomEvent) {
    this.details.push(event.detail);
  }

  private makeTree(details: Detail[]): TraceNode[] {
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
          timestamp: 0,
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
          node.duration = 0;

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

  private generateDataUrl(node: TraceNode): string {
    // 노드 데이터를 Base64로 인코딩
    const data = {
      name: node.name,
      args: node.args,
      returnValue: node.returnValue,
      source: node.source,
      duration: node.duration,
      timestamp: node.timestamp,
      children: node.children,
    };

    const jsonStr = JSON.stringify(data);
    const base64Data =
      typeof window !== "undefined"
        ? btoa(jsonStr) // 브라우저
        : Buffer.from(jsonStr).toString("base64"); // Node.js

    // HTML 템플릿 생성
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Scry Trace Viewer - ${node.name}</title>
        <style>
          body { font-family: monospace; padding: 20px; }
          .trace-info { border: 1px solid #ccc; padding: 15px; margin: 10px 0; }
          .args { color: #666; }
          .return { color: #0066cc; }
          .source { color: #888; }
        </style>
      </head>
      <body>
        <script>
          const traceData = JSON.parse(atob('${base64Data}'));
          
          document.body.innerHTML = \`
            <div class="trace-info">
              <h2>\${traceData.name}</h2>
              <div class="args">
                Arguments: \${JSON.stringify(traceData.args, null, 2)}
              </div>
              <div class="return">
                Return Value: \${JSON.stringify(traceData.returnValue, null, 2)}
              </div>
              <div class="source">
                Source: \${traceData.source}
              </div>
              <div>
                Duration: \${traceData.duration}ms
              </div>
            </div>
          \`;
        </script>
      </body>
      </html>
    `;

    // HTML을 Base64로 인코딩하여 data URL 생성
    const htmlBase64 =
      typeof window !== "undefined"
        ? btoa(html)
        : Buffer.from(html).toString("base64");

    return `data:text/html;base64,${htmlBase64}`;
  }

  private makeConsoleResult(tree: TraceNode[], level = 0): string[] {
    const result: string[] = [];

    for (const node of tree) {
      const indent = "  ".repeat(level);
      const prefix = level > 0 ? "└─ " : "";

      // 데이터 URL 생성
      const dataUrl = this.generateDataUrl(node);

      // 함수 정보와 링크 생성
      result.push(
        `${indent}${prefix}${node.name}(함수) ` + `[🔍 상세보기](${dataUrl})`
      );

      if (node.children?.length > 0) {
        result.push(...this.makeConsoleResult(node.children, level + 1));
      }
    }

    return result;
  }
}

export default Tracer;
