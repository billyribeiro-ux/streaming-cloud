//! Database access layer.
//!
//! Repositories use sqlx's runtime query API (`query_as`/`query_scalar`) rather
//! than the compile-time-checked macros, so the crate builds without a live
//! database. Once CI provisions a build-time Postgres (or an offline `.sqlx`
//! cache), these can be promoted to `query!`/`query_as!` for static checking.

pub mod admin;
pub mod alerts;
pub mod analytics;
pub mod chat;
pub mod files;
pub mod organizations;
pub mod participants;
pub mod plans;
pub mod rooms;
pub mod sessions;
pub mod subscriptions;
pub mod tokens;
pub mod users;
pub mod workspaces;
