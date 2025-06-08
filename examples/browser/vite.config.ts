import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { scryBabelPluginForESM } from "@racgoo/scry";

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
