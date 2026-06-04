//! Authentication: password hashing, token primitives, and the request
//! extractor that authenticates callers from their bearer token.

pub mod extractor;
pub mod password;
pub mod token;

pub use extractor::AuthUser;
