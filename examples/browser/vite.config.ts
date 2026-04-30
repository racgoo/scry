import react from "@vitejs/plugin-react";
import { defineConfig, type PluginOption } from "vite";
import { scryVitePlugin } from "@racgoo/scry/vite";

export default defineConfig({
  resolve: {
    preserveSymlinks: true,
  },
  // scryVitePlugin must come BEFORE @vitejs/plugin-react so it sees raw
  // .ts/.tsx before the JSX transform.
  // Cast: this example's nested vite version may differ from root scry's;
  // the runtime API is compatible.
  plugins: [scryVitePlugin() as unknown as PluginOption, react()],
});
