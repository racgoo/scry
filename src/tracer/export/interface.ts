import { TraceNode } from "../node";

interface RuntimeStrategyInterface {
  openBrowser(filePath: string): Promise<void>;
  saveHtmlAndReturnFilePath(html: string): string;
}

interface TraceReportMeta {
  description: string;
  startTimeISO: string;
  durationMs: number;
  // Diagnostics — surfaced in the WebUI's empty-tree panel so users can
  // distinguish "emit never reached the listener" from "listener got events
  // but rejected them" without console-diving.
  rawEventCount?: number;
  droppedNullBundle?: number;
  listenerKind?: "process" | "globalThis" | "none";
  pluginApplied?: boolean;
}

interface ExporterStrategyInterface {
  export(data: TraceNode[], meta: TraceReportMeta): void;
  //will be deprecated
  exportHtml(html: string): void;
}

interface ExporterInterface {
  export(data: TraceNode[], meta: TraceReportMeta): void;
  //will be deprecated
  exportToHtml(html: string): void;
}

export {
  ExporterInterface,
  ExporterStrategyInterface,
  RuntimeStrategyInterface,
  TraceReportMeta,
};
