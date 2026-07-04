import '../../../../core/network/api_client.dart';
import '../../models/dialogue_model.dart';

class DialogueDatasource {
  final ApiClient _client;

  DialogueDatasource(this._client);

  Future<List<DialogueType>> getDialogueTypes() async {
    final List data = await _client.get<List<dynamic>>('/dialogue/types');
    return data.map((i) => DialogueType.fromJson(i as Map<String, dynamic>)).toList();
  }

  Future<Dialogue> generateDialogue({
    required String topic,
    required String language,
    required String level,
  }) async {
    final Map<String, dynamic> data = await _client.post<Map<String, dynamic>>('/dialogue/generate', data: {
      'topic': topic,
      'language': language,
      'level': level,
    });
    return Dialogue.fromJson(data);
  }

  Future<DialogueWithProgress> getSharedDialogue({
    required String topic,
    required String language,
    required String level,
  }) async {
    final params = {
      'topic': topic,
      'language': language,
      'level': level,
    };
    final Map<String, dynamic> data = await _client.get<Map<String, dynamic>>('/dialogue/shared', queryParameters: params);
    return DialogueWithProgress.fromJson(data);
  }

  Future<DialogueWithProgress?> getActiveDialogue() async {
    try {
      final Map<String, dynamic> data = await _client.get<Map<String, dynamic>>('/dialogue/active');
      return DialogueWithProgress.fromJson(data);
    } catch (_) {
      return null;
    }
  }

  Future<void> updateDialogueProgress({
    required int dialogueId,
    required int lineIndex,
    required bool completed,
  }) async {
    await _client.put('/dialogue/$dialogueId/progress', data: {
      'current_line_index': lineIndex,
      'is_completed': completed,
    });
  }

  Future<Dialogue> regenerateDialogue({
    required int prevDialogueId,
    required String topic,
    required String language,
    required String level,
    required String hint,
    required String nativeLanguage,
  }) async {
    final Map<String, dynamic> data = await _client.post<Map<String, dynamic>>('/dialogue/regenerate', data: {
      'prev_dialogue_id': prevDialogueId,
      'topic': topic,
      'language': language,
      'level': level,
      'hint': hint,
      'native_language': nativeLanguage,
    });
    return Dialogue.fromJson(data);
  }

  Future<Dialogue> getDialogue(int id) async {
    final Map<String, dynamic> data = await _client.get<Map<String, dynamic>>('/dialogue/$id');
    return Dialogue.fromJson(data);
  }

  Future<Map<String, dynamic>> listDialogues({
    required int page,
    required int pageSize,
    String? search,
  }) async {
    final params = {
      'page': page,
      'page_size': pageSize,
      if (search != null && search.isNotEmpty) 'search': search,
    };
    return _client.get<Map<String, dynamic>>('/dialogue', queryParameters: params);
  }

  Future<void> rejectDialogue(int id) async {
    await _client.post('/dialogue/$id/reject');
  }
}
