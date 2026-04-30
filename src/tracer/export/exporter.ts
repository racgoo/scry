import { TraceNode } from "../node";
import { Environment } from "../../utils/enviroment.js";
import { WebUIStrategy } from "./exportStrategies/webUI.js";
import {
  ExporterInterface,
  ExporterStrategyInterface,
  TraceReportMeta,
} from "./interface.js";
import { BrowserStrategy } from "./rumTImeStrategies/BrowserStrategy.js";
import { NodeStrategy } from "./rumTImeStrategies/NodeStrategy.js";

class Exporter implements ExporterInterface {
  // private rumTimeStrategy: RuntimeStrategyInterface;
  private exportStrategy: ExporterStrategyInterface;
  constructor() {
    this.exportStrategy = Environment.isNodeJS()
      ? new WebUIStrategy(new NodeStrategy())
      : new WebUIStrategy(new BrowserStrategy());
  }

  //Open browser with file path
  public export(data: TraceNode[], meta: TraceReportMeta) {
    this.exportStrategy.export(data, meta);
  }

  public exportToHtml(html: string) {
    this.exportStrategy.exportHtml(html);
  }
}

export { Exporter };
