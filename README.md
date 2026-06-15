# LangStudy

LangStudy is a modern full-stack web application designed for interactive foreign language learning. It features customizable difficulty control through fill-in-the-blank dialogue exercises.

---

## Tech Stack

### Backend
- **Core**: Go (Golang)
- **Web Framework**: Gin
- **ORM**: GORM with PostgreSQL driver
- **Cache**: Redis
- **Config Management**: Viper (YAML + Environment variables override)
- **Database Migrations**: golang-migrate
- **Dev Environment**: testcontainers-go (Automatic Postgres and Redis lifecycle orchestration)

### Frontend
- **Core**: React, TypeScript, Vite
- **Styling**: Tailwind CSS v4
- **UI Components**: Ant Design (antd)

---

## Prerequisites

Ensure you have the following installed and running locally:
- **Go**: Version 1.22+
- **Node.js & npm**
- **Docker / Colima**: Container daemon must be active so testcontainers can spin up dev instances.

---

## Getting Started

### One-Click Startup (Frontend & Backend)
Run the following command in the project root directory:
```bash
make dev
```
This orchestrates both sides simultaneously:
- Starts Vite frontend dev server at `http://localhost:5173`.
- Starts Go backend dev server with testcontainers at `http://localhost:8080`.
- Automatically spins up named `langstudy-dev-postgres` & `langstudy-dev-redis` containers and runs database migrations.

### Individual Commands
- **Start Frontend**: `make dev-fe`
- **Start Backend (Dev Mode)**: `make dev-be-dev`
- **Tidy Go Modules**: `make tidy`
- **Clean Dev Containers**: `make dev-clean`

---

## How to Develop Your First Feature

This project follows a strict **Feature-First Architecture** on the backend and a modular component-driven layout on the frontend. Follow these steps to implement a new feature (e.g., a "Vocabulary Book" or "Bookmarks"):

### Step 1: Define Database Migration
Create migration files in the `backend/migrations/` directory using the naming template `<version>_create_<feature>.up.sql` and `<version>_create_<feature>.down.sql`.
Example:
```sql
CREATE TABLE IF NOT EXISTS vocabularies (
    id         BIGSERIAL PRIMARY KEY,
    user_id    BIGINT NOT NULL,
    word       VARCHAR(128) NOT NULL,
    definition TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### Step 2: Implement Backend Feature Package
Create a new directory under `backend/internal/<feature>/` (e.g., `backend/internal/vocabulary/`) and add:
1. **Model** (`model.go`): Define GORM struct models and request/response DTO structures.
2. **Store** (`store.go`): Declare the data store interface and implement database interactions using GORM.
3. **Service** (`service.go`): Declare the service interface and implement business logic rules.
4. **Handler** (`handler.go`): Build Gin HTTP handler endpoints, parse query parameters or JSON bodies, and return structured JSON responses using the standard `platform/response` package.

### Step 3: Wire Dependencies in main.go
Open `backend/cmd/server/main.go` and append your new feature wiring:
1. Initialize the new Store injecting the database connection:
   ```go
   vocabStore := vocabulary.NewStore(db)
   ```
2. Initialize the Service injecting the Store:
   ```go
   vocabService := vocabulary.NewService(vocabStore)
   ```
3. Initialize the Handler injecting the Service:
   ```go
   vocabHandler := vocabulary.NewHandler(vocabService)
   ```
4. Register the new routing endpoints under public or authenticated API groups:
   ```go
   authed.GET("/vocabularies", vocabHandler.List)
   authed.POST("/vocabularies", vocabHandler.Create)
   ```

### Step 4: Implement Frontend Logic
1. **API Requests**: Create a request mapping file in `frontend/src/services/<feature>.ts` to fetch backend routes.
2. **Components**: Build reusable visual widgets in `frontend/src/components/` styled using Tailwind CSS classes.
3. **Integration**: Import and render components on views or layouts as required.
