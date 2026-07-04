import '../../../../core/network/api_client.dart';
import '../../models/grammar_model.dart';

class GrammarDatasource {
  final ApiClient _client;

  GrammarDatasource(this._client);

  Future<GrammarArticle> analyzeText({
    required String title,
    required String text,
  }) async {
    final Map<String, dynamic> data = await _client.post<Map<String, dynamic>>('/grammar/analyze', data: {
      'title': title,
      'text': text,
    });
    return GrammarArticle.fromJson(data);
  }

  Future<List<GrammarArticle>> getGrammarHistory() async {
    final List data = await _client.get<List<dynamic>>('/grammar/history');
    return data.map((i) => GrammarArticle.fromJson(i as Map<String, dynamic>)).toList();
  }

  Future<GrammarArticle> getAnalyzedArticle(int id) async {
    final Map<String, dynamic> data = await _client.get<Map<String, dynamic>>('/grammar/article/$id');
    return GrammarArticle.fromJson(data);
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

  Future<GrammarSentence> regenerateGrammarSentence(int sentenceId) async {
    final Map<String, dynamic> data = await _client.post<Map<String, dynamic>>('/grammar/sentence/$sentenceId/regenerate');
    return GrammarSentence.fromJson(data);
  }
}
