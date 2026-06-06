import { config } from './config.js';

export const readJsonBody = (request) =>
  new Promise((resolve, reject) => {
    const chunks = [];

    request.on('data', (chunk) => {
      chunks.push(chunk);
    });

    request.on('end', () => {
      const text = Buffer.concat(chunks).toString('utf8');

      if (!text) {
        resolve(null);
        return;
      }

      try {
        resolve(JSON.parse(text));
      } catch (error) {
        reject(error);
      }
    });

    request.on('error', reject);
  });

export const parseCookies = (header) => {
  if (!header) {
    return {};
  }

  return Object.fromEntries(
    header.split(';').map((part) => {
      const [name, ...valueParts] = part.trim().split('=');
      return [name, decodeURIComponent(valueParts.join('='))];
    }),
  );
};

export const sendJson = (response, statusCode, body) => {
  response.writeHead(statusCode, {
    'content-type': 'application/json; charset=utf-8',
  });
  response.end(JSON.stringify(body));
};

export const setCorsHeaders = (response) => {
  response.setHeader('access-control-allow-origin', config.frontendOrigin);
  response.setHeader('access-control-allow-credentials', 'true');
  response.setHeader('access-control-allow-methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  response.setHeader('access-control-allow-headers', 'content-type,accept');
};

export const setSessionCookie = (response, sessionId) => {
  const parts = [
    `${config.sessionCookieName}=${encodeURIComponent(sessionId)}`,
    'Path=/',
    `Max-Age=${config.sessionTtlSeconds}`,
    'HttpOnly',
    'SameSite=Lax',
  ];

  if (config.cookieSecure) {
    parts.push('Secure');
  }

  response.setHeader('set-cookie', parts.join('; '));
};

export const clearSessionCookie = (response) => {
  response.setHeader(
    'set-cookie',
    `${config.sessionCookieName}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax`,
  );
};
