import '../../../../core/network/api_client.dart';
import '../../models/reading_models.dart';

class ReadingDatasource {
  final ApiClient _client;

  ReadingDatasource(this._client);

  Future<ReadingArticle> analyzeText({
    required String title,
    required String text,
  }) async {
    final Map<String, dynamic> data = await _client.post<Map<String, dynamic>>('/reading/analyze', data: {
      'title': title,
      'text': text,
    });
    return ReadingArticle.fromJson(data);
  }

  Future<List<ReadingArticle>> getReadingHistory() async {
    final List data = await _client.get<List<dynamic>>('/reading/history');
    return data.map((i) => ReadingArticle.fromJson(i as Map<String, dynamic>)).toList();
  }

  Future<ReadingArticle> getReadingArticle(int id) async {
    final Map<String, dynamic> data = await _client.get<Map<String, dynamic>>('/reading/article/$id');
    return ReadingArticle.fromJson(data);
  }

  Future<ReadingSentence> regenerateReadingSentence(int sentenceId) async {
    final Map<String, dynamic> data = await _client.post<Map<String, dynamic>>('/reading/sentence/$sentenceId/regenerate');
    return ReadingSentence.fromJson(data);
  }
}
