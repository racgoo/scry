import {
  scryBabelPluginForCJS,
  scryBabelPluginForESM,
  scryBabelPluginAutoDetect,
} from "./scry-babel-plugin.js";
import type { ScryPluginOptions } from "./scry-babel-plugin.js";

/**
 * Recommended single-plugin export. Automatically detects ESM vs CJS from the Babel
 * parser's sourceType and the nearest package.json, so users no longer need to choose
 * between scryBabelPluginForESM and scryBabelPluginForCJS.
 *
 * Usage (vite.config.ts):
 *   import { scryBabelPlugin } from "@racgoo/scry/babel"
 *   plugins: [react({ babel: { plugins: [scryBabelPlugin] } })]
 *
 * Usage (babel.config.js):
 *   const { scryBabelPlugin } = require("@racgoo/scry/babel")
 *   module.exports = { plugins: [scryBabelPlugin] }
 *
 * With options:
 *   plugins: [[scryBabelPlugin, { include: ["src/"], exclude: ["**\/*.test.ts"], maxDepth: 30 }]]
 */
const scryBabelPlugin = scryBabelPluginAutoDetect;

export {
  scryBabelPlugin,
  scryBabelPluginForCJS,
  scryBabelPluginForESM,
  ScryPluginOptions,
};
