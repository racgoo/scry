// Drop-in Vite plugin that runs the scry babel transform on user source
// files (.js / .jsx / .ts / .tsx).  Replaces the previous
// `react({ babel: { plugins: [scryBabelPlugin] } })` instruction in our
// README, which silently no-op'd in real-world setups whenever:
//   - the user already had a custom babel.config in the project,
//   - @vitejs/plugin-react ran some plugins in a different phase,
//   - or the user simply forgot to wire it through `react.babel.plugins`.
//
// Using this plugin instead, the transform is registered DIRECTLY with
// Vite — independent of @vitejs/plugin-react — and is therefore
// applied unconditionally.

import type { Plugin } from "vite";
import { transformSync } from "@babel/core";
import {
  scryBabelPluginAutoDetect,
  type ScryPluginOptions,
} from "../babel/scry-babel-plugin.js";

const DEFAULT_INCLUDE_RE =
  /\.(?:tsx?|jsx?|mjs|cjs)(?:\?[^/]*)?$/;

const DEFAULT_EXCLUDE_RE =
  /(?:^|\/)(?:node_modules|\.vite|dist|build)(?:\/|$)/;

export interface ScryVitePluginOptions
  extends Omit<ScryPluginOptions, "exclude"> {
  /**
   * Override the file inclusion regex.  Default matches .ts/.tsx/.js/.jsx
   * (with or without query string).
   */
  test?: RegExp;
  /**
   * Override the file exclusion regex, OR a list of substring matches.
   * Default skips node_modules / .vite / dist / build.
   */
  exclude?: RegExp | string[];
  /**
   * Forwarded to the babel plugin's own `exclude` option (substring match
   * against file paths, evaluated AFTER the regex includes/excludes above).
   */
  babelExclude?: string[];
}

export function scryVitePlugin(options: ScryVitePluginOptions = {}): Plugin {
  const include = options.test ?? DEFAULT_INCLUDE_RE;
  const exclude =
    options.exclude instanceof RegExp ? options.exclude : DEFAULT_EXCLUDE_RE;
  const stringExcludes =
    Array.isArray(options.exclude) ? options.exclude : [];
  const babelOptions: ScryPluginOptions = {
    include: options.include,
    exclude: options.babelExclude,
    maxDepth: options.maxDepth,
  };

  return {
    name: "scry-babel",
    // Run BEFORE @vitejs/plugin-react so it sees the wrapped IIFEs and
    // can do its own JSX transform on top.  enforce:"pre" puts us in the
    // "pre" phase Vite runs before any default user-plugin transforms.
    enforce: "pre",
    transform(code, id) {
      // Strip query string so the regex actually matches.
      const cleanId = id.split("?")[0];

      if (!include.test(cleanId)) return null;
      if (exclude instanceof RegExp && exclude.test(cleanId)) return null;
      if (stringExcludes.some((p) => cleanId.includes(p))) return null;

      // The plugin's own NODE_ENV check treats anything-not-"production"
      // as development.  Force "development" here for safety so that
      // even ambient process.env.NODE_ENV === "production" inside a
      // dev-mode invocation doesn't accidentally disable the transform.
      // The user can opt out by setting their own production build.
      const wasProd = process.env.NODE_ENV === "production";
      const orig = process.env.NODE_ENV;
      if (!wasProd) process.env.NODE_ENV = "development";
      let result: ReturnType<typeof transformSync>;
      // Tell babel's parser about TS/JSX directly via parserOpts so we
      // don't have to depend on @babel/preset-typescript being installed
      // in the user's project.  We never need to *strip* types — Vite's
      // esbuild step handles that downstream — we just need babel to
      // PARSE without choking on `:` annotations and `<Comp />` syntax.
      const isTS = /\.tsx?(?:\?|$)/.test(cleanId);
      const isJSX = /\.[jt]sx(?:\?|$)/.test(cleanId);
      const parserPlugins: string[] = [];
      if (isTS) parserPlugins.push("typescript");
      if (isJSX) parserPlugins.push("jsx");
      try {
        result = transformSync(code, {
          filename: cleanId,
          parserOpts: {
            sourceType: "module",
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            plugins: parserPlugins as any,
          },
          generatorOpts: {
            // Preserve types in the output — esbuild strips them later.
            // (Not actually used unless babel needs to print TS nodes,
            // but harmless and future-proof.)
          },
          plugins: [[scryBabelPluginAutoDetect, babelOptions]],
          babelrc: false,
          configFile: false,
          sourceMaps: true,
          sourceType: "module",
        });
      } finally {
        process.env.NODE_ENV = orig;
      }
      if (!result?.code) return null;
      return { code: result.code, map: result.map ?? null };
    },
  };
}

export default scryVitePlugin;
