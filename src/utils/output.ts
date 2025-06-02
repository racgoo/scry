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
}

export { Output };
