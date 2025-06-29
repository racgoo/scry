import { defineConfig } from "vite";
import path from "path";
import string from "vite-plugin-string";

export default defineConfig({
  root: ".",
  plugins: [string()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      "@utils": path.resolve(__dirname, "src/utils"),
      "@babel": path.resolve(__dirname, "src/babel"),
      "@tracer": path.resolve(__dirname, "src/tracer"),
    },
  },
  build: {
    outDir: "dist",
    sourcemap: true,
    emptyOutDir: true,
    lib: {
      entry: path.resolve(__dirname, "src/index.ts"),
      name: "Scry",
      formats: ["es", "cjs"],
      fileName: (format) => `index.${format}.js`,
    },
    rollupOptions: {
      external: [], // 외부 의존성 필요시 추가
    },
  },
});
