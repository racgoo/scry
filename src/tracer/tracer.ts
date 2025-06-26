import "zone.js";
import dayjs from "dayjs";
import Format from "./format.js";
import { Output } from "../utils/output.js";
import { Environment } from "../utils/enviroment.js";
import {
  // ACTIVE_TRACE_ID_SET,
  TRACE_EVENT_NAME,
} from "../babel/scry.constant.js";

//Tracer class. for single instance.
class Tracer {
  private isTracing = false;
  //Trace details(like stack trace)
  private bundleMap: Map<
    number,
    {
      description: string;
      details: Detail[];
      startTime: dayjs.Dayjs;
      duration: number;
      activeTraceIdSet: Set<number>;
    }
  > = new Map();
  //Bind onTrace function(for static method call)
  private boundOnTrace = this.onTrace.bind(this) as EventListener;

  constructor() {
    if (Environment.isNodeJS()) {
      //Nodejs use process event
      process.on(TRACE_EVENT_NAME, this.boundOnTrace);
    } else {
      //Browser use globalThis event
      globalThis.addEventListener(TRACE_EVENT_NAME, this.boundOnTrace);
    }
  }
  //Trace description
  private currentOption: {
    description: string;
    traceBundleId: number;
  } = {
    description: "",
    traceBundleId: 0,
  };

  //Start tracing
  public start(description?: string) {
    if (this.isTracing) {
      Output.printError(
        "Tracing is already started. Please call Tracer.end() first."
      );
      return;
    }
    //Update current option
    this.currentOption.description = description || "";
    this.currentOption.traceBundleId++;
    Function(
      `Zone.root._properties.traceContext.traceBundleId = ${this.currentOption.traceBundleId};`
    )();
    Function(
      `Zone.current._properties.traceContext.traceBundleId = ${this.currentOption.traceBundleId};`
    )();

    this.isTracing = true;

    //Init details with bundle id
    if (!this.bundleMap.has(this.currentOption.traceBundleId)) {
      this.bundleMap.set(this.currentOption.traceBundleId, {
        description: description || "",
        details: [],
        startTime: dayjs(),
        duration: 0,
        activeTraceIdSet: new Set(),
      });
    }

    //Register event listener according to the execution environment

    Output.printDivider();
    Output.print("Tracer is started");
  }

  //End tracing
  end() {
    if (!this.isTracing) {
      Output.printError(
        "Tracing is not started. Please call Tracer.start() first."
      );
      return;
    }
    const endBundleId = this.currentOption.traceBundleId;
    this.isTracing = false;

    Function(`Zone.root._properties.traceContext.traceBundleId = null;`)();
    Function(`Zone.current._properties.traceContext.traceBundleId = null;`)();

    //Wait for all return values to be resolved
    //this logic is wait for async context done(await promise context with 'then' trigger)
    const asyncTaskLoading = new Promise((resolve) => {
      const interval = setInterval(() => {
        if (this.isAllContextDone(endBundleId)) {
          resolve(true);
          clearInterval(interval);
        }
      }, 100);
    });

    asyncTaskLoading.then(() => {
      //Get current bundle details
      const currentBundleDetails =
        this.bundleMap.get(endBundleId)?.details || [];
      //Make trace tree(hierarchical tree structure by call)
      const traceNodes: TraceNode[] = this.makeTraceNodes(currentBundleDetails);
      //Update duration
      this.bundleMap.get(endBundleId)!.duration = dayjs().diff(
        this.bundleMap.get(endBundleId)!.startTime,
        "ms"
      );

      //Generate html root for Display UI(HTML)
      const htmlRoot = Format.generateHtmlRoot(
        this.bundleMap.get(endBundleId)!.description,
        traceNodes,
        this.bundleMap.get(endBundleId)!.startTime,
        this.bundleMap.get(endBundleId)!.duration
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
    });
  }

  //OnTrace function. called when trace event is emitted.
  private onTrace(event: unknown) {
    // Nodejs use event directly, browser use custom event with detail
    // const detail: Detail = (event as CustomEvent).detail;
    const detail: Detail = (event as any).detail ?? (event as Detail);
    if (!detail) {
      Output.printError("Trace event detail is undefined");
      return;
    }

    if (detail.traceBundleId === null) return;

    //If detail is async done, delete trace id from active trace id set
    if (detail.type === "async-done") {
      this.bundleMap
        .get(detail.traceBundleId)
        ?.activeTraceIdSet.delete(detail.traceId);

      return;
    }
    if (detail.type === "enter") {
      //Add trace id to active trace id set(for async context done)
      this.bundleMap
        .get(detail.traceBundleId)
        ?.activeTraceIdSet.add(detail.traceId);
    }
    // //Save as detail with bundle id(for making tree)
    if (this.bundleMap.get(detail.traceBundleId)) {
      this.bundleMap.get(detail.traceBundleId)!.details.push(detail);
    }
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
  private isAllContextDone(bundleId: number) {
    const bundle = this.bundleMap.get(bundleId);

    if (!bundle) {
      return true;
    }

    return bundle.activeTraceIdSet.size === 0;
    // //Zone.root has ACTIVE_TRACE_ID_SET as Active trace id set.
    // const { [ACTIVE_TRACE_ID_SET]: activeTraceIdSet } =
    //   Zone.root as unknown as {
    //     [ACTIVE_TRACE_ID_SET]: Set<number>;
    //   };
    // //Return active context is not exist
    // return activeTraceIdSet.size === 0;
  }

  //Init context history(reset Zone.root.ACTIVE_TRACE_ID_SET )
  // private initContextHistory() {
  //   (Zone.root as unknown as { [ACTIVE_TRACE_ID_SET]: Set<number> })[
  //     ACTIVE_TRACE_ID_SET
  //   ] = new Set();
  // }

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
}

export default Tracer;
