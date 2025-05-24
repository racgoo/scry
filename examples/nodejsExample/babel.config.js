import { scryBabelPlugin } from "@racgoo/scry";

console.log("[Babel Config] Loading configuration...");
console.log("[Babel Config] NODE_ENV:", process.env.NODE_ENV);

export default {
  presets: [
    [
      "@babel/preset-env",
      {
        modules: false, // ES 모듈 형식 유지
        targets: {
          node: "current",
        },
      },
    ],
  ],
  plugins: [scryBabelPlugin],
};
