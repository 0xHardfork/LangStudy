import 'package:flutter_bloc/flutter_bloc.dart';
import '../data/repository/reading_repository.dart';
import '../models/reading_models.dart';
import 'reading_state.dart';

class ReadingCubit extends Cubit<ReadingState> {
  final ReadingRepository _repository;

  ReadingCubit(this._repository) : super(ReadingInitial());

  Future<void> loadHistory() async {
    emit(ReadingLoading());
    try {
      final list = await _repository.getReadingHistory();
      emit(ReadingLoaded(history: list));
    } catch (e) {
      emit(ReadingError(e.toString().replaceAll('Exception: ', '')));
    }
  }

  Future<void> getReadingArticle(int id) async {
    final currentState = state;
    List<ReadingArticle> history = [];
    if (currentState is ReadingLoaded) {
      history = currentState.history;
    }

    emit(ReadingLoading());
    try {
      final article = await _repository.getReadingArticle(id);
      emit(ReadingLoaded(history: history, currentArticle: article));
    } catch (e) {
      emit(ReadingError(e.toString().replaceAll('Exception: ', '')));
    }
  }

  Future<void> analyzeText({
    required String title,
    required String text,
    required Function() onSuccess,
  }) async {
    final currentState = state;
    if (currentState is! ReadingLoaded) return;

    emit(currentState.copyWith(analyzing: true, error: () => null));
    try {
      final article = await _repository.analyzeText(title: title, text: text);
      final updatedHistory = List<ReadingArticle>.from(currentState.history)..insert(0, article);
      emit(ReadingLoaded(history: updatedHistory, currentArticle: article));
      onSuccess();
    } catch (e) {
      emit(currentState.copyWith(
        analyzing: false,
        error: () => e.toString().replaceAll('Exception: ', ''),
      ));
    }
  }

  Future<void> regenerateReadingSentence(int sentenceId) async {
    final currentState = state;
    if (currentState is! ReadingLoaded || currentState.currentArticle == null) return;

    emit(currentState.copyWith(analyzing: true, error: () => null));
    try {
      final freshSentence = await _repository.regenerateReadingSentence(sentenceId);
      final currentArticle = currentState.currentArticle!;

      final updatedSentences = currentArticle.sentences?.map((s) {
            return s.id == sentenceId ? freshSentence : s;
          }).toList() ??
          [];

      final updatedArticle = ReadingArticle(
        id: currentArticle.id,
        userId: currentArticle.userId,
        title: currentArticle.title,
        rawText: currentArticle.rawText,
        createdAt: currentArticle.createdAt,
        sentences: updatedSentences,
      );

      emit(currentState.copyWith(
        currentArticle: () => updatedArticle,
        analyzing: false,
      ));
    } catch (e) {
      emit(currentState.copyWith(
        analyzing: false,
        error: () => e.toString().replaceAll('Exception: ', ''),
      ));
    }
  }

  void resetCurrentArticle() {
    final currentState = state;
    if (currentState is ReadingLoaded) {
      emit(currentState.copyWith(currentArticle: () => null, error: () => null));
    }
  }
}
