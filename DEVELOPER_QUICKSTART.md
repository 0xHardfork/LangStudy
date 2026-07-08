# LangStudy Developer Quick Start Guide

This guide walks you through building a simple, complete full-stack feature (Backend Go API, React Web Frontend, and Flutter Mobile App) in the `LangStudy` repository. We will build a **"Vocabulary Notebook"** feature, which allows users to save and view new words.

## Prerequisites
Ensure you have set up your local development environment:
```bash
make prepare
```
Make sure Docker is running, then start the development environment:
```bash
make dev
```
This boots up the local databases, runs migrations, and starts the frontend and backend servers.

---

## Part 1: Backend Development (Go / Gin / GORM)

We will create a `vocabularies` table, model, service, store, handler, and register the API endpoints.

### Step 1.1: Create SQL Migrations
Generate migration files under `backend/migrations/` using a sequential numbering prefix. Create the following two files:

#### `000006_create_vocabularies.up.sql`
```sql
CREATE TABLE IF NOT EXISTS vocabularies (
    id         BIGSERIAL PRIMARY KEY,
    user_id    BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    word       VARCHAR(128) NOT NULL,
    definition VARCHAR(512) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_vocabularies_user_id ON vocabularies(user_id);
```

#### `000006_create_vocabularies.down.sql`
```sql
DROP TABLE IF EXISTS vocabularies;
```

### Step 1.2: Define the Model (`backend/internal/vocabulary/model.go`)
Define GORM structures and JSON request DTOs:
```go
package vocabulary

import "time"

type Vocabulary struct {
	ID         uint      `gorm:"primaryKey;autoIncrement" json:"id"`
	UserID     uint      `gorm:"not null;index" json:"user_id"`
	Word       string    `gorm:"type:varchar(128);not null" json:"word"`
	Definition string    `gorm:"type:varchar(512);not null" json:"definition"`
	CreatedAt  time.Time `json:"created_at"`
}

func (Vocabulary) TableName() string {
	return "vocabularies"
}

type CreateRequest struct {
	Word       string `json:"word" binding:"required,min=1"`
	Definition string `json:"definition" binding:"required,min=1"`
}
```

### Step 1.3: Define the Database Queries (`backend/internal/vocabulary/store.go`)
Create the store layer for database interactions, ensuring multi-tenancy checking (`user_id = ?`):
```go
package vocabulary

import (
	"context"
	"gorm.io/gorm"
)

type Store interface {
	Create(ctx context.Context, vocab *Vocabulary) error
	ListByUserID(ctx context.Context, userID uint) ([]*Vocabulary, error)
}

type store struct {
	db *gorm.DB
}

func NewStore(db *gorm.DB) Store {
	return &store{db: db}
}

func (s *store) Create(ctx context.Context, vocab *Vocabulary) error {
	return s.db.WithContext(ctx).Create(vocab).Error
}

func (s *store) ListByUserID(ctx context.Context, userID uint) ([]*Vocabulary, error) {
	var list []*Vocabulary
	err := s.db.WithContext(ctx).Where("user_id = ?", userID).Order("created_at desc").Find(&list).Error
	return list, err
}
```

### Step 1.4: Implement Business Logic (`backend/internal/vocabulary/service.go`)
```go
package vocabulary

import "context"

type Service interface {
	AddWord(ctx context.Context, userID uint, word, definition string) (*Vocabulary, error)
	GetWords(ctx context.Context, userID uint) ([]*Vocabulary, error)
}

type service struct {
	store Store
}

func NewService(store Store) Service {
	return &service{store: store}
}

func (s *service) AddWord(ctx context.Context, userID uint, word, definition string) (*Vocabulary, error) {
	vocab := &Vocabulary{
		UserID:     userID,
		Word:       word,
		Definition: definition,
	}
	if err := s.store.Create(ctx, vocab); err != nil {
		return nil, err
	}
	return vocab, nil
}

func (s *service) GetWords(ctx context.Context, userID uint) ([]*Vocabulary, error) {
	return s.store.ListByUserID(ctx, userID)
}
```

