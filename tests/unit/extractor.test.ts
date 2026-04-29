import { describe, it, expect } from "vitest";
import Extractor from "../../src/utils/extractor.js";
import {
  ORIGINAL_CODE_START_MARKER,
  ORIGINAL_CODE_END_MARKER,
} from "../../src/babel/scry.constant.js";

/**
 * Build a fake "instrumented" function whose toString() mimics the output that
 * the babel plugin would produce.  We do NOT use `new Function(markedBody)`
 * because the marker identifier runs directly into `return` without whitespace
 * (e.g. `__ORIGINAL_CODE_START_MARK__return 1;`) – the tokenizer parses it as
 * a single identifier followed by a bare number literal, which is a SyntaxError.
 * Instead we only override toString(), which is all `extractOriginCode` uses.
 */
function makeFn(body = "return 1;"): Function {
  function original() {
    return undefined;
  }
  const markedSource =
    `function original() {\n` +
    `${ORIGINAL_CODE_START_MARKER}\n` +
    `${body}\n` +
    `${ORIGINAL_CODE_END_MARKER}\n}`;
  Object.defineProperty(original, "toString", {
    value: () => markedSource,
    writable: true,
  });
  return original;
}

class Sample {
  greet() {
    return "hello";
  }
}

describe("Unit: Extractor.extractCode", () => {
  it("extracts functionCode for a standalone function", () => {
    const fn = makeFn("return 42;");
    const result = Extractor.extractCode(null, null, fn as typeof Function);
    expect(result.functionCode).toBeTruthy();
  });

  it("returns [External Code] for functions without markers", () => {
    function plain() {
      return 1;
    }
    const result = Extractor.extractCode(null, null, plain as typeof Function);
    expect(result.functionCode).toBe("[External Code]");
  });

  it("extracts classCode for a class method call", () => {
    const inst = new Sample();
    const result = Extractor.extractCode(
      inst as unknown as { [key: string]: unknown },
      "greet",
      null
    );
    expect(result.classCode).toBeTruthy();
    expect(result.methodCode).toBeTruthy();
  });

  it("methodCache hit still preserves functionCode when provided", () => {
    // First call: no func — populates methodCache
    const inst = new Sample();
    Extractor.extractCode(
      inst as unknown as { [key: string]: unknown },
      "greet",
      null
    );

    // Second call: with func — methodCache should hit but functionCode must be returned
    const fn = makeFn("return 99;");
    const result = Extractor.extractCode(
      inst as unknown as { [key: string]: unknown },
      "greet",
      fn as typeof Function
    );
    // functionCode must not be discarded by the methodCache hit
    expect(result.functionCode).toBeTruthy();
  });

  it("functionCache hit avoids repeated toString() parsing", () => {
    let toStringCalls = 0;
    const markedSource =
      `function anonymous() {\n` +
      `${ORIGINAL_CODE_START_MARKER}\n` +
      `return 1;\n` +
      `${ORIGINAL_CODE_END_MARKER}\n}`;
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    const fn = function cacheTestFn() {};
    Object.defineProperty(fn, "toString", {
      value: () => {
        toStringCalls++;
        return markedSource;
      },
      writable: true,
    });
    // Clear any prior cache by using a fresh function reference
    Extractor.extractCode(null, null, fn as typeof Function);
    const before = toStringCalls;
    Extractor.extractCode(null, null, fn as typeof Function);
    expect(toStringCalls).toBe(before); // no extra toString() call on cache hit
  });

  it("classCode and methodCode are empty for non-method calls", () => {
    const fn = makeFn("return 'standalone';");
    const result = Extractor.extractCode(null, null, fn as typeof Function);
    expect(result.classCode).toBe("");
    expect(result.methodCode).toBe("");
  });
});
