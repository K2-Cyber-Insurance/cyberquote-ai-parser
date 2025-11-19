import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [react()],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.K2_CYBER_ENV': JSON.stringify(env.K2_CYBER_ENV || 'prod'),
        'process.env.K2_CYBER_CLIENT_ID_TEST': JSON.stringify(env.K2_CYBER_CLIENT_ID_TEST),
        'process.env.K2_CYBER_CLIENT_SECRET_TEST': JSON.stringify(env.K2_CYBER_CLIENT_SECRET_TEST),
        'process.env.K2_CYBER_CLIENT_ID_PROD': JSON.stringify(env.K2_CYBER_CLIENT_ID_PROD),
        'process.env.K2_CYBER_CLIENT_SECRET_PROD': JSON.stringify(env.K2_CYBER_CLIENT_SECRET_PROD)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      },
      optimizeDeps: {
        include: ['emailjs-mime-parser'],
        esbuildOptions: {
          // Handle CommonJS modules
          target: 'es2020',
        }
      }
    };
  });
