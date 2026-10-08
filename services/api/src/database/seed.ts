import { hash } from '@node-rs/argon2';
import { eq } from 'drizzle-orm';
import { IssuerKeysService } from '../issuers/issuer-keys.service';
import { createDb } from './db';
import { issuers, users } from './schema';

/** Seeds the mock issuer ("Government Authority") and one staff account. Safe to re-run. */
async function seed() {
  const email = process.env.SEED_ISSUER_EMAIL;
  const password = process.env.SEED_ISSUER_PASSWORD;
  if (!email || !password) throw new Error('Set SEED_ISSUER_EMAIL and SEED_ISSUER_PASSWORD');

  const { db, pool } = createDb();
  const identifier = 'government';
  let [issuer] = await db.select().from(issuers).where(eq(issuers.identifier, identifier));
  if (!issuer) {
    const publicJwk = await new IssuerKeysService().generate(identifier);
    [issuer] = await db
      .insert(issuers)
      .values({ name: 'Government Authority', type: 'government', identifier, publicKey: JSON.stringify(publicJwk) })
      .returning();
    console.log(`Created issuer "${issuer.name}" and its signing key`);
  }

  const [existing] = await db.select().from(users).where(eq(users.email, email));
  if (!existing) {
    await db.insert(users).values({ email, passwordHash: await hash(password), role: 'issuer', issuerId: issuer.id });
    console.log(`Created issuer account ${email}`);
  }
  await pool.end();
}

seed().catch((error) => {
  console.error(error);
  process.exit(1);
});
