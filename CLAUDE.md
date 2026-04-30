# Scry — Claude/AI Agent Guidance

Scry is a JavaScript/TypeScript execution flow tracer that instruments code at **compile time** (Babel AST plugin) and collects call graphs at **runtime** (Zone.js + event system).

> **Rule files** — single source of truth in `.cursor/rules/`, shared by Cursor (`alwaysApply: true`) and Claude Code (`@`-imports below).
>
> @.cursor/rules/project-overview.mdc
> @.cursor/rules/babel-plugin.mdc
> @.cursor/rules/git-workflow.mdc

---

## Build & Run

```bash
npm run build          # full build (ESM + CJS + embed webUI)
npm run build:esm      # ESM only  (dist/esm/)
npm run build:cjs      # CJS only  (dist/cjs/)
npm test               # Jest tests
npm run lint           # ESLint
node node_modules/typescript/bin/tsc --noEmit   # type-check without emit
```

## Project Structure

```
src/
  babel/               # Babel plugin — compile-time AST transformation
    scry-babel-plugin.ts   main plugin: wraps every CallExpression in a Zone + event IIFE
    scry.ast.ts            AST node generators (ScryAst class)
    scry.check.ts          skip-condition checkers (ScryChecker class)
    scry.constant.ts       all string constants and ScryAstVariable map
    index.ts               public exports: scryBabelPlugin, scryBabelPluginForESM/CJS
  tracer/              # Runtime tracer — collects and exports trace data
    tracer.ts              Tracer class (start / end public API)
    record/                TraceRecorder: listens to events, stores bundles
    node/                  NodeGenerator: builds call tree from flat event list
    zone/                  ZoneContext: updates Zone.current/_root at start/end
    export/                Exporter: renders HTML report, opens browser
    format.ts              HTML/CSS string template for the report UI
  utils/
    extractor.ts           Extractor.extractCode() — extracts source from func.toString()
    enviroment.ts          isNodeJS() helper
    output.ts              console helpers
  index.ts               main package entry: exports Tracer, Extractor, Babel
webUI/                 # Standalone Vite app for the trace report viewer
examples/
  browser/             # Vite + React demo
  nodejs/              # Node.js CommonJS / ESM demo
scripts/
  fix-cjs.js           post-build: rewrites .js → .cjs in CJS output
  embad-webui.js       embeds built webUI into the HTML report template
```

## Key Architecture

```
Source code
  ↓  Babel plugin (build time, Node.js)
     • wraps every CallExpression in (() => { ... Zone.fork + enter/exit events })()
     • injects Zone.js, Tracer, Extractor imports
     • embeds original source code as string literals
  ↓  Transformed code (browser or Node.js runtime)
     • Zone.js: provides async-context propagation (parent/child trace IDs)
     • Tracer.start() / Tracer.end(): marks a trace bundle
     • process.emit / CustomEvent: carries trace data to TraceRecorder
     • TraceRecorder: accumulates bundles → NodeGenerator builds tree → Exporter renders HTML
```

## Plugin Conventions

See [.cursor/rules/babel-plugin.mdc](.cursor/rules/babel-plugin.mdc) for full rules. Summary:

- Every `CallExpression.exit` visitor call generates an IIFE with:
  1. `traceId` (global auto-increment counter)
  2. `Zone.fork()` with `traceContext` and `_depth` (for maxDepth guard)
  3. `enter` event emit → actual call → `exit` event emit
  4. `finally`: `delete Zone[traceId]` to prevent leak
  5. `catch`: records error + rethrows (never swallow errors)
- `ScryAst` / `ScryChecker` instances are created **once per plugin** (not per visitor node).
- All `node_modules` are skipped first before any other check.

## Generated Variables (ScryAstVariable)

| Constant | Injected name | Purpose |
|----------|--------------|---------|
| `traceId` | `traceId` | unique call ID |
| `traceContext` | `traceContext` | `{ parentTraceId, traceBundleId }` per scope |
| `prevReturnValue` | `_prevReturnValue` | Zone property — result of prev chained call |
| `globalScryCalledCount` | `__globalScryCalledCount` | global call counter |
| `pluginApplied` | `scryPluginApplied` | marker checked by `@checkPlugin` decorator |

## Adding a New Feature

1. If it changes generated code → edit `scry.ast.ts` (AST generators) + `scry-babel-plugin.ts` (wiring)
2. If it changes runtime behaviour → edit `tracer/` files
3. If it changes the report UI → edit `webUI/` then run `npm run inject-webui`
4. Always run `node node_modules/typescript/bin/tsc --noEmit` before committing

## Git Workflow

See [.cursor/rules/git-workflow.mdc](.cursor/rules/git-workflow.mdc) for full procedure. Summary:

### Branch Strategy (GitFlow Lite)

```
main ──────────────────────► releases only (npm publish)
        ↑
develop ───────────────────► integration branch — ALL PR base
    ↑        ↑        ↑
feat/*    fix/*   chore/*  refactor/*  docs/*
```

| Branch | Purpose | PR target |
|--------|---------|-----------|
| `main` | Stable releases only. No direct push. | — |
| `develop` | Integration. Base for all feature/fix branches. | `main` (on release) |
| `feat/<topic>` | New feature | `develop` |
| `fix/<topic>` | Bug fix | `develop` |
| `refactor/<topic>` | Structural changes, no behaviour change | `develop` |
| `chore/<topic>` | Build, deps, config | `develop` |
| `docs/<topic>` | Documentation only | `develop` |
| `hotfix/<topic>` | Production emergency patch | `main` direct (then cherry-pick to `develop`) |

### Commands

```bash
# One-time setup
brew install gh
gh auth login   # choose HTTPS, browser auth — use the racgoo account

# Start work (always branch from develop)
git checkout develop && git pull
git checkout -b fix/my-fix

# Commit and push
git add <files>
git commit -m "fix: ..."
git push -u origin HEAD

# Open PR targeting develop
gh pr create --base develop --title "fix: ..." --body "..."
```

> GitHub remote: `git@racgoo:racgoo/scry.git` (SSH).  
> Account: **racgoo** (`lhsung98@naver.com`).  
> If `git push` returns 403, run `gh auth login` and pick the racgoo account.

## Package Info

- Package name: `@racgoo/scry`
- Current version: see `package.json`
- Exports two entry points: `.` (runtime) and `./babel` (plugin)
- Dual CJS + ESM: `dist/esm/` and `dist/cjs/`
