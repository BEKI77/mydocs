import { Inject, Injectable } from '@nestjs/common';
import { DB, Db } from '../database/db';
import { auditLogs } from '../database/schema';

export interface AuditEntry {
  actorId?: string | null;
  actorType: 'holder' | 'issuer' | 'verifier' | 'system';
  action: string;
  resourceType: string;
  resourceId?: string | null;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class AuditService {
  constructor(@Inject(DB) private readonly db: Db) {}

  async log(entry: AuditEntry, tx: Pick<Db, 'insert'> = this.db): Promise<void> {
    await tx.insert(auditLogs).values(entry);
  }
}
