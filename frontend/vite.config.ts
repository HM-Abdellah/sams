import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

export default defineConfig(({ command }) => ({
  // SAMS is deployed below /sams/ in XAMPP/Apache. A plain production build
  // must not emit /assets URLs that point outside the application mount.
  // Local Vite development and mocked-browser tests stay rooted at /.
  base: command === 'build' ? '/sams/' : '/',
  plugins: [react(), tailwindcss()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
}))
