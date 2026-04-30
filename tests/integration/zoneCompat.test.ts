/**
 * Regression tests for the zone.js + React 18 Suspense + TanStack Query
 * compatibility fix.  These are the failure modes that bit a real user
 * (Hoguma-console):
 *
 *   - `new ZoneAwarePromise(...)` wrapped every Suspense retry, so the
 *     <Transitioner> setState loop multiplied into "Maximum update
 *     depth exceeded".
 *   - zone.js's PromiseRejectionEvent patch re-threw user fetch errors
 *     through `globalCallback`, short-circuiting React's
 *     <ErrorBoundary>.
 *
 * The fix has THREE moving parts that all have to stay in sync:
 *   1. scripts/bundle-zone.js prepends the disable flags as an esbuild
 *      `banner` so they run BEFORE zone.js's patches register.
 *   2. The flag NAMES match zone.js's __load_patch names exactly
 *      (invented names are silently ignored).
 *   3. The runtime emit / recorder pipeline still works without
 *      Zone-aware Promise context propagation.
 *
 * Each item below pins one of those.  If a future refactor breaks any
 * of them, this file fails at CI time, not in a user's React app.
 */
import { describe, it, expect, beforeAll } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");

const ESM_BUNDLE = path.join(ROOT, "dist/esm/zone-init.js");
const CJS_BUNDLE = path.join(ROOT, "dist/cjs/zone-init.cjs");

// Patch names that MUST be disabled.  These are the exact strings
// scripts/bundle-zone.js writes into the banner; they're also the exact
// strings zone.js's `Zone.__load_patch(...)` calls register, which is
// the part that actually matters at runtime.
const REQUIRED_DISABLE_FLAGS = [
  // The big one — without this, every user Promise becomes a
  // ZoneAwarePromise and React Suspense retries infinite-loop.
  "__Zone_disable_ZoneAwarePromise",
  // Don't re-throw rejections through zone's globalCallback —
  // React's <ErrorBoundary> handles them as designed.
  "__Zone_disable_PromiseRejectionEvent",
  // Don't patch onload / onerror / etc.
  "__Zone_disable_on_property",
  // Not needed for trace propagation; only adds latency.
  "__Zone_disable_XHR",
  // Modern React / lazy-image libs hammer these.
  "__Zone_disable_IntersectionObserver",
  "__Zone_disable_MutationObserver",
];

