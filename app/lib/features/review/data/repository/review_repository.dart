import '../datasource/review_datasource.dart';
import '../../models/review_model.dart';
import '../../../grammar/models/grammar_model.dart';

class ReviewRepository {
  final ReviewDatasource _datasource;

  ReviewRepository(this._datasource);

  Future<List<ReviewItem>> getDueReviews() {
    return _datasource.getDueReviews();
  }

  Future<List<ReviewItem>> getReviewSchedule() {
    return _datasource.getReviewSchedule();
  }

  Future<void> submitDialogueAnswer({
    required int dialogueLineId,
    required bool isCorrect,
  }) {
    return _datasource.submitDialogueAnswer(dialogueLineId: dialogueLineId, isCorrect: isCorrect);
  }

  Future<List<GrammarQuizReviewDetail>> getDueGrammarReviews() {
    return _datasource.getDueGrammarReviews();
  }

  Future<void> submitGrammarAnswer({
    required int grammarQuizId,
    required bool isCorrect,
  }) {
    return _datasource.submitGrammarAnswer(grammarQuizId: grammarQuizId, isCorrect: isCorrect);
  }
}
