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

  // Debounce export so back-to-back Tracer.start/end pairs land in ONE
  // tab instead of triggering N separate window.open() calls.  Real-world
  // report: code with two consecutive
  //   Tracer.start("a"); ... Tracer.end(); Tracer.start("b"); ... Tracer.end();
  // showed only the first trace because the browser popup blocker
  // refused the second window.open (it lost user-gesture context inside
  // an async .then callback).  We now collect every bundle that ends
  // within the debounce window and surface them all in a single report.
  private pendingExport: ReturnType<typeof setTimeout> | null = null;
  private pendingBundleIds: number[] = [];
  // 50ms is short enough that a single one-shot Tracer.end() still feels
  // synchronous to users, but long enough to absorb a tight start/end
  // /start/end pair.
  private static EXPORT_DEBOUNCE_MS = 50;

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
          // The babel plugin injects a counter increment at the top of
          // every module body it transforms.  Reading it here tells us
          // DEFINITIVELY whether user files got instrumented:
          //   transformedFiles === 0 → babel plugin never ran on user code
          //   transformedFiles >  0 → it ran on N user files
          const transformedFiles =
            (globalThis as { __scryTransformedFileCount?: number })
              .__scryTransformedFileCount ?? 0;
          const diag =
            ` [diagnostics: rawEvents=${r._rawEventCount ?? "?"} ` +
            `droppedNullBundle=${r._droppedNullBundle ?? "?"} ` +
            `listener=${r._listenerKind ?? "?"} ` +
            `pluginApplied=${
              (globalThis as { scryPluginApplied?: boolean })
                .scryPluginApplied === true
            } ` +
            `transformedFiles=${transformedFiles}]`;
          // rawEvents > 0 && droppedNullBundle === rawEvents:
          //   listener heard them but they had traceBundleId=null
          //   → Tracer.start was not called or the IIFE's traceContext
          //     never sync'd from Zone.current — likely a transform issue.
          // rawEvents === 0:
          //   no listener received anything.  Either nothing emitted
          //   (transform skipped entirely → check NODE_ENV / plugin
          //   wiring / stale .vite/deps) or the recorder was never
          //   created (Tracer module never evaluated).
          // CONFIRMED: babel plugin never ran on a single user file.
          //   → vite.config / babel config is wrong.  Switch to the
          //     dedicated Vite plugin (one-line fix).
          const noTransformAtAll = transformedFiles === 0;
          // PROBABLE: ran on some files but not the one calling Tracer.
          //   → most likely .vite/deps cache or an `exclude` rule that
          //     happens to match the user's file.
          const partialTransformOnly =
            !noTransformAtAll && r._rawEventCount === 0;

          let transformHint = "";
          if (noTransformAtAll) {
            transformHint =
              " ★★ CONFIRMED: the scry babel plugin DID NOT RUN on any of your files (transformedFiles=0). " +
              "Your vite.config is not wired correctly. Fix:\n\n" +
              '  import { scryVitePlugin } from "@racgoo/scry/vite";\n' +
              '  import react from "@vitejs/plugin-react";\n' +
              "  export default { plugins: [scryVitePlugin(), react()] };\n\n" +
              "Then `rm -rf node_modules/.vite` and restart dev. " +
              "This counter is incremented once per transformed module — if it's 0, the plugin definitely never ran.";
          } else if (partialTransformOnly) {
            transformHint =
              ` ★ The babel plugin ran on ${transformedFiles} file(s), but the file calling Tracer.start/end isn't one of them. ` +
              "Likely causes: your vite plugin's `exclude` rule covers this path, or Vite served the file from a stale `.vite/deps` prebundle " +
              "(try `rm -rf node_modules/.vite` and restart).";
          }
          Output.printError(
            "Tracer.end(): no events were recorded for this bundle. " +
              "Common causes: (1) the traced function was not invoked between " +
              "Tracer.start() and Tracer.end(); (2) NODE_ENV === 'production' " +
              "at transform time; (3) the babel plugin is not active for this " +
              "file; (4) Vite served a stale .vite/deps prebundle (try " +
              "`rm -rf node_modules/.vite` and restart dev)." +
              transformHint +
              diag
          );
        }
        //Update duration (ms) — tree generation deferred to flush
        this.recorder.getBundleMap().get(endBundleId)!.duration =
          Date.now() -
          this.recorder.getBundleMap().get(endBundleId)!.startTime;

        // Queue this bundle for export.  Debounce — if more start/end
        // pairs fire within EXPORT_DEBOUNCE_MS, they all land in the
        // same report tab instead of triggering separate window.open
        // calls (the browser popup-blocks all but the first).
        this.pendingBundleIds.push(endBundleId);
        if (this.pendingExport !== null) clearTimeout(this.pendingExport);
        this.pendingExport = setTimeout(() => {
          this.pendingExport = null;
          this.flushPendingExports();
        }, Tracer.EXPORT_DEBOUNCE_MS);
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

  // Drain queued bundles into a SINGLE export call.  We export the
  // most-recent bundle as the primary view (its trace tree is what the
  // WebUI renders by default) but stash every queued bundle's trees and
  // metadata in the report meta so the UI can offer a bundle selector
  // without us needing to open multiple browser tabs.
  private flushPendingExports() {
    const ids = this.pendingBundleIds.slice();
    this.pendingBundleIds.length = 0;
    if (ids.length === 0) return;

    const bundles: TraceReportBundle[] = [];
    for (const bundleId of ids) {
      const bundle = this.recorder.getBundleMap().get(bundleId);
      if (!bundle) continue;
      const traceNodes: TraceNode[] =
        this.nodeGenerator.generateNodesWithTraceDetails(bundle.details);
      bundles.push({
        id: bundleId,
        description: bundle.description,
        startTimeISO: new Date(bundle.startTime).toISOString(),
        durationMs: bundle.duration,
        nodes: traceNodes,
      });
    }
    if (bundles.length === 0) return;

    // Use the LAST bundle's data as the "primary" payload for back-compat
    // with the existing exporter.export(data, meta) signature.  The other
    // bundles ride along on `meta.bundles`.
    const primary = bundles[bundles.length - 1];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r = this.recorder as any;
    this.exporter.export(primary.nodes, {
      description: primary.description,
      startTimeISO: primary.startTimeISO,
      durationMs: primary.durationMs,
      rawEventCount: r._rawEventCount,
      droppedNullBundle: r._droppedNullBundle,
      listenerKind: r._listenerKind,
      pluginApplied:
        (globalThis as { scryPluginApplied?: boolean }).scryPluginApplied ===
        true,
      transformedFiles:
        (globalThis as { __scryTransformedFileCount?: number })
          .__scryTransformedFileCount ?? 0,
      bundles,
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

interface TraceReportBundle {
  id: number;
  description: string;
  startTimeISO: string;
  durationMs: number;
  nodes: TraceNode[];
}

export default Tracer;
