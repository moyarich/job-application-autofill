import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig({
  plugins: [react()],
  build: { outDir: "dist-app" },
  server: {
    host: "0.0.0.0",
    port: 5173,
    proxy: {
      "/api": process.env.VITE_API_PROXY_TARGET || "http://127.0.0.1:4177",
      "/vnc": {
        target: process.env.VITE_VNC_PROXY_TARGET || "http://127.0.0.1:6080",
        ws: true,
        rewrite: (path) => path.replace(/^\/vnc/, ""),
      },
    },
  },
});
