// scripts/fix-cjs.js
import fs from "fs";
import pkg from "glob";
const { glob } = pkg;

// 1. 파일 확장자 변경
const files = glob.sync("dist/cjs/**/*.js");
files.forEach((file) => {
  // 2. import문의 확장자도 수정
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

  // 3. 파일명 변경
  const newFile = file.replace(".js", ".cjs");
  fs.writeFileSync(newFile, content);
  fs.unlinkSync(file); // 원본 삭제
});
