//! JWT verification matching `signaling/src/services/AuthService.ts`.
//!
//! Phase 1 deliberately omits the database lookup (verifyOrganizationMembership
//! queries PostgreSQL). The JWT is verified cryptographically and the user ID
//! plus embedded metadata are extracted. Organization membership is trust-on-
//! token – the Laravel backend already scoped the JWT to the correct org.

use jsonwebtoken::{decode, DecodingKey, Validation, Algorithm};
use serde::{Deserialize, Serialize};

/// Mirrors `AuthenticatedUser` from the Node.js service.
#[derive(Debug, Clone, Serialize)]
pub struct AuthenticatedUser {
    pub id: String,
    pub email: String,
    pub organization_id: Option<String>,
    pub role: Option<String>,
    pub permissions: Vec<String>,
}

/// JWT claims – union of Laravel SignalingService fields and legacy Supabase
/// fields that the Node.js server accepts.
#[derive(Debug, Deserialize)]
struct JwtClaims {
    /// Standard `sub` claim.
    sub: Option<String>,
    /// Laravel `user_id` claim.
    user_id: Option<String>,
    email: Option<String>,
    organization_id: Option<String>,
    role: Option<String>,
    display_name: Option<String>,
    room_id: Option<String>,
    participant_id: Option<String>,
    app_metadata: Option<AppMetadata>,
}

#[derive(Debug, Deserialize)]
struct AppMetadata {
    organization_id: Option<String>,
    organization_role: Option<String>,
}

/// Verify a JWT token and return the authenticated user.
pub fn verify_token(token: &str, secret: &str) -> Result<AuthenticatedUser, String> {
    let key = DecodingKey::from_secret(secret.as_bytes());

    let mut validation = Validation::new(Algorithm::HS256);
    // The Node.js server does not validate audience/issuer.
    validation.validate_aud = false;
    validation.required_spec_claims.clear();

    let token_data = decode::<JwtClaims>(token, &key, &validation)
        .map_err(|e| format!("JWT verification failed: {e}"))?;

    let claims = token_data.claims;

    let user_id = claims
        .sub
        .or(claims.user_id)
        .ok_or_else(|| "Invalid token: missing subject / user_id".to_string())?;

    let org_role = claims
        .app_metadata
        .as_ref()
        .and_then(|m| m.organization_role.clone())
        .or(claims.role.clone());

    let org_id = claims
        .app_metadata
        .as_ref()
        .and_then(|m| m.organization_id.clone())
        .or(claims.organization_id);

    let permissions = permissions_for_role(org_role.as_deref());

    Ok(AuthenticatedUser {
        id: user_id,
        email: claims.email.unwrap_or_default(),
        organization_id: org_id,
        role: org_role,
        permissions,
    })
}

/// Matches `getPermissionsForRole` from the Node.js AuthService.
fn permissions_for_role(role: Option<&str>) -> Vec<String> {
    let perms: &[&str] = match role {
        Some("owner") => &["manage", "admin", "stream", "moderate", "view"],
        Some("admin") => &["admin", "stream", "moderate", "view"],
        Some("host") => &["stream", "moderate", "view"],
        Some("co_host") => &["stream", "view"],
        Some("moderator") => &["moderate", "view"],
        _ => &["view"],
    };
    perms.iter().map(|s| (*s).to_string()).collect()
}

/// Verify organization membership.
///
/// Phase 1 stub: always returns `true`. A future phase will query PostgreSQL
/// via `sqlx` (`SELECT id FROM organization_members WHERE user_id = $1 AND
/// organization_id = $2`).
pub async fn verify_organization_membership(
    _user_id: &str,
    _organization_id: &str,
) -> bool {
    // TODO: implement database lookup in Phase 2
    true
}
