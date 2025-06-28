import dayjs from "dayjs";
import { ExporterStrategyInterface } from "../interface.js";
import fs from "fs";
import {
  REPORT_DIR,
  REPORT_FILE_DATE_FORMAT,
  SCRY_DIR,
  TRACE_RESULT_FILE_EXTENSION,
  TRACE_RESULT_FILE_NAME,
} from "./constant.js";

class NodeStrategy implements ExporterStrategyInterface {
  constructor() {}

  public async openBrowser(filePathOrUrl: string) {
    const command =
      process.platform === "darwin"
        ? "open"
        : process.platform === "win32"
        ? "start"
        : "xdg-open";
    const { exec } = await import("child_process");
    exec(`${command} "${filePathOrUrl}"`);
  }

  public saveHtmlAndReturnFilePath(html: string) {
    //Create scry directory if not exists
    if (!fs.existsSync(SCRY_DIR)) {
      fs.mkdirSync(SCRY_DIR);
    }
    //Create report directory if not exists
    if (!fs.existsSync(REPORT_DIR)) {
      fs.mkdirSync(REPORT_DIR);
    }
    //Trace end date
    const now = dayjs().format(REPORT_FILE_DATE_FORMAT);
    //File path for result
    const filePath = `${REPORT_DIR}/${TRACE_RESULT_FILE_NAME}:${now}.${TRACE_RESULT_FILE_EXTENSION}`;
    fs.writeFileSync(filePath, html);
    return filePath;
  }
}

export { NodeStrategy };
