//! Database integration tests against a real Postgres.
//!
//! Gated behind the `integration` feature and run via `#[sqlx::test]`, which
//! provisions a fresh, migrated database per test. Run with:
//! `DATABASE_URL=postgres://… cargo test --features integration`.

use sqlx::PgPool;

use crate::auth::password::{self, Verification};
use crate::db;
use crate::domain::room::RoomStatus;

async fn make_user(pool: &PgPool, email: &str) -> crate::domain::user::User {
    let password_hash = password::hash_password("password123").unwrap();
    db::users::register(
        pool,
        db::users::NewUser {
            name: "Test User".to_string(),
            email: email.to_string(),
            password_hash,
        },
    )
    .await
    .unwrap()
}

async fn org_of(pool: &PgPool, user_id: uuid::Uuid) -> uuid::Uuid {
    db::organizations::member_org_ids(pool, user_id)
        .await
        .unwrap()[0]
}

#[sqlx::test]
async fn register_creates_user_org_and_membership(pool: PgPool) {
    let user = make_user(&pool, "a@example.com").await;

    let found = db::users::find_by_email(&pool, "a@example.com")
        .await
        .unwrap()
        .unwrap();
    assert_eq!(found.id, user.id);
    assert!(db::users::email_exists(&pool, "a@example.com")
        .await
        .unwrap());

    let orgs = db::organizations::member_org_ids(&pool, user.id)
        .await
        .unwrap();
    assert_eq!(orgs.len(), 1, "registration must create exactly one org");
    assert!(db::organizations::is_member(&pool, orgs[0], user.id)
        .await
        .unwrap());
}

#[sqlx::test]
async fn password_verifies(pool: PgPool) {
    let user = make_user(&pool, "b@example.com").await;
    assert_eq!(
        password::verify_password("password123", &user.password),
        Verification::Ok
    );
    assert_eq!(
        password::verify_password("wrong", &user.password),
        Verification::Invalid
    );
}

#[sqlx::test]
async fn token_issue_authenticate_revoke(pool: PgPool) {
    let user = make_user(&pool, "c@example.com").await;
    let raw = db::tokens::issue(&pool, user.id, "auth").await.unwrap();

    assert_eq!(
        db::tokens::authenticate(&pool, &raw).await.unwrap(),
        Some(user.id)
    );

    db::tokens::revoke(&pool, &raw).await.unwrap();
    assert_eq!(db::tokens::authenticate(&pool, &raw).await.unwrap(), None);
    // A malformed token never authenticates.
    assert_eq!(
        db::tokens::authenticate(&pool, "garbage").await.unwrap(),
        None
    );
}

#[sqlx::test]
async fn room_crud_and_lifecycle(pool: PgPool) {
    let user = make_user(&pool, "d@example.com").await;
    let org = org_of(&pool, user.id).await;

    let workspace = db::workspaces::create(
        &pool,
        db::workspaces::NewWorkspace {
            organization_id: org,
            name: "Workspace".to_string(),
            description: None,
        },
    )
    .await
    .unwrap();

    let room = db::rooms::create(
        &pool,
        db::rooms::NewRoom {
            workspace_id: workspace.id,
            organization_id: org,
            name: "Daily Standup".to_string(),
            description: None,
            scheduled_start: None,
            scheduled_end: None,
            recording_enabled: false,
            is_public: false,
            created_by: user.id,
        },
    )
    .await
    .unwrap();

    let listed = db::rooms::list(&pool, &[org], None, 10, 0).await.unwrap();
    assert_eq!(listed.len(), 1);
    assert_eq!(listed[0].id, room.id);
    assert_eq!(db::rooms::count(&pool, &[org], None).await.unwrap(), 1);

    let live = db::rooms::mark_live(&pool, room.id).await.unwrap();
    assert!(matches!(live.status, RoomStatus::Live));
    assert!(live.actual_start.is_some());

    db::rooms::cancel(&pool, room.id).await.unwrap();
    let after = db::rooms::find_by_id(&pool, room.id)
        .await
        .unwrap()
        .unwrap();
    assert!(matches!(after.status, RoomStatus::Cancelled));
}

#[sqlx::test]
async fn participants_reconnect_semantics(pool: PgPool) {
    let user = make_user(&pool, "e@example.com").await;
    let org = org_of(&pool, user.id).await;
    let workspace = db::workspaces::create(
        &pool,
        db::workspaces::NewWorkspace {
            organization_id: org,
            name: "W".to_string(),
            description: None,
        },
    )
    .await
    .unwrap();
    let room = db::rooms::create(
        &pool,
        db::rooms::NewRoom {
            workspace_id: workspace.id,
            organization_id: org,
            name: "R".to_string(),
            description: None,
            scheduled_start: None,
            scheduled_end: None,
            recording_enabled: false,
            is_public: false,
            created_by: user.id,
        },
    )
    .await
    .unwrap();

    let join = |()| {
        db::participants::join(
            &pool,
            db::participants::JoinParticipant {
                room_id: room.id,
                session_id: None,
                user_id: user.id,
                role: "host".to_string(),
                display_name: Some("Host".to_string()),
            },
        )
    };

    join(()).await.unwrap();
    join(()).await.unwrap(); // reconnect: prior presence marked left
    let active = db::participants::list_active(&pool, room.id).await.unwrap();
    assert_eq!(
        active.len(),
        1,
        "a reconnect must not duplicate active presence"
    );

    db::participants::leave(&pool, room.id, user.id)
        .await
        .unwrap();
    assert!(db::participants::list_active(&pool, room.id)
        .await
        .unwrap()
        .is_empty());
}

#[sqlx::test]
async fn chat_and_subscription(pool: PgPool) {
    let user = make_user(&pool, "f@example.com").await;
    let org = org_of(&pool, user.id).await;
    let workspace = db::workspaces::create(
        &pool,
        db::workspaces::NewWorkspace {
            organization_id: org,
            name: "W".to_string(),
            description: None,
        },
    )
    .await
    .unwrap();
    let room = db::rooms::create(
        &pool,
        db::rooms::NewRoom {
            workspace_id: workspace.id,
            organization_id: org,
            name: "R".to_string(),
            description: None,
            scheduled_start: None,
            scheduled_end: None,
            recording_enabled: false,
            is_public: false,
            created_by: user.id,
        },
    )
    .await
    .unwrap();

    let message = db::chat::create(
        &pool,
        db::chat::NewMessage {
            room_id: room.id,
            user_id: user.id,
            content: "hello".to_string(),
            message_type: "text".to_string(),
        },
    )
    .await
    .unwrap();
    let messages = db::chat::list(&pool, room.id, 10, 0).await.unwrap();
    assert_eq!(messages.len(), 1);
    assert_eq!(messages[0].id, message.id);

    db::subscriptions::upsert(
        &pool,
        db::subscriptions::UpsertSubscription {
            organization_id: org,
            plan_id: None,
            stripe_subscription_id: "sub_test".to_string(),
            status: "active".to_string(),
            current_period_start: None,
            current_period_end: None,
            cancelled_at: None,
        },
    )
    .await
    .unwrap();
    let subscription = db::subscriptions::find_for_org(&pool, org)
        .await
        .unwrap()
        .unwrap();
    assert!(subscription.is_active());
}
