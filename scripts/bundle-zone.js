// Bundle zone.js content directly into dist/esm/zone-init.js and
// dist/cjs/zone-init.cjs so consumers never need to resolve zone.js
// themselves. Without this, pnpm's isolated node_modules would cause
// "Failed to resolve import 'zone.js'" in projects that don't list
// zone.js as a direct dependency.
import esbuild from "esbuild";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

// ESM output – keep as ES module
await esbuild.build({
  entryPoints: [path.join(root, "src/zone-init.ts")],
  bundle: true,
  format: "esm",
  outfile: path.join(root, "dist/esm/zone-init.js"),
  platform: "browser",
  // zone.js has browser + Node builds; the 'browser' condition picks the
  // right UMD/ESM bundle automatically.
  conditions: ["browser", "import", "default"],
  // Overwrite the tsc-generated file.
  allowOverwrite: true,
  logLevel: "info",
});

// CJS output
await esbuild.build({
  entryPoints: [path.join(root, "src/zone-init.ts")],
  bundle: true,
  format: "cjs",
  outfile: path.join(root, "dist/cjs/zone-init.cjs"),
  platform: "node",
  conditions: ["require", "default"],
  allowOverwrite: true,
  logLevel: "info",
});

console.log("zone-init bundled successfully");
