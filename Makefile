.PHONY: help install dev build test test-api test-frontend lint fmt clean docker-up docker-down docker-build migrate

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

install: ## Install all dependencies
	cd backend-rs && cargo fetch
	cd frontend-svelte && npm ci
	cd signaling && npm ci
	cd sfu && npm ci

dev: ## Start development servers (Rust API + SvelteKit + signaling)
	@echo "Starting development servers..."
	cd backend-rs && cargo run &
	cd frontend-svelte && npm run dev &
	cd signaling && npm run dev &
	wait

build: ## Build all services
	cd backend-rs && cargo build --release --locked
	cd frontend-svelte && npm run build
	cd signaling && npm run build

test: ## Run all tests
	cd backend-rs && cargo test
	cd frontend-svelte && npm run check
	cd signaling && npm run test

test-api: ## Run Rust API tests only
	cd backend-rs && cargo test

test-frontend: ## Run SvelteKit type/a11y checks only
	cd frontend-svelte && npm run check

lint: ## Run all linters
	cd backend-rs && cargo fmt --all --check && cargo clippy --all-targets -- -D warnings
	cd frontend-svelte && npm run check

fmt: ## Format Rust code
	cd backend-rs && cargo fmt --all

clean: ## Clean build artifacts
	rm -rf backend-rs/target
	rm -rf frontend-svelte/build frontend-svelte/.svelte-kit
	rm -rf frontend-svelte/node_modules signaling/node_modules sfu/node_modules

docker-up: ## Start Docker services
	docker compose --env-file .env -f infrastructure/docker/docker-compose.yml up -d

docker-down: ## Stop Docker services
	docker compose --env-file .env -f infrastructure/docker/docker-compose.yml down

docker-build: ## Build Docker images
	docker compose --env-file .env -f infrastructure/docker/docker-compose.yml build

migrate: ## Apply database migrations (sqlx)
	cd backend-rs && sqlx migrate run --source crates/api/migrations
