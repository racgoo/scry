import { RuntimeStrategyInterface } from "../interface.js";
import fs from "fs";
import {
  REPORT_DIR,
  SCRY_DIR,
  TRACE_RESULT_FILE_EXTENSION,
  TRACE_RESULT_FILE_NAME,
} from "./constant.js";

// Drop-in replacement for `dayjs().format("YYYY-MM-DD_HH-mm-ss")` —
// avoids pulling dayjs (a CJS package) into the runtime, which broke
// for users who set Vite `optimizeDeps.exclude: ["@racgoo/scry"]`.
function formatNowForFilename(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `_${pad(d.getHours())}-${pad(d.getMinutes())}-${pad(d.getSeconds())}`
  );
}

class NodeStrategy implements RuntimeStrategyInterface {
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
    //Trace end date — formatted manually so we don't depend on dayjs.
    const now = formatNowForFilename();
    //File path for result
    // Colon is forbidden in Windows filenames; use underscore as separator.
    const filePath = `${REPORT_DIR}/${TRACE_RESULT_FILE_NAME}_${now}.${TRACE_RESULT_FILE_EXTENSION}`;
    fs.writeFileSync(filePath, html);
    return filePath;
  }
}

export { NodeStrategy };
