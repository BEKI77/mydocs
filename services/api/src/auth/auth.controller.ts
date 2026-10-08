import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { z } from 'zod';
import { Public } from '../common/auth';
import { ZodPipe } from '../common/zod.pipe';
import { AuthService } from './auth.service';

const credentialsSchema = z.object({
  identifier: z.string().trim().min(3).max(254),
  password: z.string().min(8).max(128),
});
const refreshSchema = z.object({ refreshToken: z.string().min(20).max(200) });

@Public()
@Throttle({ default: { limit: 10, ttl: 60_000 } })
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('register')
  register(@Body(new ZodPipe(credentialsSchema)) body: z.infer<typeof credentialsSchema>) {
    return this.auth.register(body.identifier, body.password);
  }

  @Post('login')
  @HttpCode(200)
  login(@Body(new ZodPipe(credentialsSchema)) body: z.infer<typeof credentialsSchema>) {
    return this.auth.login(body.identifier, body.password);
  }

  @Post('refresh')
  @HttpCode(200)
  refresh(@Body(new ZodPipe(refreshSchema)) body: z.infer<typeof refreshSchema>) {
    return this.auth.refresh(body.refreshToken);
  }

  @Post('logout')
  @HttpCode(204)
  async logout(@Body(new ZodPipe(refreshSchema)) body: z.infer<typeof refreshSchema>) {
    await this.auth.logout(body.refreshToken);
  }
}
