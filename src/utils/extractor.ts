import path from "path";
import fs from "fs";

//Extract code from instance and method(Runtime Extractor)
class Extractor {
  constructor() {}

  //Extract code from instance and method(if it's not method, extract function code)
  public static extractCode(
    instance: { [key: string]: unknown },
    method: string
  ) {
    const result = {
      functionCode: "",
      classCode: "",
      methodCode: "",
    };
    if (!this.isMethod(instance, method)) {
      result.functionCode = this.extractFunction(
        instance[method] as typeof Function
      ).functionCode;
    } else {
      result.classCode = instance.constructor.toString();
      result.methodCode =
        instance.constructor.prototype[method]?.toString() ?? "";
    }
    return result;
  }
  //Check if the function is a method
  private static isMethod(instance: object, funcName: string) {
    if (instance.constructor.prototype[funcName]) {
      return true;
    }
    return false;
  }
  //Extract function code
  static extractFunction(func: typeof Function) {
    return {
      functionCode: func?.toString() ?? "Cannot extract function code",
      classCode: "",
      methodCode: "",
    };
  }

  //Find nearest package.json file
  static extractNearestPackageJSON(filePath: string): { type: string } | null {
    let dir = path.dirname(filePath);
    while (dir !== path.parse(dir).root) {
      const pkgPath = path.join(dir, "package.json");
      if (fs.existsSync(pkgPath)) {
        return JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
      }
      dir = path.dirname(dir);
    }
    return null;
  }
}
export { Extractor };
