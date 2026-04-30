/**
 * Tests for zone.js injection behaviour of the Babel plugin.
 *
 * Key regression: in pnpm workspaces, a consumer project may NOT have zone.js
 * as a direct dependency, so `import "zone.js"` placed directly in a consumer
 * source file would fail to resolve in Vite/esbuild.  The plugin must always
 * inject `@racgoo/scry/zone` (the bundled path) instead.
 *
 * Additional regression: if a file already contains a bare `import "zone.js"`
 * (from an older version of this plugin or from a manual addition), the plugin
 * must rewrite it to `@racgoo/scry/zone` rather than leaving the broken import.
 */
import { describe, it, expect } from "vitest";
import * as babel from "@babel/core";
import { scryBabelPlugin } from "../../src/babel/index.js";

const OLD_NODE_ENV = process.env.NODE_ENV;

function transform(code: string, filename = "/project/src/index.ts") {
  process.env.NODE_ENV = "development";
  try {
    const result = babel.transformSync(code, {
      filename,
      plugins: [[scryBabelPlugin]],
      presets: [["@babel/preset-typescript", { allExtensions: true }]],
      configFile: false,
      babelrc: false,
    });
    return result?.code ?? "";
  } finally {
    process.env.NODE_ENV = OLD_NODE_ENV;
  }
}

describe("Zone.js injection — never injects bare zone.js", () => {
  it("injects @racgoo/scry/zone into a plain ESM file", () => {
    const output = transform(`export function hello() { return 1; }`);
    expect(output).toContain(`"@racgoo/scry/zone"`);
    expect(output).not.toMatch(/import\s+["']zone\.js["']/);
  });

  it("replaces a pre-existing bare `import 'zone.js'` with @racgoo/scry/zone", () => {
    const output = transform(
      `import "zone.js";\nexport function foo() { return 2; }`
    );
    expect(output).toContain(`"@racgoo/scry/zone"`);
    expect(output).not.toMatch(/import\s+["']zone\.js["']/);
  });

  it("does not duplicate the zone import when @racgoo/scry/zone is already present", () => {
    const output = transform(
      `import "@racgoo/scry/zone";\nexport function bar() { return 3; }`
    );
    const count = (output.match(/@racgoo\/scry\/zone/g) ?? []).length;
    expect(count).toBe(1);
  });

  it("injected zone import resolves to the bundled path, not bare zone.js", () => {
    const output = transform(`export const x = 1;`);
    // Must use the scry-bundled subpath export, not the bare package name
    expect(output).toContain("@racgoo/scry/zone");
    expect(output).not.toContain(`"zone.js"`);
  });

  it("works for files with call expressions (real instrumentation path)", () => {
    const output = transform(
      `export function run() { return Math.random(); }`
    );
    expect(output).toContain("@racgoo/scry/zone");
    expect(output).not.toMatch(/import\s+["']zone\.js["']/);
  });
});

describe("Duplicate declaration guard", () => {
  it("does not produce duplicate var traceContext in a function scope", () => {
    const output = transform(`
      export function outer() {
        function inner() { return 1; }
        return inner();
      }
    `);
    // Count occurrences of 'var traceContext' in the output
    const count = (output.match(/var traceContext\s*=/g) ?? []).length;
    // Expect exactly 2 (one for outer, one for inner) — not more
    expect(count).toBeLessThanOrEqual(3);
    expect(output).not.toMatch(/Duplicate/);
  });

  it("does not re-instrument Zone internal calls (__TRACE_ZONE__.run, etc.)", () => {
    // The plugin stores Zone[traceId] in a const and calls .run() on it.
    // If that .run() call were re-instrumented we'd see it wrapped in a second
    // IIFE producing two returnValue = __TRACE_ZONE__.run(...) assignments.
    const output = transform(`
      export function run() { return fetch("https://example.com"); }
    `);
    // Count .run( occurrences — should be exactly 1 (the Zone zone runner)
    const zoneRunMatches = (output.match(/\.run\(/g) ?? []).length;
    expect(zoneRunMatches).toBe(1);
  });

  it("handles multiple arrow functions at the same scope without duplicates", () => {
    const output = transform(`
      export const a = () => doA();
      export const b = () => doB();
    `);
    // Each top-level arrow gets exactly one var traceContext in its own scope
    const count = (output.match(/var traceContext\s*=/g) ?? []).length;
    // program (1) + arrow a (1) + arrow b (1) = 3, not more
    expect(count).toBeLessThanOrEqual(4);
  });
});

describe("Infinite recursion guard — Maximum call stack size regression", () => {
  it("does not blow the call stack on a file with many nested calls", () => {
    // Deeply-nested call expressions stress-test the max-depth guard path:
    // each call is instrumented and the max-depth guard embeds the original
    // call verbatim.  Without TRACE_MARKER on the cloned node, Babel's
    // re-traversal would re-instrument that inner call ad infinitum.
    expect(() =>
      transform(`
        export function complex() {
          const a = Math.random();
          const b = parseInt(String(Math.floor(a * 100)), 10);
          const c = JSON.stringify({ value: b });
          const d = JSON.parse(c);
          return Object.keys(d).map(k => k.toUpperCase());
        }
      `)
    ).not.toThrow();
  });

  it("does not blow the call stack on deeply-nested call chains", () => {
    expect(() =>
      transform(`
        export function chain() {
          return [1, 2, 3]
            .filter(x => x > 0)
            .map(x => x * 2)
            .reduce((acc, x) => acc + x, 0);
        }
      `)
    ).not.toThrow();
  });

  it("does not blow the call stack on a React-like component with event handlers", () => {
    // Simulates a React component file (like ClockWidget/index.tsx) that
    // uses multiple call expressions inside JSX event handlers.  This is the
    // exact pattern that originally triggered "Maximum call stack size exceeded"
    // in vite:react-babel.
    expect(() =>
      transform(`
        export function handleClick(event) {
          const val = event.target.value;
          const formatted = new Date(parseInt(val, 10)).toISOString();
          window.dispatchEvent(new CustomEvent("tick", { detail: formatted }));
          console.log("dispatched", formatted);
        }
        export function processData(items) {
          return items
            .filter(Boolean)
            .map(item => ({ ...item, ts: Date.now() }))
            .sort((a, b) => a.ts - b.ts);
        }
      `)
    ).not.toThrow();
  });

  it("plugin-generated IIFE children are not re-instrumented", () => {
    const output = transform(`
      export function run() { return Math.random(); }
    `);
    // The max-depth guard embeds Math.random() as a cloned node with
    // TRACE_MARKER, so we must NOT see it wrapped in a second IIFE.
    // Count plugin-generated IIFEs by looking for the distinctive
    // "/* __SCRY_MARK__ */(() =>" pattern — should be exactly 1 per call site.
    const iifes = (output.match(/\/\*.*?__SCRY_MARK__.*?\*\/\s*\(\(\) =>/g) ?? [])
      .length;
    expect(iifes).toBe(1);
  });
});
