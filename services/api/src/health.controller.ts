import { Controller, Get, Inject } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { sql } from 'drizzle-orm';
import { Public } from './common/auth';
import { DB, Db } from './database/db';

@Public()
@SkipThrottle()
@Controller('health')
export class HealthController {
  constructor(@Inject(DB) private readonly db: Db) {}

  /** Used by container health checks; fails when the database is unreachable. */
  @Get()
  async check() {
    await this.db.execute(sql`select 1`);
    return { status: 'ok' };
  }
}
