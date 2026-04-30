// ESM (package.json "type": "module")
import { scryBabelPlugin } from "@racgoo/scry/babel";
export default {
  presets: [],
  plugins: [scryBabelPlugin],
};

// CJS (package.json "type": "commonjs") — uncomment and replace the above
// const { scryBabelPlugin } = require("@racgoo/scry/babel");
// module.exports = {
//   presets: [],
//   plugins: [scryBabelPlugin],
// };
