import { TraceNode } from "@/tracer/node/type.js";
import {
  ExporterStrategyInterface,
  RuntimeStrategyInterface,
  TraceReportMeta,
} from "../interface.js";
import webui from "./webui.html.js";
import { Transformer } from "../../../utils/transformer.js";

class WebUIStrategy implements ExporterStrategyInterface {
  private runtimeStrategy: RuntimeStrategyInterface;
  constructor(runtimeStrategy: RuntimeStrategyInterface) {
    this.runtimeStrategy = runtimeStrategy;
  }

  exportHtml(html: string) {
    const filePath = this.runtimeStrategy.saveHtmlAndReturnFilePath(html);
    this.runtimeStrategy.openBrowser(filePath);
  }

  export(data: TraceNode[], meta: TraceReportMeta) {
    // The trace tree has cyclic refs (parent ↔ children) so it can't go
    // through plain JSON.stringify.  We use the same flatted-based
    // Transformer for the primary tree and for each bundle's tree, then
    // pass the rest of `meta` (which is JSON-safe scalars/arrays) via
    // a regular JSON encode.
    const safeMeta = { ...meta } as TraceReportMeta;
    const bundleData =
      meta.bundles && meta.bundles.length > 0
        ? meta.bundles.map((b) => ({
            id: b.id,
            description: b.description,
            startTimeISO: b.startTimeISO,
            durationMs: b.durationMs,
            // Each bundle's nodes get their own flatted blob to dodge
            // the circular-reference TypeError that bit us when bundles
            // landed inside a JSON.stringify(meta).
            nodesSerialized: Transformer.serialize(b.nodes),
          }))
        : undefined;
    delete safeMeta.bundles;

    const injectionScript =
      `<script>` +
      `window.__INJECTION_DATA__ = "${Transformer.serialize(data)}";` +
      `window.__INJECTION_META__ = ${JSON.stringify(safeMeta)};` +
      (bundleData
        ? `window.__INJECTION_BUNDLES__ = ${JSON.stringify(bundleData)};`
        : "") +
      `</script>`;

    let injectedHTML: string;
    if (webui.includes("<head>")) {
      injectedHTML = webui.replace(/<head>/i, `<head>${injectionScript}`);
    } else if (webui.includes("<body>")) {
      injectedHTML = webui.replace(/<body>/i, `<body>${injectionScript}`);
    } else {
      injectedHTML = injectionScript + webui;
    }

    const filePath =
      this.runtimeStrategy.saveHtmlAndReturnFilePath(injectedHTML);
    this.runtimeStrategy.openBrowser(filePath);
  }
}

export { WebUIStrategy };
