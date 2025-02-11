import { resolve } from 'path'
import { defineConfig } from 'vite';
import path from 'path'

export default defineConfig({
  root: resolve(__dirname, 'src'),
  base: '',
  build: {
    outDir: 'dist',
    assetsInlineLimit: 0,
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'src/index.html'), 
        grid: path.resolve(__dirname, 'src/tableDisplay.html'),
        editor: path.resolve(__dirname, 'src/editorPage.html'),
        sqlEditor: path.resolve(__dirname, 'src/sqlEditor.html'),
        home: path.resolve(__dirname, 'src/homePage.html'),
        policy: path.resolve(__dirname, 'src/privacyPolicy.html'),
        notebook: path.resolve(__dirname, 'src/S_Notebook.html'),
      },
      output: {
        assetFileNames: 'assets/[name].[hash].[ext]',
        chunkFileNames: 'assets/[name].[hash].js',
        entryFileNames: 'assets/[name].[hash].js',
      },
    },
  }, 
  
  worker:{
    format: 'es',
    rollupOptions: {
      output: {
        entryFileNames: 'workers/[name].[hash].js',
      }
    }
  },
  server: {
    port: 8080,
    cors:true,
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
    
  },
  optimizeDeps:{
    exclude: ['@sqlite.org/sqlite-wasm'],
  }
})


// import { defineConfig } from 'vite';

// export default ({
//   root: resolve(__dirname, 'src'),
//     build: {
//       outDir: '../dist',
//     },
//   server: {
//     port:8080,
//     cors:true,
//     headers: {
//       'Cross-Origin-Opener-Policy': 'same-origin',
//       'Cross-Origin-Embedder-Policy': 'require-corp',
//     },
//   },
//   optimizeDeps: {
//     exclude: ['@sqlite.org/sqlite-wasm'],
//   },
// });