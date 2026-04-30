# 🔍 Scry (Beta)

**JavaScript/TypeScript execution flow tracker**

<div align="center">
  <img src="https://img.shields.io/badge/version-0.0.44-blue.svg" alt="Version"/>
  <img src="https://img.shields.io/badge/License-MIT-yellow.svg" alt="License"/>
  <img src="https://img.shields.io/badge/PRs-welcome-brightgreen.svg" alt="PRs Welcome"/>
  <img src="https://img.shields.io/badge/CI-passing-brightgreen.svg" alt="CI"/>
</div>

<div align="center">
  <img width="320" alt="Scry" src="https://github.com/user-attachments/assets/d6ca7480-658b-484a-8a51-00edbcb082c7" />
</div>

GitHub: [https://github.com/racgoo/scry](https://github.com/racgoo/scry)
NPM: [https://www.npmjs.com/package/@racgoo/scry](https://www.npmjs.com/package/@racgoo/scry)

---

## Introduction

Scry is a JavaScript/TypeScript function execution context tracing library that **automatically records every function and method call** — along with its name, arguments, and return value.

It was created to ease the pain of debugging unexpected runtime errors. Scry lets you clearly understand complex call flows and relationships between function calls.

> ⚠️ **Development only** — instrumentation only fires when `NODE_ENV !== "production"`. Zero overhead in production builds.

---

## How it works

1. The **Vite plugin** (`@racgoo/scry/vite`) rewrites every call expression at compile time, wrapping it in a lightweight IIFE that emits enter/exit events.
2. The **Zone.js** context (bundled inside `@racgoo/scry`) tracks async call graphs automatically.
3. `Tracer.start()` / `Tracer.end()` capture all instrumented calls in the recorded window and export a visual HTML report.

---

## Supported environments

Scry currently ships a **Vite plugin** as the only supported integration. Vite is the most reliable host for the underlying babel transform — other integrations (`@vitejs/plugin-react`'s `babel.plugins`, custom `babel.config.js`, webpack-loader chains) are environment-sensitive and silently no-op in many real configs, leaving you with empty trace reports. By scoping the supported surface to one well-tested entry point, Scry guarantees the transform runs.

| Environment | Tested |
|---|---|
| Vite + React (`.jsx` / `.tsx`) | ✅ |
| Vite + Vanilla TS (`.ts`) | ✅ |
| Node.js 18 / 20 / 22 (test / fixture transforms via `@babel/core`) | ✅ |

If you need a non-Vite integration (Webpack, Rollup, Next.js's SWC, etc.) please open an issue — we'd rather build a dedicated plugin than re-recommend the brittle `babel.plugins` route.

---

## Install

```bash
# npm
npm install --save-dev @racgoo/scry

# pnpm
pnpm add -D @racgoo/scry

# yarn
yarn add --dev @racgoo/scry
```

> `zone.js` is **bundled** inside `@racgoo/scry/zone`. You do not need to install it separately or import it manually.

---

## Setup

### `vite.config.ts`

```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { scryVitePlugin } from "@racgoo/scry/vite";

export default defineConfig({
  // scry must come BEFORE @vitejs/plugin-react so it sees raw .ts/.tsx
  // before the JSX transform.
  plugins: [scryVitePlugin(), react()],
});
```

That's it. No `babel.config.js`, no `optimizeDeps.exclude`, no `NODE_ENV` munging — the Vite plugin handles everything.

### Vanilla Vite (no React)

```ts
import { defineConfig } from "vite";
import { scryVitePlugin } from "@racgoo/scry/vite";

export default defineConfig({
  plugins: [scryVitePlugin()],
});
```

---

## Plugin options

```ts
scryVitePlugin({
  // Only instrument files matching this regex (default: .ts/.tsx/.js/.jsx).
  test: /\.(?:tsx?|jsx?)$/,

  // Skip files (regex OR substring list).  node_modules / .vite / dist /
  // build are always skipped regardless of this option.
  exclude: ["/legacy/", "/__generated__/"],

  // Forward to the underlying babel plugin's own exclude option (substring
  // match, evaluated AFTER the regex includes/excludes above).
  babelExclude: ["**/*.test.ts"],

  // Max Zone nesting depth before bypassing instrumentation (default: 50).
  // Calls beyond this depth still execute — they are just not traced.
  maxDepth: 30,
});
```

| Option | Type | Default | Description |
|---|---|---|---|
| `test` | `RegExp` | `/\.(tsx?|jsx?|mjs|cjs)(?:\?[^/]*)?$/` | Files to instrument |
| `exclude` | `RegExp \| string[]` | skip `node_modules`/`.vite`/`dist`/`build` | Files to skip |
| `babelExclude` | `string[]` | `[]` | Forwarded to the underlying babel plugin |
| `include` | `string[]` | all source files | Forwarded to the underlying babel plugin |
| `maxDepth` | `number` | `50` | Max Zone nesting depth before bypassing tracing |

---

## Usage: Tracing

```ts
import { Tracer } from "@racgoo/scry";

function add(a: number, b: number) {
  return a + b;
}

async function fetchUser(id: string) {
  const res = await fetch(`/api/users/${id}`);
  return res.json();
}

// All calls between start() and end() are recorded.
Tracer.start("my-trace");
add(1, 2);
await fetchUser("42");
Tracer.end();
```

### Report output

| Environment | Where the report appears |
|---|---|
| **Browser** | Opens in a new tab (`window.open()` with a Blob URL) |
| **Node.js** | Saved to `scry/report/` and auto-opened in your default browser |

<img width="1405" alt="Scry report" src="https://github.com/user-attachments/assets/154a7b80-c79f-4cff-b76c-a0c1a6f71f51" />

---

## Troubleshooting

If the report shows an empty trace tree, the WebUI's diagnostic panel will tell you the exact failure mode based on runtime counters. The most common causes:

| Symptom | Fix |
|---|---|
| `transformedFiles=0` in the diagnostic | Vite plugin isn't wired correctly — re-check `vite.config` and run `rm -rf node_modules/.vite` then restart dev. |
| `transformedFiles>0`, `rawEvents=0` | Some files are transformed but the file calling `Tracer.start/end` isn't one of them — check your `exclude` rule and clear `.vite/deps`. |
| `rawEvents>0`, tree empty | `Tracer.start()` likely wasn't called in the same execution path, or there's a race between consecutive `start/end` pairs. |

---

## Important notes

### Plugin is no-op in production
The Vite plugin checks `process.env.NODE_ENV` at transform time. Instrumentation is only injected when `NODE_ENV !== "production"`. Production builds are unaffected.

### zone.js is bundled
`zone.js` is fully bundled inside `dist/esm/zone-init.js` and `dist/cjs/zone-init.cjs` — you do not need `zone.js` as a peer or direct dependency. The plugin automatically injects `import "@racgoo/scry/zone"` at the top of every instrumented file.

### pnpm / monorepo users
Because `zone.js` is bundled rather than resolved from `node_modules`, the plugin works correctly in pnpm workspaces even if `zone.js` is not hoisted to the root.

---

## Package exports

```
@racgoo/scry        → Tracer, Extractor (runtime)
@racgoo/scry/vite   → scryVitePlugin (the supported integration)
@racgoo/scry/zone   → bundled zone.js initialiser (injected automatically)
```

---

## Third-party licenses

| Package | License |
|---|---|
| [zone.js](https://github.com/angular/angular) | MIT |
| [flatted](https://github.com/WebReflection/flatted) | ISC |
| [js-base64](https://github.com/dankogai/js-base64) | BSD-3-Clause |

---

## Contact

Have questions, suggestions, or want to contribute?
[[📬 send mail]](mailto:lhsung98@naver.com)
