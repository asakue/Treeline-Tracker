/**
 * @fileoverview PostgreSQL connection pool (postgres.js) and Drizzle ORM client instance
 */

import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import * as schema from './schema.js';
import * as dotenv from 'dotenv';

dotenv.config();

const connectionString = process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/treeline_db';

// postgres.js connection pool configured for high concurrency
export const queryClient = postgres(connectionString, {
  max: 20,
  idle_timeout: 30,
  connect_timeout: 10,
  onnotice: () => {},
});

export const db = drizzle(queryClient, { schema });
export type TreelineDb = typeof db;
