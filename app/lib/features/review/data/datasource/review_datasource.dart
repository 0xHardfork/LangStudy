import '../../../../core/network/api_client.dart';
import '../../models/review_model.dart';
import '../../../grammar/models/grammar_model.dart';

class ReviewDatasource {
  final ApiClient _client;

  ReviewDatasource(this._client);

  Future<List<ReviewItem>> getDueReviews() async {
    final List data = await _client.get<List<dynamic>>('/reviews/due');
    return data.map((i) => ReviewItem.fromJson(i as Map<String, dynamic>)).toList();
  }

  Future<List<ReviewItem>> getReviewSchedule() async {
    final List data = await _client.get<List<dynamic>>('/reviews/schedule');
    return data.map((i) => ReviewItem.fromJson(i as Map<String, dynamic>)).toList();
  }

  Future<void> submitDialogueAnswer({
    required int dialogueLineId,
    required bool isCorrect,
  }) async {
    await _client.post('/reviews/answer', data: {
      'dialogue_line_id': dialogueLineId,
      'is_correct': isCorrect,
    });
  }

  Future<List<GrammarQuizReviewDetail>> getDueGrammarReviews() async {
    final List data = await _client.get<List<dynamic>>('/grammar/reviews/due');
    return data.map((i) => GrammarQuizReviewDetail.fromJson(i as Map<String, dynamic>)).toList();
  }

  Future<void> submitGrammarAnswer({
    required int grammarQuizId,
    required bool isCorrect,
  }) async {
    await _client.post('/grammar/quiz/answer', data: {
      'grammar_quiz_id': grammarQuizId,
      'is_correct': isCorrect,
    });
  }
}
