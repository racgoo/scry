import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh, { rules } from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";
import { globalIgnores } from "eslint/config";

import boundaries from "eslint-plugin-boundaries";

export default tseslint.config([
  globalIgnores(["dist"]),
  {
    files: ["**/*.{ts,tsx}"],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs["recommended-latest"],
      reactRefresh.configs.vite,
    ],
    settings: {
      "import/resolver": {
        typescript: {},
      },
      "boundaries/elements": [{ type: "features", pattern: "features/*" }],
    },

    plugins: { boundaries },
    rules: {
      "boundaries/entry-point": [
        2, //error flag
        {
          default: "disallow",
          rules: [
            {
              target: ["features"],
              allow: "index.ts",
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
