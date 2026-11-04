import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// configure-pages supplies the actual prefix, including custom domains.
export default defineConfig({
  plugins: [react()],
  base: process.env.VITE_BASE_PATH || "/",
  define: { __SOURCE_URL__: JSON.stringify(process.env.VITE_SOURCE_URL || "") },
  build: { target: "es2020" },
  worker: { format: "es" },
});
