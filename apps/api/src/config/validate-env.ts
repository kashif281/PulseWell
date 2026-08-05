const PRODUCTION_SECRETS = [
  'JWT_SECRET',
  'JWT_REFRESH_SECRET',
  'DATA_ENCRYPTION_KEY',
  'EMAIL_WEBHOOK_SECRET',
] as const;

export function validateEnvironment(config: Record<string, unknown>) {
  if (config.NODE_ENV !== 'production') return config;

  const missing = ['DATABASE_URL', 'FRONTEND_URL', ...PRODUCTION_SECRETS].filter(
    (name) => typeof config[name] !== 'string' || !(config[name] as string).trim(),
  );
  if (missing.length) {
    throw new Error(`Missing required production environment variables: ${missing.join(', ')}`);
  }

  for (const name of ['JWT_SECRET', 'JWT_REFRESH_SECRET'] as const) {
    if ((config[name] as string).length < 32) {
      throw new Error(`${name} must be at least 32 characters in production`);
    }
  }

  return config;
}