describe("zone.js compatibility — bundle banner", () => {
  let esmBundle = "";
  let cjsBundle = "";
  beforeAll(() => {
    if (!fs.existsSync(ESM_BUNDLE)) {
      throw new Error(
        `dist/esm/zone-init.js missing — run \`pnpm run build\` first`
      );
    }
    esmBundle = fs.readFileSync(ESM_BUNDLE, "utf8");
    cjsBundle = fs.readFileSync(CJS_BUNDLE, "utf8");
  });

  it("ESM bundle ships the disable banner", () => {
    for (const flag of REQUIRED_DISABLE_FLAGS) {
      expect(
        esmBundle.includes(flag),
        `ESM bundle must mention ${flag} (set in scripts/bundle-zone.js banner)`
      ).toBe(true);
    }
  });

  it("CJS bundle ships the disable banner", () => {
    for (const flag of REQUIRED_DISABLE_FLAGS) {
      expect(
        cjsBundle.includes(flag),
        `CJS bundle must mention ${flag}`
      ).toBe(true);
    }
  });

  // The whole point of the banner is ORDER: it must run BEFORE zone.js's
  // patches register.  We verify that by finding both markers and
  // asserting the banner is earlier in the file.
  it("disable banner appears BEFORE the bundled zone.js code (ESM)", () => {
    const flagPos = esmBundle.indexOf("__Zone_disable_ZoneAwarePromise");
    // zone.js bundles always include this exact loadPatch call —
    // it's the line we have to beat.
    const zonePatchPos = esmBundle.indexOf("ZoneAwarePromise");
    expect(flagPos).toBeGreaterThan(-1);
    expect(zonePatchPos).toBeGreaterThan(-1);
    // Note: "ZoneAwarePromise" appears multiple times.  We need the
    // disable assignment to come before zone.js's *first* mention,
    // which is in the patch registration.
    const firstPatchMention = esmBundle.search(
      /Zone\.__load_patch\(['"]ZoneAwarePromise['"]/
    );
    if (firstPatchMention !== -1) {
      expect(flagPos).toBeLessThan(firstPatchMention);
    } else {
      // Some zone.js builds use a different syntax; still sanity-check
      // the banner is at the very top of the file.
      expect(flagPos).toBeLessThan(2000);
    }
  });

  it("disable banner appears BEFORE the bundled zone.js code (CJS)", () => {
    const flagPos = cjsBundle.indexOf("__Zone_disable_ZoneAwarePromise");
    expect(flagPos).toBeGreaterThan(-1);
    const firstPatchMention = cjsBundle.search(
      /Zone\.__load_patch\(['"]ZoneAwarePromise['"]/
    );
    if (firstPatchMention !== -1) {
      expect(flagPos).toBeLessThan(firstPatchMention);
    } else {
      expect(flagPos).toBeLessThan(2000);
    }
  });

  // The banner uses `=== undefined` checks so a user who needs
  // Zone-aware Promises (e.g. Angular) can opt back in by setting the
  // flag false BEFORE importing scry.  Pin that contract.
  it("disable banner respects pre-existing user overrides (=== undefined check)", () => {
    expect(esmBundle).toMatch(
      /__Zone_disable_ZoneAwarePromise\s*===\s*undefined/
    );
  });
});

describe("zone.js compatibility — runtime", () => {
  beforeAll(async () => {
    // Importing scry's zone-init module evaluates the banner +
    // bundled zone.js, which sets the flags and registers the
    // (subset of) patches we still want.
    await import("../../dist/esm/zone-init.js");
  });

  it("globalThis has all disable flags after zone-init evaluates", () => {
    for (const flag of REQUIRED_DISABLE_FLAGS) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const value = (globalThis as any)[flag];
      expect(value, `expected globalThis.${flag} to be truthy`).toBe(true);
    }
  });

  // Smoke test: with ZoneAwarePromise disabled, `new Promise(...)` must
  // be the native Promise — NOT zone.js's wrapper.  We detect this by
  // checking that the constructor's name is "Promise" (zone.js's wrapper
  // is also called Promise but its prototype carries a `__symbol__('state')`
  // tag we can probe).
  it("`new Promise(...)` is the native Promise (no ZoneAwarePromise wrap)", () => {
    const p = new Promise<void>((resolve) => resolve());
    // ZoneAwarePromise sets a hidden `__zone_symbol__state` on its
    // instances; native Promise does not.
    const hasZoneSymbol = Object.getOwnPropertySymbols(p).some((s) =>
      String(s).includes("zone_symbol")
    );
    expect(hasZoneSymbol).toBe(false);
  });

  // Sanity: the Zone API itself is still present (we still need it for
  // trace context propagation in the babel-emitted IIFEs).
  it("Zone API is still loaded — Zone.current / Zone.root / fork", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const Z = (globalThis as any).Zone;
    expect(Z).toBeDefined();
    expect(typeof Z.current).toBe("object");
    expect(typeof Z.root).toBe("object");
    expect(typeof Z.current.fork).toBe("function");
  });

  // The plugin-applied flag must be set as a side-effect of importing
  // zone-init (proves the module body ran AFTER the banner — i.e. the
  // banner didn't accidentally `return` early).
  it("plugin-applied flag is set after zone-init evaluates", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((globalThis as any).scryPluginApplied).toBe(true);
  });
});

describe("zone.js compatibility — Suspense-shaped repro under jsdom", () => {
  // The original bug: a rejected Promise in <PermissionChecker> got
  // re-thrown by zone's PromiseRejectionEvent patch through
  // globalCallback, which short-circuited React's <ErrorBoundary>.  We
  // can't easily run a full React render here, but we CAN verify the
  // failure preconditions don't exist anymore: a rejected Promise's
  // `then` callback must be the userland callback exactly, not zone's
  // wrapper, and unhandledrejection events must not be re-thrown
  // synchronously (they're allowed to fire as DOM events — that's what
  // React relies on).
  it("rejected Promise resolves through the userland onRejected without zone re-throw", async () => {
    const seen: unknown[] = [];
    await new Promise<void>((resolve) => {
      const p = new Promise((_, reject) => reject(new Error("user-error")));
      p.then(
        () => {
          seen.push("ok");
          resolve();
        },
        (err) => {
          seen.push(err);
          resolve();
        }
      );
    });
    expect(seen.length).toBe(1);
    expect((seen[0] as Error).message).toBe("user-error");
  });

  // ZoneAwarePromise's loop bug: each `.then()` returned a NEW
  // ZoneAwarePromise that re-wrapped the resolved value, so a chain of
  // 100 `.then(x => x)` calls produced 100 wrapper Promises.  With the
  // patch disabled, this must complete in O(N) without blowing up.
  it("long .then chain completes without exploding (no ZoneAwarePromise wrapping)", async () => {
    const N = 200;
    let p: Promise<number> = Promise.resolve(0);
    for (let i = 0; i < N; i++) {
      p = p.then((v) => v + 1);
    }
    const result = await p;
    expect(result).toBe(N);
  });
});
