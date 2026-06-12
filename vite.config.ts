import path from "path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    proxy: {
      "/api-paymongo": {
        target: "https://api.paymongo.com",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api-paymongo/, ""),
        configure: (proxy, _options) => {
          proxy.on("proxyReq", (proxyReq, _req, _res) => {
            proxyReq.setHeader("Origin", "https://api.paymongo.com")
            proxyReq.setHeader("Referer", "https://api.paymongo.com/")
          })
        },
      },
    },
  },
})
