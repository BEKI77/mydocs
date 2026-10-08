import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { exportJWK, generateKeyPair, importJWK, JWK, KeyLike } from 'jose';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { config } from '../config';

export const SIGNING_ALG = 'EdDSA';

/**
 * Issuer signing keys. MVP keeps private keys as files in a server-side
 * directory outside the database; production should move this behind KMS/HSM.
 */
@Injectable()
export class IssuerKeysService {
  /** Creates a new Ed25519 key pair, stores the private half, returns the public JWK. */
  async generate(issuerIdentifier: string): Promise<JWK> {
    const { publicKey, privateKey } = await generateKeyPair(SIGNING_ALG, { extractable: true });
    await mkdir(config.issuerKeysDir, { recursive: true, mode: 0o700 });
    await writeFile(this.path(issuerIdentifier), JSON.stringify(await exportJWK(privateKey)), {
      mode: 0o600,
    });
    return exportJWK(publicKey);
  }

  async privateKey(issuerIdentifier: string): Promise<KeyLike> {
    try {
      const jwk = JSON.parse(await readFile(this.path(issuerIdentifier), 'utf8'));
      return (await importJWK(jwk, SIGNING_ALG)) as KeyLike;
    } catch {
      throw new InternalServerErrorException('Issuer signing key is not available');
    }
  }

  async publicKey(publicJwk: string): Promise<KeyLike> {
    return (await importJWK(JSON.parse(publicJwk), SIGNING_ALG)) as KeyLike;
  }

  private path(issuerIdentifier: string): string {
    return join(config.issuerKeysDir, `${issuerIdentifier.replace(/[^a-z0-9_-]/gi, '_')}.jwk.json`);
  }
}
