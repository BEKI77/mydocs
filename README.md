# Digital Document Wallet

MVP of the plan in `../mydoc/PAYMENT_VERIFICATION_DOCUMENT.md`: a holder scans a document, an issuer
verifies it and signs a credential, and a verifier confirms it from a short-lived QR code.

```
apps/wallet      Tauri 2 + React mobile wallet (holder)
apps/issuer      React backoffice for issuers, plus the public verifier page at /v/:token
services/api     NestJS + Drizzle + PostgreSQL backend
packages/types   Types shared by the three apps
```

UI mocks: `../mydoc/ui-mock/`.

## Run it

Requires Node 22, pnpm, Rust 1.89+, and Podman or Docker.

```bash
pnpm install
pnpm db:up                                   # Postgres on :5433 (or: docker compose -f infrastructure/docker/docker-compose.yml up -d)
cp services/api/.env.example services/api/.env   # then set JWT_SECRET and SEED_ISSUER_PASSWORD
pnpm db:migrate && pnpm db:seed              # creates the mock issuer "Government Authority" and its signing key

pnpm dev:api                                 # http://localhost:4000
pnpm dev:issuer                              # http://localhost:5174  (sign in with SEED_ISSUER_EMAIL / SEED_ISSUER_PASSWORD)
pnpm dev:wallet                              # http://localhost:1420  (browser preview of the wallet UI)
```

Wallet as an app:

```bash
cd apps/wallet
pnpm tauri dev                               # desktop window
pnpm tauri android init && pnpm tauri android dev   # Android (needs ANDROID_HOME and NDK_HOME)
```

On a physical Android device run `adb reverse tcp:4000 tcp:4000` so the app reaches the API on
`localhost`. To use another host, set `VITE_API_URL` and add it to `connect-src` in
`apps/wallet/src-tauri/tauri.conf.json`, and set `VERIFY_BASE_URL` so the QR link is reachable
from the verifier's phone.

## Tests

```bash
pnpm --filter @dw/api test:e2e               # full slice against a running API
cd apps/wallet/src-tauri && cargo test --lib # key encryption
```

## How the security requirements are met

- **Holder key**: Ed25519 pair generated in Rust on the device. The private key is sealed with a
  key derived from the password (Argon2id + XChaCha20-Poly1305) and never crosses into JavaScript
  or to the server. Creating a presentation requires a signature from it.
- **Issuer key**: Ed25519, kept as a file in `ISSUER_KEYS_DIR`, outside the database. Move to KMS/HSM
  for production.
- **Credential**: VC-JWT style payload signed as a compact JWS (`jose`). Verification re-checks the
  signature and its claims against the issuer's registered public key.
- **Presentation**: the QR holds only an opaque 256-bit token. Sessions last 120 s, are stored
  hashed, and are single-use. Validity is always decided by the server.
- **Verifier sees**: name, document type, issuer, validity, issue and expiry dates. Never the scan
  or the document number.
- **Uploads**: type detected from file content (JPEG, PNG, PDF), 10 MB limit, stored privately and
  streamed only to the owner or the reviewing issuer.
- **Sessions**: 15-minute access tokens, rotating refresh tokens with reuse detection, rate limits
  on auth and verification, audit log of holder, issuer and verifier actions.

## Not built yet

- Object storage is local disk behind `StorageService`; an S3-compatible driver is the next step.
- Crop in the scanner (rotate is implemented). Scanning uses the system camera through the file
  picker rather than an in-app camera view.
- The verifier page is opened by scanning the QR with the phone camera, or by pasting the link;
  there is no in-page QR scanner.
- The wallet learns about issuer decisions by polling every 5 s, not by push.
- On-device key storage uses a password-derived key, not the platform keystore or biometrics.
- The Android build has not been run; only the desktop build of the Rust code is compiled and tested.
- HTTPS termination, device recovery, and multiple issuers per document type.

The Tauri crates are pinned to the 2.8 line in `Cargo.lock` because newer releases need Rust 1.90.
