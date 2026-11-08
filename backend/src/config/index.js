
import dotenv from 'dotenv';
import { z } from 'zod';

// Load .env locally. Render supplies its own environment variables.
dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

  // Render provides PORT automatically.
  PORT: z.coerce.number().default(5000),

  // Render must be able to access the server externally.
  HOST: z.string().default('0.0.0.0'),

  CORS_ORIGIN: z.string().default('http://localhost:5173'),

  DATABASE_URL: z.string().url().default(
    'postgresql://postgres:postgres@localhost:5432/aotuc_transport?schema=public'
  ),

  JWT_ACCESS_SECRET: z.string().min(16).default('development_jwt_access_secret_key_32chars_min!'),
  JWT_REFRESH_SECRET: z.string().min(16).default('development_jwt_refresh_secret_key_32chars_min!'),
  JWT_ACCESS_EXPIRATION: z.string().default('15m'),
  JWT_REFRESH_EXPIRATION: z.string().default('7d'),

  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(900000),
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().default(100),

  LOG_LEVEL: z.string().default('debug'),
  UPLOAD_DIR: z.string().default('./uploads'),
  MAX_FILE_SIZE_BYTES: z.coerce.number().default(5242880),

  SMS_PROVIDER: z.enum(['mock', 'orange', 'mtn']).default('mock'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Configuration error: Invalid environment variables:');
  console.error(parsed.error.format());
  process.exit(1);
}

export const config = parsed.data;

// Ensure process.env.DATABASE_URL is set for Prisma Client
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = config.DATABASE_URL;
}

export default config;
