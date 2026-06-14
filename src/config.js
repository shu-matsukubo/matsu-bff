const requiredEnv = (name, fallback) => {
  const value = process.env[name] ?? fallback;

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
};

const boolEnv = (name, fallback) => {
  const value = process.env[name];

  if (value == null) {
    return fallback;
  }

  return value.toLowerCase() === 'true';
};

const intEnv = (name, fallback) => {
  const value = process.env[name];

  if (value == null) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);

  if (Number.isNaN(parsed)) {
    throw new Error(`Environment variable ${name} must be an integer.`);
  }

  return parsed;
};

export const config = {
  port: intEnv('PORT', 18082),
  frontendOrigin: requiredEnv('FRONTEND_ORIGIN', 'http://localhost:5173'),
  backendApiBaseUrl: requiredEnv('BACKEND_API_BASE_URL', 'http://localhost:18080/api'),
  authBaseUrl: requiredEnv('AUTH_BASE_URL', 'http://localhost:18081'),
  redisUrl: requiredEnv('REDIS_URL', 'redis://localhost:16379'),
  sessionCookieName: requiredEnv('SESSION_COOKIE_NAME', 'matsu-session'),
  sessionTtlSeconds: intEnv('SESSION_TTL_SECONDS', 60 * 60 * 24 * 30),
  cookieSecure: boolEnv('COOKIE_SECURE', process.env.NODE_ENV === 'production'),
};
