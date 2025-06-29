import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { scryBabelPluginForESM } from "@racgoo/scry/babel";
export default defineConfig({
  resolve: {
    preserveSymlinks: true,
  },
  plugins: [
    react({
      babel: {
        plugins: [scryBabelPluginForESM],
      },
    }),
  ],
});
