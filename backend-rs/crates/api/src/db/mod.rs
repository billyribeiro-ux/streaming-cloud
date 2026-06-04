//! Database access layer.
//!
//! Repositories use sqlx's runtime query API (`query_as`/`query_scalar`) rather
//! than the compile-time-checked macros, so the crate builds without a live
//! database. Once CI provisions a build-time Postgres (or an offline `.sqlx`
//! cache), these can be promoted to `query!`/`query_as!` for static checking.

pub mod alerts;
pub mod chat;
pub mod organizations;
pub mod rooms;
pub mod tokens;
pub mod users;
pub mod workspaces;
