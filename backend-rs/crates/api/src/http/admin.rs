//! Platform-admin endpoints (parity with the React admin pages):
//! `GET /v1/admin/stats`, `GET /v1/admin/users`. Guarded by [`AdminUser`].

use axum::extract::{Query, State};
use axum::routing::get;
use axum::{Json, Router};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

use crate::auth::AdminUser;
use crate::db;
use crate::db::admin::AdminUserRow;
use crate::error::AppResult;
use crate::state::AppState;

pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/v1/admin/stats", get(stats))
        .route("/v1/admin/users", get(users))
}

async fn stats(State(state): State<AppState>, _admin: AdminUser) -> AppResult<Json<Value>> {
    let (users, organizations, rooms, live_rooms) = db::admin::platform_stats(&state.db).await?;
    Ok(Json(json!({
        "users": users,
        "organizations": organizations,
        "rooms": rooms,
        "live_rooms": live_rooms,
    })))
}

#[derive(Debug, Deserialize)]
struct Pagination {
    page: Option<u32>,
    per_page: Option<u32>,
}

#[derive(Serialize)]
struct Page {
    data: Vec<AdminUserRow>,
    meta: Meta,
}

#[derive(Serialize)]
struct Meta {
    page: i64,
    per_page: i64,
    total: i64,
}

async fn users(
    State(state): State<AppState>,
    _admin: AdminUser,
    Query(q): Query<Pagination>,
) -> AppResult<Json<Page>> {
    let per_page = i64::from(q.per_page.unwrap_or(25).clamp(1, 100));
    let page = i64::from(q.page.unwrap_or(1).max(1));
    let offset = (page - 1) * per_page;

    let data = db::admin::list_users(&state.db, per_page, offset).await?;
    let total = db::admin::count_users(&state.db).await?;

    Ok(Json(Page {
        data,
        meta: Meta {
            page,
            per_page,
            total,
        },
    }))
}
