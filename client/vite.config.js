import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { viteSingleFile } from "vite-plugin-singlefile";

// O Apps Script serve um arquivo HTML só (Index.html), sem pasta de assets:
// o viteSingleFile embute JS e CSS dentro do próprio HTML.
export default defineConfig({
  base: "./",
  plugins: [react(), viteSingleFile()],
  build: {
    target: "es2019",
    reportCompressedSize: false,
  },
  server: {
    host: true,
    port: 5173,
  },
});
