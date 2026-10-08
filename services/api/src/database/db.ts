import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { config } from '../config';
import * as schema from './schema';

export const DB = Symbol('DB');
export type Db = NodePgDatabase<typeof schema>;

export function createDb(): { db: Db; pool: Pool } {
  const pool = new Pool({ connectionString: config.databaseUrl });
  return { db: drizzle(pool, { schema, casing: 'snake_case' }), pool };
}
