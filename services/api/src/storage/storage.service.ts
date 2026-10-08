import { BadRequestException, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { createReadStream, ReadStream } from 'node:fs';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { config } from '../config';

const SIGNATURES: { mime: string; ext: string; magic: number[] }[] = [
  { mime: 'image/jpeg', ext: 'jpg', magic: [0xff, 0xd8, 0xff] },
  { mime: 'image/png', ext: 'png', magic: [0x89, 0x50, 0x4e, 0x47] },
  { mime: 'application/pdf', ext: 'pdf', magic: [0x25, 0x50, 0x44, 0x46] },
];

/**
 * Private document storage. MVP driver writes to local disk; the `local://` key
 * scheme leaves room for an S3-compatible driver without touching callers.
 */
@Injectable()
export class StorageService {
  /** Detects the type from file content; the client-supplied MIME type is never trusted. */
  detectType(buffer: Buffer): { mime: string; ext: string } {
    const match = SIGNATURES.find((s) => s.magic.every((byte, i) => buffer[i] === byte));
    if (!match) throw new BadRequestException('File must be a JPEG, PNG or PDF');
    return match;
  }

  async save(buffer: Buffer, ext: string): Promise<string> {
    await mkdir(config.storageDir, { recursive: true });
    const key = `${randomUUID()}.${ext}`;
    await writeFile(join(config.storageDir, key), buffer, { mode: 0o600 });
    return `local://${key}`;
  }

  open(fileUrl: string): ReadStream {
    return createReadStream(this.path(fileUrl));
  }

  async remove(fileUrl: string): Promise<void> {
    await rm(this.path(fileUrl), { force: true });
  }

  private path(fileUrl: string): string {
    const key = fileUrl.replace(/^local:\/\//, '');
    if (!/^[0-9a-f-]+\.(jpg|png|pdf)$/.test(key)) throw new BadRequestException('Invalid file key');
    return join(config.storageDir, key);
  }
}
