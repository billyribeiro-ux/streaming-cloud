//! Personal access tokens — wire-compatible with Laravel Sanctum.
//!
//! A token presented by a client has the form `"{id}|{plaintext}"`. Only the
//! SHA-256 of the plaintext is stored (column `token`); the numeric `id` selects
//! the row. This matches Sanctum exactly, so tokens issued by either stack are
//! mutually verifiable during the migration.

use rand::distr::Alphanumeric;
use rand::Rng;
use uuid::Uuid;

use crate::auth::token::sha256_hex;
use crate::error::AppResult;

const TOKENABLE_TYPE: &str = "App\\Models\\User";
const PLAINTEXT_LEN: usize = 40;

/// Issues a new token for `user_id` and returns the full `"{id}|{plaintext}"`
/// string to hand to the client. Only the hash is persisted.
pub async fn issue(pool: &sqlx::PgPool, user_id: Uuid, name: &str) -> AppResult<String> {
    let plaintext: String = rand::rng()
        .sample_iter(Alphanumeric)
        .take(PLAINTEXT_LEN)
        .map(char::from)
        .collect();

    let id: i64 = sqlx::query_scalar(
        "INSERT INTO personal_access_tokens \
         (tokenable_type, tokenable_id, name, token, abilities, created_at, updated_at) \
         VALUES ($1, $2, $3, $4, $5, now(), now()) RETURNING id",
    )
    .bind(TOKENABLE_TYPE)
    .bind(user_id)
    .bind(name)
    .bind(sha256_hex(&plaintext))
    .bind(r#"["*"]"#)
    .fetch_one(pool)
    .await?;

    Ok(format!("{id}|{plaintext}"))
}

/// Verifies a presented token and returns the owning user id, updating
/// `last_used_at`. Returns `Ok(None)` for any malformed or unknown token.
pub async fn authenticate(pool: &sqlx::PgPool, raw: &str) -> AppResult<Option<Uuid>> {
    let Some((id_part, plaintext)) = raw.split_once('|') else {
        return Ok(None);
    };
    let Ok(id) = id_part.parse::<i64>() else {
        return Ok(None);
    };

    let row: Option<(Uuid, String)> = sqlx::query_as(
        "SELECT tokenable_id, token FROM personal_access_tokens \
         WHERE id = $1 AND tokenable_type = $2",
    )
    .bind(id)
    .bind(TOKENABLE_TYPE)
    .fetch_optional(pool)
    .await?;

    let Some((user_id, stored_hash)) = row else {
        return Ok(None);
    };

    if !constant_time_eq(&sha256_hex(plaintext), &stored_hash) {
        return Ok(None);
    }

    sqlx::query("UPDATE personal_access_tokens SET last_used_at = now() WHERE id = $1")
        .bind(id)
        .execute(pool)
        .await?;

    Ok(Some(user_id))
}

/// Revokes the token presented by the client (used by logout).
pub async fn revoke(pool: &sqlx::PgPool, raw: &str) -> AppResult<()> {
    let Some((id_part, _)) = raw.split_once('|') else {
        return Ok(());
    };
    let Ok(id) = id_part.parse::<i64>() else {
        return Ok(());
    };

    sqlx::query("DELETE FROM personal_access_tokens WHERE id = $1")
        .bind(id)
        .execute(pool)
        .await?;
    Ok(())
}

/// Length-constant comparison of two equal-length hex digests.
fn constant_time_eq(a: &str, b: &str) -> bool {
    if a.len() != b.len() {
        return false;
    }
    a.bytes()
        .zip(b.bytes())
        .fold(0u8, |acc, (x, y)| acc | (x ^ y))
        == 0
}
