export const getServerBaseUrl = () => {
  if (import.meta.env?.VITE_SERVER_BASE_URL) {
    return import.meta.env.VITE_SERVER_BASE_URL;
  }
  return import.meta.env.DEV ? 'http://localhost:3001' : '';
};
