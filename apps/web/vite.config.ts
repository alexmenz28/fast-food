import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// En desarrollo, el proxy evita CORS si abres la app por 127.0.0.1 y el API por localhost (u otro host).
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api": {
        target: "http://localhost:3000",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, "") || "/",
      },
    },
  },
});
