//! The wallet's Ed25519 key pair. The private key is generated on this device,
//! stored only in encrypted form, and never crosses the IPC boundary.

use crate::{crypto, storage};
use base64::engine::general_purpose::{STANDARD, URL_SAFE_NO_PAD};
use base64::Engine;
use ed25519_dalek::{Signer, SigningKey};
use rand::rngs::OsRng;
use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use tauri::{AppHandle, State};
use zeroize::Zeroizing;

#[derive(Serialize, Deserialize)]
struct KeyFile {
    version: u8,
    salt: String,
    sealed_key: String,
    public_key: String,
}

struct Unlocked {
    account: String,
    signing_key: SigningKey,
    vault_key: Zeroizing<[u8; 32]>,
}

#[derive(Default)]
pub struct WalletState(Mutex<Option<Unlocked>>);

/// Accounts are server-issued UUIDs; rejecting anything else keeps the value safe in a file name.
fn file_name(account: &str, kind: &str) -> Result<String, String> {
    if account.is_empty() || !account.chars().all(|c| c.is_ascii_hexdigit() || c == '-') {
        return Err("Invalid account".into());
    }
    Ok(format!("{kind}-{account}"))
}

fn public_key_b64(key: &SigningKey) -> String {
    URL_SAFE_NO_PAD.encode(key.verifying_key().as_bytes())
}

#[tauri::command]
pub fn wallet_exists(app: AppHandle, account: String) -> Result<bool, String> {
    Ok(storage::read(&app, &file_name(&account, "wallet")?)?.is_some())
}

/// Generates a new key pair, seals the private key with the password, and unlocks the wallet.
#[tauri::command]
pub fn wallet_create(
    app: AppHandle,
    state: State<WalletState>,
    account: String,
    password: String,
) -> Result<String, String> {
    let salt = crypto::random_bytes::<{ crypto::SALT_LEN }>();
    let vault_key = crypto::derive_key(&password, &salt)?;
    let signing_key = SigningKey::generate(&mut OsRng);
    let public_key = public_key_b64(&signing_key);
    let key_file = KeyFile {
        version: 1,
        salt: STANDARD.encode(salt),
        sealed_key: STANDARD.encode(crypto::encrypt(&vault_key, signing_key.as_bytes())?),
        public_key: public_key.clone(),
    };
    let bytes = serde_json::to_vec(&key_file).map_err(|e| e.to_string())?;
    storage::write(&app, &file_name(&account, "wallet")?, &bytes)?;
    *state.0.lock().unwrap() = Some(Unlocked { account, signing_key, vault_key });
    Ok(public_key)
}

#[tauri::command]
pub fn wallet_unlock(
    app: AppHandle,
    state: State<WalletState>,
    account: String,
    password: String,
) -> Result<String, String> {
    let bytes = storage::read(&app, &file_name(&account, "wallet")?)?.ok_or("No wallet on this device")?;
    let key_file: KeyFile = serde_json::from_slice(&bytes).map_err(|_| "Stored data is corrupted")?;
    let salt = STANDARD.decode(&key_file.salt).map_err(|_| "Stored data is corrupted")?;
    let sealed = STANDARD.decode(&key_file.sealed_key).map_err(|_| "Stored data is corrupted")?;
    let vault_key = crypto::derive_key(&password, &salt)?;
    let secret = crypto::decrypt(&vault_key, &sealed)?;
    let secret: &[u8; 32] = secret.as_slice().try_into().map_err(|_| "Stored data is corrupted")?;
    let signing_key = SigningKey::from_bytes(secret);
    let public_key = public_key_b64(&signing_key);
    *state.0.lock().unwrap() = Some(Unlocked { account, signing_key, vault_key });
    Ok(public_key)
}

#[tauri::command]
pub fn wallet_lock(state: State<WalletState>) {
    *state.0.lock().unwrap() = None;
}

/// Signs a message with the unlocked key. Returns a base64url signature.
#[tauri::command]
pub fn wallet_sign(state: State<WalletState>, message: String) -> Result<String, String> {
    let guard = state.0.lock().unwrap();
    let unlocked = guard.as_ref().ok_or("Wallet is locked")?;
    Ok(URL_SAFE_NO_PAD.encode(unlocked.signing_key.sign(message.as_bytes()).to_bytes()))
}

/// Encrypted local cache (credentials for offline viewing), keyed per account.
#[tauri::command]
pub fn vault_save(app: AppHandle, state: State<WalletState>, data: String) -> Result<(), String> {
    let guard = state.0.lock().unwrap();
    let unlocked = guard.as_ref().ok_or("Wallet is locked")?;
    let sealed = crypto::encrypt(&unlocked.vault_key, data.as_bytes())?;
    storage::write(&app, &file_name(&unlocked.account, "vault")?, &sealed)
}

#[tauri::command]
pub fn vault_load(app: AppHandle, state: State<WalletState>) -> Result<Option<String>, String> {
    let guard = state.0.lock().unwrap();
    let unlocked = guard.as_ref().ok_or("Wallet is locked")?;
    let Some(sealed) = storage::read(&app, &file_name(&unlocked.account, "vault")?)? else {
        return Ok(None);
    };
    let plain = crypto::decrypt(&unlocked.vault_key, &sealed)?;
    String::from_utf8(plain.to_vec()).map(Some).map_err(|_| "Stored data is corrupted".into())
}
