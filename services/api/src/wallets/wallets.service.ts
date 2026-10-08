import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { AuditService } from '../audit/audit.service';
import { DB, Db } from '../database/db';
import { wallets } from '../database/schema';

export type Wallet = typeof wallets.$inferSelect;

@Injectable()
export class WalletsService {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly audit: AuditService,
  ) {}

  async find(userId: string): Promise<Wallet | undefined> {
    const [wallet] = await this.db.select().from(wallets).where(eq(wallets.userId, userId));
    return wallet;
  }

  async require(userId: string): Promise<Wallet> {
    const wallet = await this.find(userId);
    if (!wallet) throw new NotFoundException('Wallet has not been created yet');
    return wallet;
  }

  /**
   * Registers the device-generated public key. Signing in on a new device
   * re-registers the key: the private key never leaves the old device, so
   * there is nothing to migrate.
   */
  async register(userId: string, publicKey: string): Promise<Wallet> {
    const existing = await this.find(userId);
    if (existing?.publicKey === publicKey) return existing;
    const [wallet] = existing
      ? await this.db.update(wallets).set({ publicKey }).where(eq(wallets.id, existing.id)).returning()
      : await this.db.insert(wallets).values({ userId, publicKey }).returning();
    await this.audit.log({
      actorId: userId,
      actorType: 'holder',
      action: existing ? 'wallet.key_rotated' : 'wallet.created',
      resourceType: 'wallet',
      resourceId: wallet.id,
    });
    return wallet;
  }
}
