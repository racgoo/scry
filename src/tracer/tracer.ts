import "zone.js";
import dayjs from "dayjs";
import Format from "./format.js";
import { Output } from "../utils/output.js";
import { Environment } from "../utils/enviroment.js";
import { TraceNode } from "./node/type.js";
import { TraceRecorder, TraceRecorderInterface } from "./record/index.js";
import { NodeGenerator, NodeGeneratorInterface } from "./node/index.js";
import { TracerOption } from "./type.js";

//Tracer class. for single instance.
class Tracer {
  //Recorder for trace details(emitted by babel plugin code)
  private recorder: TraceRecorderInterface = new TraceRecorder();
  //Generator for trace nodes(generate trace nodes from trace details)
  private nodeGenerator: NodeGeneratorInterface = new NodeGenerator();
  //Tracer option for each tracing
  private currentOption: TracerOption = {
    tracing: false,
    description: "",
    traceBundleId: 0,
  };

  constructor() {}

  //Start tracing
  public start(description?: string) {
    //Check if tracing is already started
    if (this.currentOption.tracing) {
      Output.printError(
        "Tracing is already started. Please call Tracer.end() first."
      );
      return;
    }
    //Update current option
    this.currentOption.description = description || "";
    this.currentOption.traceBundleId++;
    this.currentOption.tracing = true;
    //Update current and root zone state with bundle id
    this.updateCurrentAndRootZoneBundleId(this.currentOption.traceBundleId);
    this.updateCurrentAndRootZoneParentTraceId(null);
    //Init details with bundle id
    if (!this.recorder.hasBundle(this.currentOption.traceBundleId)) {
      this.recorder.initBundle(this.currentOption.traceBundleId, description);
    }
    //Print divider and tracing start message
    Output.printDivider();
    Output.print("Tracer is started");
  }

  //End tracing
  end() {
    //Check if tracing is started
    if (!this.currentOption.tracing) {
      Output.printError(
        "Tracing is not started. Please call Tracer.start() first."
      );
      return;
    }
    //Get end bundle id(as primitive member variable, because it will be changed during async task)
    const endBundleId = this.currentOption.traceBundleId;
    //Clear current option
    this.currentOption.tracing = false;
    this.currentOption.description = "";
    //Clear current and root zone state
    this.updateCurrentAndRootZoneBundleId(null);
    this.updateCurrentAndRootZoneParentTraceId(null);

    //Wait for all return values to be resolved
    //this logic is wait for all context return value to be done
    //in Promise, return value is resolved when 'then' trigger
    //in Object, return value is resolved automatically when context is done
    const asyncTaskLoading = new Promise((resolve) => {
      //Check if all context is done(end is sync task, so we need to check it with interval)
      const interval = setInterval(() => {
        if (this.isAllContextDone(endBundleId)) {
          //If all context is done, resolve promise
          resolve(true);
          //Clear interval
          clearInterval(interval);
        }
      }, 10);
    });

    //Wait for all return values to be resolved
    asyncTaskLoading.then(() => {
      //Get current bundle details
      const currentBundleDetails =
        this.recorder.getBundleMap().get(endBundleId)?.details || [];
      //Make trace tree(hierarchical tree structure by call)
      const traceNodes: TraceNode[] =
        this.nodeGenerator.generateNodesWithTraceDetails(currentBundleDetails);
      //Update duration
      this.recorder.getBundleMap().get(endBundleId)!.duration = dayjs().diff(
        this.recorder.getBundleMap().get(endBundleId)!.startTime,
        "ms"
      );

      //Generate html root for Display UI(HTML)
      const htmlRoot = Format.generateHtmlRoot(
        this.recorder.getBundleMap().get(endBundleId)!.description,
        traceNodes,
        this.recorder.getBundleMap().get(endBundleId)!.startTime,
        this.recorder.getBundleMap().get(endBundleId)!.duration
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

  //Check if all context is done(await promise context with 'then' trigger)
  private isAllContextDone(bundleId: number) {
    const bundleMap = this.recorder.getBundleMap();
    const bundle = bundleMap.get(bundleId);
    if (!bundle) {
      return true;
    }
    return bundle.activeTraceIdSet.size === 0;
  }

  /**
   * Update current and root zone state with bundle id
   * When Tracer.start() or Tracer.end() is called, Zone.current and Zone.root states are updated
   * Zone.current is used for function-level execution context, while Zone.root is used for file-level execution
   * This ensures that subsequent logic tracks based on the updated state
   */
  private updateCurrentAndRootZoneBundleId(bundleId: number | null) {
    //Update current zone state
    (
      Zone.current as unknown as {
        _properties: { traceContext: { traceBundleId: number | null } };
      }
    )._properties.traceContext.traceBundleId = bundleId;
    //Update root zone state
    (
      Zone.root as unknown as {
        _properties: { traceContext: { traceBundleId: number | null } };
      }
    )._properties.traceContext.traceBundleId = bundleId;
  }
  private updateCurrentAndRootZoneParentTraceId(parentTraceId: number | null) {
    //Update current zone state
    (
      Zone.current as unknown as {
        _properties: { traceContext: { parentTraceId: number | null } };
      }
    )._properties.traceContext.parentTraceId = parentTraceId;
    //Update root zone state
    (
      Zone.root as unknown as {
        _properties: { traceContext: { parentTraceId: number | null } };
      }
    )._properties.traceContext.parentTraceId = parentTraceId;
  }
}

export default Tracer;
