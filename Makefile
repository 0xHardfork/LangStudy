.PHONY: dev-fe dev-be dev-be-dev dev tidy build-be build-be-dev lint-be dev-clean

DEV_CONTAINERS := langstudy-dev-postgres langstudy-dev-redis
BACKEND_ENV_FILE := backend/.env

# Load backend/.env if it exists (strips comments and blank lines)
ifneq (,$(wildcard $(BACKEND_ENV_FILE)))
  include $(BACKEND_ENV_FILE)
  export
endif

dev-fe:
	cd frontend && npm run dev

dev-be:
	cd backend && go run ./cmd/server

dev-be-dev:
	cd backend && go run -tags dev ./cmd/server

dev:
	make -j2 dev-fe dev-be-dev


tidy:
	cd backend && go mod tidy

build-be:
	cd backend && go build -o bin/server ./cmd/server

build-be-dev:
	cd backend && go build -tags dev -o bin/server-dev ./cmd/server

lint-be:
	cd backend && golangci-lint run ./...

dev-clean:
	docker rm -f $(DEV_CONTAINERS) 2>/dev/null || true

