import { BadRequestException, ConflictException, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { hash, verify } from '@node-rs/argon2';
import { and, eq, isNull } from 'drizzle-orm';
import { createHash, randomBytes } from 'node:crypto';
import { AuditService } from '../audit/audit.service';
import { config } from '../config';
import { DB, Db } from '../database/db';
import { refreshTokens, users } from '../database/schema';

type User = typeof users.$inferSelect;

export const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');

function parseIdentifier(identifier: string): { email: string } | { phone: string } {
  const value = identifier.trim();
  if (value.includes('@')) {
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value)) throw new BadRequestException('Invalid email');
    return { email: value.toLowerCase() };
  }
  const phone = value.replace(/[\s()-]/g, '');
  if (!/^\+?[0-9]{7,15}$/.test(phone)) throw new BadRequestException('Enter a valid phone number or email');
  return { phone };
}

@Injectable()
export class AuthService {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly jwt: JwtService,
    private readonly audit: AuditService,
  ) {}

  async register(identifier: string, password: string) {
    const contact = parseIdentifier(identifier);
    if (await this.findByContact(contact)) throw new ConflictException('An account already exists for this phone or email');
    const [user] = await this.db
      .insert(users)
      .values({ ...contact, passwordHash: await hash(password) })
      .returning();
    await this.audit.log({ actorId: user.id, actorType: 'holder', action: 'user.registered', resourceType: 'user', resourceId: user.id });
    return this.session(user);
  }

  async login(identifier: string, password: string) {
    const user = await this.findByContact(parseIdentifier(identifier));
    // Same error for unknown account and wrong password, so accounts can't be enumerated.
    if (!user || user.status !== 'active' || !(await verify(user.passwordHash, password))) {
      throw new UnauthorizedException('Incorrect phone/email or password');
    }
    return this.session(user);
  }

  /** Rotates the refresh token. Reuse of an already-rotated token revokes every session. */
  async refresh(refreshToken: string) {
    const [stored] = await this.db.select().from(refreshTokens).where(eq(refreshTokens.tokenHash, sha256(refreshToken)));
    if (!stored) throw new UnauthorizedException();
    if (stored.revokedAt) {
      await this.db.update(refreshTokens).set({ revokedAt: new Date() })
        .where(and(eq(refreshTokens.userId, stored.userId), isNull(refreshTokens.revokedAt)));
      throw new UnauthorizedException();
    }
    if (stored.expiresAt < new Date()) throw new UnauthorizedException();
    await this.db.update(refreshTokens).set({ revokedAt: new Date() }).where(eq(refreshTokens.id, stored.id));
    const [user] = await this.db.select().from(users).where(eq(users.id, stored.userId));
    if (!user || user.status !== 'active') throw new UnauthorizedException();
    return this.session(user);
  }

  async logout(refreshToken: string) {
    await this.db.update(refreshTokens).set({ revokedAt: new Date() })
      .where(and(eq(refreshTokens.tokenHash, sha256(refreshToken)), isNull(refreshTokens.revokedAt)));
  }

  private async findByContact(contact: { email: string } | { phone: string }): Promise<User | undefined> {
    const where = 'email' in contact ? eq(users.email, contact.email) : eq(users.phone, contact.phone);
    const [user] = await this.db.select().from(users).where(where);
    return user;
  }

  private async session(user: User) {
    const accessToken = await this.jwt.signAsync(
      { sub: user.id, role: user.role, issuerId: user.issuerId },
      { expiresIn: config.accessTtl },
    );
    const refreshToken = randomBytes(32).toString('base64url');
    await this.db.insert(refreshTokens).values({
      userId: user.id,
      tokenHash: sha256(refreshToken),
      expiresAt: new Date(Date.now() + config.refreshTtlDays * 86_400_000),
    });
    return {
      accessToken,
      refreshToken,
      user: { id: user.id, email: user.email, phone: user.phone, role: user.role, issuerId: user.issuerId },
    };
  }
}