### Step 1.5: Decode Parameters & Return Handler Response (`backend/internal/vocabulary/handler.go`)
```go
package vocabulary

import (
	"net/http"
	"github.com/0xHardfork/langstudy/platform/auth"
	"github.com/0xHardfork/langstudy/platform/response"
	"github.com/0xHardfork/langstudy/platform/validator"
	"github.com/gin-gonic/gin"
)

type Handler struct {
	svc Service
}

func NewHandler(svc Service) *Handler {
	return &Handler{svc: svc}
}

func (h *Handler) Create(c *gin.Context) {
	userID, err := auth.CurrentUserID(c)
	if err != nil {
		response.Fail(c, http.StatusUnauthorized, "unauthorized")
		return
	}

	var req CreateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Fail(c, http.StatusBadRequest, validator.Translate(err))
		return
	}

	vocab, err := h.svc.AddWord(c.Request.Context(), userID, req.Word, req.Definition)
	if err != nil {
		response.Fail(c, http.StatusInternalServerError, err.Error())
		return
	}
	response.Success(c, http.StatusCreated, vocab)
}

func (h *Handler) List(c *gin.Context) {
	userID, err := auth.CurrentUserID(c)
	if err != nil {
		response.Fail(c, http.StatusUnauthorized, "unauthorized")
		return
	}

	list, err := h.svc.GetWords(c.Request.Context(), userID)
	if err != nil {
		response.Fail(c, http.StatusInternalServerError, err.Error())
		return
	}
	response.Success(c, http.StatusOK, list)
}

func (h *Handler) RegisterRoutes(public, authed, admin *gin.RouterGroup) {
	authed.POST("/vocabularies", h.Create)
	authed.GET("/vocabularies", h.List)
}
```

### Step 1.6: Register in Main Entry (`backend/cmd/server/main.go`)
Open `backend/cmd/server/main.go` and wire the layers inside the router setup function:
```go
import "github.com/0xHardfork/langstudy/internal/vocabulary"

// Inside the main server setup (after db is connected):
vocabStore := vocabulary.NewStore(db)
vocabService := vocabulary.NewService(vocabStore)
vocabHandler := vocabulary.NewHandler(vocabService)

// Under the authed routing group registration:
vocabHandler.RegisterRoutes(public, authed, admin)
```

Compile and test:
```bash
go build ./...
```

---

## Part 2: Web Frontend Development (React / TS / Tailwind)

### Step 2.1: Add TypeScript Types (`frontend/src/types/index.ts`)
Add the model interface:
```typescript
export interface Vocabulary {
  id: number
  user_id: number
  word: string
  definition: string
  created_at: string
}
```

### Step 2.2: Add Service Request Functions (`frontend/src/services/api.ts`)
```typescript
import type { Vocabulary } from '../types'

// Append inside frontend/src/services/api.ts
export function getVocabularies(token: string): Promise<Vocabulary[]> {
  return apiCall<Vocabulary[]>(token, '/vocabularies')
}

export function createVocabulary(token: string, payload: { word: string; definition: string }): Promise<Vocabulary> {
  return apiCall<Vocabulary>(token, '/vocabularies', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}
```

### Step 2.3: Create Page Component (`frontend/src/pages/VocabularyList.tsx`)
Create a simple visual page component:
```tsx
import { useEffect, useState } from 'react'
import { getVocabularies, createVocabulary } from '../services/api'
import { useAppStore } from '../store/useAppStore'
import type { Vocabulary } from '../types'

export default function VocabularyList() {
  const token = useAppStore((state) => state.token)
  const [words, setWords] = useState<Vocabulary[]>([])
  const [word, setWord] = useState('')
  const [definition, setDefinition] = useState('')
  const [loading, setLoading] = useState(false)

  const fetchWords = async () => {
    if (!token) return
    try {
      const data = await getVocabularies(token)
      setWords(data)
    } catch (e) {
      console.error(e)
    }
  }

  useEffect(() => {
    fetchWords()
  }, [token])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!token || !word || !definition) return
    setLoading(true)
    try {
      await createVocabulary(token, { word, definition })
      setWord('')
      setDefinition('')
      fetchWords()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to save word')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6 text-white">Vocabulary Notebook</h1>
      <form onSubmit={handleSubmit} className="mb-8 space-y-4 bg-slate-900/60 p-6 rounded-lg border border-slate-800">
        <div>
          <label className="block text-sm font-medium text-slate-400">Word</label>
          <input
            type="text"
            value={word}
            onChange={(e) => setWord(e.target.value)}
            className="mt-1 block w-full rounded bg-slate-950 border border-slate-800 p-2 text-white"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-400">Definition</label>
          <input
            type="text"
            value={definition}
            onChange={(e) => setDefinition(e.target.value)}
            className="mt-1 block w-full rounded bg-slate-950 border border-slate-800 p-2 text-white"
            required
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="bg-violet-600 hover:bg-violet-500 text-white font-bold py-2 px-4 rounded transition-all duration-200"
        >
          {loading ? 'Adding...' : 'Add Word'}
        </button>
      </form>

      <div className="space-y-4">
        {words.map((item) => (
          <div key={item.id} className="bg-slate-900/60 p-4 rounded-lg border border-slate-800">
            <h3 className="font-bold text-white text-lg">{item.word}</h3>
            <p className="text-slate-400 mt-1">{item.definition}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
```

