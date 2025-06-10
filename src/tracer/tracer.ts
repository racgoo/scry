import "zone.js";
import dayjs from "dayjs";
import Format from "./format.js";
import { Output } from "../utils/output.js";
import { Environment } from "../utils/enviroment.js";
import {
  ACTIVE_TRACE_ID_SET,
  TRACE_EVENT_NAME,
} from "../babel/scry.constant.js";

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
    //Init context history(for zone.js)
    this.initContextHistory();
    //Set tracing flag
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
    //this logic is wait for async context done(await promise context with 'then' trigger)
    while (this.isTracing) {
      await new Promise((resolve) => setTimeout(resolve, 10));
      if (this.isAllContextDone()) break;
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
    //Generate html root for Display UI(HTML)
    const htmlRoot = Format.generateHtmlRoot(
      traceNodes,
      this.startTime,
      this.duration
    );
    //Use display ui for Browser(Nodejs use file system)
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
    //Reverse chained nodes order(babel plugin transform code with wrapping. so reverse order is needed)
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
          traceNodes.push(node);
        }
      }
    }
    return traceNodes;
  }

  //Check if all context is done(await promise context with 'then' trigger)
  private isAllContextDone() {
    //Zone.root has ACTIVE_TRACE_ID_SET as Active trace id set.
    const { [ACTIVE_TRACE_ID_SET]: activeTraceIdSet } =
      Zone.root as unknown as {
        [ACTIVE_TRACE_ID_SET]: Set<number>;
      };
    //Return active context is not exist
    return activeTraceIdSet.size === 0;
  }

  //Init context history(reset Zone.root.ACTIVE_TRACE_ID_SET )
  private initContextHistory() {
    (Zone.root as unknown as { [ACTIVE_TRACE_ID_SET]: Set<number> })[
      ACTIVE_TRACE_ID_SET
    ] = new Set();
  }

  //Reverse chained nodes order
  //(because, babel plugin transform code with wrapping. so reverse order is needed)
  private reverseChainedNodes(
    nodeDetails: Detail[],
    nodeMap: Map<number, TraceNode>
  ) {
    const reversedChains: number[][] = [];
    //Only one chain list(ex. .map().reduce().then() as [1,2,3])
    const currentReversedChainTraceIds: number[] = [];
    //Accumulating flag
    let accumulating = false;
    nodeDetails.some((detail) => {
      const { chained, type } = detail;
      //If type is exit, return false(not accumulate)
      if (type === "exit") {
        return false;
      }
      //If chained is true and accumulating is false, start accumulating
      if (chained && !accumulating) {
        //Start accumulating
        accumulating = true;
      }
      if (accumulating) {
        //Accumulate
        currentReversedChainTraceIds.push(detail.traceId);
      }
      //If chained is false and accumulating is true, end accumulating
      //Fist chain function's chained is false. so, it's not a chained function. just start function.
      if (!chained && accumulating) {
        //End accumulating
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
      //First chain function's trace id
      const chainRootTraceId = nodeMap.get(
        reversedChainTraceIds[reversedChainTraceIds.length - 1]
      )!.traceId;
      //Setup parent trace id as root parent id,and add chain info(for display)
      for (let i = 0; i < reversedChainTraceIds.length; i++) {
        const currentNode = nodeMap.get(reversedChainTraceIds[i])!;
        currentNode.parentTraceId = rootParentTraceId;
        currentNode.chainInfo = {
          //Chain start trace id
          startTraceId: chainRootTraceId,
          //Chain index
          index: reversedChainTraceIds.length - i,
        };
      }
    });
    //Create new node map, because, Map is ordered by insertion order
    const newNodeMap = new Map<number, TraceNode>();
    //Sort and update newNodeMap
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
