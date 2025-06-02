//Environment class. for single instance.
class Environment {
  //Check runtime environment
  static isNodeJS(): boolean {
    return typeof window === "undefined" && typeof process !== "undefined";
  }
}

export { Environment };
