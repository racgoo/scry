import path from "path";
import fs from "fs";
import {
  ORIGINAL_CODE_END_MARKER,
  ORIGINAL_CODE_START_MARKER,
} from "../babel/scry.constant.js";

//Extract code from instance and method(Runtime Extractor)
class Extractor {
  constructor() {}

  //ExtractOriginCode
  private static extractOriginCode(tranfiledCode: string): string {
    const originCode = tranfiledCode
      ?.split(ORIGINAL_CODE_START_MARKER)[1]
      ?.split(ORIGINAL_CODE_END_MARKER)[0];
    if (originCode) {
      return originCode.replace(/\\n/g, "\n");
    } else {
      return "[External Code]";
    }
  }

  //Extract code from instance and method(if it's not method, extract function code)
  public static extractCode(
    instance: { [key: string]: unknown } | null,
    method: string | null,
    func: typeof Function | null
  ) {
    const result = {
      functionCode: "",
      classCode: "",
      methodCode: "",
    };
    if (func) {
      result.functionCode = this.extractOriginCode(func.toString());
    }
    if (this.isMethod(instance, method)) {
      result.classCode = this.extractOriginCode(
        instance!.constructor.toString()
      );
      result.methodCode = this.extractOriginCode(
        instance!.constructor.prototype[method!]?.toString() ?? ""
      );
    }

    return result;
  }

  //Check if the function is a method
  private static isMethod(
    instance: { [key: string]: unknown } | null,
    method: string | null
  ) {
    if (!instance || !method) {
      return false;
    }
    if (instance.constructor.prototype[method]) {
      return true;
    }
    return false;
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
export default Extractor;
