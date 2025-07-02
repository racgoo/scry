import { globalIgnores } from "eslint/config";
import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

//Custom lint plugin
import importPlugin from "eslint-plugin-import";
//need "eslint-import-resolver-typescript": "^4.4.4" as dev dependency
const capsuredModuleAlias = ["features", "styles"];

function getPatterns(alias) {
  return [`@${alias}/*/*`, `*/${alias}/*/*`];
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

    //Scry custom lint code
    settings: {
      //Resolve ts path(need "eslint-import-resolver-typescript" as dev dependency)
      "import/resolver": {
        typescript: {}, //automatically insert resolver
      },
    },
    //Isolate features folder lint rule
    plugins: { import: importPlugin },
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: capsuredModuleAlias.flatMap(getPatterns),
        },
      ],
    },

    languageOptions: {
      ecmaVersion: "latest",
      globals: globals.browser,
    },
  },
]);
