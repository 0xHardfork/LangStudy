---
name: update-app-feature
description: Guides the agent to modify, optimize, or refactor an existing Flutter mobile app feature. Use this for UI bug fixes, Cubit state adjustments, navigation changes, or performance improvements in the Flutter app.
---

# Update App Feature Skill (Flutter Mobile)

This skill guides the agent to safely and efficiently modify or refactor an existing feature in the `LangStudy` Flutter mobile app.

## Development Workflow

### 1. Impact Assessment
Before modifying any shared widget, Cubit, repository, or `ApiClient` logic:
- Search for all usages of the code being changed across the app codebase.
- Confirm the change will not silently break other pages or features that depend on the same component.
- If modifying a data model's `fromJson`/`toJson`, check every place the model is used for deserialization.

### 2. Cubit & State Modifications
- If adding or removing a state variant in a Cubit's State class, update every `BlocBuilder` and `BlocListener` in the `view/` layer that pattern-matches on the state.
- If an existing `Loaded` state carries new data, ensure the Cubit correctly emits the updated state after fetching.

### 3. UI & Theming
- Always use `Theme.of(context)` for colors and text styles. Never hardcode hex color values.
- If modifying a widget that is used in multiple pages, verify the changes look correct in all contexts.
- Respect the existing dark-mode design of the app.

### 4. Navigation Changes
- If modifying route paths or parameters in `lib/app/router/`, check every `context.go(...)`, `context.push(...)`, and `context.replace(...)` call that references the affected routes.

### 5. Dependency & DI
- If the modification changes the constructor signature of a `Cubit`, `Repository`, or `Datasource`, update the corresponding registration in `lib/core/di/service_locator.dart`.

### 6. Verification
After completing changes, run:
```bash
# Static analysis — must pass with no errors
flutter analyze

# Run tests to catch regressions
flutter test
```
Fix all static analysis errors and test failures before delivering.
