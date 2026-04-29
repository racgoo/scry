import path from "path";
import fs from "fs";
import {
  ORIGINAL_CODE_END_MARKER,
  ORIGINAL_CODE_START_MARKER,
} from "../babel/scry.constant.js";

type CodeResult = {
  functionCode: string;
  classCode: string;
  methodCode: string;
};

//Extract code from instance and method(Runtime Extractor)
class Extractor {
  constructor() {}

  //Cache keyed by the function/constructor reference.
  //WeakMap is used so cached entries are GC-eligible once the function object is no longer referenced.
  //Calling func.toString() and splitting on marker strings on every invocation was the dominant
  //per-call cost for frequently-called traced functions.
  private static functionCache = new WeakMap<object, CodeResult>();
  private static methodCache = new WeakMap<object, CodeResult>();

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
  ): CodeResult {
    const result: CodeResult = {
      functionCode: "",
      classCode: "",
      methodCode: "",
    };

    // func and isMethod are mutually exclusive in generated code:
    // - member-expression calls pass (instance, methodName, null)
    // - standalone calls pass (null, null, funcRef)
    // Guard both paths independently so a future call pattern that passes all
    // three arguments doesn't cause the early-return from functionCache to skip
    // the method-info population.
    if (func) {
      if (this.functionCache.has(func as object)) {
        const cached = this.functionCache.get(func as object)!;
        // If this same call also provides method info, merge it in rather than
        // returning the cached (method-less) result immediately.
        if (!this.isMethod(instance, method)) {
          return cached;
        }
        result.functionCode = cached.functionCode;
      } else {
        result.functionCode = this.extractOriginCode(
          (func as unknown as { toString(): string }).toString()
        );
        this.functionCache.set(func as object, result);
      }
    }

    if (this.isMethod(instance, method)) {
      const ctor = instance!.constructor as object;
      if (this.methodCache.has(ctor)) {
        return this.methodCache.get(ctor)!;
      }
      result.classCode = this.extractOriginCode(
        instance!.constructor.toString()
      );
      result.methodCode = this.extractOriginCode(
        (
          instance!.constructor as {
            prototype: Record<string, { toString(): string }>;
          }
        ).prototype[method!]?.toString() ?? ""
      );
      this.methodCache.set(ctor, result);
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
