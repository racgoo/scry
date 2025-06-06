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
    //this logic is danger, because Trace.start() Trace.end() pattern called over twice times, it will be not working as I think
    while (this.isTracing) {
      const promiseWaits = this.details
        .filter((detail) => detail.type === "exit")
        .filter((returnValue) => returnValue instanceof Promise);
      const results = await Promise.allSettled(promiseWaits);
      await new Promise((resolve) => setTimeout(resolve, 1000));
      if (results.every((promise) => promise.status === "fulfilled")) {
        break;
      }
    }
    //Make trace tree(hierarchical tree structure by call)
    const traceNodes: TraceNode[] = this.makeTraceNodes(this.details);
    //Remove last node. it's not a trace node, it's Trace.end() command.. :(
    traceNodes.pop();
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

  //Make trace nodes(hierarchical tree structure by call)
  private makeTraceNodes(details: Detail[]): TraceNode[] {
    const traceNodes: TraceNode[] = [];
    let nodeMap = new Map<number, TraceNode>();
    const enterDetails = details.filter((d) => d.type === "enter");
    //Extract entry index for each trace id
    const enterIndexMap = new Map<number, number>();
    for (let i = 0; i < enterDetails.length; i++) {
      enterIndexMap.set(enterDetails[i].traceId, i);
    }
    //Create nodes(transform details to trace nodes)
    for (const detail of details) {
      if (detail.type === "enter") {
        const node: TraceNode = {
          parent: null,
          errored: false,
          traceId: detail.traceId,
          name: detail.name,
          source: detail.source,
          functionCode: detail.functionCode,
          methodCode: detail.methodCode,
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

    //Reverse chained nodes order
    nodeMap = this.reverseChainedNodes(details, nodeMap);

    //Setup parent-child relation
    for (const node of nodeMap.values()) {
      if (!node.parentTraceId) {
        traceNodes.push(node);
      } else {
        const parent = nodeMap.get(node.parentTraceId);
        if (parent) {
          parent.children.push(node);
          node.parent = parent;
        } else {
          traceNodes.push(node); // dangling parent
        }
      }
    }

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
      // const indent = "ㅤㅤ".repeat(depth);
      const indent = "ㅤ";
      // const prefix = depth > 0 ? "⤷ " : "";
      const prefix = "ㅤ";
      //Generate html content
      const htmlContent = Format.generateHtmlContent(node);
      //Generate args string
      const args = node.args.map((arg) => Format.parseJson(arg)).join(", ");
      //Save to result
      result.push({
        //Title text
        title: `${indent}${prefix}${node.name}(${args}) ${
          node.errored ? "⚠️Error⚠️" : ""
        } [${node.classCode ? "method" : "function"}]`,
        //HTM: detail page
        html: htmlContent,
        depth: depth,
        chainInfo: node.chainInfo,
      });
      //Recursive call for children
      if (node.children?.length > 0) {
        result.push(...this.makeDetailResult(node.children, depth + 1));
      }
    }
    return result;
  }

  private reverseChainedNodes(
    nodeDetails: Detail[],
    nodeMap: Map<number, TraceNode>
  ) {
    const reversedChains: number[][] = [];
    const currentReversedChainTraceIds: number[] = [];
    let accumulating = false;
    nodeDetails.some((detail) => {
      const { chained, type } = detail;
      if (type === "exit") {
        return false;
      }
      if (chained && !accumulating) {
        //start
        accumulating = true;
      }
      if (accumulating) {
        //accumulate
        currentReversedChainTraceIds.push(detail.traceId);
      }
      if (!chained && accumulating) {
        //end
        accumulating = false;
        reversedChains.push(currentReversedChainTraceIds.slice());
        currentReversedChainTraceIds.length = 0;
      }
    });

    reversedChains.some((reversedChainTraceIds) => {
      //Chain root parent trace id
      const rootParentTraceId = nodeMap.get(
        reversedChainTraceIds[0]
      )?.parentTraceId;
      const chainRootTraceId = nodeMap.get(
        reversedChainTraceIds[reversedChainTraceIds.length - 1]
      )!.traceId;
      //Setup parent trace id and chain info
      for (let i = 0; i < reversedChainTraceIds.length; i++) {
        const traceId = reversedChainTraceIds[i];
        const currentNode = nodeMap.get(traceId)!;
        currentNode.parentTraceId = rootParentTraceId;
        currentNode.chainInfo = {
          startTraceId: chainRootTraceId,
          index: reversedChainTraceIds.length - i,
        };
      }
    });
    //Create new node map, because, Map is ordered by insertion order
    const newNodeMap = new Map<number, TraceNode>();
    Array.from(nodeMap.values())
      //Sort by trace id
      .sort((a, b) => {
        if (a.traceId && b.traceId) {
          return a.traceId - b.traceId;
        }
        return 0;
      })
      //Sort by chain index(must be chain node, if same start trace id, sort by chain index)
      .sort((a, b) => {
        if (a.chainInfo && b.chainInfo) {
          if (a.chainInfo.startTraceId === b.chainInfo.startTraceId) {
            return a.chainInfo.index - b.chainInfo.index;
          }
        }
        return 0;
      })
      .some((node) => {
        newNodeMap.set(node.traceId, node);
      });
    return newNodeMap;
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
