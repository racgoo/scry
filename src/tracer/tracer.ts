import "zone.js";
import dayjs from "dayjs";
// import Format from "./format.js";
import { Output } from "../utils/output.js";
import { TraceNode } from "./node/type.js";
import { TraceRecorder, TraceRecorderInterface } from "./record/index.js";
import { NodeGenerator, NodeGeneratorInterface } from "./node/index.js";
import { ZoneContext, ZoneContextInterface } from "./zone/index.js";
import { TracerOption } from "./type.js";
import { ExporterInterface } from "./export/interface.js";
import { Exporter } from "./export/exporter.js";
import Format from "./format.js";
//Tracer class. for single instance.
class Tracer {
  //Recorder for trace details(emitted by babel plugin code)
  private recorder: TraceRecorderInterface = new TraceRecorder();
  //Generator for trace nodes(generate trace nodes from trace details)
  private nodeGenerator: NodeGeneratorInterface = new NodeGenerator();
  //Zone context for update current and root zone state
  private zoneContext: ZoneContextInterface = new ZoneContext();
  //Exporter for export trace result
  private exporter: ExporterInterface = new Exporter();

  //Tracer option for each tracing
  private currentOption: TracerOption = {
    tracing: false,
    description: "",
    traceBundleId: 0,
  };

  //Start tracing
  public start(description?: string) {
    //Check if tracing is already started
    if (this.currentOption.tracing) {
      this.handleDuplicatedStart();
      return;
    }
    //Update current option
    this.currentOption.description = description || "";
    this.currentOption.traceBundleId++;
    this.currentOption.tracing = true;
    //Update current and root zone state with bundle id and init parent trace id
    this.zoneContext.updateCurrentAndRootZoneBundleId(
      this.currentOption.traceBundleId
    );
    this.zoneContext.updateCurrentAndRootZoneParentTraceId(null);
    //Init details with bundle id
    if (!this.recorder.hasBundle(this.currentOption.traceBundleId)) {
      this.recorder.initBundle(this.currentOption.traceBundleId, description);
    }
  }
  //End tracing
  end() {
    //Check if tracing is started
    if (!this.currentOption.tracing) {
      this.handleDuplicatedEnd();
      return;
    }
    //Get end bundle id(as primitive member variable, because it will be changed during async task)
    const endBundleId = this.currentOption.traceBundleId;
    //Clear current option
    this.currentOption.description = "";
    this.currentOption.tracing = false;
    //Clear current and root zone state
    this.zoneContext.updateCurrentAndRootZoneBundleId(null);
    this.zoneContext.updateCurrentAndRootZoneParentTraceId(null);
    //Wait for all return values to be resolved
    //this logic is wait for all context return value to be done
    //in Promise, return value is resolved when 'then' trigger
    //in Object, return value is resolved automatically when context is done
    const asyncTaskLoading = this.recorder.waitAllContextDone(endBundleId);
    //Wait for all return values to be resolved
    asyncTaskLoading.then(async () => {
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
      //Export html
      this.exporter.exportToHtml(htmlRoot);
    });
  }

  private handleDuplicatedStart() {
    Output.printError(
      "Tracing is already started. Please call Tracer.end() first."
    );
  }

  private handleDuplicatedEnd() {
    Output.printError(
      "Tracing is not started. Please call Tracer.start() first."
    );
  }
}

export default Tracer;
