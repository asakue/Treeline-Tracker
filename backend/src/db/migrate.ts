/**
 * @fileoverview Automatic Schema Migration & Bootstrap
 * Ensures schema is applied upon container start if database is uninitialized.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import postgres from 'postgres';
import { seedDatabase } from './seed.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function runAutoMigrations(client: postgres.Sql) {
  try {
    console.log('[Database] Checking schema initialization...');

    // Verify if core users table exists
    const [existingTable] = await client`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'users';
    `;

    if (!existingTable) {
      console.log('[Database] Core tables not found. Applying schema.sql...');

      const candidatePaths = [
        path.resolve(__dirname, '../../schema.sql'),
        path.resolve(__dirname, '../schema.sql'),
        path.resolve(__dirname, 'schema.sql'),
        path.resolve(process.cwd(), 'schema.sql'),
        path.resolve(process.cwd(), 'backend/schema.sql'),
      ];

      let schemaSql = '';
      let usedPath = '';
      for (const p of candidatePaths) {
        if (fs.existsSync(p)) {
          schemaSql = fs.readFileSync(p, 'utf-8');
          usedPath = p;
          break;
        }
      }

      if (schemaSql) {
        console.log(`[Database] Executing schema DDL from ${usedPath}...`);
        await client.unsafe(schemaSql);
        console.log('[Database] Schema DDL executed successfully.');

        // Optionally seed if requested or by default on first install
        if (process.env.SEED_DATABASE !== 'false') {
          console.log('[Database] Running initial database seed...');
          await seedDatabase();
          console.log('[Database] Initial seeding finished.');
        }
      } else {
        console.warn('[Database] Warning: Could not locate schema.sql in candidate paths; skipping auto-migration.');
      }
    } else {
      console.log('[Database] Schema already verified (users table present).');
    }
  } catch (err) {
    console.error('[Database] Migration check failed:', err);
    // Do not throw fatal error if already exists or non-critical error
  }
}

