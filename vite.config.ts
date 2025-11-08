import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
        proxy: {
          '/api': {
            target: 'http://localhost:3001',
            changeOrigin: true,
          },
        },
      },
      plugins: [react()],
      define: {
        // 只注入 YOUTUBE_CLIENT_ID 和 GITHUB_GIST_ID（這些是 OAuth 流程需要的，可以安全地暴露在前端）
        // API Keys 和 Tokens 不應該暴露在前端，改由後端 API 使用
        'process.env.YOUTUBE_CLIENT_ID': JSON.stringify(env.YOUTUBE_CLIENT_ID),
        'process.env.GITHUB_GIST_ID': JSON.stringify(env.GITHUB_GIST_ID)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
