import { Output } from "../utils/output.js";
import Format from "./format.js";
import { TRACE_EVENT_NAME } from "../babel/scry.constant.js";
import { Environment } from "../utils/enviroment.js";
import dayjs from "dayjs";

//Tracer class. for single instance.
class Tracer {
  private isTracing = false;
  //Trace details(like stack trace)
  private details: Detail[] = [];
  //Trace start time(dayjs)
  private startTime: dayjs.Dayjs = dayjs();
  //Trace duration(ms)
  private duration: number = 0;
  //Bind onTrace function(for static method call)
  private boundOnTrace = this.onTrace.bind(this) as EventListener;

  //Start tracing
  public start() {
    if (this.isTracing) {
      Output.printError(
        "Tracing is already started. Please call Tracer.end() first."
      );
      return;
    }
    this.isTracing = true;
    //Init start time
    this.startTime = dayjs();
    //Register event listener according to the execution environment
    if (Environment.isNodeJS()) {
      //Nodejs use process event
      process.on(TRACE_EVENT_NAME, this.boundOnTrace);
    } else {
      //Browser use globalThis event
      globalThis.addEventListener(TRACE_EVENT_NAME, this.boundOnTrace);
    }
    Output.printDivider();
    Output.print("Tracer is started");
  }

  //End tracing
  async end() {
    if (!this.isTracing) {
      Output.printError(
        "Tracing is not started. Please call Tracer.start() first."
      );
      return;
    }

    //Wait for all return values to be resolved
    while (this.isTracing) {
      // traceNodes = this.makeTraceNodes(this.details);
      const promiseWaits = this.details
        .filter((detail) => detail.type === "exit")
        .filter((returnValue) => returnValue instanceof Promise);
      const results = await Promise.allSettled(promiseWaits);
      await new Promise((resolve) => setTimeout(resolve, 100));
      if (results.every((promise) => promise.status === "fulfilled")) {
        break;
      }
    }
    //Make trace tree(hierarchical tree structure by call)
    const traceNodes: TraceNode[] = this.makeTraceNodes(this.details);
    //Update duration
    this.duration = dayjs().diff(this.startTime, "ms");
    //Remove event listener according to the execution environment
    if (Environment.isNodeJS()) {
      //Nodejs use process event
      process.removeListener(TRACE_EVENT_NAME, this.boundOnTrace);
    } else {
      //Browser use globalThis event
      globalThis.removeEventListener(TRACE_EVENT_NAME, this.boundOnTrace);
    }

    // await Promise.allSettled(traceNodes.map((node) => node.returnValue));
    //Make display result(for formatting)
    const detailResult = this.makeDetailResult(traceNodes);
    //Save result in file
    const htmlRoot = Format.generateHtmlRoot(
      detailResult,
      this.startTime,
      this.duration
    );

    if (Environment.isNodeJS()) {
      import("fs").then(async (fs) => {
        //Create scry directory if not exists
        if (!fs.existsSync("scry")) {
          fs.mkdirSync("scry");
        }
        //Create report directory if not exists
        if (!fs.existsSync("scry/report")) {
          fs.mkdirSync("scry/report");
        }
        //Trace end date
        const now = dayjs().format("YYYY-MM-DD_HH-mm-ss");
        //File path for result
        const filePath = `scry/report/TraceResult:${now}.html`;
        fs.writeFileSync(filePath, htmlRoot);
        //Open result html with browser
        Output.openBrowser(filePath);
      });
    }

    //Open tracing result window
    if (!Environment.isNodeJS()) {
      const blob = new Blob([htmlRoot], { type: "text/html" });
      const url = URL.createObjectURL(blob);
      //Open result html with browser
      Output.openBrowser(url);
    }

    //Clear settings
    Output.print("Tracing is ended");
    this.isTracing = false;
    this.resetSettings();
  }

  //OnTrace function. called when trace event is emitted.
  private onTrace(event: unknown) {
    // Nodejs use event directly, browser use custom event with detail
    const detail = Environment.isNodeJS()
      ? event
      : (event as CustomEvent).detail;
    //Save as detail(for making tree)
    this.details.push(detail);
    //If detail is error, show raw error(not trace tree)
    if (detail.returnValue instanceof Error) {
      Output.printError(detail.returnValue);
    }
  }

  private makeTraceNodes(details: Detail[]): TraceNode[] {
    const traceNodes: TraceNode[] = []; // 루트 노드들
    const nodeMap = new Map<string, TraceNode>();

    // 1단계: 모든 노드 생성
    for (const detail of details) {
      if (detail.type === "enter") {
        const node: TraceNode = {
          errored: false,
          traceId: detail.traceId,
          name: detail.name,
          source: detail.source,
          originCode: detail.originCode,
          classCode: detail.classCode,
          args: detail.args || [],
          children: [],
          completed: false,
          chained: detail.chained,
          parentTraceId: detail.parentTraceId,
        };
        nodeMap.set(detail.traceId, node);
      } else if (detail.type === "exit") {
        const node = nodeMap.get(detail.traceId);
        if (node) {
          node.returnValue = detail.returnValue;
          node.completed = true;
          node.errored = detail.returnValue instanceof Error;
        }
      }
    }

    // 2단계: 부모-자식 관계 설정
    for (const node of nodeMap.values()) {
      if (!node.parentTraceId) {
        // parentTraceId가 없으면 루트 노드
        traceNodes.push(node);
      } else {
        // 부모가 있으면 부모의 children에 추가
        const parent = nodeMap.get(node.parentTraceId);
        if (parent) {
          parent.children.push(node);
        } else {
          traceNodes.push(node);
        }
      }
    }

    // Trace.end() 이벤트는 제외
    traceNodes.pop();
    return traceNodes;
  }

  //Make display result(for console)
  private makeDetailResult(
    traceNodes: TraceNode[],
    depth = 0
  ): DisplayDetailResult[] {
    const result: DisplayDetailResult[] = [];
    //Iterate traceNodes(they are root nodes)
    for (const node of traceNodes) {
      //Indent and prefix for display
      const indent = "ㅤㅤ".repeat(depth);
      const prefix = depth > 0 ? "⤷ " : "";
      //Generate html content
      const htmlContent = Format.generateHtmlContent(node);
      //Generate args string
      const args = node.args.map((arg) => JSON.stringify(arg)).join(", ");
      //Save to result
      result.push({
        //Title text
        title: `${indent}${prefix}${node.name}(${args}) ${
          node.errored ? "⚠️Error⚠️" : ""
        } [${node.classCode ? "method" : "function"}]`,
        //HTM: detail page
        html: htmlContent,
      });
      //Recursive call for children
      if (node.children?.length > 0) {
        result.push(...this.makeDetailResult(node.children, depth + 1));
      }
    }
    return result;
  }

  //Reset settings(Trace is single instance but, v8(nodejs,browser) use signle thread, there is no side effect)
  private resetSettings() {
    this.isTracing = false;
    this.details = [];
    this.startTime = dayjs();
    this.duration = 0;
  }
}

export default Tracer;
