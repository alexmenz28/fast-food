import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Proxy a IPv4 explícito: en Windows `localhost` puede ir a ::1 y el backend (0.0.0.0) no recibe → ECONNREFUSED.
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api": {
        target: "http://127.0.0.1:3000",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, "") || "/",
      },
    },
  },
});
