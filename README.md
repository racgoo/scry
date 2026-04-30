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

Scry is a JavaScript/TypeScript function execution context tracing library that **automatically records every function and method call** — along with its name, arguments, and return value — using a Babel plugin for compile-time AST instrumentation.

It was created to ease the pain of debugging unexpected runtime errors.  
Scry lets you clearly understand complex call flows and relationships between function calls.

> ⚠️ **Development only** — the Babel plugin instruments code only when `NODE_ENV=development`. There is zero overhead in production builds.

---

## How it works

1. The **Babel plugin** (`@racgoo/scry/babel`) rewrites every call expression at compile time, wrapping it in a lightweight IIFE that emits enter/exit events.
2. The **Zone.js** context (bundled inside `@racgoo/scry`) tracks async call graphs automatically.
3. `Tracer.start()` / `Tracer.end()` capture all instrumented calls in the recorded window and export a visual HTML report.

---

## Supported environments

| Environment | Module system |
|---|---|
| Node.js 18 / 20 / 22 | ESM, CJS |
| Browser (ES2018+) | ESM |
| Vite + React | ESM |
| Next.js | ESM, CJS |

---

## Install

```bash
# npm
npm install @racgoo/scry

# yarn
yarn add @racgoo/scry

# pnpm
pnpm add @racgoo/scry
```

> **Note** – `zone.js` is **bundled** inside the package (`@racgoo/scry/zone`). You do **not** need to install `zone.js` separately or import it manually.

---

## Setup: Babel plugin

### Exported names

| Export | Description |
|---|---|
| `scryBabelPlugin` | **Recommended.** Auto-detects ESM vs CJS per file. |
| `scryBabelPluginForESM` | Force ESM mode (use when auto-detection fails). |
| `scryBabelPluginForCJS` | Force CJS mode (use when auto-detection fails). |

All three are exported from `@racgoo/scry/babel`.

---

### Vite + React (`vite.config.ts`)

```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { scryBabelPlugin } from "@racgoo/scry/babel";

export default defineConfig({
  plugins: [
    react({
      babel: {
        plugins: [scryBabelPlugin],
      },
    }),
  ],
});
```

### Vite + React + Emotion (`vite.config.ts`)

```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { scryBabelPlugin } from "@racgoo/scry/babel";

export default defineConfig({
  plugins: [
    react({
      jsxImportSource: "@emotion/react",
      babel: {
        plugins: ["@emotion/babel-plugin", scryBabelPlugin],
      },
    }),
  ],
});
```

### Node.js — ESM (`babel.config.js`)

```js
import { scryBabelPlugin } from "@racgoo/scry/babel";

export default {
  presets: ["@babel/preset-typescript"],
  plugins: [scryBabelPlugin],
};
```

### Node.js — CJS (`babel.config.js`)

```js
const { scryBabelPlugin } = require("@racgoo/scry/babel");

module.exports = {
  presets: ["@babel/preset-typescript"],
  plugins: [scryBabelPlugin],
};
```

### Next.js (`next.config.js`)

```js
const { scryBabelPlugin } = require("@racgoo/scry/babel");

module.exports = {
  experimental: { forceSwcTransforms: false },
  babel: {
    plugins: [scryBabelPlugin],
  },
};
```

---

## Plugin options

Pass options as the second element in a `[plugin, options]` tuple:

```ts
import { scryBabelPlugin } from "@racgoo/scry/babel";

react({
  babel: {
    plugins: [
      [
        scryBabelPlugin,
        {
          // Only instrument files matching these glob patterns (default: all source files).
          include: ["src/**"],
          // Skip files matching these patterns.
          exclude: ["**/*.test.ts", "**/*.spec.ts"],
          // Max Zone nesting depth before bypassing instrumentation (default: 50).
          // Calls beyond this depth still execute — they are just not traced.
          maxDepth: 30,
        },
      ],
    ],
  },
}),
```

| Option | Type | Default | Description |
|---|---|---|---|
| `include` | `string[]` | all files (non-node_modules) | Glob patterns for files to instrument |
| `exclude` | `string[]` | `[]` | Glob patterns for files to skip |
| `maxDepth` | `number` | `50` | Max Zone nesting depth before bypassing tracing |

> `node_modules` is **always excluded** regardless of `include`/`exclude`.

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
| **Browser** | Opens in a new tab via `window.open()` |
| **Node.js** | Saved to `scry/report/` and auto-opened in a browser |

<img width="1405" alt="Scry report" src="https://github.com/user-attachments/assets/154a7b80-c79f-4cff-b76c-a0c1a6f71f51" />

---

## Important notes

### Plugin is no-op in production
The Babel plugin checks `process.env.NODE_ENV` at transform time. Instrumentation code is **only injected when `NODE_ENV=development`**. Production builds are unaffected.

### zone.js is bundled
`zone.js` is **fully bundled** inside `dist/esm/zone-init.js` and `dist/cjs/zone-init.cjs` — you do not need `zone.js` as a peer or direct dependency. The plugin automatically injects `import "@racgoo/scry/zone"` at the top of every instrumented file.

### pnpm / monorepo users
Because `zone.js` is bundled rather than resolved from `node_modules`, the plugin works correctly in pnpm workspaces even if `zone.js` is not hoisted to the root.

---

## Package exports

```
@racgoo/scry         → Tracer, Extractor (runtime)
@racgoo/scry/babel   → scryBabelPlugin, scryBabelPluginForESM, scryBabelPluginForCJS
@racgoo/scry/zone    → bundled zone.js initialiser (injected automatically by the plugin)
```

---

## Third-party licenses

| Package | License |
|---|---|
| [zone.js](https://github.com/angular/angular) | MIT |
| [Day.js](https://github.com/iamkun/dayjs) | MIT |
| [flatted](https://github.com/WebReflection/flatted) | ISC |
| [js-base64](https://github.com/dankogai/js-base64) | BSD-3-Clause |

---

## Contact

Have questions, suggestions, or want to contribute?  
[[📬 send mail]](mailto:lhsung98@naver.com)
