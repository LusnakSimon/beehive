import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { ViteMcp } from 'vite-plugin-mcp'

export default defineConfig({
  plugins: [
    react(),
    // MCP server for AI-assisted development
    // Exposes app info at http://localhost:3000/__mcp/sse
    ViteMcp({
      // Automatically update VSCode/Cursor MCP config
      updateConfig: true,
      updateConfigServerName: 'beehive-dev'
    })
  ],
  build: {
    outDir: 'dist',
    sourcemap: false,
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'charts': ['recharts']
        }
      }
    }
  },
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true
      }
    }
  }
})
