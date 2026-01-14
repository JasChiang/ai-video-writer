export class ApiError extends Error {
  status: number;
  data?: unknown;

  constructor(message: string, status: number, data?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

export const getApiBaseUrl = () =>
  import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'http://localhost:3001/api' : '/api');

const buildApiUrl = (path: string, baseUrl: string) => {
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }
  if (path.startsWith('/')) {
    return `${baseUrl}${path}`;
  }
  return `${baseUrl}/${path}`;
};

const isJsonResponse = (response: Response) => {
  const contentType = response.headers.get('content-type');
  return contentType?.includes('application/json');
};

const parseErrorMessage = (data: unknown, fallback: string) => {
  if (data && typeof data === 'object' && 'error' in data && typeof data.error === 'string') {
    return data.error;
  }
  if (typeof data === 'string' && data.trim()) {
    return data;
  }
  return fallback;
};

const throwApiError = async (response: Response, fallback: string) => {
  let data: unknown;
  try {
    if (isJsonResponse(response)) {
      data = await response.json();
    } else {
      data = await response.text();
    }
  } catch (error) {
    data = undefined;
  }

  throw new ApiError(parseErrorMessage(data, fallback), response.status, data);
};

export interface ApiRequestOptions extends RequestInit {
  baseUrl?: string;
  errorMessage?: string;
}

export async function requestJson<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const { baseUrl = getApiBaseUrl(), errorMessage = 'Request failed', ...fetchOptions } = options;
  const url = buildApiUrl(path, baseUrl);
  const response = await fetch(url, fetchOptions);

  if (!response.ok) {
    await throwApiError(response, errorMessage);
  }

  if (response.status === 204 || response.headers.get('content-length') === '0') {
    return undefined as T;
  }

  return response.json();
}

export async function requestNoContent(path: string, options: ApiRequestOptions = {}): Promise<void> {
  const { baseUrl = getApiBaseUrl(), errorMessage = 'Request failed', ...fetchOptions } = options;
  const url = buildApiUrl(path, baseUrl);
  const response = await fetch(url, fetchOptions);

  if (!response.ok) {
    await throwApiError(response, errorMessage);
  }
}
