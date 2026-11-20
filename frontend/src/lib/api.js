export const API_URL = (import.meta.env.VITE_API_URL || '/api').replace(/\/+$/, '');

export class ApiError extends Error {
  constructor(message, status, code) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

export async function apiRequest(path, { body, ...options } = {}) {
  const isFormData = body instanceof FormData;
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    credentials: 'include',
    headers: {
      ...(body === undefined || isFormData ? {} : { 'Content-Type': 'application/json' }),
      ...options.headers,
    },
    ...(body === undefined ? {} : { body: isFormData ? body : JSON.stringify(body) }),
  });
  const payload = await response.json();

  if (!response.ok) {
    throw new ApiError(
      payload.error || 'The request could not be completed.',
      response.status,
      payload.code,
    );
  }

  return payload;
}
