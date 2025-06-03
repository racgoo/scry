import { Environment } from "./enviroment.js";

class Output {
  //Print divider
  static printDivider(length = 50) {
    this.print("-".repeat(length));
  }

  //Print error message
  static printError(...args: unknown[]) {
    console.error("[SCRY]:", ...args);
  }

  //Print message
  static print(...args: unknown[]) {
    console.log("[SCRY]:", ...args);
  }

  //Open browser with file path
  static async openBrowser(filePath: string) {
    if (Environment.isNodeJS()) {
      //Nodejs use child_process
      const command =
        process.platform === "darwin"
          ? "open"
          : process.platform === "win32"
          ? "start"
          : "xdg-open";

      const { exec } = await import("child_process");
      exec(`${command} "${filePath}"`);
    } else {
      //Browser use window.open
      window.open(filePath, "_blank");
    }
  }
}

export { Output };
