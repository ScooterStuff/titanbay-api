import { z } from 'zod';

/**
 * Environment configuration, validated once at boot.
 * We fail fast and loudly if DATABASE_URL is missing — there is no safe default
 * for a database connection in a financial system.
 */
const envSchema = z.object({
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  PORT: z.coerce.number().int().positive().default(3000),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
});

export type AppConfig = z.infer<typeof envSchema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = envSchema.safeParse(env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    // Crash loudly — do not start with an invalid configuration.
    throw new Error(`Invalid environment configuration: ${issues}`);
  }
  return parsed.data;
}
