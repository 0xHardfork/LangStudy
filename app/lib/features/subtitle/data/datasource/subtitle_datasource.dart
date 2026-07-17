import 'package:dio/dio.dart';
import '../../../../core/network/api_client.dart';
import '../../models/subtitle_models.dart';

class SubtitleDatasource {
  final ApiClient _client;

  SubtitleDatasource(this._client);

  Future<SubtitleTopic> uploadSubtitle({
    required String filePath,
    required String fileName,
    required String title,
    required String targetLanguage,
    required String nativeLanguage,
  }) async {
    final formData = FormData.fromMap({
      'file': await MultipartFile.fromFile(filePath, filename: fileName),
      'title': title,
      'target_language': targetLanguage,
      'native_language': nativeLanguage,
    });

    final Map<String, dynamic> data = await _client.post<Map<String, dynamic>>(
      '/subtitle/upload',
      data: formData,
    );
    return SubtitleTopic.fromJson(data);
  }

  Future<List<SubtitleTopic>> getSubtitleHistory() async {
    final List data = await _client.get<List<dynamic>>('/subtitle/history');
    return data.map((i) => SubtitleTopic.fromJson(i as Map<String, dynamic>)).toList();
  }

  Future<SubtitleTopic> getSubtitleTopic(int id) async {
    final Map<String, dynamic> data = await _client.get<Map<String, dynamic>>('/subtitle/topic/$id');
    return SubtitleTopic.fromJson(data);
  }

  Future<SubtitleSentence> regenerateSubtitleSentence(int sentenceId) async {
    final Map<String, dynamic> data = await _client.post<Map<String, dynamic>>('/subtitle/sentence/$sentenceId/regenerate');
    return SubtitleSentence.fromJson(data);
  }

  Future<void> deleteSubtitleTopic(int id) async {
    await _client.delete('/subtitle/topic/$id');
  }

  Future<void> processSubtitleChunk(int chunkId) async {
    await _client.post('/subtitle/chunk/$chunkId/process');
  }

  Future<void> processSubtitleTopic(int topicId) async {
    await _client.post('/subtitle/topic/$topicId/process');
  }

  Future<void> mergeSubtitleTopic(int topicId) async {
    await _client.post('/subtitle/topic/$topicId/merge');
  }

  Future<void> shareSubtitleTopic(int topicId) async {
    await _client.post('/subtitle/topic/$topicId/share');
  }

  Future<void> unshareSubtitleTopic(int topicId) async {
    await _client.post('/subtitle/topic/$topicId/unshare');
  }

  Future<List<SubtitleTopic>> getSharedSubtitles() async {
    final List data = await _client.get<List<dynamic>>('/subtitle/shared');
    return data.map((i) => SubtitleTopic.fromJson(i as Map<String, dynamic>)).toList();
  }
}
