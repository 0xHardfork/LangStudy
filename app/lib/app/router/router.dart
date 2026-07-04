import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../../core/di/service_locator.dart';
import '../../features/auth/view/login_page.dart';
import '../../features/auth/view/profile_page.dart';
import '../../features/home/view/home_page.dart';
import '../../features/dialogue/view/dialogue_preview_page.dart';
import '../../features/study/view/fill_blank_exercise_page.dart';
import '../../features/review/view/review_page.dart';
import '../../features/grammar/view/grammar_dashboard_page.dart';
import '../../features/grammar/view/grammar_article_detail_page.dart';
import '../../features/history/view/learning_history_page.dart';

final GoRouter router = GoRouter(
  initialLocation: '/',
  redirect: (BuildContext context, GoRouterState state) {
    final prefs = getIt<SharedPreferences>();
    final token = prefs.getString('auth_token');
    final loggingIn = state.matchedLocation == '/login';

    if (token == null || token.isEmpty) {
      return loggingIn ? null : '/login';
    }

    if (loggingIn) {
      return '/';
    }

    return null;
  },
  routes: <RouteBase>[
    GoRoute(
      path: '/login',
      builder: (BuildContext context, GoRouterState state) {
        return const LoginPage();
      },
    ),
    GoRoute(
      path: '/',
      builder: (BuildContext context, GoRouterState state) {
        return const HomePage();
      },
    ),
    GoRoute(
      path: '/profile',
      builder: (BuildContext context, GoRouterState state) {
        return const ProfilePage();
      },
    ),
    GoRoute(
      path: '/preview',
      builder: (BuildContext context, GoRouterState state) {
        return const DialoguePreviewPage();
      },
    ),
    GoRoute(
      path: '/fill-blank',
      builder: (BuildContext context, GoRouterState state) {
        return const FillBlankExercisePage();
      },
    ),
    GoRoute(
      path: '/review',
      builder: (BuildContext context, GoRouterState state) {
        return const ReviewPage();
      },
    ),
    GoRoute(
      path: '/grammar',
      builder: (BuildContext context, GoRouterState state) {
        return const GrammarDashboardPage();
      },
      routes: [
        GoRoute(
          path: 'article/:id',
          builder: (BuildContext context, GoRouterState state) {
            final id = int.tryParse(state.pathParameters['id'] ?? '') ?? 0;
            return GrammarArticleDetailPage(articleId: id);
          },
        ),
      ],
    ),
    GoRoute(
      path: '/history',
      builder: (BuildContext context, GoRouterState state) {
        return const LearningHistoryPage();
      },
    ),
  ],
);
