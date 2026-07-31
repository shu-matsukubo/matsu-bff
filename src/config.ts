const requiredEnv = (name: string, fallback?: string): string => {
  const value = process.env[name] ?? fallback;

  if (!value?.trim()) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
};

const boolEnv = (name: string, fallback: boolean): boolean => {
  const value = process.env[name];

  if (value == null) {
    return fallback;
  }

  return value.toLowerCase() === 'true';
};

const positiveIntEnv = (name: string, fallback: number): number => {
  const value = process.env[name];

  if (value == null) {
    return fallback;
  }

  if (!/^\d+$/.test(value)) {
    throw new Error(`Environment variable ${name} must be a positive integer.`);
  }

  const parsed = Number(value);

  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new Error(`Environment variable ${name} must be a positive integer.`);
  }

  return parsed;
};

const urlEnv = (
  name: string,
  fallback: string,
  allowedProtocols: readonly string[] = ['http:', 'https:']
): string => {
  const value = requiredEnv(name, fallback);

  try {
    const url = new URL(value);

    if (!allowedProtocols.includes(url.protocol)) {
      throw new Error('unsupported protocol');
    }

    return value;
  } catch {
    throw new Error(`Environment variable ${name} must be a valid URL.`);
  }
};

export const config = {
  port: positiveIntEnv('PORT', 18082),
  publicBaseUrl: urlEnv('PUBLIC_BASE_URL', 'http://localhost:18082'),
  frontendOrigin: urlEnv('FRONTEND_ORIGIN', 'http://localhost:5173'),
  backendApiBaseUrl: urlEnv('BACKEND_API_BASE_URL', 'http://localhost:18080/api'),
  toolboxApiBaseUrl: urlEnv('TOOLBOX_API_BASE_URL', 'http://host.docker.internal:18083/api'),
  arcadeApiBaseUrl: urlEnv('ARCADE_API_BASE_URL', 'http://host.docker.internal:18085/api'),
  authBaseUrl: urlEnv('AUTH_BASE_URL', 'http://localhost:18081'),
  authPublicBaseUrl: urlEnv('AUTH_PUBLIC_BASE_URL', 'http://localhost:18081'),
  arcadeAuthBaseUrl: urlEnv('ARCADE_AUTH_BASE_URL', 'http://host.docker.internal:18084'),
  authClientId: requiredEnv('AUTH_CLIENT_ID', 'matsu-bff'),
  authClientSecret: requiredEnv('AUTH_CLIENT_SECRET', 'matsu-bff-dev-secret'),
  authScope: requiredEnv('AUTH_SCOPE', 'matsu-api'),
  redisUrl: urlEnv('REDIS_URL', 'redis://localhost:16379', ['redis:']),
  sessionCookieName: requiredEnv('SESSION_COOKIE_NAME', 'matsu-session'),
  sessionTtlSeconds: positiveIntEnv('SESSION_TTL_SECONDS', 60 * 60 * 24 * 30),
  authorizationFlowTtlSeconds: positiveIntEnv('AUTHORIZATION_FLOW_TTL_SECONDS', 10 * 60),
  upstreamTimeoutMilliseconds: positiveIntEnv('UPSTREAM_TIMEOUT_MILLISECONDS', 5000),
  cookieSecure: boolEnv('COOKIE_SECURE', process.env.NODE_ENV === 'production'),
} as const;
