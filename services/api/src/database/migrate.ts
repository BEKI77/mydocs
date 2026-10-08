import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { join } from 'node:path';
import { createDb } from './db';

/** Applies pending migrations. Run on container start, before the API boots. */
async function main() {
  const { db, pool } = createDb();
  await migrate(db, { migrationsFolder: join(__dirname, '../../drizzle') });
  await pool.end();
  console.log('Migrations applied');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
