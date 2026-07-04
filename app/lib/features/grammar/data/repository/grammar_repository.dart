import '../datasource/grammar_datasource.dart';
import '../../models/grammar_model.dart';

class GrammarRepository {
  final GrammarDatasource _datasource;

  GrammarRepository(this._datasource);

  Future<GrammarArticle> analyzeText({
    required String title,
    required String text,
  }) {
    return _datasource.analyzeText(title: title, text: text);
  }

  Future<List<GrammarArticle>> getGrammarHistory() {
    return _datasource.getGrammarHistory();
  }

  Future<GrammarArticle> getAnalyzedArticle(int id) {
    return _datasource.getAnalyzedArticle(id);
  }

  Future<void> submitGrammarAnswer({
    required int grammarQuizId,
    required bool isCorrect,
  }) {
    return _datasource.submitGrammarAnswer(grammarQuizId: grammarQuizId, isCorrect: isCorrect);
  }

  Future<GrammarSentence> regenerateGrammarSentence(int sentenceId) {
    return _datasource.regenerateGrammarSentence(sentenceId);
  }
}
