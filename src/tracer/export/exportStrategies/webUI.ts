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
    // Inject both the trace tree and the report metadata as window globals.
    // The React WebUI reads __INJECTION_DATA__ (serialized TraceNode[]) and
    // __INJECTION_META__ (description / startTime / duration).
    const injectionScript =
      `<script>` +
      `window.__INJECTION_DATA__ = "${Transformer.serialize(data)}";` +
      `window.__INJECTION_META__ = ${JSON.stringify(meta)};` +
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
