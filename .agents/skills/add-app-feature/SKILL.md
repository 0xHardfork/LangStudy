---
name: add-app-feature
description: Guides the agent to develop a new Flutter mobile app feature, including new pages, Cubit state management, data sources, and repositories. Use this when the user asks to add a new feature or module to the Flutter app.
---

# Add App Feature Skill (Flutter Mobile)

This skill guides the agent to develop a brand-new feature in the `LangStudy` Flutter mobile app to a high standard.

## Development Workflow

### 1. Requirements & Design Alignment
- **Confirm the API contract**: Identify which backend API endpoints this feature depends on. If the backend is not ready, provide Mock data in the Datasource layer to unblock development.
- **Design UI & interactions**: Clarify the page layout, loading states, error display, pull-to-refresh behavior, and dark mode compatibility.

### 2. Feature Module Structure (`lib/features/`)
All new features **must** follow the Clean Architecture structure under `lib/features/<feature_name>/`. Never dump all code into a single file.

```
lib/features/<feature_name>/
  models/           # Data models with fromJson/toJson
  data/
    datasource/     # HTTP requests via ApiClient (Dio)
    repository/     # Data transformation and caching logic
  cubit/            # Cubit class + State class
  view/             # Page-level Widgets (xxx_page.dart)
    widgets/        # Sub-components extracted from the page, only when needed
```

**Model requirements**: Every model that serializes/deserializes data must implement `fromJson` and `toJson`.

**Cubit state requirements**: State classes must cover at least four lifecycle states: `Initial`, `Loading`, `Loaded` (with data), `Failure` (with error message).

**File size limit**: Strictly keep every file under 300 lines. When a page file in `view/` grows too large, extract sub-widgets into a `view/widgets/` subdirectory.

### 3. Dependency Injection & Routing
- **DI Registration**: Register the new `Datasource`, `Repository`, and `Cubit` (if it is a global singleton) in `lib/core/di/service_locator.dart` using `GetIt`.
- **Route Registration**: Register the new page route in `lib/app/router/` using `go_router`. Verify navigation works correctly from all entry points.

### 4. Theme-Aware Styling
- Always use `Theme.of(context)` for colors and text styles. Never hardcode hex color values in new widgets.
- Ensure all new UI respects the existing dark-mode color scheme.

### 5. Verification
Before marking the task done, run:
```bash
# Static analysis — must pass with no errors
flutter analyze

# Run unit and widget tests
flutter test
```
Fix all static analysis errors before delivering.
