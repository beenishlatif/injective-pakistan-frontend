import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    // "true" makes Vite listen on all local addresses
    // (both localhost AND 127.0.0.1), not just one of them.
    host: true,
    port: 5173,
    proxy: {
      "/api": {
        target: "http://127.0.0.1:5000", // apka actual backend port
        changeOrigin: true,
      },
    },
  },
});