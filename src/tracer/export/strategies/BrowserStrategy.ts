import { ExporterStrategyInterface } from "../interface.js";
import { BLOB_TYPE } from "./constant.js";

class BrowserStrategy implements ExporterStrategyInterface {
  constructor() {}

  public async openBrowser(filePathOrUrl: string) {
    window.open(filePathOrUrl, "_blank");
  }

  public saveHtmlAndReturnFilePath(html: string) {
    const blob = new Blob([html], { type: BLOB_TYPE });
    const url = URL.createObjectURL(blob);
    return url;
  }
}

export { BrowserStrategy };
