class Extractor {
  constructor() {}

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
  private static isMethod(instance: object, funcName: string) {
    if (instance.constructor.prototype[funcName]) {
      return true;
    }
    return false;
  }
  static extractFunction(func: typeof Function) {
    return {
      functionCode: func.toString(),
      classCode: "",
      methodCode: "",
    };
  }
}
export default Extractor;
