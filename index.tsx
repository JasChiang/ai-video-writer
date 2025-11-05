import React from 'react';
import ReactDOM from 'react-dom/client';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

function loadRuntimeConfig(): Promise<void> {
  if (typeof window === 'undefined') {
    return Promise.resolve();
  }

  if (window.__APP_CONFIG__?.YOUTUBE_CLIENT_ID) {
    return Promise.resolve();
  }

  const baseUrl = import.meta.env.DEV ? 'http://localhost:3001' : '';

  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = `${baseUrl}/app-config.js`;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () =>
      reject(new Error('Failed to load /app-config.js. Please ensure the backend server is running.'));
    document.head.appendChild(script);
  });
}

async function bootstrap() {
  await loadRuntimeConfig();
  const AppModule = await import('./App');
  const App = AppModule.default;

  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}

bootstrap().catch((error) => {
  console.error('Failed to bootstrap application:', error);
  const message = document.createElement('div');
  message.style.color = '#dc2626';
  message.style.fontFamily = 'system-ui, sans-serif';
  message.style.margin = '2rem';
  message.textContent = 'Application failed to start. Please check console for details.';
  document.body.appendChild(message);
});
   
