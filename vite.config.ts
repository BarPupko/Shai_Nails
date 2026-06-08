import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig(({ mode }) => {
  // Load .env files; also merge actual process.env (for Hostinger build env vars)
  const env = Object.assign({}, loadEnv(mode, process.cwd(), ''), process.env)

  const defines = Object.fromEntries(
    Object.entries(env)
      .filter(([k]) => k.startsWith('NEXT_PUBLIC_'))
      .map(([k, v]) => [`process.env.${k}`, JSON.stringify(v)])
  )

  return {
    plugins: [react()],
    resolve: {
      alias: { '@': path.resolve(__dirname, '.') },
    },
    define: defines,
  }
})
