import { globalIgnores } from "eslint/config";
import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

//Custom lint plugin
import importPlugin from "eslint-plugin-import";
import boundaries from "eslint-plugin-boundaries";
//need "eslint-import-resolver-typescript": "^4.4.4" as dev dependency
const capsuredModuleAlias = ["features", "styles"];

function getImportPatterns(alias) {
  return [`@${alias}/*/*`, `*/${alias}/*/*`];
}

function getBoundaryElement(alias) {
  return { type: alias, pattern: `${alias}/*` };
}

export default tseslint.config([
  globalIgnores(["dist"]),
  {
    //Vite default code
    files: ["**/*.{ts,tsx}"],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs["recommended-latest"],
      reactRefresh.configs.vite,
    ],
    //Scry custom lint plugins
    plugins: { import: importPlugin, boundaries },
    //Boundary settings
    settings: {
      //Resolve ts path(need "eslint-import-resolver-typescript" as dev dependency)
      "import/resolver": {
        typescript: {}, //automatically insert resolver
      },
      "boundaries/elements": capsuredModuleAlias.map(getBoundaryElement),
    },
    //Isolate features folder lint rule
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: capsuredModuleAlias.flatMap(getImportPatterns),
        },
      ],
      "boundaries/entry-point": [
        2, //Error flag(2: error, 1: warning, 0: off).. I think it's not good using error as number
        {
          default: "disallow",
          rules: [
            {
              target: capsuredModuleAlias,
              allow: "index.ts", //Allow only index.ts file(Protect capsured module)
            },
          ],
        },
      ],
    },

    languageOptions: {
      ecmaVersion: "latest",
      globals: globals.browser,
    },
  },
]);

// eslint-plugin-boundaries는 features or styles와 같이 같은 바운더리 안에 있는 모듈끼리 서로 참조를 못하게 하기 위해서 사용
// (같은 바운더리 안에서는 "@boundary/*", "*/boundary/*" 형태로만 참조하지 않기에 패턴 매칭으로 검사하기 어려움)
//eslint-plugin-import는 바운더리 외부에서 해당 바운더리에 접근할때 패턴 매칭으로 검사하기에 features, styles 같은 모듈을 보호 할 수 있음.
//즉 eslint-plugin-boundaries는 같은 바운더리에 속한 모듈끼리 참조를 보호하고, eslint-plugin-import는 바운더리 외부 코드에서 바운더리에 해당하는 모듈들의 참조를 보호하는 역할을함
//따라서 2가지 모두 필요
