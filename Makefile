.PHONY: dev tidy build lint clean dev-clean prepare

DEV_CONTAINERS := langstudy-dev-postgres langstudy-dev-redis
BACKEND_ENV_FILE := backend/.env
DEPLOY_ENV_FILE := backend/scripts/.env.deploy

# Load backend/.env if it exists
ifneq (,$(wildcard $(BACKEND_ENV_FILE)))
  include $(BACKEND_ENV_FILE)
  export
endif

# Load backend/scripts/.env.deploy if it exists
ifneq (,$(wildcard $(DEPLOY_ENV_FILE)))
  include $(DEPLOY_ENV_FILE)
  export
endif

TARGET_IP ?= $(subst ",,$(if $(IP),$(IP),$(SERVER_IP)))

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

# Build production iOS app bundle (unsigned). Usage: make app-ios [IP=192.168.1.100]
app-ios:
	@if [ -z "$(TARGET_IP)" ]; then \
		echo "Error: IP parameter is required or must be set in $(DEPLOY_ENV_FILE). Usage: make app-ios IP=192.168.1.100"; \
		exit 1; \
	fi
	cd app && flutter build ios --release --no-codesign -t lib/main_prod.dart --dart-define=API_BASE_URL=http://$(TARGET_IP)

# Build production Android APK. Usage: make app-apk [IP=192.168.1.100]
app-apk:
	@if [ -z "$(TARGET_IP)" ]; then \
		echo "Error: IP parameter is required or must be set in $(DEPLOY_ENV_FILE). Usage: make app-apk IP=192.168.1.100"; \
		exit 1; \
	fi
	cd app && flutter build apk --release -t lib/main_prod.dart --dart-define=API_BASE_URL=http://$(TARGET_IP)

# Run App on device/simulator. Usage: make app-run [IP=192.168.1.100] [DEV=device_id] [RELEASE=1]
app-run:
	@if [ -z "$(TARGET_IP)" ]; then \
		echo "Error: IP parameter is required or must be set in $(DEPLOY_ENV_FILE). Usage: make app-run IP=192.168.1.100 [DEV=device_id] [RELEASE=1]"; \
		exit 1; \
	fi; \
	FLAGS="-t lib/main_prod.dart --dart-define=API_BASE_URL=http://$(TARGET_IP)"; \
	if [ ! -z "$(DEV)" ]; then \
		FLAGS="$$FLAGS -d $(DEV)"; \
	fi; \
	if [ "$(RELEASE)" = "1" ]; then \
		FLAGS="$$FLAGS --release"; \
	fi; \
	cd app && flutter run $$FLAGS

# Install & Run production release package to connected phone. Usage: make app-prod [DEV=device_id]
app-prod:
	@make app-run RELEASE=1 DEV=$(DEV)

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
	@echo "  make app-prod     - Build and install production app to connected phone (uses server IP from deploy config)"
	@echo "  make app-apk      - Build Android APK. Optional: IP=xxx"
	@echo "  make app-ios      - Build iOS App (unsigned). Optional: IP=xxx"
	@echo "  make app-run      - Run App on device. Optional: IP=xxx DEV=device_id RELEASE=1"
	@echo "  make clean        - Clean build artifacts"


