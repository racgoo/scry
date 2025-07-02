import { globalIgnores } from "eslint/config";
import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

//Custom lint plugin
import boundaries from "eslint-plugin-boundaries";
//need "eslint-import-resolver-typescript": "^4.4.4" as dev dependency

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
      //Define boundaries to use
      "boundaries/elements": [{ type: "features", pattern: "features/*" }],
    },
    //Isolate features folder lint rule
    plugins: { boundaries },
    rules: {
      "boundaries/entry-point": [
        2, //Error flag(2: error, 1: warning, 0: off).. I think it's not good using error as number
        {
          default: "disallow",
          rules: [
            {
              target: ["features"],
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
