# LangStudy Mobile (Flutter Client)

This directory contains the mobile application for **LangStudy**, built with Flutter. It shares the same business rules as the React-based web client but is tailored for iOS and Android platforms with interactive chat bubble interfaces, audio streaming support, and localized settings.

---

## 🛠 Developer Commands

Use standard Flutter CLI commands in this directory to manage packages, analyze codebase health, run tests, and spin up hot-reloaded development sessions:

| Command | Target | Description |
| :--- | :--- | :--- |
| `flutter pub get` | All | Downloads and updates all package dependencies listed in `pubspec.yaml`. |
| `flutter run -t lib/main_dev.dart` | **Development** | **Local Run**: Launches the app on your simulator or device connected to the local development backend (`http://localhost:8080`). |
| `flutter run -t lib/main_prod.dart` | **Production** | **Production Run**: Launches the app connected to the remote production backend APIs. |
| `flutter analyze` | Code Quality | Executes static analysis checks on Dart files. |
| `flutter test` | Testing | Runs all widget and unit tests inside the `test/` directory. |

---

## 🧑‍💻 Architecture Conventions

The app complies with a structured **Clean Architecture** layout. When implementing a new feature or modifying existing components, respect these directory boundaries:

### 1. Data Layer (`lib/features/<name>/data/`)
Contains direct network adapters and storage mappings:
- **Datasource** (`data/datasource/`): Makes API network calls using the unified `ApiClient` wrapper.
- **Repository** (`data/repository/`): Manages local and remote caching priorities.

### 2. State & Business Layer (`lib/features/<name>/cubit/`)
Houses logic state flows using `flutter_bloc`'s lightweight `Cubit` controllers:
- **Cubit**: Emits events, accepts user triggers, and interacts with repositories.
- **State**: Declares fields (loading flags, lists, active entities) modeled on current UI states.

### 3. Presentation Layer (`lib/features/<name>/view/`)
Contains widgets and views:
- **View**: Displays interactive forms, cards, and dashboards.
- **Widgets**: Reusable visual atoms specific to this module.

### 4. Shared Utilities (`lib/shared/`)
Holds cross-feature assets:
- **Widgets**: Reusable global views like [audio_player_control.dart](file:///Users/peigen/Documents/dev/0xHardfork/LangStudy/app/lib/shared/widgets/audio_player_control.dart).
- **Utils**: Universal constant mappings (e.g. flag emojis, localized labels in [constants.dart](file:///Users/peigen/Documents/dev/0xHardfork/LangStudy/app/lib/shared/utils/constants.dart)).

---

## 🔒 Multi-Environment Configurations

- **AppConfig**: Define backend addresses, timeout durations, and client profiles in [app_config.dart](file:///Users/peigen/Documents/dev/0xHardfork/LangStudy/app/lib/core/config/app_config.dart).
- **Target Entries**: Do **not** use `main.dart` directly for custom API hosts. Instead:
  - Run `main_dev.dart` for local database sync and sandbox APIs.
  - Run `main_prod.dart` for production deployment.

---

## 🎯 Onboarding Test Suite

Always verify that your code changes compile and preserve existing unit behaviors before submitting code changes:
- Mock dependencies via Dart's `noSuchMethod` fallback system inside `test/widget_test.dart`.
- Run `flutter test` to ensure all widgets build correctly.
