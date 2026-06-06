import { config } from './config.js';

const postAuth = async (path, body) => {
  const response = await fetch(`${config.authBaseUrl}${path}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      accept: 'application/json',
    },
    body: JSON.stringify(body),
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  if (!response.ok) {
    const error = new Error(`Auth server returned ${response.status}`);
    error.statusCode = response.status;
    error.data = data;
    throw error;
  }

  return data;
};

export const login = (request) => postAuth('/auth/login', request);

export const register = (request) => postAuth('/auth/register', request);

export const refresh = (refreshToken) =>
  postAuth('/auth/refresh', {
    refreshToken,
  });
