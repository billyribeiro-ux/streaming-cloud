//! Password hashing and verification.
//!
//! New hashes use Argon2id. Legacy Laravel bcrypt hashes (`$2y$…`) are still
//! verified so existing users can sign in; a successful legacy verification
//! signals that the stored hash should be transparently upgraded to Argon2.

use argon2::password_hash::{PasswordHash, PasswordHasher, PasswordVerifier, SaltString};
use argon2::Argon2;
use password_hash::rand_core::OsRng;

use crate::error::{AppError, AppResult};

/// Outcome of verifying a plaintext password against a stored hash.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Verification {
    /// Valid, and the stored hash is current (Argon2).
    Ok,
    /// Valid, but stored using a legacy scheme — caller should re-hash.
    OkNeedsRehash,
    /// Invalid credentials.
    Invalid,
}

/// Hashes a password with Argon2id and default parameters.
pub fn hash_password(password: &str) -> AppResult<String> {
    let salt = SaltString::generate(&mut OsRng);
    Argon2::default()
        .hash_password(password.as_bytes(), &salt)
        .map(|hash| hash.to_string())
        .map_err(|e| AppError::Internal(anyhow::anyhow!("password hashing failed: {e}")))
}

/// Verifies `password` against `stored_hash`, transparently supporting legacy
/// bcrypt hashes produced by the previous Laravel backend.
pub fn verify_password(password: &str, stored_hash: &str) -> Verification {
    if stored_hash.starts_with("$argon2") {
        match PasswordHash::new(stored_hash) {
            Ok(parsed)
                if Argon2::default()
                    .verify_password(password.as_bytes(), &parsed)
                    .is_ok() =>
            {
                Verification::Ok
            }
            _ => Verification::Invalid,
        }
    } else if stored_hash.starts_with("$2") {
        match bcrypt::verify(password, stored_hash) {
            Ok(true) => Verification::OkNeedsRehash,
            _ => Verification::Invalid,
        }
    } else {
        Verification::Invalid
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn argon2_roundtrip() {
        let hash = hash_password("correct horse battery staple").unwrap();
        assert_eq!(
            verify_password("correct horse battery staple", &hash),
            Verification::Ok
        );
        assert_eq!(
            verify_password("wrong password", &hash),
            Verification::Invalid
        );
    }

    #[test]
    fn legacy_bcrypt_is_accepted_and_flagged_for_rehash() {
        let legacy = bcrypt::hash("hunter2hunter2", 4).unwrap();
        assert_eq!(
            verify_password("hunter2hunter2", &legacy),
            Verification::OkNeedsRehash
        );
        assert_eq!(verify_password("nope", &legacy), Verification::Invalid);
    }
}
