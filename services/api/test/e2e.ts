/**
 * End-to-end check of the MVP vertical slice against a running API:
 * register → wallet → upload → submit → issuer approves → signed credential →
 * presentation → verifier sees VALID, plus replay, revocation and access checks.
 *
 *   pnpm dev            # in one terminal
 *   pnpm test:e2e       # in another
 */
import 'dotenv/config';
import assert from 'node:assert/strict';
import { generateKeyPairSync, sign } from 'node:crypto';

const BASE = process.env.API_URL ?? `http://localhost:${process.env.PORT ?? 4000}`;
// 1x1 transparent PNG
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');

async function call(method: string, path: string, opts: { token?: string; body?: unknown; form?: FormData } = {}) {
  const headers: Record<string, string> = {};
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`;
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: opts.form ?? (opts.body === undefined ? undefined : JSON.stringify(opts.body)),
  });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null };
}

function step(name: string) {
  console.log(`✓ ${name}`);
}

async function main() {
  const email = `holder-${Date.now()}@example.com`;
  const password = 'correct-horse-battery';

  // Holder registers and creates a wallet with a device-generated key
  const registered = await call('POST', '/auth/register', { body: { identifier: email, password } });
  assert.equal(registered.status, 201, JSON.stringify(registered.body));
  const holder = registered.body.accessToken as string;
  assert.equal((await call('POST', '/auth/register', { body: { identifier: email, password } })).status, 409);
  assert.equal((await call('POST', '/auth/login', { body: { identifier: email, password: 'wrong-password' } })).status, 401);
  step('register, duplicate rejected, wrong password rejected');

  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  const publicKeyB64 = publicKey.export({ format: 'jwk' }).x!;
  const wallet = await call('POST', '/wallet', { token: holder, body: { publicKey: publicKeyB64 } });
  assert.equal(wallet.status, 201, JSON.stringify(wallet.body));
  step('wallet created');

  // Upload: content sniffing rejects non-image/PDF files
  const upload = (file: Buffer, name: string) => {
    const form = new FormData();
    form.set('file', new Blob([file]), name);
    form.set('type', 'NATIONAL_ID');
    form.set('documentNumber', '123456789');
    form.set('name', 'John Doe');
    return call('POST', '/documents', { token: holder, form });
  };
  assert.equal((await upload(Buffer.from('not an image'), 'evil.png')).status, 400);
  const document = await upload(PNG, 'id.png');
  assert.equal(document.status, 201, JSON.stringify(document.body));
  const documentId = document.body.id as string;
  step('document uploaded, disguised file rejected');

  const submitted = await call('POST', `/documents/${documentId}/verification`, { token: holder, body: {} });
  assert.equal(submitted.status, 201, JSON.stringify(submitted.body));
  assert.equal((await call('POST', `/documents/${documentId}/verification`, { token: holder, body: {} })).status, 409);
  step('submitted for verification, double submit rejected');

  // Access control
  assert.equal((await call('GET', '/issuer/verification-requests', { token: holder })).status, 403);
  assert.equal((await call('GET', '/documents')).status, 401);
  step('holder cannot reach issuer routes, anonymous cannot reach documents');

  // Issuer reviews and approves
  const issuerLogin = await call('POST', '/auth/login', {
    body: { identifier: process.env.SEED_ISSUER_EMAIL, password: process.env.SEED_ISSUER_PASSWORD },
  });
  assert.equal(issuerLogin.status, 200, JSON.stringify(issuerLogin.body));
  const issuer = issuerLogin.body.accessToken as string;
  const pending = await call('GET', '/issuer/verification-requests?status=PENDING', { token: issuer });
  const request = pending.body.find((r: any) => r.document.id === documentId);
  assert.ok(request, 'issuer sees the pending request');
  const file = await fetch(`${BASE}/documents/${documentId}/file`, { headers: { Authorization: `Bearer ${issuer}` } });
  assert.equal(file.status, 200);
  assert.equal(file.headers.get('content-type'), 'image/png');
  const approved = await call('POST', `/issuer/verification-requests/${request.id}/approve`, { token: issuer, body: {} });
  assert.equal(approved.status, 200, JSON.stringify(approved.body));
  assert.equal((await call('POST', `/issuer/verification-requests/${request.id}/approve`, { token: issuer, body: {} })).status, 409);
  step('issuer sees request and scan, approves once');

  // Wallet receives the signed credential
  const creds = await call('GET', '/wallet/credentials', { token: holder });
  const credential = creds.body.find((c: any) => c.documentId === documentId);
  assert.equal(credential.status, 'ACTIVE');
  assert.equal(credential.type, 'NationalIDCredential');
  assert.equal(credential.jws.split('.').length, 3);
  step('wallet holds an ACTIVE signed credential');

  // Presentation needs a proof signed by the wallet key
  const present = (key = privateKey) => {
    const timestamp = Date.now();
    const signature = sign(null, Buffer.from(`present:${credential.id}:${timestamp}`), key).toString('base64url');
    return call('POST', '/presentations', { token: holder, body: { credentialId: credential.id, timestamp, signature } });
  };
  assert.equal((await present(generateKeyPairSync('ed25519').privateKey)).status, 403);
  const presentation = await present();
  assert.equal(presentation.status, 201, JSON.stringify(presentation.body));
  const token = presentation.body.token as string;
  assert.equal((await call('GET', `/presentations/${token}`)).body.status, 'PENDING');
  step('presentation created, foreign key rejected');

  const verified = await call('POST', `/presentations/${token}/verify`);
  assert.equal(verified.body.valid, true, JSON.stringify(verified.body));
  assert.deepEqual(verified.body.checks.map((c: any) => c.name), ['signature', 'issuer', 'expiration', 'revocation', 'presentation']);
  assert.equal(verified.body.credential.name, 'John Doe');
  assert.equal(verified.body.credential.documentNumber, undefined, 'document number is not disclosed');
  assert.equal((await call('GET', `/presentations/${token}`)).body.result, 'VALID');
  step('verifier sees VALID with minimal disclosure');

  const replay = await call('POST', `/presentations/${token}/verify`);
  assert.equal(replay.body.valid, false);
  assert.equal(replay.body.credential, undefined);
  step('replayed token is rejected');

  // Revocation takes effect on the next verification
  assert.equal((await call('POST', `/credentials/${credential.id}/revoke`, { token: holder })).status, 403);
  assert.equal((await call('POST', `/credentials/${credential.id}/revoke`, { token: issuer })).body.status, 'REVOKED');
  const second = await present();
  const afterRevoke = await call('POST', `/presentations/${second.body.token}/verify`);
  assert.equal(afterRevoke.body.valid, false);
  assert.equal(afterRevoke.body.reason, 'Credential has been revoked.');
  step('revoked credential verifies as INVALID');

  // Refresh token rotation
  const refreshed = await call('POST', '/auth/refresh', { body: { refreshToken: registered.body.refreshToken } });
  assert.equal(refreshed.status, 200);
  assert.equal((await call('POST', '/auth/refresh', { body: { refreshToken: registered.body.refreshToken } })).status, 401);
  assert.equal((await call('POST', '/auth/refresh', { body: { refreshToken: refreshed.body.refreshToken } })).status, 401);
  step('refresh rotates, reuse revokes the session family');

  const audit = await call('GET', '/issuer/audit-logs', { token: issuer });
  assert.ok(audit.body.some((entry: any) => entry.action === 'credential.revoked' && entry.resourceId === credential.id));
  step('audit log records issuer actions');

  console.log('\nAll end-to-end checks passed.');
}

main().catch((error) => {
  console.error('\n✗ FAILED:', error.message ?? error);
  process.exit(1);
});