### Step 2.4: Register Page Route (`frontend/src/App.tsx`)
Import and register the page in `frontend/src/App.tsx`:
```tsx
import VocabularyList from './pages/VocabularyList'

// Inside RequireUser outlet route lists:
<Route path="/vocabulary" element={<VocabularyList />} />
```

Test and build the frontend:
```bash
npm run build
```

---

## Part 3: Mobile App Development (Flutter)

### Step 3.1: Define Data Model (`app/lib/features/vocabulary/models/vocabulary_model.dart`)
Create the Dart representation of the vocabulary:
```dart
class Vocabulary {
  final int id;
  final int userId;
  final String word;
  final String definition;

  Vocabulary({
    required this.id,
    required this.userId,
    required this.word,
    required this.definition,
  });

  factory Vocabulary.fromJson(Map<String, dynamic> json) {
    return Vocabulary(
      id: json['id'] as int? ?? 0,
      userId: json['user_id'] as int? ?? 0,
      word: json['word'] as String? ?? '',
      definition: json['definition'] as String? ?? '',
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'user_id': userId,
        'word': word,
        'definition': definition,
      };
}
```

### Step 3.2: Implement Data Source & Repository (`app/lib/features/vocabulary/data/`)

#### `app/lib/features/vocabulary/data/datasource/vocabulary_datasource.dart`
```dart
import '../../../../core/network/api_client.dart';
import '../../models/vocabulary_model.dart';

class VocabularyDatasource {
  final ApiClient _client;

  VocabularyDatasource(this._client);

  Future<List<Vocabulary>> fetchVocabularies() async {
    final List<dynamic> res = await _client.get('/vocabularies');
    return res.map((e) => Vocabulary.fromJson(e as Map<String, dynamic>)).toList();
  }

  Future<Vocabulary> createVocabulary(String word, String definition) async {
    final res = await _client.post(
      '/vocabularies',
      data: {'word': word, 'definition': definition},
    );
    return Vocabulary.fromJson(res as Map<String, dynamic>);
  }
}
```

#### `app/lib/features/vocabulary/data/repository/vocabulary_repository.dart`
```dart
import '../datasource/vocabulary_datasource.dart';
import '../../models/vocabulary_model.dart';

class VocabularyRepository {
  final VocabularyDatasource _datasource;

  VocabularyRepository(this._datasource);

  Future<List<Vocabulary>> fetchVocabularies() => _datasource.fetchVocabularies();

  Future<Vocabulary> createVocabulary(String word, String definition) =>
      _datasource.createVocabulary(word, definition);
}
```

### Step 3.3: Implement Cubit & State (`app/lib/features/vocabulary/cubit/`)

#### `app/lib/features/vocabulary/cubit/vocabulary_state.dart`
```dart
import '../../models/vocabulary_model.dart';

abstract class VocabularyState {}

class VocabularyInitial extends VocabularyState {}
class VocabularyLoading extends VocabularyState {}
class VocabularyLoaded extends VocabularyState {
  final List<Vocabulary> words;
  VocabularyLoaded(this.words);
}
class VocabularyFailure extends VocabularyState {
  final String error;
  VocabularyFailure(this.error);
}
```

