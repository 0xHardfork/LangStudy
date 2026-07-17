import '../datasource/subtitle_datasource.dart';
import '../../models/subtitle_models.dart';

class SubtitleRepository {
  final SubtitleDatasource _datasource;

  SubtitleRepository(this._datasource);

  Future<SubtitleTopic> uploadSubtitle({
    required String filePath,
    required String fileName,
    required String title,
    required String targetLanguage,
    required String nativeLanguage,
  }) {
    return _datasource.uploadSubtitle(
      filePath: filePath,
      fileName: fileName,
      title: title,
      targetLanguage: targetLanguage,
      nativeLanguage: nativeLanguage,
    );
  }

  Future<List<SubtitleTopic>> getSubtitleHistory() {
    return _datasource.getSubtitleHistory();
  }

  Future<SubtitleTopic> getSubtitleTopic(int id) {
    return _datasource.getSubtitleTopic(id);
  }

  Future<SubtitleSentence> regenerateSubtitleSentence(int sentenceId) {
    return _datasource.regenerateSubtitleSentence(sentenceId);
  }

  Future<void> deleteSubtitleTopic(int id) {
    return _datasource.deleteSubtitleTopic(id);
  }

  Future<void> processSubtitleChunk(int chunkId) {
    return _datasource.processSubtitleChunk(chunkId);
  }

  Future<void> processSubtitleTopic(int topicId) {
    return _datasource.processSubtitleTopic(topicId);
  }

  Future<void> mergeSubtitleTopic(int topicId) {
    return _datasource.mergeSubtitleTopic(topicId);
  }

  Future<void> shareSubtitleTopic(int topicId) {
    return _datasource.shareSubtitleTopic(topicId);
  }

  Future<void> unshareSubtitleTopic(int topicId) {
    return _datasource.unshareSubtitleTopic(topicId);
  }

  Future<List<SubtitleTopic>> getSharedSubtitles() {
    return _datasource.getSharedSubtitles();
  }
}
