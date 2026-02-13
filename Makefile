.PHONY: help install dev build test lint clean docker-up docker-down migrate seed fresh

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

install: ## Install all dependencies
	cd backend && composer install
	cd frontend && npm ci
	cd signaling && npm ci
	cd sfu && npm ci

dev: ## Start all development servers
	@echo "Starting development servers..."
	cd backend && php artisan serve &
	cd frontend && npm run dev &
	cd signaling && npm run dev &
	wait

build: ## Build all services
	cd frontend && npm run build
	cd signaling && npm run build

test: ## Run all tests
	cd backend && ./vendor/bin/pest
	cd frontend && npm run test
	cd signaling && npm run test

test-backend: ## Run backend tests only
	cd backend && ./vendor/bin/pest

test-frontend: ## Run frontend tests only
	cd frontend && npm run test

lint: ## Run all linters
	cd backend && ./vendor/bin/pint --test
	cd backend && ./vendor/bin/phpstan analyse
	cd frontend && npm run lint

clean: ## Clean build artifacts
	rm -rf frontend/dist
	rm -rf backend/vendor
	rm -rf frontend/node_modules
	rm -rf signaling/node_modules
	rm -rf sfu/node_modules

docker-up: ## Start Docker services
	docker compose -f infrastructure/docker/docker-compose.yml up -d

docker-down: ## Stop Docker services
	docker compose -f infrastructure/docker/docker-compose.yml down

docker-build: ## Build Docker images
	docker compose -f infrastructure/docker/docker-compose.yml build

migrate: ## Run database migrations
	cd backend && php artisan migrate

seed: ## Seed the database
	cd backend && php artisan db:seed

fresh: ## Fresh migrate and seed
	cd backend && php artisan migrate:fresh --seed

horizon: ## Start Laravel Horizon
	cd backend && php artisan horizon

logs: ## Tail all logs
	tail -f backend/storage/logs/laravel.log
