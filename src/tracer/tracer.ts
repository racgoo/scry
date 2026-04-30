// Import the side-effect-only init module (NOT raw zone.js) so simply
// importing Tracer is enough to set globalThis.scryPluginApplied.  This
// closes the ordering hole where a user module calls Tracer.start() at
// top level before any other transformed file has run its own flag-set
// statement.  zone-init.ts itself imports "zone.js", so Zone is still
// initialized.
import "../zone-init.js";
import { ScryAstVariable } from "../babel/scry.constant.js";

// Defense in depth: also set the flag here, at module-evaluation time of
// the Tracer module itself.  zone-init.js already does this, but if a
// bundler's "sideEffects": false hint, an aggressive pre-bundler, or a
// future refactor ever drops the side-effect import above, we still
// want `import { Tracer }` to be sufficient — because Tracer.start /
// Tracer.end are the ONLY public APIs that trigger checkPluginApplied,
// and you cannot call them without first evaluating this module.
(globalThis as unknown as { [k: string]: boolean })[
  ScryAstVariable.pluginApplied
] = true;

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
import { checkPlugin } from "./decorator.js";

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
  @checkPlugin //Decorator for method to check if plugin is applied
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
  @checkPlugin //Decorator for method to check if plugin is applied
  public end() {
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
    asyncTaskLoading
      .then(async (completed) => {
        if (!completed) {
          Output.printError(
            "Tracer.end(): some async traces did not complete before the timeout. " +
            "The report may be incomplete. Consider increasing the timeout or " +
            "ensuring all async operations finish before calling Tracer.end()."
          );
        }
        //Get current bundle details
        const currentBundleDetails =
          this.recorder.getBundleMap().get(endBundleId)?.details || [];
        // Surface the empty-tree case loudly so users don't stare at a
        // "No traced calls were recorded" page wondering whether the plugin
        // is broken.  The most common real cause is "the function I wrapped
        // in start/end never actually got called during this trace window"
        // — e.g. a probabilistic spawn inside setInterval.  Other possible
        // causes (NODE_ENV not set to development at transform time, stale
        // .vite/deps prebundle, plugin not in vite babel.plugins, etc.) are
        // also worth flagging here.
        if (currentBundleDetails.length === 0) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const r = this.recorder as any;
          const diag =
            ` [diagnostics: rawEvents=${r._rawEventCount ?? "?"} ` +
            `droppedNullBundle=${r._droppedNullBundle ?? "?"} ` +
            `listener=${r._listenerKind ?? "?"} ` +
            `pluginApplied=${
              (globalThis as { scryPluginApplied?: boolean })
                .scryPluginApplied === true
            }]`;
          // rawEvents > 0 && droppedNullBundle === rawEvents:
          //   listener heard them but they had traceBundleId=null
          //   → Tracer.start was not called or the IIFE's traceContext
          //     never sync'd from Zone.current — likely a transform issue.
          // rawEvents === 0:
          //   no listener received anything.  Either nothing emitted
          //   (transform skipped entirely → check NODE_ENV / plugin
          //   wiring / stale .vite/deps) or emit & listener live on
          //   different globalThis objects (rare; usually a Vite
          //   `optimizeDeps` quirk — try `optimizeDeps.exclude:
          //   ["@racgoo/scry"]`).
          // rawEvents=0 + pluginApplied=true is the classic "scry runtime
          // is loaded, but the user's source files were never transformed"
          // signature.  The most reliable fix is to use the dedicated Vite
          // plugin instead of trying to wedge the babel plugin into
          // @vitejs/plugin-react's babel pipeline (which silently no-ops
          // in many real configs).
          const transformLikelyMissing =
            r._rawEventCount === 0 &&
            (globalThis as { scryPluginApplied?: boolean })
              .scryPluginApplied === true;
          const transformHint = transformLikelyMissing
            ? " ★ Most likely cause: your source files are NOT being transformed by the scry babel plugin (rawEvents=0 + pluginApplied=true). " +
              "Switch your vite.config to use the dedicated Vite plugin: " +
              "`import { scryVitePlugin } from \"@racgoo/scry/vite\"; export default { plugins: [scryVitePlugin(), react()] }`. " +
              "It transforms .ts/.tsx/.js/.jsx directly and is independent of @vitejs/plugin-react's babel config."
            : "";
          Output.printError(
            "Tracer.end(): no events were recorded for this bundle. " +
              "Common causes: (1) the traced function was not invoked between " +
              "Tracer.start() and Tracer.end(); (2) NODE_ENV === 'production' " +
              "at transform time; (3) the babel plugin is not active for this " +
              "file; (4) Vite served a stale .vite/deps prebundle (try " +
              "`rm -rf node_modules/.vite` and restart dev); " +
              "(5) emit & listener live on different `globalThis` objects " +
              "(try Vite `optimizeDeps.exclude: [\"@racgoo/scry\"]`)." +
              transformHint +
              diag
          );
        }
        //Make trace tree(hierarchical tree structure by call)
        const traceNodes: TraceNode[] =
          this.nodeGenerator.generateNodesWithTraceDetails(currentBundleDetails);
        //Update duration
        this.recorder.getBundleMap().get(endBundleId)!.duration = dayjs().diff(
          this.recorder.getBundleMap().get(endBundleId)!.startTime,
          "ms"
        );

        // Render the trace via the React WebUI (single-file build embedded
        // at package build time).  Pass both the tree and the report meta
        // (description / startTime / duration) so the React UI can render
        // the same header the legacy template used to.
        const bundle = this.recorder.getBundleMap().get(endBundleId)!;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const r = this.recorder as any;
        this.exporter.export(traceNodes, {
          description: bundle.description,
          startTimeISO: bundle.startTime.toISOString(),
          durationMs: bundle.duration,
          rawEventCount: r._rawEventCount,
          droppedNullBundle: r._droppedNullBundle,
          listenerKind: r._listenerKind,
          pluginApplied:
            (globalThis as { scryPluginApplied?: boolean })
              .scryPluginApplied === true,
        });
      })
      .catch((error: unknown) => {
        // Surface the full error so users notice silent failures instead of
        // staring at a half-rendered report.  Real cause has bitten users:
        // `HTMLElement is not defined` from a stale environment check inside
        // safeStringify, leaving Tracer.end() failing AFTER the trace tree
        // was already correctly built.
        const stack =
          error && typeof error === "object" && "stack" in error
            ? (error as { stack?: string }).stack
            : null;
        Output.printError(
          `Tracer.end() failed to generate report: ${
            error instanceof Error ? error.message : String(error)
          }${stack ? `\n${stack}` : ""}`
        );
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
