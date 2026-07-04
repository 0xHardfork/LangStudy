import 'package:flutter_test/flutter_test.dart';
import 'package:get_it/get_it.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:langstudy/app/app.dart';
import 'package:langstudy/features/auth/cubit/auth_cubit.dart';
import 'package:langstudy/features/auth/cubit/auth_state.dart';
import 'package:langstudy/features/study/cubit/study_cubit.dart';
import 'package:langstudy/features/study/cubit/study_state.dart';
import 'package:langstudy/features/review/cubit/review_cubit.dart';
import 'package:langstudy/features/review/cubit/review_state.dart';
import 'package:langstudy/features/grammar/cubit/grammar_cubit.dart';
import 'package:langstudy/features/grammar/cubit/grammar_state.dart';

// ─── Fake Cubits using noSuchMethod fallback ────────────────────────────────

class FakeAuthCubit extends Cubit<AuthState> implements AuthCubit {
  FakeAuthCubit() : super(AuthUnauthenticated());

  @override
  Future<void> checkAuth() async {}

  @override
  dynamic noSuchMethod(Invocation invocation) => null;
}

class FakeStudyCubit extends Cubit<StudyState> implements StudyCubit {
  FakeStudyCubit() : super(StudyState(dialogueTypes: []));

  @override
  Future<void> loadDialogueTypes() async {}

  @override
  dynamic noSuchMethod(Invocation invocation) => null;
}

class FakeReviewCubit extends Cubit<ReviewState> implements ReviewCubit {
  FakeReviewCubit() : super(ReviewInitial());

  @override
  Future<void> loadReviews() async {}

  @override
  dynamic noSuchMethod(Invocation invocation) => null;
}

class FakeGrammarCubit extends Cubit<GrammarState> implements GrammarCubit {
  FakeGrammarCubit() : super(GrammarInitial());

  @override
  Future<void> loadHistory() async {}

  @override
  dynamic noSuchMethod(Invocation invocation) => null;
}

void main() {
  testWidgets('App smoke test', (WidgetTester tester) async {
    // Mock SharedPreferences
    SharedPreferences.setMockInitialValues({});
    final prefs = await SharedPreferences.getInstance();

    // Register Fake Cubits in GetIt
    final getIt = GetIt.instance;
    getIt.registerSingleton<SharedPreferences>(prefs);
    getIt.registerSingleton<AuthCubit>(FakeAuthCubit());
    getIt.registerSingleton<StudyCubit>(FakeStudyCubit());
    getIt.registerSingleton<ReviewCubit>(FakeReviewCubit());
    getIt.registerSingleton<GrammarCubit>(FakeGrammarCubit());

    // Build our app and trigger a frame.
    await tester.pumpWidget(const App());
    await tester.pumpAndSettle(); // Wait for routing animations to settle

    // Verify that the login page content (e.g. login button) is displayed.
    expect(find.text('登录'), findsOneWidget);
  });
}
