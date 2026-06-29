.PHONY: dev tidy build lint clean dev-clean prepare

DEV_CONTAINERS := langstudy-dev-postgres langstudy-dev-redis
BACKEND_ENV_FILE := backend/.env

# Load backend/.env if it exists
ifneq (,$(wildcard $(BACKEND_ENV_FILE)))
  include $(BACKEND_ENV_FILE)
  export
endif

# --- Development ---

# Run both frontend and backend development servers in parallel
dev:
	make -j2 dev-frontend dev-backend-dev

dev-frontend:
	cd frontend && npm run dev

dev-backend-dev:
	cd backend && go run -tags dev ./cmd/server

# --- Production Build ---

# Build both frontend and backend for production environment
build: build-frontend build-backend

build-frontend:
	cd frontend && npm run build

build-backend:
	cd backend && go build -ldflags="-w -s" -o bin/server ./cmd/server

# --- Utilities ---

tidy:
	cd backend && go mod tidy

lint:
	cd backend && golangci-lint run ./...

clean:
	rm -rf backend/bin backend/server backend/server-dev frontend/dist

dev-clean:
	docker rm -f $(DEV_CONTAINERS) 2>/dev/null || true
	rm -rf backend/static/audio

prepare:
	@if [ ! -f backend/.env ]; then \
		cp backend/.env.example backend/.env; \
	fi
	cd frontend && npm install
	cd backend && go mod download
	@if [ ! -d .venv ]; then \
		python3 -m venv .venv; \
	fi
	.venv/bin/pip install -r requirements.txt
