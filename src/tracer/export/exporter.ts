import { Environment } from "../../utils/enviroment.js";
import { ExporterInterface, ExporterStrategyInterface } from "./interface.js";
import { BrowserStrategy } from "./strategies/BrowserStrategy.js";
import { NodeStrategy } from "./strategies/NodeStrategy.js";

class Exporter implements ExporterInterface {
  private strategy: ExporterStrategyInterface;

  constructor() {
    this.strategy = Environment.isNodeJS()
      ? new NodeStrategy()
      : new BrowserStrategy();
  }

  //Open browser with file path
  public exportHtml(html: string) {
    const filePath = this.strategy.saveHtmlAndReturnFilePath(html);
    this.strategy.openBrowser(filePath);
  }
}

export { Exporter };
