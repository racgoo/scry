import Output from "@utils/output";
import Format from "@tracer/format";

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

  // 전역 이벤트 이미터 생성

  private isNodeJS(): boolean {
    return typeof window === "undefined" && typeof process !== "undefined";
  }

  public start() {
    if (this.isTracing) {
      Output.print(
        "Tracing is already started. Please call Tracer.end() first."
      );
      return;
    }
    this.isTracing = true;
    this.duration = Date.now();

    // 환경에 따라 다른 이벤트 리스너 등록
    if (this.isNodeJS()) {
      process.on("scry:trace", this.boundOnTrace);
    } else {
      // 브라우저 환경에서는 addEventListener 사용
      globalThis.addEventListener("scry:trace", this.boundOnTrace);
    }

    Output.print("Tracer is started");
  }

  end() {
    if (!this.isTracing) {
      Output.print("Tracing is not started. Please call Tracer.start() first.");
      return;
    }
    this.isTracing = false;

    // 환경에 따라 다른 이벤트 리스너 제거
    if (this.isNodeJS()) {
      process.removeListener("scry:trace", this.boundOnTrace);
    } else {
      globalThis.removeEventListener("scry:trace", this.boundOnTrace);
    }

    this.duration = Date.now() - this.duration;
    const tree = this.makeTree(this.details);
    Output.print("Tracing is ended");
    const displayResult = this.makeConsoleResult(tree);
    if (this.isNodeJS()) {
      const linkList: [string, string][] = [];
      for (let i = 0; i < displayResult.length; i += 2) {
        linkList.push([displayResult[i], displayResult[i + 1]]);
      }
      const htmlRoot = Format.generateHtmlRoot(linkList);
      import("fs").then((fs) => {
        if (!fs.existsSync("scry")) {
          fs.mkdirSync("scry");
        }
        fs.writeFileSync("scry/curernt-trace.html", htmlRoot);
      });
    } else {
      for (let i = 0; i < displayResult.length; i += 2) {
        console.groupCollapsed(displayResult[i]);
        console.log(displayResult[i + 1]);
        console.groupEnd();
      }
    }

    this.details = [];
    return tree;
  }

  private onTrace(event: any) {
    // Node.js 환경에서는 event가 직접 데이터를 포함
    const detail = this.isNodeJS() ? event : event.detail;
    this.details.push(detail);
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

  private makeConsoleResult(tree: TraceNode[], level = 0): string[] {
    const result: string[] = [];

    for (const node of tree) {
      const indent = "ㅤㅤ".repeat(level);
      const prefix = level > 0 ? "└─ " : "";

      const htmlContent = Format.generateHtmlContent(node);
      const dataUrl = `data:text/html;base64,${this.toBase64(htmlContent)}`;
      const args = node.args.map((arg) => JSON.stringify(arg)).join(", ");

      // Node.js 환경
      if (this.isNodeJS()) {
        // terminal-link나 ANSI 이스케이프 코드 사용
        result.push(`${indent}${prefix}${node.name}(${args})`, dataUrl);
      }
      // 브라우저 환경
      else {
        // console.log의 CSS 스타일링 사용
        result.push(
          `${indent}${prefix}${node.name}(${args})`,
          `${indent}${prefix}[Detail] ${dataUrl}`
        );
      }

      if (node.children?.length > 0) {
        result.push(...this.makeConsoleResult(node.children, level + 1));
      }
    }

    return result;
  }

  private toBase64(str: string): string {
    return this.isNodeJS() ? Buffer.from(str).toString("base64") : btoa(str);
  }
}

export default Tracer;