#### `app/lib/features/vocabulary/cubit/vocabulary_cubit.dart`
```dart
import 'package:flutter_bloc/flutter_bloc.dart';
import '../data/repository/vocabulary_repository.dart';
import 'vocabulary_state.dart';

class VocabularyCubit extends Cubit<VocabularyState> {
  final VocabularyRepository _repository;

  VocabularyCubit(this._repository) : super(VocabularyInitial());

  Future<void> loadVocabularies() async {
    emit(VocabularyLoading());
    try {
      final list = await _repository.fetchVocabularies();
      emit(VocabularyLoaded(list));
    } catch (e) {
      emit(VocabularyFailure(e.toString()));
    }
  }

  Future<void> addWord(String word, String definition) async {
    try {
      await _repository.createVocabulary(word, definition);
      loadVocabularies(); // Reload list on success
    } catch (e) {
      emit(VocabularyFailure(e.toString()));
    }
  }
}
```

### Step 3.4: Register Dependencies & Router

#### Dependency Injection (`app/lib/core/di/service_locator.dart`)
Add registration lines:
```dart
import '../../features/vocabulary/data/datasource/vocabulary_datasource.dart';
import '../../features/vocabulary/data/repository/vocabulary_repository.dart';
import '../../features/vocabulary/cubit/vocabulary_cubit.dart';

// Inside setupServiceLocator()
final vocabDatasource = VocabularyDatasource(apiClient);
final vocabRepository = VocabularyRepository(vocabDatasource);
getIt.registerSingleton<VocabularyRepository>(vocabRepository);
getIt.registerSingleton<VocabularyCubit>(VocabularyCubit(vocabRepository));
```

#### Router Setup (`app/lib/app/router/router.dart`)
```dart
import '../../features/vocabulary/view/vocabulary_page.dart';

// Append Route inside GoRouter routes definition:
GoRoute(
  path: '/vocabulary',
  builder: (BuildContext context, GoRouterState state) {
    return const VocabularyPage();
  },
),
```

### Step 3.5: Create UI View (`app/lib/features/vocabulary/view/vocabulary_page.dart`)
```dart
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../../../core/di/service_locator.dart';
import '../cubit/vocabulary_cubit.dart';
import '../cubit/vocabulary_state.dart';

class VocabularyPage extends StatefulWidget {
  const VocabularyPage({super.key});

  @override
  State<VocabularyPage> createState() => _VocabularyPageState();
}

class _VocabularyPageState extends State<VocabularyPage> {
  final _wordController = TextEditingController();
  final _defController = TextEditingController();

  @override
  void dispose() {
    _wordController.dispose();
    _defController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return BlocProvider(
      create: (context) => getIt<VocabularyCubit>()..loadVocabularies(),
      child: Scaffold(
        appBar: AppBar(title: const Text('Vocabulary Notebook')),
        body: Padding(
          padding: const EdgeInsets.all(16.0),
          child: Column(
            children: [
              TextField(
                controller: _wordController,
                decoration: const InputDecoration(labelText: 'Word'),
              ),
              TextField(
                controller: _defController,
                decoration: const InputDecoration(labelText: 'Definition'),
              ),
              const SizedBox(height: 16),
              ElevatedButton(
                onPressed: () {
                  final word = _wordController.text.trim();
                  final def = _defController.text.trim();
                  if (word.isNotEmpty && def.isNotEmpty) {
                    context.read<VocabularyCubit>().addWord(word, def);
                    _wordController.clear();
                    _defController.clear();
                  }
                },
                child: const Text('Add Word'),
              ),
              const SizedBox(height: 24),
              Expanded(
                child: BlocBuilder<VocabularyCubit, VocabularyState>(
                  builder: (context, state) {
                    if (state is VocabularyLoading) {
                      return const Center(child: CircularProgressIndicator());
                    } else if (state is VocabularyLoaded) {
                      final words = state.words;
                      return ListView.builder(
                        itemCount: words.length,
                        itemBuilder: (context, index) {
                          final item = words[index];
                          return Card(
                            margin: const EdgeInsets.symmetric(vertical: 8),
                            color: Theme.of(context).colorScheme.surfaceContainer,
                            child: ListTile(
                              title: Text(item.word, style: const TextStyle(fontWeight: FontWeight.bold)),
                              subtitle: Text(item.definition),
                            ),
                          );
                        },
                      );
                    } else if (state is VocabularyFailure) {
                      return Center(child: Text('Error: ${state.error}'));
                    }
                    return const SizedBox.shrink();
                  },
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
```

Static check and verification:
```bash
cd app && flutter analyze
```

---

This is the complete, standard workflow for full-stack features in the `LangStudy` codebase!
