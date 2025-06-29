import { TraceNode } from "../node";

interface RuntimeStrategyInterface {
  openBrowser(filePath: string): Promise<void>;
  saveHtmlAndReturnFilePath(html: string): string;
}

interface ExporterStrategyInterface {
  export(data: TraceNode[]): void;
  //will be deprecated
  exportHtml(html: string): void;
}

interface ExporterInterface {
  export(data: TraceNode[]): void;
  //will be deprecated
  exportToHtml(html: string): void;
}

export {
  ExporterInterface,
  ExporterStrategyInterface,
  RuntimeStrategyInterface,
};
