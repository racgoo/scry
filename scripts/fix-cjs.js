// scripts/fix-cjs.js
// Renames dist/cjs/**/*.js → *.cjs and rewrites internal import/require paths.
// Uses only Node.js built-ins so no extra dependencies are required.
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function findJsFiles(dir) {
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...findJsFiles(full));
    } else if (entry.isFile() && entry.name.endsWith(".js")) {
      results.push(full);
    }
  }
  return results;
}

const cjsDir = path.resolve(__dirname, "../dist/cjs");
const files = findJsFiles(cjsDir);

files.forEach((file) => {
  let content = fs.readFileSync(file, "utf8");
  content = content.replace(/from ["'](\.\.\/.+?)\.js["']/g, 'from "$1.cjs"');
  content = content.replace(/from ["'](\.\/.+?)\.js["']/g, 'from "$1.cjs"');
  content = content.replace(
    /require\(["'](\.\.\/.+?)\.js["']\)/g,
    'require("$1.cjs")'
  );
  content = content.replace(
    /require\(["'](\.\/.+?)\.js["']\)/g,
    'require("$1.cjs")'
  );

  const newFile = file.replace(/\.js$/, ".cjs");
  fs.writeFileSync(newFile, content);
  fs.unlinkSync(file);
});
