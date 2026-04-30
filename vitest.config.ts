import { defineConfig } from "vitest/config";
import { transformSync } from "@babel/core";
import { scryBabelPlugin } from "./src/babel/index.js";
import path from "path";
import { fileURLToPath } from "url";
import type { Plugin } from "vite";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Vite plugin that applies the scry babel plugin to any .fixture.ts file.
 * This lets integration tests import instrumented fixtures without a separate
 * compile step – Vite's transform pipeline calls this hook before esbuild.
 */
function scryFixturePlugin(): Plugin {
  return {
    name: "scry-fixture-transform",
    enforce: "pre",
    async transform(code, id) {
      if (!id.includes(".fixture.")) return null;

      // The scry plugin only instruments code when NODE_ENV === "development".
      // Temporarily set it so fixtures are fully instrumented during tests.
      const origNodeEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = "development";
      let result: ReturnType<typeof transformSync>;
      try {
        result = transformSync(code, {
          filename: id,
          presets: [["@babel/preset-typescript", { allExtensions: true }]],
          plugins: [
            [
              scryBabelPlugin,
              {
                maxDepth: 20,
                includes: [],
              },
            ],
          ],
          sourceMaps: true,
        });
      } finally {
        process.env.NODE_ENV = origNodeEnv;
      }

      if (!result?.code) return null;
      return { code: result.code, map: result.map ?? null };
    },
  };
}

export default defineConfig({
  plugins: [scryFixturePlugin()],
  resolve: {
    alias: {
      // Redirect scry's own self-imports (injected by the babel plugin) to src
      "@racgoo/scry/zone": path.resolve(__dirname, "src/zone-init.ts"),
      "@racgoo/scry/babel": path.resolve(__dirname, "src/babel/index.ts"),
      "@racgoo/scry": path.resolve(__dirname, "src/index.ts"),
    },
  },
  test: {
    environment: "node",
    globals: true,
    include: ["tests/**/*.test.ts"],
    setupFiles: ["tests/setup.ts"],
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      exclude: ["src/**/*.d.ts"],
      reporter: ["text", "lcov", "html"],
    },
    // Give integration tests more time (Zone.js async + setTimeout)
    testTimeout: 15000,
  },
});
