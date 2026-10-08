//! Thin wrappers over audited crates. No cryptography is implemented here.

use argon2::Argon2;
use chacha20poly1305::aead::{Aead, KeyInit};
use chacha20poly1305::{XChaCha20Poly1305, XNonce};
use rand::rngs::OsRng;
use rand::RngCore;
use zeroize::Zeroizing;

pub const SALT_LEN: usize = 16;
const NONCE_LEN: usize = 24;

pub fn random_bytes<const N: usize>() -> [u8; N] {
    let mut bytes = [0u8; N];
    OsRng.fill_bytes(&mut bytes);
    bytes
}

/// Derives the key that wraps the wallet's private key from the user's password (Argon2id).
pub fn derive_key(password: &str, salt: &[u8]) -> Result<Zeroizing<[u8; 32]>, String> {
    let mut key = Zeroizing::new([0u8; 32]);
    Argon2::default()
        .hash_password_into(password.as_bytes(), salt, key.as_mut())
        .map_err(|e| e.to_string())?;
    Ok(key)
}

/// Returns `nonce || ciphertext`.
pub fn encrypt(key: &[u8; 32], plaintext: &[u8]) -> Result<Vec<u8>, String> {
    let nonce = random_bytes::<NONCE_LEN>();
    let ciphertext = XChaCha20Poly1305::new(key.into())
        .encrypt(XNonce::from_slice(&nonce), plaintext)
        .map_err(|_| "Encryption failed".to_string())?;
    Ok([nonce.as_slice(), &ciphertext].concat())
}

/// Fails when the key is wrong or the data was tampered with.
pub fn decrypt(key: &[u8; 32], sealed: &[u8]) -> Result<Zeroizing<Vec<u8>>, String> {
    if sealed.len() < NONCE_LEN {
        return Err("Stored data is corrupted".into());
    }
    let (nonce, ciphertext) = sealed.split_at(NONCE_LEN);
    XChaCha20Poly1305::new(key.into())
        .decrypt(XNonce::from_slice(nonce), ciphertext)
        .map(Zeroizing::new)
        .map_err(|_| "Incorrect password".to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn round_trips_with_the_right_password() {
        let salt = random_bytes::<SALT_LEN>();
        let key = derive_key("correct horse", &salt).unwrap();
        let sealed = encrypt(&key, b"private key bytes").unwrap();
        assert_eq!(decrypt(&key, &sealed).unwrap().as_slice(), b"private key bytes");
    }

    #[test]
    fn rejects_wrong_password_and_tampering() {
        let salt = random_bytes::<SALT_LEN>();
        let key = derive_key("correct horse", &salt).unwrap();
        let mut sealed = encrypt(&key, b"private key bytes").unwrap();

        let wrong = derive_key("wrong horse", &salt).unwrap();
        assert!(decrypt(&wrong, &sealed).is_err());

        let last = sealed.len() - 1;
        sealed[last] ^= 1;
        assert!(decrypt(&key, &sealed).is_err());
        assert!(decrypt(&key, &[0u8; 4]).is_err());
    }
}
