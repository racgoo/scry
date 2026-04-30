import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const htmlPath = path.resolve(__dirname, "../webUI/dist/index.html");

// If the webUI hasn't been built yet (e.g. in CI or a fresh clone) use an
// empty placeholder so the library build still succeeds. Run
// `cd webUI && npm install && npm run build` to generate a real WebUI.
let webUIHTML = "";
if (fs.existsSync(htmlPath)) {
  webUIHTML = fs.readFileSync(htmlPath, "utf8");
} else {
  console.warn(
    "[embad-webui] webUI/dist/index.html not found — embedding empty placeholder.\n" +
    "  Run `cd webUI && npm install && npm run build` to build the WebUI."
  );
}

const cjsContent = `const webUIHTML = ${JSON.stringify(
  webUIHTML
)};\nmodule.exports = webUIHTML;\n`;

const esmContent = `const webUIHTML = ${JSON.stringify(
  webUIHTML
)};\nexport default webUIHTML;\n`;

fs.writeFileSync(
  path.resolve(
    __dirname,
    "../dist/cjs/tracer/export/exportStrategies/webui.html.cjs"
  ),
  cjsContent
);
fs.writeFileSync(
  path.resolve(
    __dirname,
    "../dist/esm/tracer/export/exportStrategies/webui.html.js"
  ),
  esmContent
);
// }
