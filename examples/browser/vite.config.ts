import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { scryBabelPlugin } from "@racgoo/scry/babel";

export default defineConfig({
  resolve: {
    preserveSymlinks: true,
  },
  plugins: [
    react({
      babel: {
        plugins: [scryBabelPlugin],
      },
    }),
  ],
});
