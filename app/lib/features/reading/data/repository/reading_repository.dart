import '../datasource/reading_datasource.dart';
import '../../models/reading_models.dart';

class ReadingRepository {
  final ReadingDatasource _datasource;

  ReadingRepository(this._datasource);

  Future<ReadingArticle> analyzeText({
    required String title,
    required String text,
  }) {
    return _datasource.analyzeText(title: title, text: text);
  }

  Future<List<ReadingArticle>> getReadingHistory() {
    return _datasource.getReadingHistory();
  }

  Future<ReadingArticle> getReadingArticle(int id) {
    return _datasource.getReadingArticle(id);
  }

  Future<ReadingSentence> regenerateReadingSentence(int sentenceId) {
    return _datasource.regenerateReadingSentence(sentenceId);
  }
}
