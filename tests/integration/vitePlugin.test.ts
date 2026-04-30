// Verifies the dedicated Vite plugin (`@racgoo/scry/vite`) actually
// transforms .js / .jsx / .ts / .tsx without requiring the user to
// have @babel/preset-typescript installed — the failure mode that
// prompted us to ship this plugin in the first place.
import { describe, it, expect } from "vitest";
import { scryVitePlugin } from "../../src/vite/index.js";

interface TransformReturn {
  code: string;
  map: unknown;
}

function callTransform(
  plugin: ReturnType<typeof scryVitePlugin>,
  code: string,
  id: string
): TransformReturn | null {
  const t = plugin.transform;
  if (!t || typeof t !== "function") throw new Error("no transform fn");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = (t as any).call({}, code, id);
  return result as TransformReturn | null;
}

describe("Vite plugin: scryVitePlugin", () => {
  const plugin = scryVitePlugin();

  it("transforms a .jsx file (the original empty-trace bug case)", () => {
    const out = callTransform(
      plugin,
      `
        import { useState } from "react";
        function App() {
          const test = () => { console.log("hi"); };
          test();
          Math.floor(Math.random() * 3);
          return null;
        }
        export default App;
      `,
      "/project/src/App.jsx"
    );
    expect(out).not.toBeNull();
    // The wrapped IIFE marker must appear — proves the babel plugin ran.
    expect(out!.code).toContain("__SCRY_MARK__");
    expect(out!.code).toContain("TRACE_ZONE");
  });

  it("transforms a .tsx file without @babel/preset-typescript installed", () => {
    const out = callTransform(
      plugin,
      `
        type Props = { a: number };
        export function f(p: Props): number {
          return Math.floor(Math.random() * p.a);
        }
      `,
      "/project/src/Comp.tsx"
    );
    expect(out).not.toBeNull();
    expect(out!.code).toContain("__SCRY_MARK__");
  });

  it("transforms a plain .ts file", () => {
    const out = callTransform(
      plugin,
      `
        export function add(a: number, b: number): number {
          return a + b;
        }
        add(1, 2);
      `,
      "/project/src/util.ts"
    );
    expect(out).not.toBeNull();
    expect(out!.code).toContain("__SCRY_MARK__");
  });

  it("skips node_modules", () => {
    const out = callTransform(
      plugin,
      `function f() { Math.random(); }`,
      "/project/node_modules/some-pkg/index.js"
    );
    expect(out).toBeNull();
  });

  it("skips .vite cache", () => {
    const out = callTransform(
      plugin,
      `function f() { Math.random(); }`,
      "/project/node_modules/.vite/deps/foo.js"
    );
    expect(out).toBeNull();
  });

  it("skips files outside the include regex", () => {
    const out = callTransform(
      plugin,
      `body { color: red; }`,
      "/project/src/App.css"
    );
    expect(out).toBeNull();
  });

  it("strips query strings before matching extensions (Vite passes ?v=...)", () => {
    const out = callTransform(
      plugin,
      `Math.random();`,
      "/project/src/A.jsx?v=abc123"
    );
    expect(out).not.toBeNull();
    expect(out!.code).toContain("__SCRY_MARK__");
  });

  it("respects a custom test regex", () => {
    const onlyMjs = scryVitePlugin({ test: /\.mjs(?:\?|$)/ });
    expect(callTransform(onlyMjs, "Math.random();", "/x.jsx")).toBeNull();
    expect(callTransform(onlyMjs, "Math.random();", "/x.mjs")).not.toBeNull();
  });

  it("respects substring excludes via options.exclude", () => {
    const customExcludes = scryVitePlugin({ exclude: ["/legacy/"] });
    expect(
      callTransform(customExcludes, "Math.random();", "/project/src/legacy/foo.tsx")
    ).toBeNull();
    expect(
      callTransform(customExcludes, "Math.random();", "/project/src/main.tsx")
    ).not.toBeNull();
  });

  it("plugin object has enforce='pre' so it runs before plugin-react", () => {
    expect(plugin.name).toBe("scry-babel");
    expect(plugin.enforce).toBe("pre");
  });

  // Regression: babel plugin must inject the transformed-file counter so
  // Tracer.end()'s "did the plugin actually run?" diagnostic works.
  it("transform output increments globalThis.__scryTransformedFileCount", () => {
    const out = callTransform(
      plugin,
      `function f() { return 1; }`,
      "/project/src/util.ts"
    );
    expect(out).not.toBeNull();
    expect(out!.code).toMatch(
      /__scryTransformedFileCount\s*=\s*\(\s*globalThis\.__scryTransformedFileCount\s*\|\|\s*0\s*\)\s*\+\s*1/
    );
  });
});
