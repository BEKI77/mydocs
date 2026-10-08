import { Body, Controller, Get, Post } from '@nestjs/common';
import { z } from 'zod';
import { AuthUser, CurrentUser, Roles } from '../common/auth';
import { ZodPipe } from '../common/zod.pipe';
import { CredentialsService } from '../credentials/credentials.service';
import { WalletsService } from './wallets.service';

// 32-byte Ed25519 public key, base64url without padding
const createSchema = z.object({ publicKey: z.string().regex(/^[A-Za-z0-9_-]{43}$/) });

@Roles('holder')
@Controller('wallet')
export class WalletsController {
  constructor(
    private readonly walletsService: WalletsService,
    private readonly credentials: CredentialsService,
  ) {}

  @Post()
  create(@CurrentUser() user: AuthUser, @Body(new ZodPipe(createSchema)) body: z.infer<typeof createSchema>) {
    return this.walletsService.register(user.id, body.publicKey);
  }

  @Get()
  get(@CurrentUser() user: AuthUser) {
    return this.walletsService.require(user.id);
  }

  @Get('credentials')
  async listCredentials(@CurrentUser() user: AuthUser) {
    const wallet = await this.walletsService.require(user.id);
    return this.credentials.listForHolder(wallet.id);
  }
}
