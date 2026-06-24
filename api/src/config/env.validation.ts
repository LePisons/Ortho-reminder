/**
 * Fail-fast validation of required environment variables. Called at startup so
 * a misconfigured deployment crashes immediately with a clear message instead
 * of failing later in subtle ways (e.g. a missing JWT secret silently breaking
 * auth, or missing R2 creds breaking image uploads at runtime).
 */
const REQUIRED_VARS = [
  'DATABASE_URL',
  'JWT_SECRET',
  'R2_ACCOUNT_ID',
  'R2_ACCESS_KEY_ID',
  'R2_SECRET_ACCESS_KEY',
  'R2_BUCKET_NAME',
];

// Recommended for full functionality; missing ones only disable a feature, so
// we warn rather than crash.
const RECOMMENDED_VARS = [
  'ALLOWED_ORIGINS',
  'WHATSAPP_TOKEN',
  'WHATSAPP_PHONE_ID',
  'WHATSAPP_VERIFY_TOKEN',
  'RESEND_API_KEY',
];

export function validateEnv(): void {
  const missing = REQUIRED_VARS.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}. ` +
        `Set them before starting the API (see api/.env.example).`,
    );
  }

  if (process.env.JWT_SECRET && process.env.JWT_SECRET.length < 32) {
    throw new Error(
      'JWT_SECRET is too short; use at least 32 characters of high-entropy randomness.',
    );
  }

  if (process.env.NODE_ENV === 'production' && !process.env.ALLOWED_ORIGINS) {
    throw new Error(
      'ALLOWED_ORIGINS must be set in production so CORS is not wide open.',
    );
  }

  const missingRecommended = RECOMMENDED_VARS.filter((key) => !process.env[key]);
  if (missingRecommended.length > 0) {
    // eslint-disable-next-line no-console
    console.warn(
      `[env] Optional variables not set (related features disabled): ${missingRecommended.join(', ')}`,
    );
  }
}
