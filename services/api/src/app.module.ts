import { Module, OnApplicationShutdown } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { Pool } from 'pg';
import { AuditService } from './audit/audit.service';
import { AuthController } from './auth/auth.controller';
import { AuthService } from './auth/auth.service';
import { AuthGuard } from './common/auth';
import { config } from './config';
import { CredentialsController } from './credentials/credentials.controller';
import { CredentialsService } from './credentials/credentials.service';
import { createDb, DB } from './database/db';
import { DocumentsController } from './documents/documents.controller';
import { IssuerController } from './issuers/issuer.controller';
import { IssuerKeysService } from './issuers/issuer-keys.service';
import { PresentationsController } from './presentations/presentations.controller';
import { StorageService } from './storage/storage.service';
import { WalletsController } from './wallets/wallets.controller';
import { WalletsService } from './wallets/wallets.service';

const { db, pool } = createDb();

@Module({
  imports: [
    JwtModule.register({ secret: config.jwtSecret, signOptions: { algorithm: 'HS256' }, verifyOptions: { algorithms: ['HS256'] } }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
  ],
  controllers: [
    AuthController,
    WalletsController,
    DocumentsController,
    IssuerController,
    CredentialsController,
    PresentationsController,
  ],
  providers: [
    { provide: DB, useValue: db },
    { provide: Pool, useValue: pool },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: AuthGuard },
    AuditService,
    AuthService,
    WalletsService,
    CredentialsService,
    IssuerKeysService,
    StorageService,
  ],
})
export class AppModule implements OnApplicationShutdown {
  async onApplicationShutdown() {
    await pool.end();
  }
}
