import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import '../core/di/service_locator.dart';
import '../features/auth/cubit/auth_cubit.dart';
import '../features/auth/cubit/auth_state.dart';
import '../features/study/cubit/study_cubit.dart';
import '../features/review/cubit/review_cubit.dart';
import '../features/grammar/cubit/grammar_cubit.dart';
import '../features/reading/cubit/reading_cubit.dart';
import 'router/router.dart';

class App extends StatelessWidget {
  const App({super.key});

  @override
  Widget build(BuildContext context) {
    return MultiBlocProvider(
      providers: [
        BlocProvider<AuthCubit>(
          create: (context) => getIt<AuthCubit>()..checkAuth(),
        ),
        BlocProvider<StudyCubit>(
          create: (context) => getIt<StudyCubit>()..loadDialogueTypes(),
        ),
        BlocProvider<ReviewCubit>(
          create: (context) => getIt<ReviewCubit>()..loadReviews(),
        ),
        BlocProvider<GrammarCubit>(
          create: (context) => getIt<GrammarCubit>()..loadHistory(),
        ),
        BlocProvider<ReadingCubit>(
          create: (context) => getIt<ReadingCubit>()..loadHistory(),
        ),
      ],
      child: BlocListener<AuthCubit, AuthState>(
        listener: (context, state) {
          if (state is AuthUnauthenticated) {
            router.go('/login');
          }
        },
        child: MaterialApp.router(
          title: 'LangStudy',
          debugShowCheckedModeBanner: false,
          theme: ThemeData(
            useMaterial3: true,
            colorScheme: ColorScheme.fromSeed(
              seedColor: Colors.deepPurple,
              brightness: Brightness.dark,
            ),
            scaffoldBackgroundColor: const Color(0xFF020617), // Matching slate-950 bg
          ),
          routerConfig: router,
          localizationsDelegates: const [
            GlobalMaterialLocalizations.delegate,
            GlobalWidgetsLocalizations.delegate,
            GlobalCupertinoLocalizations.delegate,
          ],
          supportedLocales: const [
            Locale('en'),
            Locale('zh'),
            Locale('ja'),
          ],
        ),
      ),
    );
  }
}
