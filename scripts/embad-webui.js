import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const htmlPath = path.resolve(__dirname, "../webUI/dist/index.html");
const webUIHTML = fs.readFileSync(htmlPath, "utf8");

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
