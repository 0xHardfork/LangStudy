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
	cd backend && go build -ldflags="-w -s" -o bin/migrate ./cmd/migrate

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

# --- Mobile App Build (Flutter) ---

# Build production iOS app bundle (unsigned). Usage: make app-ios IP=192.168.1.100
app-ios:
	@if [ -z "$(IP)" ]; then \
		echo "Error: IP parameter is required. Usage: make app-ios IP=192.168.1.100"; \
		exit 1; \
	fi
	cd app && flutter build ios --release --no-codesign -t lib/main_prod.dart --dart-define=API_BASE_URL=http://$(IP)

# Build production Android APK. Usage: make app-apk IP=192.168.1.100
app-apk:
	@if [ -z "$(IP)" ]; then \
		echo "Error: IP parameter is required. Usage: make app-apk IP=192.168.1.100"; \
		exit 1; \
	fi
	cd app && flutter build apk --release -t lib/main_prod.dart --dart-define=API_BASE_URL=http://$(IP)

# Run App on device/simulator. Usage: make app-run IP=192.168.1.100 [DEV=00008130-xxx] [RELEASE=1]
app-run:
	@if [ -z "$(IP)" ]; then \
		echo "Error: IP parameter is required. Usage: make app-run IP=192.168.1.100 [DEV=device_id] [RELEASE=1]"; \
		exit 1; \
	fi; \
	FLAGS="-t lib/main_prod.dart --dart-define=API_BASE_URL=http://$(IP)"; \
	if [ ! -z "$(DEV)" ]; then \
		FLAGS="$$FLAGS -d $(DEV)"; \
	fi; \
	if [ "$(RELEASE)" = "1" ]; then \
		FLAGS="$$FLAGS --release"; \
	fi; \
	cd app && flutter run $$FLAGS

# --- Remote Deployment ---

# Deploy newest backend & frontend releases to production environment (reads local scripts/.env.deploy)
deploy:
	./backend/scripts/deploy.sh

# --- Help ---

help:
	@echo "LangStudy Makefile commands:"
	@echo "  make dev          - Run frontend and backend local development in parallel"
	@echo "  make build        - Compile both frontend and backend for production"
	@echo "  make deploy       - One-click compile & upload updates to production server"
	@echo "  make app-apk      - Build Android APK. Required: IP=xxx"
	@echo "  make app-ios      - Build iOS App (unsigned). Required: IP=xxx"
	@echo "  make app-run      - Run App on device. Required: IP=xxx. Optional: DEV=device_id RELEASE=1 (e.g. make app-run IP=192.168.1.100 DEV=00008130-0005252A029A001C RELEASE=1)"
	@echo "  make clean        - Clean build artifacts"


