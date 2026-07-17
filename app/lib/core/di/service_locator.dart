import 'package:get_it/get_it.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../network/api_client.dart';
import '../../features/auth/data/datasource/auth_datasource.dart';
import '../../features/auth/data/repository/auth_repository.dart';
import '../../features/auth/cubit/auth_cubit.dart';
import '../../features/dialogue/data/datasource/dialogue_datasource.dart';
import '../../features/dialogue/data/repository/dialogue_repository.dart';
import '../../features/study/cubit/study_cubit.dart';
import '../../features/review/data/datasource/review_datasource.dart';
import '../../features/review/data/repository/review_repository.dart';
import '../../features/review/cubit/review_cubit.dart';
import '../../features/grammar/data/datasource/grammar_datasource.dart';
import '../../features/grammar/data/repository/grammar_repository.dart';
import '../../features/grammar/cubit/grammar_cubit.dart';
import '../../features/reading/data/datasource/reading_datasource.dart';
import '../../features/reading/data/repository/reading_repository.dart';
import '../../features/reading/cubit/reading_cubit.dart';
import '../../features/subtitle/data/datasource/subtitle_datasource.dart';
import '../../features/subtitle/data/repository/subtitle_repository.dart';
import '../../features/subtitle/cubit/subtitle_cubit.dart';

final getIt = GetIt.instance;

Future<void> setupServiceLocator() async {
  final prefs = await SharedPreferences.getInstance();
  getIt.registerSingleton<SharedPreferences>(prefs);

  final apiClient = ApiClient(prefs);
  getIt.registerSingleton<ApiClient>(apiClient);

  // Auth Feature
  final authDatasource = AuthDatasource(apiClient);
  final authRepository = AuthRepository(authDatasource, prefs);
  getIt.registerSingleton<AuthRepository>(authRepository);
  getIt.registerSingleton<AuthCubit>(AuthCubit(authRepository));

  // Dialogue Feature
  final dialogueDatasource = DialogueDatasource(apiClient);
  final dialogueRepository = DialogueRepository(dialogueDatasource);
  getIt.registerSingleton<DialogueRepository>(dialogueRepository);
  getIt.registerSingleton<StudyCubit>(StudyCubit(dialogueRepository));

  // Review Feature
  final reviewDatasource = ReviewDatasource(apiClient);
  final reviewRepository = ReviewRepository(reviewDatasource);
  getIt.registerSingleton<ReviewRepository>(reviewRepository);
  getIt.registerSingleton<ReviewCubit>(ReviewCubit(reviewRepository));

  // Grammar Feature
  final grammarDatasource = GrammarDatasource(apiClient);
  final grammarRepository = GrammarRepository(grammarDatasource);
  getIt.registerSingleton<GrammarRepository>(grammarRepository);
  getIt.registerSingleton<GrammarCubit>(GrammarCubit(grammarRepository));

  // Reading Feature
  final readingDatasource = ReadingDatasource(apiClient);
  final readingRepository = ReadingRepository(readingDatasource);
  getIt.registerSingleton<ReadingRepository>(readingRepository);
  getIt.registerSingleton<ReadingCubit>(ReadingCubit(readingRepository));

  // Subtitle Feature
  final subtitleDatasource = SubtitleDatasource(apiClient);
  final subtitleRepository = SubtitleRepository(subtitleDatasource);
  getIt.registerSingleton<SubtitleRepository>(subtitleRepository);
  getIt.registerSingleton<SubtitleCubit>(SubtitleCubit(subtitleRepository));
}
