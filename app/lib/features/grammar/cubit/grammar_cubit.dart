import 'package:flutter_bloc/flutter_bloc.dart';
import '../data/repository/grammar_repository.dart';
import '../models/grammar_model.dart';
import 'grammar_state.dart';

class GrammarCubit extends Cubit<GrammarState> {
  final GrammarRepository _repository;

  GrammarCubit(this._repository) : super(GrammarInitial());

  Future<void> loadHistory() async {
    emit(GrammarLoading());
    try {
      final list = await _repository.getGrammarHistory();
      emit(GrammarLoaded(history: list));
    } catch (e) {
      emit(GrammarError(e.toString().replaceAll('Exception: ', '')));
    }
  }

  Future<void> getAnalyzedArticle(int id) async {
    final currentState = state;
    List<GrammarArticle> history = [];
    if (currentState is GrammarLoaded) {
      history = currentState.history;
    }

    emit(GrammarLoading());
    try {
      final article = await _repository.getAnalyzedArticle(id);
      emit(GrammarLoaded(history: history, currentArticle: article));
    } catch (e) {
      emit(GrammarError(e.toString().replaceAll('Exception: ', '')));
    }
  }

  Future<void> analyzeText({
    required String title,
    required String text,
    required Function() onSuccess,
  }) async {
    final currentState = state;
    if (currentState is! GrammarLoaded) return;

    emit(currentState.copyWith(analyzing: true, error: () => null));
    try {
      final article = await _repository.analyzeText(title: title, text: text);
      final updatedHistory = List<GrammarArticle>.from(currentState.history)..insert(0, article);
      emit(GrammarLoaded(history: updatedHistory, currentArticle: article));
      onSuccess();
    } catch (e) {
      emit(currentState.copyWith(
        analyzing: false,
        error: () => e.toString().replaceAll('Exception: ', ''),
      ));
    }
  }

  Future<void> submitGrammarAnswer({
    required int grammarQuizId,
    required bool isCorrect,
  }) async {
    try {
      await _repository.submitGrammarAnswer(grammarQuizId: grammarQuizId, isCorrect: isCorrect);
    } catch (_) {}
  }

  Future<void> regenerateGrammarSentence(int sentenceId) async {
    final currentState = state;
    if (currentState is! GrammarLoaded || currentState.currentArticle == null) return;

    emit(currentState.copyWith(analyzing: true, error: () => null));
    try {
      final freshSentence = await _repository.regenerateGrammarSentence(sentenceId);
      final currentArticle = currentState.currentArticle!;

      final updatedSentences = currentArticle.sentences?.map((s) {
            return s.id == sentenceId ? freshSentence : s;
          }).toList() ??
          [];

      final updatedArticle = GrammarArticle(
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
    if (currentState is GrammarLoaded) {
      emit(currentState.copyWith(currentArticle: () => null, error: () => null));
    }
  }
}
