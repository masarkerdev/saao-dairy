// শুধু ডেমো বিল্ডের জন্য: আসল Supabase-এর বদলে ব্রাউজারের ভেতরের নমুনা ডেটাবেস
import { defineConfig } from 'vite'
import { resolve } from 'node:path'

const mock = resolve(__dirname, 'src/demo/mockSupabase.ts')

export default defineConfig({
  plugins: [{
    name: 'demo-supabase',
    enforce: 'pre',
    resolveId(source, importer) {
      if (importer && importer.includes('/src/') && /(^|\/)supabase$/.test(source)) return mock
      return null
    },
  }],
  esbuild: {
    jsx: 'transform',
    jsxFactory: 'React.createElement',
    jsxFragment: 'React.Fragment',
    jsxInject: "import React from 'react'",
  },
  define: { 'process.env.NODE_ENV': '"production"' },
  build: {
    outDir: 'demo-dist',
    emptyOutDir: true,
    lib: { entry: resolve(__dirname, 'src/demo/main.tsx'), formats: ['iife'], name: 'SaaoDemo', fileName: () => 'demo.js' },
    rollupOptions: {
      external: ['react', 'react-dom', 'react-dom/client', 'react-router-dom'],
      output: { globals: { react: 'React', 'react-dom': 'ReactDOM', 'react-dom/client': 'ReactDOM', 'react-router-dom': 'ReactRouterDOM' } },
    },
  },
})
