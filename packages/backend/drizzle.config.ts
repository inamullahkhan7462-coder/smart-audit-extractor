import { defineConfig } from 'drizzle-kit';
import * as dotenv from 'dotenv';

// This line reads the variables out of your safe .env file automatically
dotenv.config();

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  driver: 'pg',
  dbCredentials: {
    connectionString: process.env.DATABASE_URL!, // Safe and hidden!
  },
  verbose: true,
  strict: true,
});