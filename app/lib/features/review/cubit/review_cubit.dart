import 'package:flutter_bloc/flutter_bloc.dart';
import '../data/repository/review_repository.dart';
import 'review_state.dart';

class ReviewCubit extends Cubit<ReviewState> {
  final ReviewRepository _repository;

  ReviewCubit(this._repository) : super(ReviewInitial());

  Future<void> loadReviews() async {
    emit(ReviewLoading());
    try {
      final due = await _repository.getDueReviews();
      final all = await _repository.getReviewSchedule();
      final grammar = await _repository.getDueGrammarReviews();
      emit(ReviewLoaded(
        dueReviews: due,
        allReviews: all,
        dueGrammarReviews: grammar,
      ));
    } catch (e) {
      emit(ReviewError(e.toString().replaceAll('Exception: ', '')));
    }
  }

  Future<void> submitDialogueAnswer({
    required int dialogueLineId,
    required bool isCorrect,
  }) async {
    try {
      await _repository.submitDialogueAnswer(dialogueLineId: dialogueLineId, isCorrect: isCorrect);
    } catch (_) {}
  }

  Future<void> submitGrammarAnswer({
    required int grammarQuizId,
    required bool isCorrect,
  }) async {
    try {
      await _repository.submitGrammarAnswer(grammarQuizId: grammarQuizId, isCorrect: isCorrect);
    } catch (_) {}
  }
}
